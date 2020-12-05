//import settingsExtender from './settings-extender.js';

const registerSettings = () => {
	// module settings
	game.settings.register("combater", "playlist", {
		name: "Combater.Playlist",
		hint: "Combater.PlaylistHint",
		scope: "world",
		config: true,
		default: 0,
		isSelect: true,
		choices: ["None"].concat(game.playlists.entities.map(x => x.data.name)),
		type: String
	});
	
	game.settings.register("combater", "exp", {
		name: "Combater.Exp",
		hint: "Combater.ExpHint",
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});
	
	game.settings.register("combater", "key", {
		name: "Combater.Keybind",
		hint: "Combater.KeybindHint",
		scope: "world",
		config: true,
		default: "c",
		type: String
	});
	
	game.settings.register("combater", "oldPlaylist", {
		scope: "world",
		config: false,
		default: "",
		type: Object
	});
	
	game.settings.register("combater", "inCombat", {
		scope: "world",
		config: false,
		default: false,
		type: Boolean
	});
};

class Combater {
	static init() {
		registerSettings();
	}

	static async rollInitiatives(combat) {
		console.log("rolling combatants initiatives")
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
		console.log("creating a new combat instance");

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
		console.log("adding combatants to combat tracker");

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
		console.log("awarding experience to pcs");

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
					level_up = "<td><strong>" + game.i18n.localize("Combater.LevelUp") + "</strong></td>"
				}
				actor_exp_msg += "<tr><td><img src='" + a.img + "' width='50' height='50'></td><td><strong>" + a.name + "</strong></td><td>" + a.actor.data.data.details.xp.value + " &rarr; " + new_exp + "</p></td>" + level_up + "</tr>"
				a.actor.update({
					"data.details.xp.value": new_exp
				});
			});
			let msg = "<p>" + game.i18n.localize("Combater.ExperienceMessageStart") + " <strong>" + defeated.join(", ") + "</strong> " + game.i18n.localize("Combater.ExperienceMessageMid") + " <strong>" + exp + "</strong> " + game.i18n.localize("Combater.ExperienceMessageEnd") + "</p>" + actor_exp_msg + "</table>";
			ChatMessage.create({
				user: userId, 
				content: msg,
				type: CONST.CHAT_MESSAGE_TYPES.OTHER
			}, {});
		}
	}
	
	static startPlaylist() {
		var playlists = game.playlists.playing.map(a => a.data.name);
		game.settings.set("combater", "oldPlaylist", playlists)
		game.playlists.playing.forEach(function(playing) {
			playing.stopAll()
		});
		console.log("Saving/Stopping Current Playlists", game.settings.get("combater", "oldPlaylist"))

		var name = game.settings.settings.get("combater.playlist").choices[game.settings.get("combater", "playlist")]
		console.log("Starting Combat Playlist", name);
		game.playlists.getName(name).playAll();
	}
	
	static stopPlaylist() {
		var name = game.settings.settings.get("combater.playlist").choices[game.settings.get("combater", "playlist")]
		console.log("Stopping Combat Playlist", name);
		game.playlists.getName(name).stopAll();

		console.log("Starting Old Playlists");
		game.settings.get("combater", "oldPlaylist").forEach(function(playlist) {
			game.playlists.getName(playlist).playAll();
		})
		game.settings.set("combater", "oldPlaylist", [])
	}
}

Hooks.once("ready", function() {
	window.addEventListener("keydown", ev => {
		if (ev.repeat)
			return true;
		//console.log(game.settings.get("combater", "key"), ev);
		if(game.settings.get("combater", "key") == ev.key) {
			if (game.settings.get("combater", "inCombat")) {
				game.combat.endCombat();
			}
			else {
				//check if combat tracker has combatants
				if(combat.combatants && combat.combatants.length > 0) {
					game.combat.startCombat();
				}
				//check if GM has any selected tokens
				else if (canvas.tokens.controlled.length === 0) {
					ui.notifications.error(game.i18n.localize("Combater.KeyError"));
				}
				else {
					Combater.addCombatants();
				}
			}
		}
	});
});

Hooks.on("ready", function () {
	Combater.init();
});

Hooks.on("preDeleteCombat", (combat, options, userId) => {
	console.log("in end combat hook");
	game.settings.set("combater", "inCombat", false);
	if (game.settings.get("combater", "exp")) {
		Combater.awardExp(combat, userId);
	}
	if (game.settings.get("combater", "playlist") != 0) {
		Combater.stopPlaylist();
	}
});

Hooks.on("updateCombat", (combat, update, options, userId) => {
	if (!game.settings.get("combater", "inCombat")) {
		game.settings.set("combater", "inCombat", true);
		Combater.rollInitiatives(combat);
		if (game.settings.get("combater", "playlist") != 0) {
			Combater.startPlaylist();
		}
	}
});
