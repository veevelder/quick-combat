import {genericCombat} from './generic.js'

//Old School Essentials Class/Functions
export class oseCombat extends genericCombat {
	async rollInitiative(combatant, userId, initiative = null, group = false) {
		console.debug("quick-combat | skipping combat rolling for OSE")
	}

	awardEXP(combat, userId) {
		let exp = 0;
		let defeated = [];
		//get only defeated NPCs that are hostile
		this.get_npcs(combat.combatants).filter(x => x.isDefeated).forEach(function(a) {
			if (typeof a.actor.system.details.xp === "string" || a.actor.system.details.xp instanceof String) {
				exp += parseInt(a.actor.system.details.xp)
			}
			else {
				exp += a.actor.system.details.xp
			}
			defeated.push(a.name);
		});

		let pcs = this.get_pcs(combat.combatants)
		if (pcs.length < 1 ) {
			ui.notifications.error(game.i18n.localize("QuickCombat.noPlayerError"));
		}
		else {
			exp = Math.round(exp / pcs.length);
			console.log(`quick-combat | awarding exp ${exp} to PCs`)
			if (exp != 0 && !isNaN(exp)) {
				let actor_experence = []
				pcs.forEach(function(a) {
					//calculate share should be 100%
					let exp_share = exp * (a.actor.system.details.xp.share / 100)
					let bonus = exp * (a.actor.system.details.xp.bonus / 100)
					//add ose specific details: previous exp amount + exp + bonus
					let new_exp = Math.round(a.actor.system.details.xp.value + exp_share + bonus)
					let level_up = false
					//get next level exp
					if (new_exp >= a.actor.system.details.xp.next) {
						level_up = true
					}
					a.actor.update({
						"system.details.xp.value": new_exp
					});
					actor_experence.push({
						id: a.token.id,
						img: a.img,
						name: a.name,
						exp: a.actor.system.details.xp.value,
						level: level_up
					})
				});
				this.exp_message(exp, defeated, actor_experence, userId)
			}
			else {
				console.info("quick-combat | no exp for PCs")
			}
		}
	}
}
