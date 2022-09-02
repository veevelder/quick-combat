![Latest Release Download Count](https://img.shields.io/github/downloads/veevelder/quick-combat/latest/module.zip) ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fquick-combat&colorB=4aa94a) ![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fveevelder%2Fquick-combat%2Fmaster%2Fmodule.json&label=Foundry%20Version&query=$.compatibleCoreVersion&colorB=orange)

# BREAKING
With the update of version 0.2.5 of quick hits it will remove your old saved playlist setting. You will need to update the Quick Hit settings.

# Quick Combat module for FVTT
Adds the ability to add a Combat Playlist. Whenever you start combat the playlist will start.

Adds Auto Experience Tracking. When NPCs are defeated it will add the experience to PCs.

Adds a Hotkey to quickly add PCs, and NPCs to the combat tracker, roll their initiatives, and start combat.


## Current Game System Support
This module has been tested with the systems listed below. Plan is to make it available to other systems in the future. For other systems, everything except the Experience tracking should work, but this has not been tested yet.

* [D&D 5e](https://gitlab.com/foundrynet/dnd5e)
* [OSE](https://github.com/vttred/ose)

## How To Use Quick Combat

### FoundryVTT Version 9 Updates
With the new keybind capabilities built into Foundry Quick Combat no longer requires any dependencies, and some of the settings have moved/changed as noted below. The same basic functionality still exists.

### Settings

![Quick Combat Settings](images/settings.png)

* **Combat Playlist** - select from a list of playlists to play when starting combat, or None to not change the playlist.
* **Fanfare Playlist** - select from a list of playlists to play when combat ends, will randomly select a track to play.
* **Boss Combat Playlist** - select from a list of playlists to play when starting combat, or None to not change the playlist. This is separate from the Combat Playlist.
* **Only Roll Initiative for NPCs?** - When adding combatants to the combat tracker, only roll for NPCs and not PCs. If your players like to roll their own initiatives. Doesn't do anything for the OSE system.
* **Combat Experience Tracking** - (DND5E Only!) For any defeated NPCs will add any experience and for all PCs in combat will add any gained experience.
* **GM Experience Whisper** - Only Message the GM the experience gained.
* ~~**Combat Toggle Keybind** - Keybind combination to start and stop combat.~~ Its not located in the Configure Controls Settings Menu, Under Quick Hits.
* ~~**Combat Toggle Keybind WITHOUT playlist** - Keybind combination to start and stop combat, but will not start the Combat Playlist or Fanfare Playlist.~~ Not longer exists due to Playlist Selection Window
* **Remove Defeated NPCs?** - Will delete any of the defeated NPC tokens from the scene.

### Keybind Settings

![Quick Combat Settings](images/settings-keybind.png)

Under the Configure Control Settings Menu is located a **Quick Combat** Action Category. Where the Combat Toggle Keybind setting is now located. This can be changed as before.

**NOTE** Due to the way this Foundry setting works I had to change the default keybind from `Shift + C` to `Alt + C`.

### Start Combat
![Quick Combat Tokens Selected](images/tokens-selected.png)

Select all tokens for combat.

Hit the Combat Toggle Keybind hot key.

**New in Version 0.2.6** If enabled: A Window will pop up asking which playlist to start. Select which playlist to start or None to start no playlist and continue the same as before.

![Quick Combat Playlist With Boss](images/start-playlist-window-withboss.png)

If you have set a boss playlist in the settings the option will appear.

![Quick Combat Playlist With Boss](images/start-playlist-window-withoutboss.png)

If no boss playlist has been set in the settings the boss playlist option will not appear.

![Quick Combat Start](images/combat-start.png)

Adds all selected tokens to combat tracker, rolls all tokens initiatives, starts combat.

### End Combat
![Quick Combat End](images/end-combat-warning.png)

Hit the Combat Toggle Keybind hot key, a warning will pop up to make sure it wasn't an accident.

Will remove all combatants, and if experience tracking was enabled will find all defeated NPCs, calculate experience and display a chat box with all PCs experience.

![Quick End Experience](images/experience-tracking.png)

### Setup Combat Playlist Example
![Quick Combat Playlist](images/settings-withplaylist.png)

Setup Quick Combat to use the "Combat" playlist, start the "Background" playlist.

![Quick Combat Background Playlist](images/playlist.png)

Start Combat.

![Quick Combat Combat Playlist](images/playlist-start.png)

Stop Combat and will start the "Background" playlist again.

### Fanfare Playlist
Fanfare Playlist will only play at the end of combat. It will randomly select a track and play it once. After the track is done playing the playlist that was playing before combat started will start again.

![Fanfare Settings](images/fanfare_settings.png)

It is recommended that you set up the playlist using the `Soundboard Only` Playback Mode as shown below. You can also set the Fade Duration for any track if you require it.

![Fanfare Playlist](images/fanfare_playlist.png)

### NPC Rolling Only
![Quick Combat NPC Rolling](images/npc-rolls.png)

If set up will only roll for NPC combatants and not PCs.

![Quick Combat NPC Rolls](images/npc-roll.png)

### Remove Defeated
![Remove Defeated Settings](images/settings-remove-defeated.png)

Remove any of the defeated NPC combatants tokens from the Scene.

![Remove Defeated Before](images/removed-defeated-before.png)
Before

![Remove Defeated After](images/removed-defeated-after.png)
After
