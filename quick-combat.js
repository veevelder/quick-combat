async function quickcombat() {
	console.debug("quick-combat | starting combat")
	//check if combat tracker has combatants
	if(game.combat && game.combat.combatants.length > 0) {
		game.combat.startCombat();
	}
	//check if GM has any selected tokens
	else if (canvas.tokens.controlled.length === 0) {
		ui.notifications.error(game.i18n.localize("QuickCombat.KeyError"));
	}
	else {
		// Reference the combat encounter displayed in the Sidebar if none was provided
		var combat = ui.combat.combat;
		if ( !combat ) {
			if ( game.user.isGM ) {
				console.debug("quick-combat | creating new combat")
				combat = await game.combats.documentClass.create({scene: canvas.scene.id, active: true});
			}
			else {
				return ui.notifications.warn(game.i18n.localize("COMBAT.NoneActive"));
			}
		}
		else {
			combat = game.combat;
		}

		console.debug("quick-combat | getting player tokens skipping Pets")
		var tokens = canvas.tokens.controlled.filter(t => t.inCombat === false).filter(function(token) {
			if (token.actor.data.items.filter(c => c.name == "Pet").length == 0) {
				return token
			}
		});
		
		// Process each controlled token, as well as the reference token
		const createData = tokens.map(t => {return {tokenId: t.id, hidden: t.data.hidden}});
		console.debug("quick-combat | adding combatants to combat")
		await combat.createEmbeddedDocuments("Combatant", createData)
		console.log("quick-combat | rolling initiatives for NPCs")
		await combat.rollNPC()
		//check for PC roll option
		if (game.settings.get("quick-combat", "npcroll")) {
			return;
		}
		console.log("quick-combat | rolling initiatives for PCs")
		//roll all PCs that haven't rolled initiative yet
		await combat.rollInitiative(combat.combatants.filter(a => a.actor.hasPlayerOwner).filter(a => !a.initiative).map(a => a.id))
		console.log("quick-combat | starting combat")
		await combat.startCombat();
	}
}

Hooks.on("init", () => {
	console.debug("quick-combat | register keybind settings")
	game.keybindings.register("quick-combat", "key", {
		name: "QuickCombat.Keybind",
		hint: "QuickCombat.KeybindHint",
		editable: [
			{
				key: "C",
				modifiers: ["Alt"]
			}
		],
		onDown: () => {
			console.debug("quick-combat | combat hotkey pressed")
			if (game.combat) {
				console.debug("quick-combat | combat found stopping combat")
				game.combat.endCombat();
			}
			else {
				var buttons = {
					button1: {
						label: game.i18n.localize("QuickCombat.CombatButton"),
						callback: () => {
							console.debug("quick-combat | setting combat playlist to start")
							game.settings.set("quick-combat", "combatPlaylist", game.settings.get("quick-combat", "playlist"))
							quickcombat()
						},
						icon: `<i class="fas fa-music"></i>`
					},
					button2: {
						label: game.i18n.localize("QuickCombat.NoneButton"),
						callback: () => {
							console.debug("quick-combat | setting no playlist to start")
							game.settings.set("quick-combat", "combatPlaylist", null)
							quickcombat()
							
						},
						icon: `<i class="fas fa-volume-mute"></i>`
					}
				}

				//check if boss playlist has been set if so add button otherwise dont
				let playlist_obj = game.settings.get("quick-combat", "boss-playlist")
				let playlist = String(playlist_obj)
				if (!(playlist_obj && Object.keys(playlist_obj).length === 0 && Object.getPrototypeOf(playlist_obj) === Object.prototype) && playlist != "None") {
					buttons.button3 = {
						label: game.i18n.localize("QuickCombat.BossButton"),
						callback: () => {
							console.debug("quick-combat | setting boss playlist to start")
							game.settings.set("quick-combat", "combatPlaylist", game.settings.get("quick-combat", "boss-playlist"))
							quickcombat()
		
						},
						icon: `<i class="fas fa-skull-crossbones"></i>`
					}
				}

				new Dialog({
					title: game.i18n.localize("QuickCombat.PlaylistWindowTitle"),
					content: game.i18n.localize("QuickCombat.PlaylistWindowDescription"),
					buttons: buttons
				}).render(true);
			}
		},
		restricted: true, //gmonly
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});
});

