export class QuickCombatPlaylists extends FormApplication {
	constructor(object = {}, options) {
		super(object, options);
	}

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			popOut: true,
			template: "modules/quick-combat/templates/playlists.html",
			height: 'auto',
			id: 'quick-combat-playlists',
			title: game.i18n.localize("QuickCombat.playlists.name"),
			width: 700,
			popOut: true,
			minimizable: true,
            resizable: true,
			submitOnClose: true,
			closeOnSubmit: true,
		});
	}

	/** @override */
	async getData() {
		//get saved data
		let qc_playlists = game.settings.get("quick-combat", "playlists")
		console.log("og", qc_playlists)
		for (var i = 0; i < qc_playlists.length; i++) {
			//get scene data
			qc_playlists[i]["scene_ids"] = [];
			game.scenes.forEach(function(scene) {
				qc_playlists[i]["scene_ids"].push({
					"id": scene.id,
					"name": scene.name,
					"selected": scene.id == qc_playlists[i].scene
				});
			});
			//get playlists data
			qc_playlists[i]["playlist_ids"] = [];
			game.playlists.forEach(function(playlist) {
				console.log(playlist.id, qc_playlists[i].id)
				qc_playlists[i]["playlist_ids"].push({
					"id": playlist.id,
					"name": playlist.name,
					"selected": playlist.id == qc_playlists[i].id
				});
			});

		}
		return {qc_playlists}
	}

	/** @override */
	async _updateObject(event, formData) {
		const data = expandObject(formData);
		console.log("fd", formData)
		let playlists = []
		for (let [key, value] of Object.entries(data)) {
			if (value.name == "") {
				ui.notifications.error(game.i18n.localize("QuickCombat.SaveNameError"));
				return;
			}
			if (value.playlist == "") {
				ui.notifications.error(game.i18n.localize("QuickCombat.SavePlaylistError"));
				return;
			}
			console.log(key, value)
			playlists.push(value)
		}
		await game.settings.set("quick-combat", "playlists", playlists);
		await this.render()
	}

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);
		html.find('.add-playlist').click(this._onAddPlaylist.bind(this));
		html.find('.remove-playlist').click(this._onRemovePlaylist.bind(this));
	}

	async _onAddPlaylist(event) {
		event.preventDefault();
		let playlists = game.settings.get("quick-combat", "playlists");
		playlists.push({
			"id": "",
			"scene": "",
			"fanfare": false
		})
		await game.settings.set("quick-combat", "playlists", playlists)
		this.render();
	}

	async _onRemovePlaylist(event) {
		event.preventDefault();
		const el = $(event.target);
		if (!el) {
			return true;
		}
		let playlists = game.settings.get("quick-combat", "playlists");
		playlists.splice(el.data("idx"), 1);
		await game.settings.set("quick-combat", "playlists", playlists)
		el.remove();
		this.render();
	}
}

function get_playlist(fanfare = false, pickone = false) {
	//get scene playlists
	let scene = game.scenes.active.id
	let playlists = []
	//get scene playlists
	playlists = game.settings.get("quick-combat", "playlists").filter(a => a.scene == scene && a.fanfare == fanfare)
	//if not scene playlists get all "" scenes
	if (playlists.length == 0) {
		playlists = game.settings.get("quick-combat", "playlists").filter(a => a.scene == "" && a.fanfare == fanfare)
	}
	//if still no playlists then return None
	if (playlists.length == 0) {
		return null
	}
	//get the playlist object
	if (pickone) {
		//select a random playlist
		return game.playlists.get(playlists[Math.floor(Math.random()*playlists.length)].id)
	}
	else {
		let a = []
		for (var i = 0; i < playlists.length; i++) {
			var tmp = game.playlists.get(playlists[i].id)
			console.log(playlists[i], tmp)
			a.push(tmp)
		}
		return a
	}
}

