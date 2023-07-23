// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as util from 'util';
import { execSync, exec } from "child_process";
import { openStdin, stderr, stdout } from 'process';

const execPromise = util.promisify(exec);

type SapiensProjectInfo = {
	path: string,
	id: string,
	modPath: string,
	MOD_NAME: string,
	MOD_DESCRIPTION: string,
	MOD_DEVELOPER: string,
	MOD_WEBSITE: string,
	MOD_TYPE: "world" | "app"
};


abstract class Platform {
	
	abstract directorySeparator: string;

	abstract cloneRepo(path: string, repoUrl: string): string;
	abstract removeDir(path: string): string;
	abstract changeDir(path: string): string;
	abstract cmakeInit(path: string, modPath: string): string;
	abstract cmakeBuild(): string;
	abstract openVsCode(path: string): string;
	abstract chainCommands(...commands: Array<string>): string;

	abstract getRoots(): Array<string>;

	abstract toPathArray(path: string): Array<string>;

	public static New() {
		switch(process.platform) {
			case "win32": return new WindowsPlatform();
			case "linux": return new LinuxPlatform();
			default: {throw new Error(`Unsupported platform: ${process.platform}`);}
		}
	}
}

class LinuxPlatform extends Platform {

	directorySeparator: string = "/";

	cloneRepo(path: string, repoUrl: string): string {
		return `git clone --recurse-submodules ${repoUrl} ${path}`;
	}

	removeDir(path: string): string {
		return `rm -rf ${path}`;
	}

	changeDir(path: string): string {
		return `cd ${path}`;
	}

	cmakeInit(path: string, modPath: string): string {
		const strippedPath = path.endsWith(this.directorySeparator) ? path.slice(0, path.length-1) : path;
		const strippedModPath = modPath.endsWith(this.directorySeparator) ? modPath.slice(0, modPath.length-1) : modPath;

		return `x86_64-w64-mingw32-cmake -DAUTO_COPY_MOD=ON -DSAPIENS_MOD_DIRECTORY="${strippedModPath}" ${strippedPath} -B build`;
	}

	cmakeBuild(): string {
		return `cmake --build build/ --target sync_mod_files --target run_game`;
	}

	openVsCode(path: string): string {
		return `code ${path}`;
	}

	chainCommands(...commands: string[]): string {
		return commands.join(` && `);
	}

	getRoots(): string[] {
		return [`/`];
	}

	toPathArray(path: string): string[] {
		if(path.startsWith("/")) {
			if(path === "/") {
				return ["/"];
			} else {
				return ["/", ...path.slice(1).split("/")];
			}
		} else {
			return path.split("/");
		}
	}
}

class WindowsPlatform extends Platform {

	directorySeparator: string = "\\";

	cloneRepo(path: string, repoUrl: string): string {
		return `git clone --recurse-submodules ${repoUrl} ${path}`;
	}

	removeDir(path: string): string {
		return `rmdir /Q /S ${path}`;
	}

	changeDir(path: string): string {
		return `cd ${path}`;
	}

	cmakeInit(path: string, modPath: string): string {
		const strippedPath = path.endsWith(this.directorySeparator) ? path.slice(0, path.length-1) : path;
		const strippedModPath = modPath.endsWith(this.directorySeparator) ? modPath.slice(0, modPath.length-1) : modPath;

		return `cmake -DAUTO_COPY_MOD=ON -DSAPIENS_MOD_DIRECTORY="${strippedModPath}" ${strippedPath} -B build`;
	}

	cmakeBuild(): string {
		return `cmake --build build/ --target sync_mod_files --target run_game`;
	}

	openVsCode(path: string): string {
		return `code ${path}`;
	}

	chainCommands(...commands: string[]): string {
		return commands.join(` && `);
	}

	getRoots(): string[] {
		const response = execSync(`wmic logicaldisk get name`).toString();
		return response
			.split(`\r\r\n`)
			.filter(value => /[A-Za-z]:/.test(value))
            .map(value => value.trim());
	}
	
