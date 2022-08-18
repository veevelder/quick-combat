function get_playlist(playlist_name) {
	let playlist_obj = game.settings.get("quick-combat", playlist_name)
	console.debug(`quick-combat | getting playlist: ${playlist_name} ${playlist_obj}`)
	if(Object.prototype.toString.call(playlist_obj) === '[object Array]') {
		//an array of playlists
		return playlist_obj
	}
	if(!(playlist_obj && Object.keys(playlist_obj).length === 0 && Object.getPrototypeOf(playlist_obj) === Object.prototype)) {
		//playlist object make it a string
		return String(playlist_obj)
	}
	return "None"
}

Hooks.on("init", () => {
	console.debug("quick-combat | register keybind settings")
	game.keybindings.register("quick-combat", "key", {
		name: "QuickCombat.Keybind",
		hint: "QuickCombat.KeybindHint",
		editable: [{key: "C", modifiers: ["Alt"]}],
		onDown: async function() {
			console.debug("quick-combat | combat hotkey pressed")
			if (game.combat) {
				console.debug("quick-combat | combat found stopping combat")
				game.combat.endCombat();
			}
			else {
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
					if (CONFIG.hasOwnProperty("DND5E")) {
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
					else if (CONFIG.hasOwnProperty("OSE")) {
						console.debug("quick-combat | skipping combat rolling for OSE")
					}
				}
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
	game.settings.register("quick-combat", "boss-playlist", {
		name: "QuickCombat.BossPlaylist",
		hint: "QuickCombat.BossPlaylistHint",
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
	game.settings.register("quick-combat", "chooseplaylist", {
		name: "QuickCombat.ChoosePlaylist",
		hint: "QuickCombat.ChoosePlaylistHint",
		scope: "world",
		config: true,
		default: false,
		type: Boolean
	});
	var def = false;
	var conf = false;
	if (CONFIG.hasOwnProperty("DND5E") || CONFIG.hasOwnProperty("OSE")) {
		def = true;
		conf = true;
	}
	if (!CONFIG.hasOwnProperty("OSE")) {
		game.settings.register("quick-combat", "npcroll", {
			name: "QuickCombat.NPCRoll",
			hint: "QuickCombat.NPCRollHint",
			scope: "world",
			config: true,
			default: false,
			type: Boolean
		});
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
	if (game.settings.get("quick-combat", "chooseplaylist")) {
		var buttons = {
			button1: {
				label: game.i18n.localize("QuickCombat.CombatButton"),
				callback: async function() {
					console.debug("quick-combat | setting combat playlist to start")
					let playlist = get_playlist("playlist")
					if (playlist != "None") {
						let playlists = []
						game.playlists.playing.forEach(function(playing) {
							playlists.push(playing.name)
							console.debug(`quick-combat | stopping old playlist ${playing.name}`)
							playing.stopAll()
						});
						game.settings.set("quick-combat", "oldPlaylist", playlists)
						game.settings.set("quick-combat", "combatPlaylist", playlist)
						console.log(`quick-combat | starting combat playlist ${playlist}`)
						await game.playlists.getName(playlist).playAll();
					}
					else {
						console.warn("quick-combat | no combat playlist defined, skipping")
					}
				},
				icon: `<i class="fas fa-music"></i>`
			},
			button2: {
				label: game.i18n.localize("QuickCombat.NoneButton"),
				callback: () => {
					console.debug("quick-combat | setting no playlist to start")
					game.settings.set("quick-combat", "combatPlaylist", null)
					let playlists = []
					game.playlists.playing.forEach(function(playing) {
						playlists.push(playing.name)
					});
					game.settings.set("quick-combat", "oldPlaylist", playlists)
				},
				icon: `<i class="fas fa-volume-mute"></i>`
			}
		}
		//check if boss playlist has been set if so add button otherwise dont	
		let playlist = get_playlist("boss-playlist")
		if (playlist != "None") {
			buttons.button3 = {
				label: game.i18n.localize("QuickCombat.BossButton"),
				callback: async function() {
					console.debug("quick-combat | setting boss playlist to start")
					if (playlist != "None") {
						let playlists = []
						game.playlists.playing.forEach(function(playing) {
							playlists.push(playing.name)
							console.debug(`quick-combat | stopping old playlist ${playing.name}`)
							playing.stopAll()
						});
						game.settings.set("quick-combat", "oldPlaylist", playlists)
						game.settings.set("quick-combat", "combatPlaylist", playlist)
						console.log(`quick-combat | starting combat playlist ${playlist}`)
						await game.playlists.getName(playlist).playAll();
					}
					else {
						console.warn("quick-combat | no combat playlist defined, skipping")
					}
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
	else {
		console.debug("quick-combat | skipping choose playlist dialog")
		let playlist = get_playlist("playlist")
		if (playlist != "None") {
			let playlists = []
			game.playlists.playing.forEach(function(playing) {
				playlists.push(playing.name)
				console.debug(`quick-combat | stopping old playlist ${playing.name}`)
				playing.stopAll()
			});
			game.settings.set("quick-combat", "oldPlaylist", playlists)
			game.settings.set("quick-combat", "combatPlaylist", playlist)
			console.log(`quick-combat | starting combat playlist ${playlist}`)
			await game.playlists.getName(playlist).playAll();
		}
		else {
			console.warn("quick-combat | no combat playlist defined, skipping")
		}
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
			if (CONFIG.hasOwnProperty("OSE")) {
				exp += parseInt(a.actor.data.data.details.xp);
			}
			else if(CONFIG.hasOwnProperty("DND5E")) {
				exp += a.actor.data.data.details.xp.value;
			}
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
					let new_exp = null;
					if (CONFIG.hasOwnProperty("OSE")) {
						console.log("exp", exp)
						//calculate share should be 100%
						exp = exp * (a.actor.data.data.details.xp.share / 100)
						//add ose specific details: previous exp amount + exp + bonus
						new_exp = Math.round(a.actor.data.data.details.xp.value + exp + (exp * (a.actor.data.data.details.xp.bonus / 100)))
					}
					else if(CONFIG.hasOwnProperty("DND5E")) {
						new_exp = a.actor.data.data.details.xp.value + exp
					}
					let level_up = ""
					//get next level exp
					let max_xp = null
					if (CONFIG.hasOwnProperty("OSE")) {
						max_xp = a.actor.data.data.details.xp.next
					}
					else if(CONFIG.hasOwnProperty("DND5E")) {
						max_xp = a.actor.data.data.details.xp.max
					}
					if (new_exp >= max_xp) {
						level_up = "<td><strong>" + game.i18n.localize("QuickCombat.LevelUp") + "</strong></td>"
						if (CONFIG.hasOwnProperty("OSE")) {
							a.actor.update({
								"data.details.level": a.actor.data.data.details.level + 1
							});
						}
						else if(CONFIG.hasOwnProperty("DND5E")) {
							let cl = a.actor.items.find(a => a.type == "class")
							cl.update({
								"data.levels": cl.data.data.levels + 1
							})
						}
					}
					actor_exp_msg += "<tr data-tokenid='" + a.token.id + "' class='quick-combat-token-selector'><td><img src='" + a.img + "' width='50' height='50'></td><td><strong>" + a.name + "</strong></td><td>" + a.actor.data.data.details.xp.value + " &rarr; " + new_exp + "</p></td>" + level_up + "</tr>"
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
	//check for combat playlist
	let combatPlaylist = get_playlist("combatPlaylist")
	//get fanfare playlist
	let fanfare = get_playlist("fanfare-playlist")
	if (combatPlaylist == "None" && fanfare == "None") {
		console.debug("quick-combat | no combat playlist is playing and no fanfare is defined, skipping stopping combat playlist")
	}
	else {
		//stop currently playing
		let playlists = game.playlists.playing
		if (playlists) {
			//stop all combat playlist
			playlists.forEach(async function(x) { 
				console.debug(`quick-combat | stopping combat playlist ${x.name}`);
				await x.stopAll();
			});
		}
	}
	//play fanfare playlist if set
	if (fanfare != "None") {
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
	let fanfare = get_playlist("fanfare-playlist")
	if (fanfare != "None") {
		if (playlist.data.name != fanfare)
			return true;
	}
	//otherwise check if combat playlist has stopped
	else {
		let name = get_playlist("combatPlaylist")
		if (name != playlist.data.name) {
			return true;
		}
	}
	//reset skip playlist
	game.settings.set("quick-combat", "combatPlaylist", null)
	console.debug("quick-combat | starting old playlist")
	//start old playlist
	let playlists = get_playlist("oldPlaylist")
	if (playlists == "None") {
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
		const token = canvas.tokens?.get($(event.currentTarget).data("tokenid"));
		token?.control({ multiSelect: false, releaseOthers: true });
	})
})