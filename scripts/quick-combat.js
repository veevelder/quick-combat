let socket;

Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerModule("quick-combat");
	socket.register("ask_initiative", ask_initiative);
});

async function ask_initiative(npc_options, actor_id) {
	return new Promise((resolve, reject) => {
		var actor = game.actors.get(actor_id)
		new Dialog({
			title: game.i18n.localize("QuickCombat.PF2E.title"),
			content: `${actor.name}</br><select id='inits'>${npc_options}</select>`,
			close: () => {reject()},
			buttons: {
				button: {
					label: game.i18n.localize("QuickCombat.PF2E.updateButton"),
					icon: "<i class='fas fa-check'></i>",
					callback: async (html) => {
						var inits = html.find("select#inits").find(":selected").val()
						console.debug(`quick-combat | updating ${actor.name} initiative to ${inits}`)
						actor.update({"system.attributes.initiative.ability": inits})
						resolve()
					}
				}
			},
		}).render(true);
	})
}

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
				qc_playlists[i]["playlist_ids"].push({
					"id": playlist.id,
					"name": playlist.name,
					"selected": playlist.id == qc_playlists[i].id,
					"empty": playlist.sounds.size == 0
				});
			});

		}
		console.log(qc_playlists)
		return {qc_playlists}
	}

	/** @override */
	async _updateObject(event, formData) {
		const data = expandObject(formData);
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
			a.push(tmp)
		}
		return a
	}
}

async function render_combat(tokens) {
	// rip off  async toggleCombat(state=true, combat=null, {token=null}={}) from  base game line ~36882
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
	if (combat != null) {
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
	}
	return combat
}