	toPathArray(path: string): string[] {
		return path.split("\\");
	}
}


const log = vscode.window.createOutputChannel("sapiens-vscode-extension-log");


function fileExplorer(platform: Platform, initial: Array<string>, title: string, onNext: (path: string) => void, autoDetectLocations?: () => Promise<Array<string>>) {

	let roots = platform.getRoots();

	let currentPath: Array<string> = initial;
	const pathToString = () => {
		if(currentPath.length > 0) {
			if(currentPath[0] === "/") {
				if(currentPath.length === 1) {
					return `${currentPath[0]}`;
				} else {
					return `${currentPath[0]}${currentPath.slice(1).join(platform.directorySeparator)}${platform.directorySeparator}`;
				}
			} else {
				if(currentPath.length > 1) {
					return `${currentPath.join(platform.directorySeparator)}${platform.directorySeparator}`;
				} else {
					return `${currentPath[0]}${platform.directorySeparator}`;
				}
			}
		} else {
			return "";
		}
	};

	let autoDetectedLocations: Array<string> = [];
	autoDetectLocations
		? autoDetectLocations()
			.then(answer => {
				autoDetectedLocations = answer;
				path.items = pathItems();
			})
			.catch(err => {
				log.appendLine(err);
				autoDetectedLocations = [`Error autodetecting locations: ${err}`];
				path.items = pathItems();
			})
		: null;

	const readContents = () => {
		if(currentPath.length > 0) {
			return fs.readdirSync(pathToString(), { withFileTypes: true })
				.filter(d => d.isDirectory())
				.map(d => d.name);
		} else {
			return roots;
		}
	};

	let contentOnPath = readContents();

	const pathItems = () => {
		const autoDetectContent = autoDetectLocations !== undefined && autoDetectedLocations.length === 0
				? [{ label: 'Auto-detecing locations. Please wait... (can take up to 5 minutes)', description: `In the meantime, you can manually search for the location` }]
				: autoDetectedLocations.map(a => ({ label: a }));

		const autoDetectLabels = [
			{ label: 'Auto-detected locations', kind: vscode.QuickPickItemKind.Separator },
			...autoDetectContent,
			{ label: 'Search location manually', kind: vscode.QuickPickItemKind.Separator },
		];

		return [
			...autoDetectLabels,
			{ label: '.', description: 'select this directory' },
			{ label: '..', description: 'go back' },
			...contentOnPath.map(c => ({ label: c }))
		] as Array<any>;

	};
	
	const path = vscode.window.createQuickPick();
	path.title = title;
	path.placeholder = pathToString();
	path.onDidAccept(() => {
		if(path.selectedItems.length > 0) {
			const selectedItem = path.selectedItems[0];
			if(selectedItem.label === ".") {
				path.hide();
				onNext(pathToString());
			} else if(selectedItem.label === "..") {
				currentPath = currentPath.slice(0, currentPath.length-1);
				contentOnPath = readContents();

				path.value = "";
				path.placeholder = pathToString();
				path.items = pathItems();
			} else {
				console.log(selectedItem.label);
				if(selectedItem.label.startsWith("/")) {
					currentPath = selectedItem.label === "/" ? ['/'] : selectedItem.label.split(platform.directorySeparator);
				} else {
					currentPath = [...currentPath, selectedItem.label];
				}
				contentOnPath = readContents();

				path.value = "";
				path.placeholder = pathToString();
				path.items = pathItems();
			}
		} else {
			console.log(path.value);
			if(path.value.startsWith("/")) {
				currentPath = path.value === "/" ? ['/'] : path.value.split(platform.directorySeparator);
			} else {
				currentPath = [...currentPath, path.value];
			}
			contentOnPath = readContents();

			path.value = "";
			path.placeholder = pathToString();
			path.items = pathItems();
		}
	});
	path.step = 0;
	path.items = pathItems();
	path.show();
}

