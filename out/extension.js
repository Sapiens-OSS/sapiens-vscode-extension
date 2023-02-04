"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const fsPromises = require("fs/promises");
const util = require("util");
const child_process_1 = require("child_process");
const log = vscode.window.createOutputChannel("sapiens-vscode-extension-log");
function fileExplorer(startPath, title, onNext, autoDetectLocations) {
    let currentPath = startPath === "/" ? [''] : startPath.split('/');
    const pathToString = () => currentPath.length > 1 ? currentPath.join('/') : "/";
    let autoDetectedLocations = [];
    autoDetectLocations
        ? autoDetectLocations()
            .then(answer => {
            autoDetectedLocations = answer;
            path.items = pathItems();
        })
            .catch(err => {
            log.appendLine(err);
            console.log(err);
            autoDetectedLocations = [`Error autodetecting locations: ${err}`];
            path.items = pathItems();
        })
        : null;
    const readContents = () => fs.readdirSync(pathToString(), { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    let contentOnPath = readContents();
    const pathItems = () => {
        const autoDetectContent = autoDetectLocations !== undefined && autoDetectedLocations.length === 0
            ? [{ label: 'Auto-detecing locations. Please wait... (can take up to 5 minutes)', description: `In the meantime, you can manually search for the location` }]
            : autoDetectedLocations.map(a => ({ label: a }));
        return [
            { label: 'Auto-detected locations', kind: vscode.QuickPickItemKind.Separator },
            ...autoDetectContent,
            { label: 'Search location manually', kind: vscode.QuickPickItemKind.Separator },
            { label: '.', description: 'select this directory' },
            { label: '..', description: 'go back' },
            ...contentOnPath.map(c => ({ label: c }))
        ];
    };
    const path = vscode.window.createQuickPick();
    path.title = title;
    path.placeholder = pathToString();
    path.onDidAccept(() => {
        if (path.selectedItems.length > 0) {
            const selectedItem = path.selectedItems[0];
            if (selectedItem.label === ".") {
                path.hide();
                onNext(pathToString());
            }
            else if (selectedItem.label === "..") {
                currentPath = currentPath.slice(0, currentPath.length - 1);
                contentOnPath = readContents();
                path.value = "";
                path.placeholder = pathToString();
                path.items = pathItems();
            }
            else {
                if (selectedItem.label.startsWith("/")) {
                    currentPath = selectedItem.label === "/" ? [''] : selectedItem.label.split('/');
                }
                else {
                    currentPath = [...currentPath, selectedItem.label];
                }
                contentOnPath = readContents();
                path.value = "";
                path.placeholder = pathToString();
                path.items = pathItems();
            }
        }
    });
    path.step = 0;
    path.items = pathItems();
    path.show();
}
function enterPath(info) {
    fileExplorer(info.path ?? "/", `This command is used to initialize a new Sapiens project. Please enter the root path where the directory of the project shall reside`, (currentPath) => enterId({ ...info, path: currentPath }));
}
function enterId(info) {
    const input = vscode.window.createInputBox();
    input.step = 1;
    input.title = "Enter the ID of your mod";
    input.placeholder = "IDs should not contain any form of whitespace";
    input.value = info.id ?? "";
    input.show();
    input.onDidAccept(() => {
        input.hide();
        enterModPath({ ...info, id: input.value });
    });
}
function enterModPath(info) {
    fileExplorer(info.modPath ?? `/`, `Enter the path to the mods folder in your Sapiens installation location`, (currentPath) => enterName({ ...info, modPath: currentPath }), async () => {
        const found = (await util.promisify(child_process_1.exec)(`find / -type d -name 'majicjungle' -print 2>/dev/null`));
        return found.stdout.split('\n').filter(f => f !== '');
    });
}
function enterName(info) {
    const input = vscode.window.createInputBox();
    input.step = 2;
    input.title = "Enter the name of your mod";
    input.value = info.MOD_NAME ?? "";
    input.show();
    input.onDidAccept(() => {
        input.hide();
        enterDescription({ ...info, MOD_NAME: input.value });
    });
}
function enterDescription(info) {
    const input = vscode.window.createInputBox();
    input.step = 3;
    input.title = "Enter the description of your mod";
    input.value = info.MOD_DESCRIPTION ?? "";
    input.show();
    input.onDidAccept(() => {
        input.hide();
        enterModType({ ...info, MOD_DESCRIPTION: input.value });
    });
}
function enterModType(info) {
    const pick = vscode.window.createQuickPick();
    pick.step = 4;
    pick.title = `Enter the type of your mod`;
    pick.items = [
        { label: "world", description: "The 'standard' type of mod. They are run both on the client and the server, and are very useful when trying to add any sort of content." },
        { label: "app", description: "Mods that affect the whole game. They are run on the client, and are useful for things like Localization" }
    ];
    pick.value = info.MOD_TYPE ?? "";
    pick.show();
    pick.onDidAccept(() => {
        pick.hide();
        if (pick.activeItems.length > 0) {
            const activeItem = pick.activeItems[0];
            pick.hide();
            enterDeveloper({ ...info, MOD_TYPE: activeItem.label });
        }
    });
}
function enterDeveloper(info) {
    const input = vscode.window.createInputBox();
    input.step = 5;
    input.title = "Enter the developer's name of your mod";
    input.value = info.MOD_DEVELOPER ?? "";
    input.show();
    input.onDidAccept(() => {
        input.hide();
        enterWebsite({ ...info, MOD_DEVELOPER: input.value });
    });
}
function enterWebsite(info) {
    const input = vscode.window.createInputBox();
    input.step = 6;
    input.title = "Enter an optional website for your mod";
    input.value = info.MOD_WEBSITE ?? "";
    input.show();
    input.onDidAccept(() => {
        input.hide();
        enterConfirmation({ ...info, MOD_WEBSITE: input.value });
    });
}
function enterConfirmation(info) {
    const input = vscode.window.createQuickPick();
    input.step = 7;
    input.title = `Please confirm the following information:\n
Setup of the project will be installed at ${info.path}/${info.id} (will write to this location).\n
Your Sapiens installation's mods folder is located at ${info.modPath} (will write to this location).\n
Mod name, description, etc. will be writted to modInfo.lua, where you can change their values any time you want.\n
Is this OK?`;
    input.items = [{ label: "Yes" }, { label: "No" }];
    input.show();
    input.onDidAccept(() => {
        if (input.activeItems.length > 0) {
            const activeItem = input.activeItems[0];
            console.log(activeItem);
            input.hide();
            if (activeItem.label === "Yes") {
                initializeProject(info);
            }
        }
    });
}
async function initializeProject(info) {
    const repo = `https://github.com/nmattela/sapiens-cmake-template.git`;
    const directory = `${info.path}/${info.id}`;
    const execPromise = util.promisify(child_process_1.exec);
    try {
        log.appendLine(`Initializing project with the following information: ${JSON.stringify(info, null, 2)}`);
        log.appendLine(`cloning ${repo} to ${directory}`);
        const { stdout: cloneOut, stderr: cloneErr } = await execPromise(`git clone -b copyInsteadOfSymlink --recurse-submodules ${repo} ${directory}`);
        log.appendLine(cloneOut);
        log.appendLine(cloneErr);
        log.appendLine(`success`);
        log.appendLine(`removing .git file`);
        const { stdout: rmOut, stderr: rmErr } = await execPromise(`rm -rf ${directory}/.git`);
        log.appendLine(rmOut);
        log.appendLine(rmErr);
        log.appendLine(`success`);
        log.appendLine(`reading modInfo.lua`);
        const modInfo = (await fsPromises.readFile(`${directory}/modInfo.lua`)).toString()
            .replace(`"MOD_NAME"`, `"${info.MOD_NAME}"`)
            .replace(`"MOD_DESCRIPTION"`, `"${info.MOD_DESCRIPTION}"`)
            .replace(`"MOD_TYPE"`, `"${info.MOD_TYPE}"`)
            .replace(`"MOD_DEVELOPER"`, `"${info.MOD_DEVELOPER}"`)
            .replace(`"MOD_WEBSITE"`, `"${info.MOD_WEBSITE}"`);
        log.appendLine(`success`);
        log.appendLine(`rewriting contents of modInfo.lua to:\n${modInfo}`);
        await fsPromises.writeFile(`${directory}/modInfo.lua`, modInfo);
        log.appendLine(`success`);
        const cmakeBuildBinary = process.platform === "linux" ? `x86_64-w64-mingw32-cmake` : `cmake`;
        const cdCommand = `cd ${directory}`;
        const cmakeBuild = `${cmakeBuildBinary} -DMOD_ID="${info.id}" -DAUTO_COPY_MOD=ON -DSAPIENS_MOD_DIRECTORY="${info.modPath}" ${directory} -B build`;
        log.appendLine(`running ${cdCommand} && ${cmakeBuild}`);
        const { stdout: cmakeOut, stderr: cmakeErr } = await execPromise(`${cdCommand} && ${cmakeBuild}`);
        log.appendLine(cmakeOut);
        log.appendLine(cmakeErr);
        log.appendLine(`success`);
        log.appendLine(`opening project in new window`);
        await execPromise(`code ${directory}`);
        log.appendLine(`success`);
        log.appendLine(`your project was opened in a new VSCode window`);
    }
    catch (e) {
        console.log(e);
        log.appendLine(e);
    }
}
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    const newProject = vscode.commands.registerCommand('sapiens-vscode-extension.newProject', () => {
        const sapiensProjectInfo = {
            path: process.env.HOME ?? "/",
        };
        enterPath(sapiensProjectInfo);
    });
    context.subscriptions.push(newProject);
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map