async function hotkey() {
	console.debug("quick-combat | combat hotkey pressed")
	if (game.combat) {
		console.debug("quick-combat | combat found stopping combat")
		game.combat.endCombat();
	}
	else {
		console.debug("quick-combat | starting combat")
		//check if GM has any selected tokens
		if (canvas.tokens.controlled.length === 0) {
			ui.notifications.error(game.i18n.localize("QuickCombat.KeyError"));
		}
		else {			
			console.debug("quick-combat | getting player tokens skipping Pets/Summons")
			var tokens = canvas.tokens.controlled.filter(t => !t.inCombat).filter(t => t.actor.items.filter(i => i.name == "Pet" || i.name == "Summon").length == 0)

			// rip off  async toggleCombat(state=true, combat=null, {token=null}={}) from  base game line ~36882
			var combat = game.combats.viewed;
			if (!combat) {
				if (game.user.isGM) {
					console.debug("quick-combat | creating new combat")
					const cls = getDocumentClass("Combat");
					combat = await cls.create({scene: canvas.scene.id, active: true}, {render: !tokens.length});
				} else {
					ui.notifications.warn("COMBAT.NoneActive", {localize: true});
					return [];
				}
			}

			// Process each controlled token, as well as the reference token
			console.debug("quick-combat | adding combatants to combat")
			const createData = tokens.map(t => {
				return {
					tokenId: t.id,
					sceneId: t.scene.id,
					actorId: t.document.actorId,
					hidden: t.document.hidden
				}
			});
			await combat.createEmbeddedDocuments("Combatant", createData)

			//do system specific rolling options
			if (CONFIG.hasOwnProperty("DND5E")) {
				console.log("quick-combat | rolling initiatives for NPCs")
				await combat.rollNPC({"messageOptions":{"rollMode": CONST.DICE_ROLL_MODES.PRIVATE}})
				//check for PC roll option
				if (!game.settings.get("quick-combat", "npcroll")) {
					console.log("quick-combat | rolling initiatives for PCs")
					//roll all PCs that haven't rolled initiative yet
					var cmb = combat.combatants.filter(a => a.actor.hasPlayerOwner).filter(a => !a.initiative).map(a => a.id)
					await combat.rollInitiative(cmb, {"messageOptions":{"rollMode": CONST.DICE_ROLL_MODES.PUBLIC}})
					console.log("quick-combat | starting combat")
					await combat.startCombat();
				}
			}
			else if (CONFIG.hasOwnProperty("OSE")) {
				console.debug("quick-combat | skipping combat rolling for OSE")
			}
			else if (CONFIG.hasOwnProperty("PF2E")) {
				var skip_dialog = game.settings.get("quick-combat", "skipdialog")
				console.log(`quick-combat | rolling initiatives for NPCs skipping dialog? ${skip_dialog}`)
				await combat.rollNPC({"secret": true, "skipDialog":skip_dialog == "npc" || skip_dialog == "both"})
				//check for PC roll option
				if (!game.settings.get("quick-combat", "npcroll")) {
					console.log("quick-combat | rolling initiatives for PCs")
					//roll all PCs that haven't rolled initiative yet
					var cmb = combat.combatants.filter(a => !a.isNPC).filter(a => !a.initiative).map(a => a.id)
					await combat.rollInitiative(cmb, {"secret": false, "skipDialog":skip_dialog == "pcs" || skip_dialog == "both"})
					console.log("quick-combat | starting combat")
					await combat.startCombat();
				}
			}
		}
	}
}

Hooks.on("init", () => {
	console.debug("quick-combat | register keybind settings")
	game.keybindings.register("quick-combat", "key", {
		name: "QuickCombat.Keybind",
		hint: "QuickCombat.KeybindHint",
		editable: [{key: "C", modifiers: ["Alt"]}],
		onDown: hotkey,
		restricted: true, //gmonly
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});
});