function enterPath(info: Partial<SapiensProjectInfo>, platform: Platform) {

	const pathArray = info.path !== undefined ? platform.toPathArray(info.path) : [];

	fileExplorer(
		platform,
		pathArray,
		`This command is used to initialize a new Sapiens project. Please enter the root path where the directory of the project shall reside`,
		(currentPath) => enterModPath({...info, path: currentPath}, platform)
	);
}

function enterModPath(info: Partial<SapiensProjectInfo>, platform: Platform) {

	const modPathExists = info.modPath !== undefined && info.modPath !== "";

	if(modPathExists) {
		enterName({...info}, platform);
	} else {
		fileExplorer(
			platform,
			[],
			`Enter the path to the mods folder in your Sapiens installation location (to make this permanent, look for 'modPath' in settings)`,
			(currentPath) => enterName({...info, modPath: currentPath}, platform),
			async () => {
				const found = (await util.promisify(exec)(`find / -type d -name 'majicjungle' -print 2>/dev/null`));
				return (found.stdout as string).split('\n').filter(f => f !== '');
			}
		);
	}
}

function sanitizeName(name: string) {
	const noWhiteSpace = name.replace(/\s/g, '-');
	const sanitized = noWhiteSpace.replace(/[^a-zA-Z0-9+_\-]/g, '');
	const toLower = sanitized.toLowerCase();
	return toLower;
}

function enterName(info: Partial<SapiensProjectInfo>, platform: Platform) {
	const input = vscode.window.createInputBox();

	input.step = 2;
	input.title = "Enter the name of your mod";
	input.value = info.MOD_NAME ?? "";
	input.show();

	input.onDidAccept(() => {
		input.hide();
		enterDescription({...info, MOD_NAME: input.value, id: sanitizeName(input.value)}, platform);
	});
}

function enterDescription(info: Partial<SapiensProjectInfo>, platform: Platform) {
	const input = vscode.window.createInputBox();

	input.step = 3;
	input.title = "Enter the description of your mod";
	input.value = info.MOD_DESCRIPTION ?? "";
	input.show();

	input.onDidAccept(() => {
		input.hide();
		enterModType({...info, MOD_DESCRIPTION: input.value}, platform);
	});
}

function enterModType(info: Partial<SapiensProjectInfo>, platform: Platform) {
	const pick = vscode.window.createQuickPick();

	pick.step = 4;
	pick.title = `Enter the type of your mod`;
	pick.items = [
		{label: "world", description: "The 'standard' type of mod. They are run both on the client and the server, and are very useful when trying to add any sort of content."},
		{label: "app", description: "Mods that affect the whole game. They are run on the client, and are useful for things like Localization"}
	];
	pick.value = info.MOD_TYPE ?? "";
	pick.show();

	pick.onDidAccept(() => {
		pick.hide();

		if(pick.activeItems.length > 0) {
			const activeItem = pick.activeItems[0];

			pick.hide();
			enterDeveloper({...info, MOD_TYPE: activeItem.label as "world" | "app"}, platform);
		}

	});
}

function enterDeveloper(info: Partial<SapiensProjectInfo>, platform: Platform) {
	const input = vscode.window.createInputBox();

	input.step = 5;
	input.title = "Enter the developer's name of your mod";
	input.value = info.MOD_DEVELOPER ?? "";
	input.show();

	input.onDidAccept(() => {
		input.hide();
		enterWebsite({...info, MOD_DEVELOPER: input.value}, platform);
	});
}

function enterWebsite(info: Partial<SapiensProjectInfo>, platform: Platform) {
	const input = vscode.window.createInputBox();

	input.step = 6;
	input.title = "Enter an optional website for your mod";
	input.value = info.MOD_WEBSITE ?? "";
	input.show();

	input.onDidAccept(() => {
		input.hide();
		enterConfirmation({...info, MOD_WEBSITE: input.value} as SapiensProjectInfo, platform);
	});
}

