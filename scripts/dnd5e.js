import {genericCombat} from './generic.js'

//Dungeons and Dragons 5e Class/Functions
export class dnd5eCombat extends genericCombat {
	awardEXP(combat, userId) {
		let exp = 0;
		let defeated = [];
		//get only defeated NPCs that are hostile
		this.get_npcs(combat.combatants).filter(x => x.isDefeated).forEach(function(a) {
			exp += a.actor.system.details.xp.value;
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
				//actor experence should be a list of objects [{id: "token id", img: "", name: "actor name", exp: number, level: boolean}, ...]
				let actor_experence = []
				pcs.forEach(function(a) {
					let new_exp = a.actor.system.details.xp.value + exp
					let level_up = false
					//get next level exp
					if (new_exp >=  a.actor.system.details.xp.max) {
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
