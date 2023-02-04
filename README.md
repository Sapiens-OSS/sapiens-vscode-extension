# Sapiens VSCode Extension
Sapiens Mod development extension for VSCode

## Usage
1. Install the Sapiens Modding extension for VSCode in the VSCode marketplace
2. Search using Ctrl+Shift+P for 'newProject'. An option to create a new Sapiens mod project will appear
3. Follow the guide that shows up
    3.1. Enter the directory in which a new directory will be created that contains the project
    3.2. Enter the Mod ID. This ID will become the name of the directory it will create
    3.3. Enter the path to your Sapiens installation. This depends on where your Steam library is located, but the default locations are as follows:

        | Platform       	| File Path                                                                                                           	|
        |----------------	|---------------------------------------------------------------------------------------------------------------------	|
        | Windows        	| `%AppData%\majicjungle\sapiens\mods`                                                                                	|
        | MacOS          	| ?                                                                                                                   	|
        | Linux (Proton) 	| `~/.steam/steam/steamapps/compatdata/1060230/pfx/drive_c/users/steamuser/AppData/Roaming/majicjungle/sapiens/mods/` 	|

        Note that the extension will attempt to automatically look for an installation folder, but this is a long process with a tendency to crash, and only works on Linux for now. So don't bother waiting for it
    3.4. Enter the name of your mod. This is a string in which you are free to type in anything
    3.5. Enter the description of your mod
    3.6. Enter the mod type. To know the difference, consult the wiki. But in short: If your mod is for localizations (translations), choose 'app'. Otherwise, choose 'world'
    3.7. Enter the name of the developer (you)
    3.8. Enter a website (optional)
4. Confirm, but double-check the location it will write files to, as well as the mod location where your mod will be copied to when building
5. In the output, you can follow the process. If everything works, it will open a new VSCode window in the project.

From thereon out, you can run
```
cmake --build build/ --target run_game
```
To run and build the game.

If, for any reason, your build folder was removed, your steam library location changes, or you want to change the ID of your mod, run the following:
```
# Linux users, replace cmake with x86_64-w64-mingw32-cmake
cmake -DMOD_ID=MyCMod -DAUTO_COPY_MOD=ON -DSAPIENS_MOD_DIRECTORY="/path/to/sapiens/installation/mods/folder" . -B build
```

## Bug reports
Please open an issue here on GitHub, or mention it in the modding Discord: https://discord.gg/WnN8hj2Fyg