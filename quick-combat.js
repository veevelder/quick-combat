import {KeyBinding} from '../settings-extender/settings-extender.js'

class QuickCombat {
	static init() {
		console.debug("quick-combat | register settings")
		// module settings
		game.settings.register("quick-combat", "playlist", {
			name: "QuickCombat.Playlist",
			hint: "QuickCombat.PlaylistHint",
			scope: "world",
			config: true,
			default: 0,
			isSelect: true,
			choices: ["None"].concat(game.playlists.contents.map(x => x.data.name)),
			type: String
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

		game.settings.register("quick-combat", "key", {
			name: "QuickCombat.Keybind",
			hint: "QuickCombat.KeybindHint",
			scope: "world",
			config: true,
			default: "Shift + C",
			type: KeyBinding,
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

		game.settings.register("quick-combat", "inCombat", {
			scope: "world",
			config: false,
			default: false,
			type: Boolean
		});
	}

	static async rollInitiatives(combat) {
		console.log("quick-combat | rolling initiatives for NPCs")
		await combat.rollNPC()
		//check for PC roll option
		if (game.settings.get("quick-combat", "npcroll")) {
			return;
		}
		console.log("quick-combat | rolling initiatives for PCs")
		//roll all PCs that haven't rolled initiative yet
		await combat.rollInitiative(combat.combatants.filter(a => a.actor.hasPlayerOwner).filter(a => !a.initiative).map(a => a.id))
	}
	
	static async addCombatants() {
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
		await QuickCombat.rollInitiatives(combat);
		console.log("quick-combat | starting combat")
		await combat.startCombat();
	}
	
	static awardExp(combat, userId) {
		let exp = 0;
		let defeated = [];
		combat.combatants.filter(x => !x.actor.hasPlayerOwner).filter(x => x.data.defeated).forEach(function(a) { 
			exp += a.actor.data.data.details.xp.value;
			defeated.push(a.name); 
		});
		let pcs = combat.combatants.filter(x => x.actor.hasPlayerOwner);
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
				actor_exp_msg += "<tr><td><img src='" + a.img + "' width='50' height='50'></td><td><strong>" + a.name + "</strong></td><td>" + a.actor.data.data.details.xp.value + " &rarr; " + new_exp + "</p></td>" + level_up + "</tr>"
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
	
	static startPlaylist() {
		var playlists = game.playlists.playing.map(a => a.data.name);
		game.settings.set("quick-combat", "oldPlaylist", playlists)
		console.debug("quick-combat | stopping old playlist ${playlists}")
		game.playlists.playing.forEach(function(playing) {
			playing.stopAll()
		});

		var name = game.settings.settings.get("quick-combat.playlist").choices[game.settings.get("quick-combat", "playlist")]
		console.debug("quick-combat | starting combat playlist ${name}")
		game.playlists.getName(name).playAll();
	}
	
	static stopPlaylist() {
		var name = game.settings.settings.get("quick-combat.playlist").choices[game.settings.get("quick-combat", "playlist")]
		console.debug("quick-combat | stopping combat playlist ${name}")
		game.playlists.getName(name).stopAll();

		var playlists = game.settings.get("quick-combat", "oldPlaylist");
		console.debug("quick-combat | starting old playlist ${playlists}")
		playlists.forEach(function(playlist) {
			game.playlists.getName(playlist).playAll();
		})
		game.settings.set("quick-combat", "oldPlaylist", [])
	}
	
	static async removeDefeated(combat, userId) {
		console.debug("quick-combat | removing defeated NPCs")
		var ids = []
		combat.combatants.filter(x => !x.actor.hasPlayerOwner).filter(x => x.data.defeated).forEach(function(a) {
			ids.push(a.token.id)
		});
		let scene = game.scenes.active;
		await scene.deleteEmbeddedDocuments("Token", ids)
	}
}

Hooks.once("ready", function() {
	//only allow for the GM
	if (!game.users.filter(a => a.id == game.userId)[0].isGM)
		return true;

	console.debug("quick-combat | initializing")
	window.addEventListener("keydown", ev => {
		//only allow for non repeat keys on the body by the GM
		if (ev.repeat || document.activeElement.tagName !== "BODY" || !game.users.filter(a => a.id == game.userId)[0].isGM)
			return true;

		let setting_key = game.settings.get("quick-combat", "key")
		if (setting_key != null) {
			const key = KeyBinding.parse(setting_key)
			if (KeyBinding.eventIsForBinding(ev, key)) {
				ev.preventDefault();
				ev.stopPropagation();
				if (game.settings.get("quick-combat", "inCombat")) {
					let combat = game.combat;
					if (combat) {
						combat.endCombat();
					}
					else {
						game.settings.set("quick-combat", "inCombat", false)
					}
				}
				else {
					//check if combat tracker has combatants
					if(combat.combatants && combat.combatants.length > 0) {
						game.combat.startCombat();
					}
					//check if GM has any selected tokens
					else if (canvas.tokens.controlled.length === 0) {
						ui.notifications.error(game.i18n.localize("QuickCombat.KeyError"));
					}
					else {
						QuickCombat.addCombatants();
					}
				}
			}
		}
	});
});

Hooks.on("ready", function () {
	if (!game.users.filter(a => a.id == game.userId)[0].isGM)
		return true;
	QuickCombat.init();
});

Hooks.on("preDeleteCombat", (combat, options, userId) => {
	if (!game.users.filter(a => a.id == game.userId)[0].isGM)
		return true;
	console.debug("quick-combat | triggering end of combat functions")
	game.settings.set("quick-combat", "inCombat", false);
	if (game.settings.get("quick-combat", "exp")) {
		QuickCombat.awardExp(combat, userId);
	}
	if (game.settings.get("quick-combat", "playlist") != 0) {
		QuickCombat.stopPlaylist();
	}
});

Hooks.on("preUpdateCombat", (combat, route, options, userId) => {
	if (!game.users.filter(a => a.id == game.userId)[0].isGM)
		return true;
	console.debug("quick-combat | triggering start combat functions")
	if (!game.settings.get("quick-combat", "inCombat")) {
		game.settings.set("quick-combat", "inCombat", true);
		if (game.settings.get("quick-combat", "playlist") != 0) {
			QuickCombat.startPlaylist();
		}
	}
});

Hooks.on("deleteCombat", (combat, options, userId) => {
	if (!game.users.filter(a => a.id == game.userId)[0].isGM)
		return true;
	console.debug("quick-combat | triggering delete combatant functions")
	if (game.settings.get("quick-combat", "rmDefeated")) {
		QuickCombat.removeDefeated(combat, userId);
	}
});
