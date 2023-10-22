import {addPlayers, startCombat, endCombat, PlaylistHandler} from './bin.js'
import {await_inits, hotkey} from './bin.js'
import {genericCombat} from './generic.js'
import {dnd5eCombat} from './dnd5e.js'
import {pf2eCombat} from './pf2e.js'
import {oseCombat} from './ose.js'

let SYSTEM = null;
const playlistHandler = new PlaylistHandler()

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
		return {qc_playlists}
	}

	/** @override */
	async _updateObject(event, formData) {
		const data = expandObject(formData);
		let playlists = []
		for (let [key, value] of Object.entries(data)) {
			if (value.id == "") {
				ui.notifications.error(game.i18n.localize("QuickCombat.SavePlaylistError"));
				return;
			}
			//check if playlist is set correctly
			if (value.fanfare) {
				var playlist = game.playlists.get(value.id)
				if (playlist.mode != CONST.PLAYLIST_MODES.DISABLED) {
					ui.notifications.error(playlist.name + " " + game.i18n.localize("QuickCombat.SaveFanfareError"));
					return
				}
			}
			else {
				var playlist = game.playlists.get(value.id)
				if (playlist.mode == CONST.PLAYLIST_MODES.DISABLED) {
					ui.notifications.error(playlist.name + " " + game.i18n.localize("QuickCombat.SavePlaylistTypeError"));
					return
				}
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
		await this.render();
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
		await this.render();
	}
}

//setup hotkey settings
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

//setup game settings and migrate old settings to new ones
Hooks.once("ready", () => {
	console.debug("quick-combat | register settings")

	//set factory for pf2e
	if (CONFIG.hasOwnProperty("PF2E")) {
		SYSTEM = new pf2eCombat()
	}
	//set factory for D&D 5e system
	else if (CONFIG.hasOwnProperty("DND5E")) {
		SYSTEM = new dnd5eCombat()
	}
	//set factory for OSE system
	else if (CONFIG.hasOwnProperty("OSE")) {
		SYSTEM = new oseCombat()
	}
	//for any other system
	else {
		SYSTEM = new genericCombat()
	}

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
	game.settings.register("quick-combat", "npcroll", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
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

	//initiative options
	game.settings.register("quick-combat", "initiative", {
		name: "QuickCombat.Initiative",
		hint: "QuickCombat.InitiativeHint",
		scope: "world",
		config: CONFIG.hasOwnProperty("OSE") ? false : true,
		default: CONFIG.hasOwnProperty("OSE") ? "disabled" : "enabled",
		type: String,
		choices: {
			"enabled": "Enabled",
			"disabled": "Disabled",
			"npc": "NPC Only",
			"pc": "PC Only"
		}
	})
	game.settings.register("quick-combat", "group", {
		name: "QuickCombat.Group",
		hint: "QuickCombat.GroupHint",
		scope: "world",
		config: CONFIG.hasOwnProperty("OSE") ? false : true,
		default: false,
		type: Boolean
	})


	//hidden settings
	game.settings.register("quick-combat", "oldPlaylist", {
		scope: "world",
		config: false,
		default: null,
		type: Object
	});
	game.settings.register("quick-combat", "combatPlaylist", {
		scope: "world",
		config: false,
		default: "",
		type: String
	});
	game.settings.register("quick-combat", "fanfarePlaylist", {
		scope: "world",
		config: false,
		default: "",
		type: String
	});
	
	//game system specific options
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

	//combat markers animations checks for JB2A_DnD5e (free) or jb2a_patreon (paid) and sequencer are installed
	game.settings.register("quick-combat", "combatMarkers", {
		name: "QuickCombat.CombatMarkers.Enable",
		hint: "QuickCombat.CombatMarkers.EnableHint",
		scope: "world",
		config: ((game.modules.get("JB2A_DnD5e")?.active ?? false) || (game.modules.get("jb2a_patreon")?.active ?? false)) && (game.modules.get("sequencer")?.active ?? false),
		default: false,
		type: Boolean,
	});
	game.settings.register("quick-combat", "combatMarkers-onDeck", {
		name: "QuickCombat.CombatMarkers.OnDeck",
		hint: "QuickCombat.CombatMarkers.OnDeckHint",
		scope: "world",
		config: ((game.modules.get("JB2A_DnD5e")?.active ?? false) || (game.modules.get("jb2a_patreon")?.active ?? false)) && (game.modules.get("sequencer")?.active ?? false),
		default: "jb2a.magic_signs.circle.01.abjuration",
		type: String,
	});
	game.settings.register("quick-combat", "combatMarkers-activeTurn", {
		name: "QuickCombat.CombatMarkers.ActiveTurn",
		hint: "QuickCombat.CombatMarkers.ActiveTurnHint",
		scope: "world",
		config: ((game.modules.get("JB2A_DnD5e")?.active ?? false) || (game.modules.get("jb2a_patreon")?.active ?? false)) && (game.modules.get("sequencer")?.active ?? false),
		default: "jb2a.magic_signs.circle.01.conjuration",
		type: String,
	});
	game.settings.register("quick-combat", "combatMarkerScale", {
		name: "QuickCombat.CombatMarkers.Scale",
		hint: "QuickCombat.CombatMarkers.ScaleHint",
		scope: "world",
		config: ((game.modules.get("JB2A_DnD5e")?.active ?? false) || (game.modules.get("jb2a_patreon")?.active ?? false)) && (game.modules.get("sequencer")?.active ?? false),
		default: 2,
		type: Number,
		range: {
			min: 1,
			max: 4,
			step: 0.1
		}
	})

	//migrate the NPC rolling option
	var npc_roll = game.settings.get("quick-combat", "npcroll")
	if (npc_roll) {
		console.debug("quick-combat | migrating old NPC Rolling setting to new initiative setting npc")
		game.settings.set("quick-combat", "initiative", "npc")
		game.settings.set("quick-combat", "npcroll", false)
	}

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

//when a combatant is added to the combat tracker
Hooks.on("createCombatant", async (combatant, update, userId) => {
	//only run if the GM added combatant OR if the player added the combatant
	if (game.userId != userId) {
		return true
	}
	if (combatant.initiative)
		return true

	if(game.combat.started) {
		//check if initiative option is set
		if(game.settings.get("quick-combat", "initiative") != "disabled") {
			//do system specific rolling options
			if (SYSTEM) {
				//check for group NPC initiatives
				var initiative = null
				if(game.settings.get("quick-combat", "group")) {
					initiative = game.combat.combatants.find(a => a.name == combatant.name)?.initiative
				}
				SYSTEM.rollInitiative(combatant, userId, initiative)
			}
			//for any other system
			else {
				console.warn("quick-combat | game system does not have any roll initiative options available")
			}
		}
	}
})

//either ask for which playlist to start or start a random one
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
				callback: () => {playlistHandler.start(null)},
				icon: `<i class="fas fa-volume-mute"></i>`
			}
		}
		let qc_playlists = playlistHandler.get()
		if (qc_playlists) {
			for (var i = 0; i < qc_playlists.length; i++) {
				buttons[qc_playlists[i].id] = {
					label: qc_playlists[i].name,
					callback: (html, button) => {
						var playlist = game.playlists.get($(button.currentTarget).data("button"))
						playlistHandler.start(playlist)
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
			playlistHandler.start()
		}
	}
	else {
		console.debug("quick-combat | skipping choose playlist dialog")
		playlistHandler.start(playlistHandler.get(false,true))
	}
});

Hooks.on("combatStart", async (combat, options) => {
	//check if initiative option is set
	if(game.settings.get("quick-combat", "initiative") != "disabled") {
		//do system specific rolling options
		if (SYSTEM) {
			//start the await initiative background task
			window.initInterval = setInterval(await_inits, 500)
			//ask for NPC rolls for PF2e
			if (CONFIG.hasOwnProperty("PF2E")) {
				if(game.settings.get("quick-combat", "initiative") == "npc" || game.settings.get("quick-combat", "initiative") == "enabled") {
					await SYSTEM.rollNPCInitiatives(combat)
				}
			}

			//check for group NPC initiatives
			if(game.settings.get("quick-combat", "group")) {
				//group all NPCs by name
				var groups = combat.combatants.filter(a => a.isNPC).reduce((group, combatant) => ({...group, [combatant.actor.id]: (group[combatant.actor.id] || []).concat(combatant)}), {})
				//get only multiples
				var multiples = Object.keys(groups).filter(k => groups[k].length > 1)
				var firsts = multiples.map(k => groups[k][0])
				//roll its initiative
				for (var i = 0; i < firsts.length; i++) {
					await SYSTEM.rollInitiative(firsts[i], game.userId)
				}
				//roll the rest
				var the_rest = multiples.map(k => groups[k].splice(1)).flat()
				for (var i = 0; i < the_rest.length; i++) {
					var initiative = game.combat.combatants.find(a => a.actor.id == the_rest[i].actor.id && a.initiative != null)?.initiative
					await SYSTEM.rollInitiative(the_rest[i], game.userId, initiative)
				}
			}
			//roll everything else
			combat.combatants.forEach(async function(c) {
				await SYSTEM.rollInitiative(c, game.userId)
			})
		}
		//for any other system
		else {
			console.warn("quick-combat | game system does not have any roll initiative options available")
		}
	}
})

//when a combat is ended do some end of combat stuff, exp, remove tokens etc
Hooks.on("deleteCombat", async (combat, options, userId) => {
	if (!game.user.isGM)
		return true;
	//reset start combat stuff
	console.debug("quick-combat | triggering delete combatant functions")
	//remove any effects
	if (game.modules.get("sequencer")?.active ?? false) {
		console.debug("quick-combat | Ending Combat Marker Animations")
		Sequencer?.EffectManager.endEffects({ name: "activeTurn" })
		Sequencer?.EffectManager.endEffects({ name: "onDeck" })
	}
	//if a system was defined and if track exp setting was set
	if (SYSTEM && game.settings.get("quick-combat", "exp")) {
		SYSTEM.awardEXP(combat, userId)
	}
	//remove defeated npc tokens
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
	//check for combat playlist and stop it
	let combatPlaylist = game.settings.get("quick-combat", "combatPlaylist")
	if(combatPlaylist) {
		let playlists = game.playlists.playing.filter(a => a.id == combatPlaylist)
		if (playlists) {
			playlists.forEach(async function(x) {
				console.debug(`quick-combat | stopping combat playlist ${x.name}`);
				await x.stopAll();
			});
		}
	}
	//if no combat playlist then check for fanfare playlist
	else {
		let fanfare = playlistHandler.get(true, true)
		//play fanfare playlist if set
		if (fanfare) {
			//stop old playlist 
			await playlistHandler.save(true)
			console.debug(`quick-combat | starting fanfare playlist ${fanfare.name}`)
			var items = Array.from(fanfare.sounds);
			if (items.length > 0) {
				var item = items[Math.floor(Math.random()*items.length)];
				console.debug(`quick-combat | starting fanfare track ${item.name}`)
				fanfare.playSound(item);
				//set fanfare setting
				game.settings.set("quick-combat", "fanfarePlaylist", fanfare.id)
			}
			else {
				//no fanfare items to play then just start the old playlist
				console.warn("quick-combat | fanfare playlist has no items")
			}
		}
	}
});

//when a playlist is stopped either start fanfare or old playlist
Hooks.on("updatePlaylist", async (playlist, update, options, userId) => {
	//only run for the GM
	if (!game.user.isGM)
		return true;
	//don't do anything if the update is set to playing
	if(playlist.playing)
		return true;

	let startOldPlaylist = false
	//if playlist is the combat playlist stopping
	if(playlist.id == game.settings.get("quick-combat", "combatPlaylist")) {
		//clear the combat playlist setting
		game.settings.set("quick-combat", "combatPlaylist", null)
		//get fanfare playlist
		let fanfare = playlistHandler.get(true, true)
		//play fanfare playlist if set
		if (fanfare) {
			console.debug(`quick-combat | starting fanfare playlist ${fanfare.name}`)
			var items = Array.from(fanfare.sounds);
			if (items.length > 0) {
				var item = items[Math.floor(Math.random()*items.length)];
				console.debug(`quick-combat | starting fanfare track ${item.name}`)
				fanfare.playSound(item);
				//set fanfare setting
				game.settings.set("quick-combat", "fanfarePlaylist", fanfare.id)
			}
			else {
				//no fanfare items to play then just start the old playlist
				startOldPlaylist = true
				console.warn("quick-combat | fanfare playlist has no items")
			}
		}
		//if no fanfare playlist set then start the old playlist
		else {
			startOldPlaylist = true
		}
	}

	//if playlist is fanfare playlist stopping
	if(playlist.id == game.settings.get("quick-combat", "fanfarePlaylist")) {
		//clear the fanfare playlist settings
		game.settings.set("quick-combat", "fanfarePlaylist", null)
		//start the old playlist
		startOldPlaylist = true
	}

	if (startOldPlaylist) {
		//get the old playlist setting
		let playlists = game.settings.get("quick-combat", "oldPlaylist")
		//set the old playlist setting to null
		game.settings.set("quick-combat", "oldPlaylist", null)
		//if nothing was set then return
		if (playlists) {
			//start old playlists
			playlists.forEach(function(op) {
				var oldPlaylist = game.playlists.get(op.id) ?? null
				//check if oldPlaylist is defined
				if (oldPlaylist) {
					//get old playlist track ids
					if (op.track_ids != []) {
						console.debug(`quick-combat | starting old playlist '${oldPlaylist.name}' tracks '${op.track_ids}'`)
						for (var i = 0; i < op.track_ids.length; i++) {
							var sound = oldPlaylist.sounds.get(op.track_ids[i])
							oldPlaylist.playSound(sound)
						}
					}
					//if none then just star the playlist again
					else {
						console.debug(`quick-combat | starting old playlist '${oldPlaylist.name}'`)
						oldPlaylist.playAll();
					}
				}
				else {
					console.error(`quick-combat | could not locate a playlist that matches the id '${op.id}'`)
				}
			})
		}
		else {
			console.warn("quick-combat | no old playlists found, skipping")
		}
	}
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
	//if not the GM and combat is not active (which should never be false here)
	if (!game.user.isGM && !combat?.active) {
		return
	}
	
	//only run for the GM and make sure the Sequencer is available check if theres a combat
	if(game.settings.get("quick-combat", "combatMarkers") && (game.user.isGM) && typeof Sequencer !== "undefined" && combat?.active) {
		console.debug("quick-combat | adding combat markers")
		//remove activeTurn/onDeck on previous source should have not animations
		Sequencer?.EffectManager.endEffects({ name: "activeTurn" })
		Sequencer?.EffectManager.endEffects({ name: "onDeck" })
		//get the size of the combat marker
		const scale = game.settings.get("quick-combat", "combatMarkerScale")
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
			var onDeckFile = game.settings.get("quick-combat", "combatMarkers-onDeck")
			new Sequence("quick-combat")
				.effect()
					.file(onDeckFile)
					.attachTo(nextToken, { bindVisibility: true, bindAlpha: true })
					.scaleToObject(scale)
					.belowTokens()
					.fadeIn(1500, {ease: "easeOutCubic", delay: 500})
					.fadeOut(1500, {ease: "easeOutCubic", delay: 500})
					.rotateIn(90, 2500, {ease: "easeInOutCubic"})
					.rotateOut(90, 2500, {ease: "easeInOutCubic"})
					.scaleIn(0, 2500, {ease: "easeInOutCubic"})
					.scaleOut(0, 2500, {ease: "easeInOutCubic"})
					.name("onDeck")
					.persist()
				.play()
		}
		//add active turn if it doesn't already exist
		const currentToken = canvas.tokens.get(combat.current.tokenId)
		if(Sequencer?.EffectManager.getEffects({ source: currentToken, name: "activeTurn" }).length == 0 ) {
			var activeTurnFile = game.settings.get("quick-combat", "combatMarkers-activeTurn")
			new Sequence("quick-combat")
				.effect()
					.file(activeTurnFile)
					.attachTo(currentToken, { bindVisibility: true, bindAlpha: true })
					.scaleToObject(scale)
					.belowTokens()
					.fadeIn(1500, {ease: "easeOutCubic", delay: 500})
					.fadeOut(1500, {ease: "easeOutCubic", delay: 500})
					.rotateIn(90, 2500, {ease: "easeInOutCubic"})
					.rotateOut(90, 2500, {ease: "easeInOutCubic"})
					.scaleIn(0, 2500, {ease: "easeInOutCubic"})
					.scaleOut(0, 2500, {ease: "easeInOutCubic"})
					.name("activeTurn")
					.persist()
				.play()
		}
	}
})

Hooks.once("setup", function() {
	console.debug("quick-combat | running setup hooks")
	var operations = {
		addPlayers: addPlayers,
		startCombat: startCombat,
		endCombat: endCombat
	}
	game.QuickCombat = operations;
	window.QuickCombat = operations;
})