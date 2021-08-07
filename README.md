![Latest Release Download Count](https://img.shields.io/github/downloads/veevelder/quick-combat/latest/quick-combat.zip) ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fquick-combat&colorB=4aa94a) ![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fveevelder%2Fquick-combat%2Fmaster%2Fmodule.json&label=Foundry%20Version&query=$.compatibleCoreVersion&colorB=orange)
# Quick Combat module for FVTT

Adds the ability to add a Combat Playlist. Whenever you start combat the playlist will start.

Adds Auto Experience Tracking. When NPCs are defeated it will add the experience to PCs. Will only work on DND5E other systems this setting is not available.

Other Systems are planned for experience tracking support in the future, as of now DND5E is the only system that is supported. 

Adds a Hotkey to quickly add PCs, and NPCs to the combat tracker, roll their initiatives, and start combat.

This module has been tested with the D&D 5E system. Plan is to make it available to other systems in the future. For other systems, everything except the Experience tracking should work, but this has not been tested yet.


## How To Use Quick Combat

### Settings
![Quick Combat Settings](images/settings.png)

* **Combat Playlist** - select from a list of playlists to play when starting combat, or None to not change the playlist.
* **Fanfare Playlist** - select from a list of playlists to play when combat ends, will randomly select a track to play.
* **Only Roll Initiative for NPCs?** - When adding combatants to the combat tracker, only roll for NPCs and not PCs. If your players like to roll their own initiatives.
* **Combat Experience Tracking** - (DND5E Only!) For any defeated NPCs will add any experience and for all PCs in combat will add any gained experience.
* **GM Experience Whisper** - Only Message the GM the experience gained.
* **Combat Toggle Keybind** - Keybind combination to start and stop combat.
* **Combat Toggle Keybind WITHOUT playlist** - Keybind combination to start and stop combat, but will not start the Combat Playlist or Fanfare Playlist.
* **Remove Defeated NPCs?** - Will delete any of the defeated NPC tokens from the scene.

### Start Combat
![Quick Combat Tokens Selected](images/tokens-selected.png)

Select all tokens for combat.

Hit the Combat Toggle Keybind hot key.

![Quick Combat Start](images/combat-start.png)

Adds all selected tokens to combat tracker, rolls all tokens initiatives, starts combat.

### End Combat
![Quick Combat End](images/end-combat-warning.png)

Hit the Combat Toggle Keybind hot key, a warning will pop up to make sure it wasn't an accident.

Will remove all combatants, and if experience tracking was enabled will find all defeated NPCs, calcuate experience and display a chat box with all PCs experience.

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