Hooks.on("ready", () => {
	console.debug("quick-combat | register settings")
	let playlists = {"None":"None"}
	game.playlists.contents.map(x => playlists[x.data.name] = x.data.name)
	// module settings
	game.settings.register("quick-combat", "playlist", {
		name: "QuickCombat.Playlist",
		hint: "QuickCombat.PlaylistHint",
		scope: "world",
		config: true,
		choices: playlists,
	});

	game.settings.register("quick-combat", "fanfare-playlist", {
		name: "QuickCombat.FanfarePlaylist",
		hint: "QuickCombat.FanfarePlaylistHint",
		scope: "world",
		config: true,
		choices: playlists,
	});

	game.settings.register("quick-combat", "boss-playlist", {
		name: "QuickCombat.BossPlaylist",
		hint: "QuickCombat.BossPlaylistHint",
		scope: "world",
		config: true,
		choices: playlists,
	});

	game.settings.register("quick-combat", "npcroll", {
		name: "QuickCombat.NPCRoll",
		hint: "QuickCombat.NPCRollHint",
		scope: "world",
		config: true,
		default: false,
		type: Boolean
	});

	var def = false;
	var conf = false;
	if (CONFIG.hasOwnProperty("DND5E")) {
		def = true;
		conf = true;
	}
	game.settings.register("quick-combat", "exp", {
		name: "QuickCombat.Exp",
		hint: "QuickCombat.ExpHint",
		scope: "world",
		config: conf,
		default: def,
		type: Boolean
	});

	game.settings.register("quick-combat", "expgm", {
		name: "QuickCombat.ExpGM",
		hint: "QuickCombat.ExpGMHint",
		scope: "world",
		config: conf,
		default: false,
		type: Boolean
	});

	game.settings.register("quick-combat", "rmDefeated", {
		name: "QuickCombat.RemoveDefeated",
		hint: "QuickCombat.RemoveDefeatedHint",
		scope: "world",
		config: true,
		default: false,
		type: Boolean,
	});

	game.settings.register("quick-combat", "oldPlaylist", {
		scope: "world",
		config: false,
		default: "",
		type: Object
	});

	game.settings.register("quick-combat", "combatPlaylist", {
		scope: "world",
		config: false,
		default: "",
		type: Object
	});
});

Hooks.on("preUpdateCombat", async (combat, update, options, userId) => {
	const combatStart = combat.round === 0 && update.round === 1;
	if (!game.user.isGM || !combatStart)
		return true;

	console.debug("quick-combat | triggering start combat functions")
	let playlist_obj = game.settings.get("quick-combat", "combatPlaylist")
	let playlist = String(playlist_obj)
	let skip = true
	let playlists = []
	if ((playlist_obj && Object.keys(playlist_obj).length === 0 && Object.getPrototypeOf(playlist_obj) === Object.prototype) || playlist == "None") {
		console.warn("No combat playlist was found, skipping")
		skip = false;
	}
	game.playlists.playing.forEach(function(playing) {
		playlists.push(playing.name)
		if(skip) {
			console.debug(`quick-combat | stopping old playlist ${playing.name}`)
			playing.stopAll()
		}
	});
	console.log("playlists", playlists)
	game.settings.set("quick-combat", "oldPlaylist", playlists)
	if (skip) {
		console.log(`quick-combat | starting combat playlist ${playlist}`)
		await game.playlists.getName(playlist).playAll();
	}
});

