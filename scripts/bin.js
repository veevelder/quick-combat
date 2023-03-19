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
						//actor.update({"system.attributes.initiative.ability": inits})
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
	async save(stop=false) {
		let playlists = []
		//list old playlists
		game.playlists.playing.forEach(function(playing) {
			var track_ids = playing.sounds.filter(a => a.playing == true).map(a => a.id)
			playlists.push({id:playing.id,track_ids:track_ids})
			//if a new playlist was given stop the old ones
			if (stop) {
				console.debug(`quick-combat | stopping old playlist ${playing.name}`)
				playing.stopAll()
			}
		});
		game.settings.set("quick-combat", "oldPlaylist", playlists)
	}

	async start(playlist) {
		if (playlist && playlist.sounds.size > 0) {
			await this.save(true)
			game.settings.set("quick-combat", "combatPlaylist", playlist.id)
			console.log(`quick-combat | starting combat playlist ${playlist.name}`)
			playlist.playAll()
		}
		else {
			await this.save(false)
			console.debug("quick-combat | setting no playlist to start")
			game.settings.set("quick-combat", "combatPlaylist", null)
		}
	}

	get(fanfare = false, pickOne = false) {
		//get scene playlists
		let scene = game.scenes.active.id
		console.debug(`quick-combat | getting playlist for scene ${scene} fanfare: ${fanfare} pickOne: ${pickOne}`)
		let playlists = []
		//get scene playlists
		playlists = game.settings.get("quick-combat", "playlists").filter(a => a.scene == scene && a.fanfare == fanfare)
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
			console.debug(`quick-combat | picking single playlist ${a} from group`)
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
	console.debug("quick-combat | getting player tokens skipping Pets/Summons")
	var tokens = canvas.tokens.controlled.filter(t => !t.inCombat).filter(t => t.actor.items.filter(i => i.name == "Pet" || i.name == "Summon").length == 0).map(t => {
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
			combat = await cls.create({scene: canvas.scene.id, active: true}, {render: !tokens.length});
		} else {
			ui.notifications.warn("COMBAT.NoneActive", {localize: true});
			combat = null
		}
	}
	//if there is a combat created
	if (combat != null) {
		// Process each controlled token, as well as the reference token
		console.debug("quick-combat | adding combatants to combat")
		await combat.createEmbeddedDocuments("Combatant", tokens)
	}
	//if no combat was created something went wrong and return
	else {
		return false
	}
	return true
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
		await startCombat()
	}
}