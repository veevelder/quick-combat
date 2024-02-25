//Generic System Class/Functions
//these functions may or may not work attempt anyways
export class genericCombat {
	async rollInitiative(combatant, userId, initiative = null, group = false) {
		try {
			//check if combatant already has an initiative
			if (combatant.initiative) {
				console.debug(`quick-combat | combatant ${combatant.name} already has an initiative skipping`)
				return
			}
			if (initiative) {
				console.log(`quick-combat | setting initiative ${initiative} for ${combatant.name}`)
				await combatant.update({"initiative": initiative})
			}
			else {
				console.log(`quick-combat | rolling initiative for ${combatant.name}`)
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
		catch {
			console.warn(`quick-combat | generic rollInitiative was unable to roll for the combatant ${combatant.name} skipping`)
		}
	}

	awardEXP(combat, userId) {
		console.warn("quick-combat | unknown system cannot award EXP")
	}
}