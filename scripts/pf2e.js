//Pathfinder 2nd Edition Class/Functions
import {socket} from './bin.js'
import {ask_initiative} from './bin.js'
import {genericCombat} from './generic.js'

export class pf2eCombat extends genericCombat {
	constructor() {
		super()
		//PF2e 5.2.0 update to perception flag
		if (foundry.utils.isNewerVersion(game.settings.version, "5.2.0")) {
			this.init_options = "<option value='perception'>" + game.i18n.localize("PF2E.PerceptionLabel") + "</option>"
		}
		else {
			this.init_options = "<option value='perception'>" + game.i18n.localize(CONFIG.PF2E.attributes.perception) + "</option>"
		}

		if (CONFIG.PF2E.hasOwnProperty("skillList")) {
			var keys = Object.keys(CONFIG.PF2E.skillList)
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i]
				this.init_options += `<option value='${key}'>${game.i18n.localize(CONFIG.PF2E.skillList[key])}</option>`
			}
		}
		else {
			var keys = Object.keys(CONFIG.PF2E.skills)
			for (var i = 0; i < keys.length; i++) {
				var key = keys[i]
				this.init_options += `<option value='${key}'>${game.i18n.localize(CONFIG.PF2E.skills[key].label)}</option>`
			}
		}
	}

	rollOptions(secret = true, skipDialog = true) {
		if(secret) {
			return {
				secret: secret,
				skipDialog: skipDialog,
				formula: null,
				updateTurn: true,
				rollMode: CONST.DICE_ROLL_MODES.PRIVATE
			}
		}
		else {
			return {
				secret: secret,
				skipDialog: skipDialog,
				formula: null,
				updateTurn: true,
				rollMode: CONST.DICE_ROLL_MODES.PUBLIC
			}
		}
	}

	async actor_update(actor, init) {
		//v10 update
		await actor.update({"system.attributes.initiative.ability": init})
		//v11 update
		await actor.update({"system.attributes.initiative.statistic": init})
		//v12 update
		await actor.update({"system.initiative.statistic": init})
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
		await this.actor_update(combatant.actor, init)
		combatant.combat.rollInitiative([combatant.id], this.rollOptions(false))
	}

	async rollInitiative(combatant, userId, initiative = null) { 
		//if combatant already has an initiative skip them
		if (combatant.initiative) {
			console.debug(`quick-combat | combatant ${combatant.name} already roll for initiative skipping`)
			return
		}
		if (initiative) {
			console.log(`quick-combat | setting initiative ${initiative} for ${combatant.name}`)
			await combatant.update({"initiative": initiative})
		}
		else {
			//render a popup box to ask for NPC and PC roll types
			if (game.settings.get("quick-combat", "autoInit") == "prompt") {
				//send prompts to PCs
				if (!combatant.isNPC && game.settings.get("quick-combat", "initiative") != "npc") {
					this.promptOwner(combatant, userId)
				}
				//ask group NPCs later before Combat is started
			}
			//prompt for users assume perception for npcs
			else if (game.settings.get("quick-combat", "autoInit") == "fast_prompt") {
				//if combatant is an NPC
				if (combatant.isNPC && game.settings.get("quick-combat", "initiative") != "pc") {
					console.log(`quick-combat | pf2e rolling fast_prompt NPC (perception) initiative for ${combatant.actor.name}`)
					await this.actor_update(combatant.actor, "perception")
					await combatant.combat.rollInitiative([combatant.id], this.rollOptions())
				}
				//if combatant is a PC and npcroll is not set
				else if (!combatant.isNPC && game.settings.get("quick-combat", "initiative") != "npc") {
					console.log(`quick-combat | pf2e rolling fast_prompt PC initiative for ${combatant.actor.name}`)
					this.promptOwner(combatant, userId)
				}
			}
			//pf2e assume perception for every token
			else if (game.settings.get("quick-combat", "autoInit") == "fast") {
				console.log(`quick-combat | pf2e rolling fast (perception) initiative for ${combatant.actor.name}`)
				await this.actor_update(combatant.actor, "perception")
				//if combatant is an NPC
				if (combatant.isNPC && game.settings.get("quick-combat", "initiative") != "pc") {
					await combatant.combat.rollInitiative([combatant.id], this.rollOptions())
				}
				//if combatant is a PC and npcroll is not set
				else if (!combatant.isNPC && game.settings.get("quick-combat", "initiative") != "npc") {
					await combatant.combat.rollInitiative([combatant.id], this.rollOptions(false))
				}	
			}
			//use pf2e system defaults
			else {
				console.log(`quick-combat | pf2e rolling default initiative for ${combatant.actor.name}`)
				//if combatant is an NPC
				if (combatant.isNPC && game.settings.get("quick-combat", "initiative") != "pc") {
					await combatant.combat.rollInitiative([combatant.id], this.rollOptions(true, false))
				}
				//if combatant is a PC and npcroll is not set
				else if (!combatant.isNPC && game.settings.get("quick-combat", "initiative") != "npc") {
					await combatant.combat.rollInitiative([combatant.id], this.rollOptions(false, false))
				}			
			}
		}
	}

	async rollNPCInitiatives(combat) {
		//render a popup box to ask for NPC group roll types
		if (game.settings.get("quick-combat", "autoInit") == "prompt") {
			//get all npcs that don't have an initiative
			var npcs = []
			//only present one NPC for groups
			if(game.settings.get("quick-combat", "group")) {
				this.get_npcs(combat.combatants).filter(a => a.initiative == null).filter(function(item){
					var i = npcs.findIndex(x => (x.actor.id == item.actor.id));
					if(i <= -1){
						npcs.push(item);
					}
					return null;
				  });
			}
			else {
				npcs = this.get_npcs(combat.combatants).filter(a => a.initiative == null)
			}
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
								await this.actor_update(npcs[i].actor, inits)
								await combat.rollInitiative([npcs[i].id], this.rollOptions())
							}
							if(game.settings.get("quick-combat", "group")) {
								//get the rest of the NPCS to set initiatives
								var the_rest = game.combat.combatants.filter(a => a.isNPC && a.initiative == null)
								for (var i = 0; i < the_rest.length; i++) {
									var initiative = game.combat.combatants.find(a => a.actor.id == the_rest[i].actor.id && a.initiative != null)?.initiative
									await the_rest[i].update({"initiative": initiative})
								}
							}
						}
					}
				},
			}).render(true);
		}
	}
}
