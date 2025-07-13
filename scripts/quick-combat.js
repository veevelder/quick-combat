const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { addPlayers, startCombat, endCombat, PlaylistHandler } from "./bin.js";
import { await_inits, hotkey } from "./bin.js";
import { genericCombat } from "./generic.js";
import { dnd5eCombat } from "./dnd5e.js";
import { pf2eCombat } from "./pf2e.js";
import { oseCombat } from "./ose.js";

let SYSTEM = null;
const playlistHandler = new PlaylistHandler();

export class QuickCombatPlaylists extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "quick-combat-playlists",
        position: {
            width: 700,
            height: "auto",
        },
        window: {
            title: "QuickCombat.playlists.name",
            resizable: true,
        },
        tag: "form",
        form: {
            handler: this.onSavePlaylists,
            closeOnSubmit: true,
        },
        actions: {
            addPlaylist: this.onAddPlaylist,
            removePlaylist: this.onRemovePlaylist,
        },
    };

    static PARTS = {
        form: {
            template: "modules/quick-combat/templates/playlists.html",
        },
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.playlists = game.settings.get("quick-combat", "playlists");
        for (var i = 0; i < context.playlists.length; i++) {
            //get scene data
            context.playlists[i]["scene_ids"] = [];
            game.scenes.forEach(function (scene) {
            context.playlists[i]["scene_ids"].push({
                    id: scene.id,
                    name: scene.name,
                    selected: scene.id == context.playlists[i].scene,
                });
            });
            //get playlists data
            context.playlists[i]["playlist_ids"] = [];
            game.playlists.forEach(function (playlist) {
                context.playlists[i]["playlist_ids"].push({
                    id: playlist.id,
                    name: playlist.name,
                    selected: playlist.id == context.playlists[i].id,
                    empty: playlist.sounds.size == 0,
                });
            });
        }

        return context;
    }

    static async onSavePlaylists(event, form, formData) {
        event.preventDefault();
        const data = foundry.utils.expandObject(formData.object);
        let playlists = [];
        for (let value of Object.values(data)) {
            if (value.id == "") {
                ui.notifications.error(game.i18n.localize("QuickCombat.SavePlaylistError"));
                return;
            }
            //check if playlist is set correctly
            if (value.fanfare) {
                var playlist = game.playlists.get(value.id);
                if (playlist.mode != CONST.PLAYLIST_MODES.DISABLED) {
                    ui.notifications.error(`${playlist.name} ${game.i18n.localize("QuickCombat.SaveFanfareError")}`);
                    return;
                }
            } else {
                var playlist = game.playlists.get(value.id);
                if (playlist.mode == CONST.PLAYLIST_MODES.DISABLED) {
                    ui.notifications.error(`${playlist.name} ${game.i18n.localize("QuickCombat.SavePlaylistTypeError")}`);
                    return;
                }
            }
            playlists.push(value);
        }
        await game.settings.set("quick-combat", "playlists", playlists);
    }

    static async onAddPlaylist(event) {
        event.preventDefault();
        let playlists = game.settings.get("quick-combat", "playlists");
        playlists.push({
            id: "",
            scene: "",
            fanfare: false,
        });
        await game.settings.set("quick-combat", "playlists", playlists);
        await this.render();
    }

    static async onRemovePlaylist(event) {
        event.preventDefault();
        const el = $(event.target);
        if (!el) {
            return true;
        }
        let playlists = game.settings.get("quick-combat", "playlists");
        playlists.splice(el.data("idx"), 1);
        await game.settings.set("quick-combat", "playlists", playlists);
        el.remove();
        await this.render();
    }
}

//setup hotkey settings
Hooks.on("init", () => {
    console.debug("quick-combat | register keybind settings");
    game.keybindings.register("quick-combat", "key", {
        name: "QuickCombat.Keybind",
        hint: "QuickCombat.KeybindHint",
        editable: [{ key: "1", modifiers: ["Alt", "Shift"] }],
        onDown: hotkey,
        restricted: true, //gmonly
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    });
});

