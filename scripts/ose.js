//Old School Essentials Class/Functions
export class oseCombat {
	async rollInitiative(combatant, userId, initiative = null, group = false) {
		console.debug("quick-combat | skipping combat rolling for OSE")
	}

	awardEXP(combat, userId) {
		let exp = 0;
		let defeated = [];
		//get only defeated NPCs that are hostile
		combat.combatants.filter(x => x.isNPC).filter(x => x.token.disposition == -1).filter(x => x.isDefeated).forEach(function(a) {
			exp += parseInt(a.actor.system.details.xp);
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
					//calculate share should be 100%
					exp = exp * (a.actor.system.details.xp.share / 100)
					//add ose specific details: previous exp amount + exp + bonus
					let new_exp = Math.round(a.actor.system.details.xp.value + exp + (exp * (a.actor.system.details.xp.bonus / 100)))
					let level_up = ""
					//get next level exp
					let max_xp = a.actor.system.details.xp.next
					if (new_exp >= max_xp) {
						level_up = "<td><strong>" + game.i18n.localize("QuickCombat.LevelUp") + "</strong></td>"
						a.actor.update({
							"data.details.level": a.actor.system.details.level + 1
						});
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
}