async function roll_combat(combat, system) {
	var cmb = []
	var npc_options = {}
	var pc_options = {}
	switch (system) {
		case "pf2e":
			var skipDialog = true
			if (game.settings.get("quick-combat", "autoInit") == "default") {
				skipDialog = false
			}
			cmb = combat.combatants.filter(a => a.actor.type == "character").filter(a => !a.initiative).map(a => a.id)
			npc_options = {"secret": true, "skipDialog": skipDialog};
			pc_options = {"secret": false, "skipDialog": skipDialog};
			break;
		default:
			cmb = combat.combatants.filter(a => !a.isNPC).filter(a => !a.initiative).map(a => a.id)
			npc_options = {"messageOptions":{"rollMode": CONST.DICE_ROLL_MODES.PRIVATE}}
			pc_options = {"messageOptions":{"rollMode": CONST.DICE_ROLL_MODES.PUBLIC}}
			break;
	}

	//add chat options for rolls should work with every system
	console.log("quick-combat | rolling initiatives for NPCs", npc_options)
	await combat.rollNPC(npc_options)
	//check for PC roll option
	if (!game.settings.get("quick-combat", "npcroll")) {
		console.log("quick-combat | rolling initiatives for PCs", pc_options)
		//roll all PCs that haven't rolled initiative yet
		await combat.rollInitiative(cmb, pc_options)
		console.log("quick-combat | starting combat")
		await combat.startCombat();
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

			//do system specific rolling options
			if (CONFIG.hasOwnProperty("PF2E")) {
				//render a popup box to ask for NPC and PC roll types
				if (game.settings.get("quick-combat", "autoInit") == "prompt") {
					console.log("quick-combat | pf2e rolling prompt initiatives")
					//popup asking for initiative types before adding to combat tracker
					var npc_options = "<option value='perception'>" + game.i18n.localize(CONFIG.PF2E.attributes.perception) + "</option>"
					var keys = Object.keys(CONFIG.PF2E.skills)
					for (var i = 0; i < keys.length; i++) {
						var key = keys[i]
						npc_options += `<option value='${key}'>${game.i18n.localize(CONFIG.PF2E.skills[key])}</option>`
					}

					//create npc inputs
					var npc_defaults = ""
					for(var i = 0; i < tokens.length; i++) {
						if (tokens[i].actor.type != "character") {
							npc_defaults+=`<select id='inits_${tokens[i].actor.id}'>${npc_options}</select><label style='padding-left:10px' for='inits_${tokens[i].actor.id}'>${tokens[i].actor.name}</label></br>`
						}
					}
					new Dialog({
						title: "Update NPC Initiative",
						content: `<label for='all_npcs'>${game.i18n.localize("QuickCombat.PF2E.groupMSG")}</label><input type='checkbox' id='all_npcs' checked><select id='inits'>${npc_options}</select>
						<p class="notes">${game.i18n.localize("QuickCombat.PF2E.groupHint")}</p><hr>${npc_defaults}`,
						close: async () => {
							//get a list of connected users to send popup for for tokens in combat
							//get a list of token/user combo thats not the GM
							for (i = 0; i < tokens.length; i++) {
								//only run on PCs
								if (tokens[i].actor.type == "character") {
									//find the owner id thats not the default, not the GM and has OWNER privs
									const user = Object.entries(tokens[i].actor.ownership).find(([k,v]) => k != "default" && k != game.userId && v == 3)
									//check if user is connected if not prompt the GM
									if (game.users.get(user)?.active) {
										await socket.executeAsUser(ask_initiative, user, npc_options, tokens[i].actor.id)
									}
									else {
										await socket.executeAsGM(ask_initiative, npc_options, tokens[i].actor.id)
									}
								}
							}
							var combat = await render_combat(tokens)
							if (combat == null) {return}
							roll_combat(combat, "pf2e")
						},
						buttons: {
							button: {
								label: "Update",
								icon: "<i class='fas fa-check'></i>",
								callback: async (html) => {
									var inits = html.find("select#inits").find(":selected").val()
									var all_npcs = html.find("input#all_npcs").prop("checked")
									for(var i = 0; i < tokens.length; i++) {
										if (tokens[i].actor.type != "character") {
											//get init type if checkbox is enabled or not
											if (!all_npcs) {
												inits = html.find("select#inits_" + tokens[i].actor.id).find(":selected").val()
											}
											//update actors to match initiative
											console.debug(`quick-combat | updating ${tokens[i].actor.name} initiative to ${inits}`)
											tokens[i].actor.update({"system.attributes.initiative.ability": inits})
										}
									}
								}
							}
						},
					}).render(true);
				}
				else if (game.settings.get("quick-combat", "autoInit") == "fast_prompt") {
					console.log("quick-combat | pf2e rolling fast_prompt initiatives")
					for(var i = 0; i < tokens.length; i++) {
						if (tokens[i].actor.type != "character" && tokens[i].actor.system.attributes.initiative.ability != "perception") {
							//update actors to match initiative
							console.debug(`quick-combat | updating ${tokens[i].actor.name} initiative to perception`)
							tokens[i].actor.update({"system.attributes.initiative.ability": "perception"})
						}
					}
					//popup asking for initiative types before adding to combat tracker
					var npc_options = "<option value='perception'>" + game.i18n.localize(CONFIG.PF2E.attributes.perception) + "</option>"
					var keys = Object.keys(CONFIG.PF2E.skills)
					for (var i = 0; i < keys.length; i++) {
						var key = keys[i]
						npc_options += `<option value='${key}'>${game.i18n.localize(CONFIG.PF2E.skills[key])}</option>`
					}
					//create npc inputs
					var npc_defaults = ""
					for(var i = 0; i < tokens.length; i++) {
						if (tokens[i].actor.type != "character") {
							npc_defaults+=`<select id='inits_${tokens[i].actor.id}'>${npc_options}</select><label style='padding-left:10px' for='inits_${tokens[i].actor.id}'>${tokens[i].actor.name}</label></br>`
						}
					}
					for (i = 0; i < tokens.length; i++) {
						for (const user in tokens[i].actor.ownership) {
							//not the default or GM and is owner
							if (user != "default" && user != game.userId && tokens[i].actor.ownership[user] == 3) {
								//check if user is connected if not prompt the GM
								if (game.users.get(user).active) {
									await socket.executeAsUser(ask_initiative, user, npc_options, tokens[i].actor.id)
								}
								else {
									await socket.executeAsGM(ask_initiative, npc_options, tokens[i].actor.id)
								}
							}
						}
					}
					var combat = await render_combat(tokens)
					if (combat == null) {return}
					roll_combat(combat, "pf2e")
				}
				//assume perception for every token
				else if (game.settings.get("quick-combat", "autoInit") == "fast") {
					console.log("quick-combat | pf2e rolling fast initiatives")
					for(var i = 0; i < tokens.length; i++) {
						if (tokens[i].actor.system.attributes.initiative.ability != "perception") {
							//update actors to match initiative
							console.debug(`quick-combat | updating ${tokens[i].actor.name} initiative to perception`)
							tokens[i].actor.update({"system.attributes.initiative.ability": "perception"})
						}
					}
					var combat = await render_combat(tokens)
					if (combat == null) {return}
					roll_combat(combat, "pf2e")
				}
				//use system defaults
				else {
					console.log("quick-combat | pf2e rolling default initiatives")
					var combat = await render_combat(tokens)
					if (combat == null) {return}
					roll_combat(combat, "pf2e")
				}
			}
			else if (CONFIG.hasOwnProperty("DND5E")) {
				var combat = await render_combat(tokens)
				if (combat == null) {return}
				roll_combat(combat, "dnd5e")
			}
			else if (CONFIG.hasOwnProperty("OSE")) {
				console.debug("quick-combat | skipping combat rolling for OSE")
				var combat = await render_combat(tokens)
				if (combat == null) {return}
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

Hooks.once("ready", () => {
	console.debug("quick-combat | register settings")
	//!!!!old settings TO BE REMOVED AT A LATER DATE!!!!
	game.settings.register("quick-combat", "playlist", {
		scope: "world",
		config: false,
		type: String,
		default: ""
	});
	game.settings.register("quick-combat", "boss-playlist", {
		scope: "world",
		config: false,
		type: String,
		default: ""
	});
	game.settings.register("quick-combat", "fanfare-playlist", {
		scope: "world",
		config: false,
		type: String,
		default: ""
	});

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
	game.settings.register("quick-combat", "autoInit", {
		name: "QuickCombat.PF2E.AutoInit",
		hint: "QuickCombat.PF2E.AutoInitHint",
		scope: "world",
		config: CONFIG.hasOwnProperty("PF2E"),
		type: String,
		default: "default",
		choices: {
			"default": "Default",
			"fast": "Fast",
			"prompt": "Prompt",
			"fast_prompt": "Fast/Prompt"
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
	var qc_playlists = game.settings.get("quick-combat", "playlists")
	var migrated = false

	try {
		var old_playlist = game.settings.get("quick-combat", "playlist")
		if (old_playlist != "") {
			var old_playlist_id = game.playlists.getName(old_playlist)?.id ?? null
			if (old_playlist_id == null) {
				console.error(`quick-combat | could not locate the matching playlists for ${old_playlist}`)
			}
			else if (!qc_playlists.map(a => a.id).includes(old_playlist_id)) {			
				console.debug(`quick-combat | migrating old combat playlist setting ${old_playlist} with ${old_playlist_id}`)	
				qc_playlists.push({
					"id": old_playlist_id,
					"scene": "",
					"fanfare": false
				})
			}
			game.settings.set("quick-combat", "playlist", "")
			migrated = true
		}
	}
	catch (error) {
		console.error(`quick-combat | could not locate the matching playlists for ${old_playlist} ${error}`)
		game.settings.set("quick-combat", "playlist", "")
		migrated = true
	}

	try {
		old_playlist = game.settings.get("quick-combat", "boss-playlist")
		if (old_playlist != "") {
			var old_playlist_id = game.playlists.getName(old_playlist)?.id ?? null
			if (old_playlist_id == null) {
				console.error(`quick-combat | could not locate the matching playlists for ${old_playlist}`)
			}
			else if (!qc_playlists.map(a => a.id).includes(old_playlist_id)) {
				console.debug(`quick-combat | migrating old boss combat playlist setting ${old_playlist} with ${old_playlist_id}`)
				qc_playlists.push({
					"id": old_playlist_id,
					"scene": "",
					"fanfare": false
				})
			}
			game.settings.set("quick-combat", "boss-playlist", "")
			migrated = true
		}
	}
	catch (error) {
		console.error(`quick-combat | could not locate the matching playlists for ${old_playlist} ${error}`)
		game.settings.set("quick-combat", "playlist", "")
		migrated = true
	}

	try {
		old_playlist = game.settings.get("quick-combat", "fanfare-playlist")
		if (old_playlist != "") {
			var old_playlist_id = game.playlists.getName(old_playlist)?.id ?? null
			if (old_playlist_id == null) {
				console.error(`quick-combat | could not locate the matching playlists for ${old_playlist}`)
			}
			else if (!qc_playlists.map(a => a.id).includes(old_playlist_id)) {
				console.debug(`quick-combat | migrating old fanfare combat playlist setting ${old_playlist} with ${old_playlist_id}`)
				qc_playlists.push({
					"id": old_playlist_id,
					"scene": "",
					"fanfare": true
				})
			}
			game.settings.set("quick-combat", "fanfare-playlist", "")
			migrated = true
		}
	}
	catch (error) {
		console.error(`quick-combat | could not locate the matching playlists for ${old_playlist} ${error}`)
		game.settings.set("quick-combat", "playlist", "")
		migrated = true
	}

	if (migrated) {
		game.settings.set("quick-combat", "playlists", qc_playlists)
		ui.notifications.warn(game.i18n.localize("QuickCombat.MigrationMessage"));
	}
});

async function start_playlist(playlist) {
	let playlists = []
	//list old playlists
	game.playlists.playing.forEach(function(playing) {
		var track_ids = playing.sounds.filter(a => a.playing == true).map(a => a.id)
		playlists.push({id:playing.id,track_ids:track_ids})
		//if a new playlist was given stop the old ones
		if (playlist && playlist.sounds.size > 0) {
			console.debug(`quick-combat | stopping old playlist ${playing.name}`)
			playing.stopAll()
		}
	});
	game.settings.set("quick-combat", "oldPlaylist", playlists)

	if (playlist && playlist.sounds.size > 0) {
		game.settings.set("quick-combat", "combatPlaylist", playlist.id)
		console.log(`quick-combat | starting combat playlist ${playlist.name}`)
		playlist.playAll()
	}
	else {
		console.debug("quick-combat | setting no playlist to start")
		game.settings.set("quick-combat", "combatPlaylist", null)
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
		for (var i = 0; i < qc_playlists.length; i++) {
			buttons[qc_playlists[i].id] = {
				label: qc_playlists[i].name,
				callback: (html, button) => {
					var playlist = game.playlists.get($(button.currentTarget).data("button"))
					start_playlist(playlist)
				},
				icon:  qc_playlists[i].name.toLowerCase().includes("boss") ? `<i class="fas fa-skull-crossbones"></i>` : `<i class="fas fa-music"></i>`
			}
		}		
		new Dialog({
			title: game.i18n.localize("QuickCombat.PlaylistWindowTitle"),
			content: game.i18n.localize("QuickCombat.PlaylistWindowDescription"),
			buttons: buttons,
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
	if (fanfare != null) {
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
	if (!playlists || playlists == null || playlists == "None" || playlists == []) {
		console.warn("no old playlists found, skipping")
		return true;
	}
	//start old playlists
	playlists.forEach(function(op) {
		//check if id is not an empty string
		if (op.id != "") {
			var oldPlaylist = game.playlists.get(op.id) ?? null
			//check if oldPlaylist is defined
			if (oldPlaylist) {
				if (op.track_ids != []) {
					console.debug(`quick-combat | starting old playlist ${oldPlaylist.name} tracks ${op.track_ids}`)
					for (var i = 0; i < op.track_ids.length; i++) {
						var sound = oldPlaylist.sounds.get(op.track_ids[i])
						oldPlaylist.playSound(sound)
					}
				}
				else {
					oldPlaylist.playAll();
				}
			}
			else {
				console.error(`quick-combat | could not locate a playlist that matches the id ${op.id}`)
			}
		}
		else {
			console.error("quick-combat | somehow an empty string got added to the old playlist settings")
		}
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