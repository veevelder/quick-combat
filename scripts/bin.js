//socket functions
export let socket;

export async function ask_initiative(npc_options, actor_id) {
	return new Promise((resolve, reject) => {
		var actor = game.actors.get(actor_id)
		new Dialog({
			title: game.i18n.localize("QuickCombat.PF2E.title"),
			content: `${actor.name}</br><select id='inits'>${npc_options}</select>`,
			buttons: {
				button: {
					label: game.i18n.localize("QuickCombat.PF2E.updateButton"),
					icon: "<i class='fas fa-check'></i>",
					callback: async  (html) => {
						var inits = html.find("select#inits").find(":selected").val()
						console.debug(`quick-combat | updating ${actor.name} initiative to ${inits}`)
						resolve(inits)
					}
				}
			},
		}).render(true);
	})
}

Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerModule("quick-combat");
	socket.register("ask_initiative", ask_initiative);
});

//playlist functions
export class PlaylistHandler {
	async stop(playlist) {
		let playlists = game.playlists.playing

		//if playlist is defined stop single otherwise stop all
		if (playlist) {
			playlists = playlists.filter(a => a.id == playlist)
		}

		playlists.forEach(function(playing) {
			console.debug(`quick-combat | stopping old playlist ${playing.name}`)
			playing.stopAll()
		});
	}

	async save() {
		let playlists = []
		//list old playlists
		game.playlists.playing.forEach(function(playing) {
			//check to see if need to save track ids
			var track_id = ""
			const restart = game.settings.get("quick-combat", "playlistRestart")
			if (restart) {
				track_id = playing.sounds.filter(a => a.playing == true).map(a => a.id)[0]
			}
			playlists.push({id:playing.id,track_id:track_id})
		});
		game.settings.set("quick-combat", "oldPlaylist", playlists)
	}

	async start_combat(playlist) {
		if (playlist && playlist.sounds.size > 0) {
			await this.save()
			await this.stop()
			console.log(`quick-combat | starting combat playlist ${playlist.name}`)
			// reshuffel playlist
			await playlist.update({mode:playlist.mode})
			playlist.playAll()
		}
		else {
			await this.save()
			console.debug("quick-combat | setting no playlist to start")
		}
	}

	async start_old() {
		//get the old playlist setting
		let playlists = game.settings.get("quick-combat", "oldPlaylist")
		//set the old playlist setting to null
		game.settings.set("quick-combat", "oldPlaylist", null)

		//if nothing was set then return
		if (playlists) {
			//get a list of old playlists that are not currently playing
			var oldPlaylists = []
			playlists.forEach(a => {
				var p = game.playlists.get(a.id)
				if (!p.playing) {
					oldPlaylists.push(p)
				}
			})

			if (oldPlaylists.length != 0) {
				//stop other playslist
				this.stop()

				//get old playlist track id
				oldPlaylists.forEach(async function(a) {
					// reshuffel playlist
					await a.update({mode:a.mode})

					//get old playlist track ids
					let track_id = playlists.find(b => b.id == a.id).track_id
					if (track_id) {
						console.debug(`quick-combat | starting old playlist '${a.name}' track '${track_id}'`)
						a.playSound(a.sounds.get(track_id))
					}
					//if none then just start the playlist again
					else {
						console.debug(`quick-combat | starting old playlist '${a.name}'`)
						a.playAll();
					}
				})
			}
		}
		else {
			console.warn("quick-combat | no old playlists found, skipping")
		}
	}

	async start_fanfare() {
		let fanfare = this.get(true, true)
		if (fanfare) {
			//stop all playlists
			this.stop()
			console.debug(`quick-combat | starting fanfare playlist ${fanfare.name}`)
			var items = Array.from(fanfare.sounds);
			if (items.length > 0) {
				var item = items[Math.floor(Math.random()*items.length)];
				console.debug(`quick-combat | starting fanfare track ${item.name}`)
				fanfare.playSound(item);
				//set fanfare setting
				game.settings.set("quick-combat", "fanfarePlaylist", fanfare.id)
				return true
			}
			else {
				//no fanfare items to play then just start the old playlist
				console.warn("quick-combat | fanfare playlist has no items")
				game.settings.set("quick-combat", "fanfarePlaylist", null)
				return false
			}
		}
		else {
			game.settings.set("quick-combat", "fanfarePlaylist", null)
			return false
		}
	}