function enterConfirmation(info: SapiensProjectInfo, platform: Platform) {
	const input = vscode.window.createQuickPick();



	input.step = 7;
	input.title = `Please confirm the following information:\n
Setup of the project will be installed at ${info.path}${info.id} (will write to this location).\n
Your Sapiens installation's mods folder is located at ${info.modPath} (will write to this location).\n
Mod name, description, etc. will be writted to modInfo.lua, where you can change their values any time you want.\n
Is this OK?`;

	input.items = [{label: "Yes"}, {label: "No"}];
	input.show();

	input.onDidAccept(() => {
		
		if(input.activeItems.length > 0) {
			const activeItem = input.activeItems[0];

			input.hide();
			if(activeItem.label === "Yes") {
				initializeProject(info, platform);
			}
		}
	});
}

async function initializeProject(info: SapiensProjectInfo, platform: Platform) {

	const repo = `https://github.com/Sapiens-OSS/sapiens-cmake-template.git`;
	const directory = `${info.path}${info.id}`;
	
	try {

		log.appendLine(`Initializing project with the following information: ${JSON.stringify(info, null, 2)}`);

		log.appendLine(`cloning ${repo} to ${directory}`);
		const { stdout: cloneOut, stderr: cloneErr } = await execPromise(platform.cloneRepo(directory, repo));
		log.appendLine(cloneOut);
		log.appendLine(cloneErr);
		log.appendLine(`success`);

		log.appendLine(`removing .git file`);
		const { stdout: rmOut, stderr: rmErr } = await execPromise(platform.removeDir(`${directory}${platform.directorySeparator}.git`));
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

		const cdCommand = platform.changeDir(directory);
		const cmakeInit = platform.cmakeInit(directory, info.modPath);
		const fullCommand = platform.chainCommands(cdCommand, cmakeInit);
		log.appendLine(`running ${fullCommand}`);
		const { stdout: cmakeOut, stderr: cmakeErr } = await execPromise(fullCommand);
		log.appendLine(cmakeOut);
		log.appendLine(cmakeErr);
		log.appendLine(`success`);

		log.appendLine(`opening project in new window`);
		// const { stdout: codeOut, stderr: codeErr } = await execPromise(platform.chainCommands(cdCommand, platform.openVsCode(".")))
		// log.appendLine(codeOut)
		// log.appendLine(codeErr)
		// log.appendLine(`success`)
		const success = await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(directory));

		log.appendLine(`your project was opened in a new VSCode window`);


	} catch (e) {
		console.log(e);
		log.appendLine(e as string);
	}


	

}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const newProject = vscode.commands.registerCommand('sapiens-vscode-extension.newProject', () => {

		const sapiensConfig = vscode.workspace.getConfiguration("sapiens-vscode-extension");
		const modPath = sapiensConfig.get<string>("modPath");

		const platform = Platform.New();

		const sapiensProjectInfo: Partial<SapiensProjectInfo> = {
			path: process.env.HOME ?? undefined,
			modPath: modPath !== "" ? modPath : undefined
		};


		enterPath(sapiensProjectInfo, platform);
	});

	context.subscriptions.push(newProject);

	const openSourceFile = vscode.commands.registerCommand('sapiens-vscode-extension.openSourceFile', async () => {

		const sapiensConfig = vscode.workspace.getConfiguration("sapiens-vscode-extension");
		const gameResourcesPath = sapiensConfig.get<string>("gameResourcesPath");

		if(gameResourcesPath === undefined || gameResourcesPath === "") {
			vscode.window.showErrorMessage(`sapiens-vscode-extension.gameResourcesPath not specified in settings`);
			return;
		}

		const textEditor = vscode.window.activeTextEditor;

		if(textEditor === undefined) {
			vscode.window.showErrorMessage(`no file is currently opened`);
			return;
		}

		const fileUri = textEditor.document.uri;
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if(workspaceFolders === undefined || workspaceFolders.length <= 0) {
			vscode.window.showErrorMessage("workspace folder not found");
			return;
		}

		const workspaceFolder = workspaceFolders[0];
		const projectRoot = workspaceFolder.uri.fsPath;
		const filePath = fileUri.fsPath;

		const relativePath = filePath.slice(projectRoot.length);

		const pathInGameResources = `${gameResourcesPath}${relativePath}`;

		const pathInGameResourcesExists = fs.existsSync(pathInGameResources);

		if(!pathInGameResourcesExists) {
			vscode.window.showErrorMessage(`file ${relativePath} does not exist in game resources (located at ${gameResourcesPath})`);
			return;
		}

		const openedGameResourcesFile = await vscode.workspace.openTextDocument(vscode.Uri.file(pathInGameResources));
		vscode.window.showTextDocument(openedGameResourcesFile, {
			viewColumn: vscode.ViewColumn.Beside
		});


	});

	context.subscriptions.push(openSourceFile);

	const recreateBuildFolder = vscode.commands.registerCommand('sapiens-vscode-extension.recreateBuildFolder', async () => {

		vscode.window.showInformationMessage(`recreating build folder...`);

		const sapiensConfig = vscode.workspace.getConfiguration("sapiens-vscode-extension");
		const modPath = sapiensConfig.get<string>("modPath");

		const platform = Platform.New();

		if(modPath === undefined || modPath === "") {
			vscode.window.showErrorMessage(`sapiens-vscode-extension.modPath not specified in settings`);
			return;
		}

		const workspaceFolders = vscode.workspace.workspaceFolders;

		if(workspaceFolders === undefined || workspaceFolders.length <= 0) {
			vscode.window.showErrorMessage("workspace folder not foun");
			return;
		}

		console.log(workspaceFolders);

		const workspaceFolder = workspaceFolders[0];
		const projectRoot = workspaceFolder.uri.fsPath;

		const cdCommand = platform.changeDir(projectRoot);
		const cmakeInit = platform.cmakeInit(".", modPath);
		const fullCommand = platform.chainCommands(cdCommand, cmakeInit);

		try {
			log.appendLine(`running ${fullCommand}`);
			const { stdout: cmakeOut, stderr: cmakeErr } = await execPromise(fullCommand);
			log.appendLine(cmakeOut);
			log.appendLine(cmakeErr);
			log.appendLine(`success`);

			vscode.window.showInformationMessage(`recreating build folder successful`);
		} catch(e) {
			log.appendLine((e as any).toString());
			vscode.window.showErrorMessage((e as any).toString());
		}

	});

	context.subscriptions.push(recreateBuildFolder);

	const buildAndRun = vscode.commands.registerCommand('sapiens-vscode-extension.buildAndRun', async () => {

		vscode.window.showInformationMessage(`building mod...`);

		const platform = Platform.New();
		const cmakeBuild = platform.cmakeBuild();

		const workspaceFolders = vscode.workspace.workspaceFolders;

		if(workspaceFolders === undefined || workspaceFolders.length <= 0) {
			vscode.window.showErrorMessage("workspace folder not found");
			return;
		}

		const workspaceFolder = workspaceFolders[0];
		const projectRoot = workspaceFolder.uri.fsPath;

		const fullCommand = platform.chainCommands(platform.changeDir(projectRoot), cmakeBuild);

		try {
			log.appendLine(`running ${fullCommand}`);
			const { stdout: cmakeOut, stderr: cmakeErr } = await execPromise(fullCommand);
			log.appendLine(cmakeOut);
			log.appendLine(cmakeErr);
			log.appendLine(`success`);

			vscode.window.showInformationMessage(`game is launching`);
		} catch(e) {
			log.appendLine((e as any).toString());
			vscode.window.showErrorMessage((e as any).toString());
		}
	});

	context.subscriptions.push(buildAndRun);
}

// This method is called when your extension is deactivated
export function deactivate() {}