Hooks.on("ready", () => {
	console.debug("quick-combat | register settings")
	//playlist options
	game.settings.registerMenu("quick-combat", "playlist-template", {
		name: "QuickCombat.button.name",
		label: "QuickCombat.button.label",
		hint: "QuickCombat.button.hint",
		type: QuickCombatPlaylists,
		restricted: true
	});
	game.settings.register("quick-combat", "chooseplaylist", {
		name: "QuickCombat.ChoosePlaylist",
		hint: "QuickCombat.ChoosePlaylistHint",
		scope: "world",
		config: true,
		default: false,
		type: Boolean
	});
	game.settings.register("quick-combat", "playlists", {
		name: "",
		hint: "",
		scope: "world",
		config: false,
		default: [],
		type: Object
	})

	//hidden settings
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
	game.settings.register("quick-combat", "migrate", {
		scope: "world",
		config: false,
		default: true,
		type: Boolean
	});

	//game system specific options
	game.settings.register("quick-combat", "npcroll", {
		name: "QuickCombat.NPCRoll",
		hint: "QuickCombat.NPCRollHint",
		scope: "world",
		config: !CONFIG.hasOwnProperty("OSE"),
		default: false,
		type: Boolean
	});
	game.settings.register("quick-combat", "exp", {
		name: "QuickCombat.Exp",
		hint: "QuickCombat.ExpHint",
		scope: "world",
		config: CONFIG.hasOwnProperty("DND5E") || CONFIG.hasOwnProperty("OSE"),
		default: CONFIG.hasOwnProperty("DND5E") || CONFIG.hasOwnProperty("OSE"),
		type: Boolean
	});
	game.settings.register("quick-combat", "expgm", {
		name: "QuickCombat.ExpGM",
		hint: "QuickCombat.ExpGMHint",
		scope: "world",
		config: CONFIG.hasOwnProperty("DND5E") || CONFIG.hasOwnProperty("OSE"),
		default: false,
		type: Boolean
	});
	game.settings.register("quick-combat", "skipdialog", {
		name: "QuickCombat.SkipDialog",
		hint: "QuickCombat.SkipDialogHint",
		scope: "world",
		config: CONFIG.hasOwnProperty("PF2E"),
		type: String,
		default: "",
		choices: {
			"none": "",
			"npc": "Only NPCs",
			"pcs": "Only PCs",
			"both": "Both"
		}
	});

	//non game system specific options
	game.settings.register("quick-combat", "rmDefeated", {
		name: "QuickCombat.RemoveDefeated",
		hint: "QuickCombat.RemoveDefeatedHint",
		scope: "world",
		config: true,
		default: false,
		type: Boolean,
	});

	//combat markers animations
	game.settings.register("quick-combat", "combatMarkers", {
		name: "QuickCombat.CombatMarkers",
		hint: "QuickCombat.CombatMarkersHint",
		scope: "world",
		config: (game.modules.get("JB2A_DnD5e")?.active ?? false) && (game.modules.get("sequencer")?.active ?? false),
		default: false,
		type: Boolean,
	});

	//migrate playlists to new playlist menu
	if (game.settings.get("quick-combat", "migrate")) {
		var qc_playlists = game.settings.get("quick-combat", "playlists")
		game.settings.storage.get("world").forEach(a => {
			if (a.key == "quick-combat.playlist") {
				var old_playlist = game.playlists.getName(a.value)
				if (!qc_playlists.map(a => a.id).includes(old_playlist.id)) {
					console.debug("quick-combat | migrating old combat playlist setting")				
					qc_playlists.push({
						"id": old_playlist.id,
						"scene": "",
						"fanfare": false
					})
				}
			}
			if (a.key == "quick-combat.boss-playlist") {
				var old_playlist = game.playlists.getName(a.value)
				if (!qc_playlists.map(a => a.id).includes(old_playlist.id)) {
					console.debug("quick-combat | migrating old boss combat playlist setting")
					var old_playlist = game.playlists.getName(a.value)
					qc_playlists.push({
						"playlist": old_playlist.id,
						"scene": "",
						"fanfare": false
					})
				}
			}
			if (a.key == "quick-combat.fanfare-playlist") {
				var old_playlist = game.playlists.getName(a.value)
				if (!qc_playlists.map(a => a.id).includes(old_playlist.id)) {
					console.debug("quick-combat | migrating old fanfare combat playlist setting")
					var old_playlist = game.playlists.getName(a.value)
					qc_playlists.push({
						"playlist": old_playlist.id,
						"scene": "",
						"fanfare": true
					})
				}
			}
		})
		game.settings.set("quick-combat", "playlists", qc_playlists)
		game.settings.set("quick-combat", "migrate", false)
	}
});

async function start_playlist(playlist) {
	if (playlist) {
		let playlists = []
		game.playlists.playing.forEach(function(playing) {
			playlists.push(playing.id)
			console.debug(`quick-combat | stopping old playlist ${playing.name}`)
			playing.stopAll()
		});
		game.settings.set("quick-combat", "oldPlaylist", playlists)

		//var combatPlaylist = game.playlists.getName(playlist.id)
		game.settings.set("quick-combat", "combatPlaylist", playlist.id)
		console.log(`quick-combat | starting combat playlist ${playlist.name}`)
		playlist.playAll()
	}
	else {
		console.debug("quick-combat | setting no playlist to start")
		game.settings.set("quick-combat", "combatPlaylist", null)
		let playlists = []
		game.playlists.playing.forEach(function(playing) {
			playlists.push(playing.id)
		});
		game.settings.set("quick-combat", "oldPlaylist", playlists)
	}
}

