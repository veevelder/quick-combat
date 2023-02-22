//Pathfinder 2nd Edition Class/Functions
import {socket} from './bin.js'
import {ask_initiative} from './bin.js'

export class pf2eCombat {
	constructor() {
		this.init_options = "<option value='perception'>" + game.i18n.localize(CONFIG.PF2E.attributes.perception) + "</option>"
		var keys = Object.keys(CONFIG.PF2E.skills)
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i]
			this.init_options += `<option value='${key}'>${game.i18n.localize(CONFIG.PF2E.skills[key])}</option>`
		}
	}

	awardEXP(combat, userId) {
		console.debug("quick-combat | skipping award experience for PF2e")
	}

	async promptOwner(combatant, userId) {
		//popup asking for initiative types before adding to combat tracker
		console.log(`quick-combat | pf2e rolling prompt PC initiative for ${combatant.actor.name}`)
		//get the token ownership and ask only one player
		var owners = combatant.actor.ownership
		//remove default
		delete owners.default
		//remove default GM
		delete owners[game.users.filter(a => a.isGM)[0].id]
		let user = null
		//loop over the remaining owners
		for (const owner in owners) {
			//if user is an owner `3`
			if (combatant.actor.ownership[owner] == 3) {
				//prompt if user is connected
				if (game.users.get(owner).active) {
					user = owner
					break
				}
				//prompt that 
				else {
					//will prompt the GM that created the combatant
					user = userId
					break
				}
			}
		}
		var init = await socket.executeAsUser(ask_initiative, user, this.init_options, combatant.actor.id)
		await combatant.actor.update({"system.attributes.initiative.ability": init})
		combatant.combat.rollInitiative([combatant.id], {"secret": false, "skipDialog": true})
	}

	async rollInitiative(combatant, userId) { 
		//if combatant already has an initiative skip them
		if (combatant.initiative) {
			console.debug(`quick-combat | combatant ${combatant.name} already roll for initiative skipping`)
			return
		}
		//render a popup box to ask for NPC and PC roll types
		if (game.settings.get("quick-combat", "autoInit") == "prompt") {
			//send prompts to PCs
			if (!combatant.isNPC && !game.settings.get("quick-combat", "npcroll")) {
				this.promptOwner(combatant, userId)
			}
			//ask group NPCs later before Combat is started
		}
		else if (game.settings.get("quick-combat", "autoInit") == "fast_prompt") {
			//if combatant is an NPC
			if (combatant.isNPC) {
				console.log(`quick-combat | pf2e rolling fast_prompt NPC (perception) initiative for ${combatant.actor.name}`)
				await combatant.actor.update({"system.attributes.initiative.ability": "perception"})
				combatant.combat.rollInitiative([combatant.id], {"secret": true, "skipDialog": true})
			}
			//if combatant is a PC and npcroll is not set
			else if (!combatant.isNPC && !game.settings.get("quick-combat", "npcroll")) {
				console.log(`quick-combat | pf2e rolling fast_prompt PC initiative for ${combatant.actor.name}`)
				this.promptOwner(combatant, userId)
			}
		}
		//pf2e assume perception for every token
		else if (game.settings.get("quick-combat", "autoInit") == "fast") {
			console.log(`quick-combat | pf2e rolling fast (perception) initiative for ${combatant.actor.name}`)
			await combatant.actor.update({"system.attributes.initiative.ability": "perception"})
			//if combatant is an NPC
			if (combatant.isNPC) {
				//combatant ==> combatant.id
				combatant.combat.rollInitiative([combatant.id], {"secret": true, "skipDialog": true})
			}
			//if combatant is a PC and npcroll is not set
			else if (!combatant.isNPC && !game.settings.get("quick-combat", "npcroll")) {
				//combatant ==> combatant.id
				combatant.combat.rollInitiative([combatant.id], {"secret": false, "skipDialog": true})
			}	
		}
		//use pf2e system defaults
		else {
			console.log(`quick-combat | pf2e rolling default initiative for ${combatant.actor.name}`)
			//if combatant is an NPC
			if (combatant.isNPC) {
				//combatant ==> combatant.id
				combatant.combat.rollInitiative([combatant.id], {"secret": true, "skipDialog": false})
			}
			//if combatant is a PC and npcroll is not set
			else if (!combatant.isNPC && !game.settings.get("quick-combat", "npcroll")) {
				//combatant ==> combatant.id
				combatant.combat.rollInitiative([combatant.id], {"secret": false, "skipDialog": false})
			}			
		}
	}

	rollNPCInitiatives(combat) {
		//render a popup box to ask for NPC group roll types
		if (game.settings.get("quick-combat", "autoInit") == "prompt") {
			//get all npcs that don't have an initiative
			var npcs = combat.combatants.filter(a => a.isNPC).filter(a => a.initiative == null)
			//if there are not NPCs to roll then skip
			if(npcs.length == 0) {
				console.log("quick-combat | no NPCs found to roll skipping")
				return
			}
			console.log("quick-combat | pf2e rolling npc prompt initiatives", npcs)
			//popup asking for initiative types before adding to combat tracker
			var npc_defaults = ""
			for(var i = 0; i < npcs.length; i++) {
				npc_defaults += `<select id='inits_${npcs[i].actor.id}'>${this.init_options}</select><label style='padding-left:10px' for='inits_${npcs[i].actor.id}'>${npcs[i].actor.name}</label></br>`
			}
			new Dialog({
				title: "Update NPC Initiative",
				content: `<label for='all_npcs'>${game.i18n.localize("QuickCombat.PF2E.groupMSG")}</label><input type='checkbox' id='all_npcs' checked><select id='inits'>${this.init_options}</select>
				<p class="notes">${game.i18n.localize("QuickCombat.PF2E.groupHint")}</p><hr>${npc_defaults}`,
				buttons: {
					button: {
						label: game.i18n.localize("QuickCombat.PF2E.updateButton"),
						icon: "<i class='fa-solid fa-dice'></i>",
						callback: async (html) => {
							var inits = html.find("select#inits").find(":selected").val()
							var all_npcs = html.find("input#all_npcs").prop("checked")
							for(var i = 0; i < npcs.length; i++) {
								//get init type if checkbox is enabled or not
								if (!all_npcs) {
									inits = html.find("select#inits_" + npcs[i].actor.id).find(":selected").val()
								}
								//update actors to match initiative
								console.debug(`quick-combat | updating ${npcs[i].actor.name} initiative to ${inits}`)
								await npcs[i].actor.update({"system.attributes.initiative.ability": inits})
								await combat.rollInitiative([npcs[i].id], {"secret": true, "skipDialog": true})
							}
						}
					}
				},
			}).render(true);
		}
	}
}