Hooks.on("deleteCombat", async (combat, options, userId) => {
	if (!game.user.isGM)
		return true;
	console.debug("quick-combat | triggering delete combatant functions")
	//give exp
	if (game.settings.get("quick-combat", "exp")) {
		let exp = 0;
		let defeated = [];
		combat.combatants.filter(x => !x.actor.hasPlayerOwner).filter(x => x.data.defeated).forEach(function(a) { 
			exp += a.actor.data.data.details.xp.value;
			defeated.push(a.name); 
		});
		let pcs = combat.combatants.filter(x => x.actor.hasPlayerOwner);
		if (pcs.length < 1 ) {
			ui.notifications.error(game.i18n.localize("QuickCombat.noPlayerError"));
		}
		else {
			exp = Math.round(exp / pcs.length);
			console.log(`quick-combat | awarding exp ${exp} to PCs`)
			if (exp != 0 && !isNaN(exp)) {
				let actor_exp_msg = "<table>";
				pcs.forEach(function(a) {
					let new_exp = a.actor.data.data.details.xp.value + exp
					let level_up = ""
					if (new_exp >= a.actor.data.data.details.xp.max) {
						level_up = "<td><strong>" + game.i18n.localize("QuickCombat.LevelUp") + "</strong></td>"
						let cl = a.actor.items.find(a => a.type == "class")
						cl.update({
							"data.levels": cl.data.data.levels + 1
						})					
						
					}
					actor_exp_msg += "<tr><td><img class='quick-combat-token-selector' id='" + a.token.id + "' src='" + a.img + "' width='50' height='50'></td><td><strong class='quick-combat-token-selector' id='" + a.token.id + "'>" + a.name + "</strong></td><td>" + a.actor.data.data.details.xp.value + " &rarr; " + new_exp + "</p></td>" + level_up + "</tr>"
					a.actor.update({
						"data.details.xp.value": new_exp
					});
				});
				let msg = "<p>" + game.i18n.localize("QuickCombat.ExperienceMessageStart") + " <strong>" + defeated.join(", ") + "</strong> " + game.i18n.localize("QuickCombat.ExperienceMessageMid") + " <strong>" + exp + "</strong> " + game.i18n.localize("QuickCombat.ExperienceMessageEnd") + "</p>" + actor_exp_msg + "</table>";
				
				if (game.settings.get("quick-combat", "expgm")) {
					ChatMessage.create({
						user: userId, 
						content: msg,
						whisper: game.users.contents.filter(u => u.isGM).map(u => u.id)
					}, {});
				}
				else {
					ChatMessage.create({
						user: userId, 
						content: msg,
						type: CONST.CHAT_MESSAGE_TYPES.OTHER
					}, {});
				}
			}
			else {
				console.info("quick-combat | no exp for PCs")
			}
		}
	}

	//stop all combat playlists and play fanfare
	let playlists = game.playlists.playing
	if (playlists) {
		//stop all combat playlist
		playlists.forEach(async function(x) { 
			console.debug(`quick-combat | stopping combat playlist ${x.name}`);
			await x.stopAll();
		});
	}
	//play fanfare playlist if set
	let playlist_obj = game.settings.get("quick-combat", "fanfare-playlist");
	var fanfare = String(playlist_obj)
	if (!(playlist_obj && Object.keys(playlist_obj).length === 0 && Object.getPrototypeOf(playlist_obj) === Object.prototype) && fanfare != "None") {
		console.debug(`quick-combat | starting fanfare playlist ${fanfare}`)
		var items = Array.from(game.playlists.getName(fanfare).data.sounds);
		var item = items[Math.floor(Math.random()*items.length)];
		console.debug(`quick-combat | starting fanfare track ${item.name}`)
		game.playlists.getName(fanfare).playSound(item);
	}
	//remove defeated npcs
	if (game.settings.get("quick-combat", "rmDefeated")) {
		console.debug("quick-combat | removing defeated NPCs")
		var ids = []
		combat.combatants.filter(x => !x.actor.hasPlayerOwner).filter(x => x.data.defeated).forEach(function(a) {
			//check if tokens exists first
			if (game.scenes.current.tokens.has(a.token.id)) {
				console.debug(`quick-combat | removing defeated NPC ${a.token.name}`)
				ids.push(a.token.id)
			}
		});
		let scene = game.scenes.active;
		await scene.deleteEmbeddedDocuments("Token", ids)
	}
});

Hooks.on("updatePlaylist", async (playlist, update, options, userId) => {
	//only run for the GM
	if (!game.user.isGM)
		return true;
	//dont do anything if the update is set to playing
	if (update.playing)
		return true;
	//if fanfare playlist has been set
	let playlist_obj = game.settings.get("quick-combat", "fanfare-playlist");
	var fanfare = String(playlist_obj)
	if (!(playlist_obj && Object.keys(playlist_obj).length === 0 && Object.getPrototypeOf(playlist_obj) === Object.prototype) && fanfare != "None") {
		if (playlist.data.name != fanfare)
			return true;
	}
	//otherwise check if combat playlist has stopped
	else {
		playlist_obj = game.settings.get("quick-combat", "combatPlaylist")
		var name = String(playlist_obj)
		if (!(playlist_obj && Object.keys(playlist_obj).length === 0 && Object.getPrototypeOf(playlist_obj) === Object.prototype) && name != playlist.data.name) {
			return true;
		}
	}
	
	//reset skip playlist
	game.settings.set("quick-combat", "combatPlaylist", null)

	console.debug("quick-combat | starting old playlist")
	//start old playlist
	let playlists = game.settings.get("quick-combat", "oldPlaylist");
	if (playlists && Object.keys(playlists).length === 0 && Object.getPrototypeOf(playlists) === Object.prototype) {
		console.warn("no old playlists found, skipping")
		return true;
	}
	//start old playlists
	playlists.forEach(function(playlist) {
		console.debug(`quick-combat | starting old playlist ${playlists.name}`)
		game.playlists.getName(playlist).playAll();
	})
	game.settings.set("quick-combat", "oldPlaylist", null)
});

Hooks.on("renderChatMessage", (message, html, data) => {
	let ids = html.find(".quick-combat-token-selector")
	ids.click(function(event) {
		event.preventDefault();
		if (!canvas?.scene?.data.active) return;
		const token = canvas.tokens?.get(event.currentTarget.id);
		token?.control({ multiSelect: false, releaseOthers: true });
	})
})