Hooks.on("preUpdateCombat", async (combat, update, options, userId) => {
	const combatStart = combat.round === 0 && update.round === 1;
	if (!game.user.isGM || !combatStart)
		return true;
	console.debug("quick-combat | triggering start combat functions")
	if (game.settings.get("quick-combat", "chooseplaylist")) {
		//generate a list of buttons
		var buttons = {
			none: {
				label: game.i18n.localize("QuickCombat.NoneButton"),
				callback: () => {start_playlist(null)},
				icon: `<i class="fas fa-volume-mute"></i>`
			}
		}
		let qc_playlists = get_playlist()
		console.log(qc_playlists)
		for (var i = 0; i < qc_playlists.length; i++) {
			buttons[qc_playlists[i].id] = {
				label: qc_playlists[i].name,
				callback: (html, button) => {
					var playlist = game.playlists.get($(button.currentTarget).data("button"))
					start_playlist(playlist)
				},
				icon:  qc_playlists[i].name.includes("Boss") ? `<i class="fas fa-skull-crossbones"></i>` : `<i class="fas fa-music"></i>`
			}
		}		
		new Dialog({
			title: game.i18n.localize("QuickCombat.PlaylistWindowTitle"),
			content: game.i18n.localize("QuickCombat.PlaylistWindowDescription"),
			buttons: buttons,
			close: () => {start_playlist(null)},
		}).render(true);
	}
	else {
		console.debug("quick-combat | skipping choose playlist dialog")
		start_playlist(get_playlist(false,true))
	}
});