//setup game settings and migrate old settings to new ones
Hooks.once("ready", () => {
    console.debug("quick-combat | register settings");

    //set factory for pf2e
    if (CONFIG.hasOwnProperty("PF2E")) {
        SYSTEM = new pf2eCombat();
    }
    //set factory for D&D 5e system
    else if (CONFIG.hasOwnProperty("DND5E")) {
        SYSTEM = new dnd5eCombat();
    }
    //set factory for OSE system
    else if (CONFIG.hasOwnProperty("OSE")) {
        SYSTEM = new oseCombat();
    }
    //for any other system
    else {
        SYSTEM = new genericCombat();
    }

    //playlist options
    game.settings.registerMenu("quick-combat", "playlist-template", {
        name: "QuickCombat.button.name",
        label: "QuickCombat.button.label",
        hint: "QuickCombat.button.hint",
        type: QuickCombatPlaylists,
        restricted: true,
    });
    game.settings.register("quick-combat", "chooseplaylist", {
        name: "QuickCombat.ChoosePlaylist",
        hint: "QuickCombat.ChoosePlaylistHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });
    game.settings.register("quick-combat", "playlists", {
        name: "",
        hint: "",
        scope: "world",
        config: false,
        default: [],
        type: Object,
    });
    game.settings.register("quick-combat", "playlistRestart", {
        name: "QuickCombat.PlaylistRestart",
        hint: "QuickCombat.PlaylistRestartHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });

    //initiative options
    game.settings.register("quick-combat", "initiative", {
        name: "QuickCombat.Initiative",
        hint: "QuickCombat.InitiativeHint",
        scope: "world",
        config: CONFIG.hasOwnProperty("OSE") ? false : true,
        default: CONFIG.hasOwnProperty("OSE") ? "disabled" : "enabled",
        type: String,
        choices: {
        enabled: "Enabled",
        disabled: "Disabled",
        npc: "NPC Only",
        pc: "PC Only",
        },
    });
    game.settings.register("quick-combat", "group", {
        name: "QuickCombat.Group",
        hint: "QuickCombat.GroupHint",
        scope: "world",
        config: CONFIG.hasOwnProperty("OSE") ? false : true,
        default: false,
        type: Boolean,
    });

    //hidden settings
    game.settings.register("quick-combat", "oldPlaylist", {
        scope: "world",
        config: false,
        default: null,
        type: Object,
    });
    game.settings.register("quick-combat", "fanfarePlaylist", {
        scope: "world",
        config: false,
        default: "",
        type: String,
    });

    //game system specific options
    game.settings.register("quick-combat", "exp", {
        name: "QuickCombat.Exp",
        hint: "QuickCombat.ExpHint",
        scope: "world",
        config: CONFIG.hasOwnProperty("DND5E") || CONFIG.hasOwnProperty("OSE"),
        default: CONFIG.hasOwnProperty("DND5E") || CONFIG.hasOwnProperty("OSE"),
        type: Boolean,
    });
    game.settings.register("quick-combat", "expgm", {
        name: "QuickCombat.ExpGM",
        hint: "QuickCombat.ExpGMHint",
        scope: "world",
        config: CONFIG.hasOwnProperty("DND5E") || CONFIG.hasOwnProperty("OSE"),
        default: false,
        type: Boolean,
    });

    game.settings.register("quick-combat", "autoInit", {
        name: "QuickCombat.PF2E.AutoInit",
        hint: "QuickCombat.PF2E.AutoInitHint",
        scope: "world",
        config: CONFIG.hasOwnProperty("PF2E"),
        type: String,
        default: "default",
        choices: {
            default: "Default",
            fast: "Fast",
            prompt: "Prompt",
            fast_prompt: "Fast/Prompt",
        },
    });

    //non game system specific options
    game.settings.register("quick-combat", "rmDefeated", {
        name: "QuickCombat.RemoveDefeated",
        hint: "QuickCombat.RemoveDefeatedHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });
    game.settings.register("quick-combat", "tags", {
        name: "QuickCombat.Tags",
        hint: "QuickCombat.TagsHint",
        scope: "world",
        config: true,
        type: String,
        default: "pet, summon",
    });
});

//when a combatant is added to the combat tracker
Hooks.on("createCombatant", async (combatant, update, userId) => {
    //only run if the GM added combatant OR if the player added the combatant
    if (game.userId != userId || combatant.initiative !== null) {
        return;
    }
    //check if combatant has the ignore tags

    const tags = Tagger.hasTags(combatant.token, game.settings.get("quick-combat", "tags"), { matchAny: true, caseInsensitive: false });
    if (tags) {
        //remove the combatant from the tracker
        console.debug(`quick-combat | removing for combatant matching tags ${combatant.id}`);
        combatant.combat.combatants.delete(combatant.id);
        return;
    }

    if (game.combat.started && game.settings.get("quick-combat", "initiative") != "disabled") {
        //check for group NPC initiatives
        var initiative = null;
        if (game.settings.get("quick-combat", "group")) {
            initiative = game.combat.combatants.find((a) => a.name == combatant.name)?.initiative;
        }
        SYSTEM.rollInitiative(combatant, userId, initiative);
    }
});

//either ask for which playlist to start or start a random one
Hooks.on("preUpdateCombat", async (combat, update) => {
    const combatStart = combat.round === 0 && update.round === 1;
    if (!game.user.isGM || !combatStart) return;

    console.debug("quick-combat | triggering start combat functions");

    if (game.settings.get("quick-combat", "chooseplaylist")) {
        //generate a list of buttons
        var buttons = [{
            action: "none",
            label: game.i18n.localize("QuickCombat.NoneButton"),
            icon: `<i class="fas fa-volume-mute"></i>`,
            callback: (event) => {
                event.preventDefault();
                playlistHandler.start_combat(null);
            },
        }];

        let qc_playlists = playlistHandler.get();
        if (qc_playlists) {
            for (var i = 0; i < qc_playlists.length; i++) {
                buttons.push({
                    action: qc_playlists[i].id,
                    label: qc_playlists[i].name,
                    icon: qc_playlists[i].name.toLowerCase().includes("boss") ? `<i class="fas fa-skull-crossbones"></i>` : `<i class="fas fa-music"></i>`,
                    callback: async (event, button) => {
                        event.preventDefault();
                        const playlist = await game.playlists.get(button.dataset.action);
                        playlistHandler.start_combat(playlist);
                    },
                });
            }

                new foundry.applications.api.DialogV2({
                title: game.i18n.localize("QuickCombat.PlaylistWindowTitle"),
                content: game.i18n.localize("QuickCombat.PlaylistWindowDescription"),
                buttons: buttons,
            }).render({ force: true });
        } else {
            playlistHandler.start_combat();
        }
    } else {
        console.debug("quick-combat | skipping choose playlist dialog");
        playlistHandler.start_combat(playlistHandler.get(false, true));
    }
});

Hooks.on("combatStart", async (combat) => {
    if (!game.user.isGM) return;

    //check if initiative option is set
    if (game.settings.get("quick-combat", "initiative") != "disabled") {
        //ask for NPC rolls for PF2e
        if (CONFIG.hasOwnProperty("PF2E")) {
            if (game.settings.get("quick-combat", "initiative") == "npc" || game.settings.get("quick-combat", "initiative") == "enabled") {
                await SYSTEM.rollNPCInitiatives(combat);
            }
        }

        //check for group NPC initiatives
        if (game.settings.get("quick-combat", "group")) {
            //group all NPCs by name
            var groups = combat.combatants.filter((a) => a.isNPC).reduce(
                (group, combatant) => ({
                    ...group,
                    [combatant.actor.id]: (group[combatant.actor.id] || []).concat(combatant),
                }),
                {},
            );
            //get only multiples
            var multiples = Object.keys(groups).filter((k) => groups[k].length > 1);
            var firsts = multiples.map((k) => groups[k][0]);
            //roll its initiative
            for (var i = 0; i < firsts.length; i++) {
                await SYSTEM.rollInitiative(firsts[i], game.userId);
            }
            //roll the rest
            var the_rest = multiples.map((k) => groups[k].splice(1)).flat();
            for (var i = 0; i < the_rest.length; i++) {
                var initiative = game.combat.combatants.find((a) => a.actor.id == the_rest[i].actor.id && a.initiative != null,)?.initiative;
                await SYSTEM.rollInitiative(the_rest[i], game.userId, initiative);
            }
        }
        //roll everything else
        combat.combatants.forEach(async function (c) {
            await SYSTEM.rollInitiative(c, game.userId);
        });
        //start the await initiative background task
        window.initInterval = setInterval(await_inits, 1500, game.settings.get("quick-combat", "initiative"));
    }
});

//when a combat is ended do some end of combat stuff, exp, remove tokens etc
Hooks.on("deleteCombat", async (combat, options, userId) => {
    if (!game.user.isGM) return;

    // only trigger stuff IF the combat has been started otherwise ignore
    if (!combat.started) return;

    console.log(combat, options, userId);
    //reset start combat stuff
    console.debug("quick-combat | triggering delete combatant functions");
    //if track exp setting was set
    if (game.settings.get("quick-combat", "exp")) {
        SYSTEM.awardEXP(combat, userId);
    }
    //remove defeated npc tokens
    if (game.settings.get("quick-combat", "rmDefeated")) {
        console.debug("quick-combat | removing defeated NPCs");
        var ids = [];
        //add only Hostile NPCs
        combat.combatants
            .filter((x) => x.isNPC)
            .filter((x) => x.token.disposition == -1)
            .filter((x) => x.isDefeated)
            .forEach(function (a) {
                //check if tokens exists first
                if (game.scenes.current.tokens.has(a.token.id)) {
                    console.debug(`quick-combat | removing defeated NPC ${a.token.name}`);
                    ids.push(a.token.id);
                }
            });
        let scene = game.scenes.active;
        if (scene) {
            await scene.deleteEmbeddedDocuments("Token", ids);
        }
    }
    //start fanfare if exists otherwise start old
    let started = await playlistHandler.start_fanfare();
    if (!started) {
        playlistHandler.start_old();
    }
});

//when a playlist is stopped either start fanfare or old playlist
Hooks.on("updatePlaylist", async (playlist) => {
    //don't do anything if the update is set to playing
    if (playlist.playing) return;

    //if playlist is fanfare playlist stopping
    if (playlist.id == game.settings.get("quick-combat", "fanfarePlaylist")) {
        //clear the fanfare playlist settings
        game.settings.set("quick-combat", "fanfarePlaylist", null);
        //start the old playlist
        playlistHandler.start_old();
    }
});

Hooks.on("renderChatMessage", (message, html) => {
    let ids = html.find(".quick-combat-token-selector");
    ids.click(function (event) {
        event.preventDefault();
        if (!canvas?.scene?.active) return;
        const token = canvas.tokens?.get($(event.currentTarget).data("tokenid"));
        token?.control({ multiSelect: false, releaseOthers: true });
    });
});

Hooks.once("setup", function () {
    console.debug("quick-combat | running setup hooks");
    //adding macro calls
    var operations = {
        addPlayers: addPlayers,
        startCombat: startCombat,
        endCombat: endCombat,
    };
    game.QuickCombat = operations;
    window.QuickCombat = operations;
});
