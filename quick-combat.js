import settingsExtender from './settings-extender.js';
settingsExtender();

const registerSettings = () => {
	// module settings
	game.settings.register("quick-combat", "playlist", {
		name: "QuickCombat.Playlist",
		hint: "QuickCombat.PlaylistHint",
		scope: "world",
		config: true,
		default: 0,
		isSelect: true,
		choices: ["None"].concat(game.playlists.entities.map(x => x.data.name)),
		type: String
	});
	
	game.settings.register("quick-combat", "exp", {
		name: "QuickCombat.Exp",
		hint: "QuickCombat.ExpHint",
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});
	
	game.settings.register("quick-combat", "key", {
		name: "QuickCombat.Keybind",
		hint: "QuickCombat.KeybindHint",
		scope: "world",
		config: true,
		default: "Shift + C",
		type: window.Azzu.SettingsTypes.KeyBinding,
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
};

class QuickCombat {
	static init() {
		registerSettings();
	}

	static async rollInitiatives(combat) {
		var combatants = combat.combatants;
		for (var i = 0; i < combatants.length; i++) {
			let rollType = CONST.DICE_ROLL_MODES.PUBLIC
			if (combatants[i].hidden) {
				rollType = CONST.DICE_ROLL_MODES.PRIVATE
			}
			await combat.rollInitiative(combatants[i]._id, {messageOptions: {rollMode: rollType}})
		}
	}
	
	static async addCombatants() {
		// Reference the combat encounter displayed in the Sidebar if none was provided
		var combat = ui.combat.combat;
		if ( !combat ) {
			if ( game.user.isGM ) {
				combat = await game.combats.object.create({scene: canvas.scene._id, active: true});
			}
			else {
				return ui.notifications.warn(game.i18n.localize("COMBAT.NoneActive"));
			}
		}

		var tokens = canvas.tokens.controlled.filter(t => t.inCombat === false).filter(function(token) {
			if (token.actor.data.items.filter(c => c.name == "Pet").length == 0) {
				return token
			}
		});
		
		// Process each controlled token, as well as the reference token
		const createData = tokens.map(t => {return {tokenId: t.id, hidden: t.data.hidden}});
		await combat.createEmbeddedEntity("Combatant", createData)
		combat.startCombat();
	}
	
	static awardExp(combat, userId) {
		let exp = 0;
		let defeated = [];
		combat.combatants.filter(x => !x.actor.hasPlayerOwner).filter(x => x.defeated).forEach(function(a) { 
			exp += a.actor.data.data.details.xp.value;
			defeated.push(a.name); 
		});
		let pcs = combat.combatants.filter(x => x.actor.hasPlayerOwner);
		exp = Math.round(exp / pcs.length);

		if (exp != 0 && !isNaN(exp)) {
			let actor_exp_msg = "<table>";
			pcs.forEach(function(a) {
				let new_exp = a.actor.data.data.details.xp.value + exp
				let level_up = ""
				if (new_exp >= a.actor.data.data.details.xp.max) {
					level_up = "<td><strong>" + game.i18n.localize("QuickCombat.LevelUp") + "</strong></td>"
				}
				actor_exp_msg += "<tr><td><img src='" + a.img + "' width='50' height='50'></td><td><strong>" + a.name + "</strong></td><td>" + a.actor.data.data.details.xp.value + " &rarr; " + new_exp + "</p></td>" + level_up + "</tr>"
				a.actor.update({
					"data.details.xp.value": new_exp
				});
			});
			let msg = "<p>" + game.i18n.localize("QuickCombat.ExperienceMessageStart") + " <strong>" + defeated.join(", ") + "</strong> " + game.i18n.localize("QuickCombat.ExperienceMessageMid") + " <strong>" + exp + "</strong> " + game.i18n.localize("QuickCombat.ExperienceMessageEnd") + "</p>" + actor_exp_msg + "</table>";
			ChatMessage.create({
				user: userId, 
				content: msg,
				type: CONST.CHAT_MESSAGE_TYPES.OTHER
			}, {});
		}
	}
	
	static startPlaylist() {
		var playlists = game.playlists.playing.map(a => a.data.name);
		game.settings.set("quick-combat", "oldPlaylist", playlists)
		game.playlists.playing.forEach(function(playing) {
			playing.stopAll()
		});

		var name = game.settings.settings.get("quick-combat.playlist").choices[game.settings.get("quick-combat", "playlist")]
		game.playlists.getName(name).playAll();
	}
	
	static stopPlaylist() {
		var name = game.settings.settings.get("quick-combat.playlist").choices[game.settings.get("quick-combat", "playlist")]
		game.playlists.getName(name).stopAll();

		game.settings.get("quick-combat", "oldPlaylist").forEach(function(playlist) {
			game.playlists.getName(playlist).playAll();
		})
		game.settings.set("quick-combat", "oldPlaylist", [])
	}
}

Hooks.once("ready", function() {
	window.addEventListener("keydown", ev => {
		//only allow for non repeat keys on the body by the GM
		if (ev.repeat || document.activeElement.tagName !== "BODY" || !game.users.filter(a => a.id == game.userId)[0].isGM)
			return true;

		let setting_key = game.settings.get("quick-combat", "key")
		if (setting_key != null) {
			const key = window.Azzu.SettingsTypes.KeyBinding.parse(setting_key)
			if (window.Azzu.SettingsTypes.KeyBinding.eventIsForBinding(ev, key)) {
				ev.preventDefault();
				ev.stopPropagation();
				if (game.settings.get("quick-combat", "inCombat")) {
					game.combat.endCombat();
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
	QuickCombat.init();
});

Hooks.on("preDeleteCombat", (combat, options, userId) => {
	game.settings.set("quick-combat", "inCombat", false);
	if (game.settings.get("quick-combat", "exp")) {
		QuickCombat.awardExp(combat, userId);
	}
	if (game.settings.get("quick-combat", "playlist") != 0) {
		QuickCombat.stopPlaylist();
	}
});

Hooks.on("updateCombat", (combat, update, options, userId) => {
	if (!game.settings.get("quick-combat", "inCombat")) {
		game.settings.set("quick-combat", "inCombat", true);
		QuickCombat.rollInitiatives(combat);
		if (game.settings.get("quick-combat", "playlist") != 0) {
			QuickCombat.startPlaylist();
		}
	}
});
