//Dungeons and Dragons 5e Class/Functions
export class dnd5eCombat {
	async rollInitiative(combatant, userId, initiative = null) {
		//check if combatant already has an initiative
		if (combatant.initiative) {
			console.debug(`quick-combat | combatant ${combatant.name} already has an initiative skipping`)
			return
		}
		if (initiative) {
			console.log(`quick-combat | dnd5e setting initiative ${initiative} for ${combatant.name}`)
			await combatant.update({"initiative": initiative})
		}
		else {
			console.log(`quick-combat | dnd5e rolling initiative for ${combatant.name}`)
			//if combatant is a NPC
			if(combatant.isNPC && game.settings.get("quick-combat", "initiative") != "pc") {
				await combatant.combat.rollInitiative([combatant.id], {"messageOptions":{"rollMode": CONST.DICE_ROLL_MODES.PRIVATE}})
			}
			//if PC and npcroll is not set
			else if (!combatant.isNPC && game.settings.get("quick-combat", "initiative") != "npc") {
				await combatant.combat.rollInitiative([combatant.id], {"messageOptions":{"rollMode": CONST.DICE_ROLL_MODES.PUBLIC}})
			}
		}
	}

	awardEXP(combat, userId) {
		let exp = 0;
		let defeated = [];
		//get only defeated NPCs that are hostile
		combat.combatants.filter(x => x.isNPC).filter(x => x.token.disposition == -1).filter(x => x.isDefeated).forEach(function(a) {
			exp += a.actor.system.details.xp.value;
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
					let new_exp = a.actor.system.details.xp.value + exp
					let level_up = ""
					//get next level exp
					let max_xp = a.actor.system.details.xp.max
					if (new_exp >= max_xp) {
						level_up = "<td><strong>" + game.i18n.localize("QuickCombat.LevelUp") + "</strong></td>"
						//if the pc has a class then update the level
						let cl = a.actor.items.find(a => a.type == "class")
						if (cl) {
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
}