Hooks.on("deleteCombat", async (combat, options, userId) => {
	if (!game.user.isGM)
		return true;
	console.debug("quick-combat | triggering delete combatant functions")
	//remove any effects
	if (game.modules.get("sequencer")?.active ?? false) {
		console.debug("quick-combat | Ending Combat Marker Animations")
		Sequencer?.EffectManager.endEffects({ name: "activeTurn" })
		Sequencer?.EffectManager.endEffects({ name: "onDeck" })
	}
	//give exp
	if (game.settings.get("quick-combat", "exp")) {
		let exp = 0;
		let defeated = [];
		//get only defeated NPCs that are hostile
		combat.combatants.filter(x => x.isNPC).filter(x => x.token.disposition == -1).filter(x => x.isDefeated).forEach(function(a) {
			if (CONFIG.hasOwnProperty("OSE")) {
				exp += parseInt(a.actor.system.details.xp);
			}
			else if(CONFIG.hasOwnProperty("DND5E")) {
				exp += a.actor.system.details.xp.value;
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
						exp = exp * (a.actor.system.details.xp.share / 100)
						//add ose specific details: previous exp amount + exp + bonus
						new_exp = Math.round(a.actor.system.details.xp.value + exp + (exp * (a.actor.system.details.xp.bonus / 100)))
					}
					else if(CONFIG.hasOwnProperty("DND5E")) {
						new_exp = a.actor.system.details.xp.value + exp
					}
					let level_up = ""
					//get next level exp
					let max_xp = null
					if (CONFIG.hasOwnProperty("OSE")) {
						max_xp = a.actor.system.details.xp.next
					}
					else if(CONFIG.hasOwnProperty("DND5E")) {
						max_xp = a.actor.system.details.xp.max
					}
					if (new_exp >= max_xp) {
						level_up = "<td><strong>" + game.i18n.localize("QuickCombat.LevelUp") + "</strong></td>"
						if (CONFIG.hasOwnProperty("OSE")) {
							a.actor.update({
								"data.details.level": a.actor.system.details.level + 1
							});
						}
						else if(CONFIG.hasOwnProperty("DND5E")) {
							let cl = a.actor.items.find(a => a.type == "class")
							cl.update({
								"data.levels": cl.system.levels + 1
							})
						}
					}
					actor_exp_msg += "<tr data-tokenid='" + a.token.id + "' class='quick-combat-token-selector'><td><img src='" + a.img + "' width='50' height='50'></td><td><strong>" + a.name + "</strong></td><td>" + a.actor.system.details.xp.value + " &rarr; " + new_exp + "</p></td>" + level_up + "</tr>"
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
	let combatPlaylist = game.settings.get("quick-combat", "combatPlaylist")
	//get fanfare playlist
	let fanfare = get_playlist(true, true)
	if (combatPlaylist == null && fanfare == null) {
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
	if (fanfare) {
		console.debug(`quick-combat | starting fanfare playlist ${fanfare.name}`)
		var items = Array.from(fanfare.sounds);
		if (items.length > 0) {
			var item = items[Math.floor(Math.random()*items.length)];
			console.debug(`quick-combat | starting fanfare track ${item.name}`)
			fanfare.playSound(item);
		}
		else {
			console.warn("quick-combat | fanfare playlist has no items")
		}
	}
	//remove defeated npcs
	if (game.settings.get("quick-combat", "rmDefeated")) {
		console.debug("quick-combat | removing defeated NPCs")
		var ids = []
		//add only Hostile NPCs
		combat.combatants.filter(x => x.isNPC).filter(x => x.token.disposition == -1).filter(x => x.isDefeated).forEach(function(a) {
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
	let fanfare = get_playlist(true, true)
	if (fanfare) {
		if (playlist.id != fanfare.id)
			return true;
	}
	//otherwise check if combat playlist has stopped
	else {
		let combatPlaylist = game.settings.get("quick-combat", "combatPlaylist")
		if (combatPlaylist != playlist.id) {
			return true;
		}
	}
	//reset skip playlist
	game.settings.set("quick-combat", "combatPlaylist", null)
	console.debug("quick-combat | starting old playlist")
	//start old playlist
	let playlists = game.settings.get("quick-combat", "oldPlaylist")
	if (!playlists || playlists == null || playlists == "None") {
		console.warn("no old playlists found, skipping")
		return true;
	}
	//start old playlists
	playlists.forEach(function(id) {
		var oldPlaylist = game.playlists.get(id)
		console.debug(`quick-combat | starting old playlist ${oldPlaylist.name}`)
		oldPlaylist.playAll();
	})
	game.settings.set("quick-combat", "oldPlaylist", null)
});

Hooks.on("renderChatMessage", (message, html, data) => {
	let ids = html.find(".quick-combat-token-selector")
	ids.click(function(event) {
		event.preventDefault();
		if (!canvas?.scene?.active) return;
		const token = canvas.tokens?.get($(event.currentTarget).data("tokenid"));
		token?.control({ multiSelect: false, releaseOthers: true });
	})
})

Hooks.on("updateCombat", async (combat, updates, diff, id) => {
	//only run for the GM
	if(game.settings.get("quick-combat", "combatMarkers") && (game.user.isGM)) {
		// check if theres a combat
		if(combat?.active) {
			//remove activeTurn/onDeck on previous source should have not animations
			Sequencer?.EffectManager.endEffects({ name: "activeTurn" })
			Sequencer?.EffectManager.endEffects({ name: "onDeck" })
			//get the next non defeated token
			var nextToken = null
			var i = 1
			while (nextToken == null) {
				var tmp = combat.turns[(game.combats.active.turn + i) % game.combats.active.turns.length]
				if (!tmp.defeated) {
					nextToken = canvas.tokens.get(tmp.tokenId)
				}
				i += 1
			}
			//add on deck animation if it doesn't already exist
			if(Sequencer?.EffectManager.getEffects({ source: nextToken, name: "onDeck" }).length == 0 ) {
				new Sequence("quick-combat")
					.effect()
						.file("jb2a.magic_signs.circle.01.abjuration")
						.attachTo(nextToken)
						.scaleToObject(2)
						.elevation(0)
						.fadeIn(1500, {ease: "easeOutCubic", delay: 500})
						.fadeOut(1500, {ease: "easeOutCubic", delay: 500})
						.rotateIn(90, 2500, {ease: "easeInOutCubic"})
						.rotateOut(90, 2500, {ease: "easeInOutCubic"})
						.scaleIn(2, 2500, {ease: "easeInOutCubic"})
						.scaleOut(2, 2500, {ease: "easeInOutCubic"})
						.name("onDeck")
						.persist()
						.playIf(!nextToken.document.hidden)
					.play()
			}
			//add active turn if it doesn't already exist
			const currentToken = canvas.tokens.get(combat.current.tokenId)
			if(Sequencer?.EffectManager.getEffects({ source: currentToken, name: "activeTurn" }).length == 0 ) {
				new Sequence("quick-combat")
					.effect()
						.file("jb2a.magic_signs.circle.01.conjuration")
						.attachTo(currentToken)
						.scaleToObject(2)
						.elevation(0)
						.fadeIn(1500, {ease: "easeOutCubic", delay: 500})
						.fadeOut(1500, {ease: "easeOutCubic", delay: 500})
						.rotateIn(90, 2500, {ease: "easeInOutCubic"})
						.rotateOut(90, 2500, {ease: "easeInOutCubic"})
						.scaleIn(2, 2500, {ease: "easeInOutCubic"})
						.scaleOut(2, 2500, {ease: "easeInOutCubic"})
						.name("activeTurn")
						.persist()
						.playIf(!currentToken.document.hidden)
					.play()
			}
		}
	}
})