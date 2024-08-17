//Generic System Class/Functions
//these functions may or may not work attempt anyways
export class genericCombat {
	//filter combat tracker for npcs
	get_npcs(combatants, hostile = true) {
		//get only defeated NPCs that are hostile
		if (hostile) {
			return combatants.filter(x => x.isNPC).filter(x => x.token.disposition == CONST.TOKEN_DISPOSITIONS.HOSTILE)
		}
		else {
			return combatants.filter(x => x.isNPC)
		}
	}

	//filter combat tracker for pcs
	get_pcs(combatants) {
		return combatants.filter(x => !x.isNPC)
	}

	//create exp message
	//actor experence should be a list of objects [{id: "token id", img: "", name: "actor name", exp: number, level: boolean}, ...]
	exp_message(experence, defeated, actor_exp, userId) {
		let actor_exp_msg = "<table>";
		actor_exp.forEach(function(a) {
			let level_up = ""
			if (a.level) {
				level_up = `<td><strong>${game.i18n.localize("QuickCombat.LevelUp")}</strong></td>`
			}
			actor_exp_msg += `<tr data-tokenid='${a.id}' class='quick-combat-token-selector'><td><img src='${a.img}' width='50' height='50'></td><td>${a.name}</td><td>${a.exp} &rarr; ${a.exp + experence}</td>${level_up}</tr>`
		});
		actor_exp_msg += "</table>"
		let msg = `<p>${game.i18n.localize("QuickCombat.ExperienceMessageStart")} <strong>${defeated.join(", ")}</strong> ${game.i18n.localize("QuickCombat.ExperienceMessageMid")} <strong>${experence}</strong> ${game.i18n.localize("QuickCombat.ExperienceMessageEnd")}</p>${actor_exp_msg}`

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
				style: CONST.CHAT_MESSAGE_STYLES.OTHER
			}, {});
		}
	}

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
			console.warn(`quick-combat | rollInitiative was unable to roll for the combatant ${combatant.name} skipping`)
		}
	}

	awardEXP(combat, userId) {
		console.warn("quick-combat | skipping award experience")
	}
}