	get(fanfare = false, pickOne = false) {
		//get scene playlists
		let scene = game.scenes.active?.id
		console.debug(`quick-combat | getting playlist for scene ${scene} fanfare: ${fanfare} pickOne: ${pickOne}`)
		let playlists = []
		//get scene playlists
		playlists = game.settings.get("quick-combat", "playlists").filter(a => (a.scene == scene || a.scene == "") && a.fanfare == fanfare)
		//if not scene playlists get all scenes
		if (playlists.length == 0) {
			console.debug("quick-combat | no scene playlist found looking for all scenes")
			playlists = game.settings.get("quick-combat", "playlists").filter(a => a.scene == "" && a.fanfare == fanfare)
		}
		//if still no playlists then return None
		if (playlists.length == 0) {
			console.log("quick-combat | no eligible playlist was found")
			return null
		}
		//get the playlist object
		if (pickOne) {
			//select a random playlist
			let a = game.playlists.get(playlists[Math.floor(Math.random()*playlists.length)].id)
			console.debug("quick-combat | picking single playlist from group", a)
			return a
		}
		else {
			let a = []
			for (var i = 0; i < playlists.length; i++) {
				var tmp = game.playlists.get(playlists[i].id)
				a.push(tmp)
			}
			console.debug("quick-combat | all playlists", a)
			return a
		}
	}
}

export async function addPlayers() {
	//check if GM has any selected tokens
	if (canvas.tokens.controlled.length === 0) {
		ui.notifications.error(game.i18n.localize("QuickCombat.KeyError"));
		return false
	}		
	console.debug("quick-combat | getting player tokens")
	var tokens = canvas.tokens.controlled.filter(t => !t.inCombat).map(t => {
		return {
			tokenId: t.id,
			sceneId: t.scene.id,
			actorId: t.document.actorId,
			hidden: t.document.hidden
		}
	});
	//render combat
	//rip off  async toggleCombat(state=true, combat=null, {token=null}={}) from  base game line ~36882
	var combat = game.combats.viewed;
	if (!combat) {
		if (game.user.isGM) {
			console.debug("quick-combat | creating new combat")
			const cls = getDocumentClass("Combat");
			combat = await cls.create({scene: canvas.scene.id, active: true}, {render: true});
		} else {
			ui.notifications.warn("COMBAT.NoneActive", {localize: true});
			combat = null
		}
	}
	return await combat.createEmbeddedDocuments("Combatant", tokens)
}

export function await_inits(initiative_mode) {
	//wait for every token to roll initiative before starting combat
	//depending on initiate mode select only to correct combatants to monitor
	var combatants = game.combat.combatants
	console.debug("quick-combat | awaiting for all initiates")
	//npc only
	if (initiative_mode == "npc") {
		combatants = combatants.filter(i => i.isNPC)
	}
	//pc only
	else if (initiative_mode == "pc") {
		combatants = combatants.filter(i => !i.isNPC)
	}
	var done_rolling = combatants.map(i => i.initiative).every(i => typeof(i) === "number")
	if (done_rolling) {
		clearInterval(window.initInterval)
		console.debug("quick-combat | updating first round turn order")
		game.combat.update({"turn": 0})
	}
}

export async function startCombat() {
	//start the combat as long as its not OSE
	if (CONFIG.hasOwnProperty("OSE")) {
		console.debug("quick-combat | skipping combat start for OSE")
		return
	}
	console.log("quick-combat | starting combat")
	await game.combat.startCombat();
}

export async function endCombat() {
	console.debug("quick-combat | combat found stopping combat")
	game.combat.endCombat();
}

//if hotkey was pressed create combat, add combatants, start combat
export async function hotkey() {
	console.debug("quick-combat | combat hotkey pressed")
	if (game.combat) {
		endCombat()
	}
	else {
		if (!await addPlayers()) {
			console.log("quick-combat | something went wrong adding tokens to combat tracker")
			return
		}
		console.log("quick-combat | done adding players")
		await startCombat()
	}
}
