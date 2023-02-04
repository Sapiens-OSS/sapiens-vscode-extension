// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises'
import * as util from 'util'
import { execSync, exec } from "child_process";

type SapiensProjectInfo = {
	path: string,
	id: string,
	modPath: string,
	MOD_NAME: string,
	MOD_DESCRIPTION: string,
	MOD_DEVELOPER: string,
	MOD_WEBSITE: string,
	MOD_TYPE: "world" | "app"
}



const log = vscode.window.createOutputChannel("sapiens-vscode-extension-log");


function fileExplorer(startPath: string, title: string, onNext: (path: string) => void, autoDetectLocations?: () => Promise<Array<string>>) {
	let currentPath = startPath === "/" ? [''] : startPath.split('/')
	const pathToString = () => currentPath.length > 1 ? currentPath.join('/') : "/"

	let autoDetectedLocations: Array<string> = []
	autoDetectLocations
		? autoDetectLocations()
			.then(answer => {
				autoDetectedLocations = answer
				path.items = pathItems()
			})
			.catch(err => {
				log.appendLine(err)
				console.log(err)
				autoDetectedLocations = [`Error autodetecting locations: ${err}`]
				path.items = pathItems()
			})
		: null

	const readContents = () => fs.readdirSync(pathToString(), { withFileTypes: true })
		.filter(d => d.isDirectory())
		.map(d => d.name)
	let contentOnPath = readContents()
	const pathItems = () => {

		const autoDetectContent = autoDetectLocations !== undefined && autoDetectedLocations.length === 0
				? [{ label: 'Auto-detecing locations. Please wait... (can take up to 5 minutes)', description: `In the meantime, you can manually search for the location` }]
				: autoDetectedLocations.map(a => ({ label: a }))

		return [
			{ label: 'Auto-detected locations', kind: vscode.QuickPickItemKind.Separator },
			...autoDetectContent,
			{ label: 'Search location manually', kind: vscode.QuickPickItemKind.Separator },
			{ label: '.', description: 'select this directory' },
			{ label: '..', description: 'go back' },
			...contentOnPath.map(c => ({ label: c }))
		] as Array<any>;
	}


	
	const path = vscode.window.createQuickPick()
	path.title = title
	path.placeholder = pathToString()
	path.onDidAccept(() => {
		if(path.selectedItems.length > 0) {
			const selectedItem = path.selectedItems[0]
			if(selectedItem.label === ".") {
				path.hide()
				onNext(pathToString())
			} else if(selectedItem.label === "..") {
				currentPath = currentPath.slice(0, currentPath.length-1)
				contentOnPath = readContents()

				path.value = ""
				path.placeholder = pathToString()
				path.items = pathItems()
			} else {
				if(selectedItem.label.startsWith("/")) {
					currentPath = selectedItem.label === "/" ? [''] : selectedItem.label.split('/')
				} else {
					currentPath = [...currentPath, selectedItem.label]
				}
				contentOnPath = readContents()

				path.value = ""
				path.placeholder = pathToString()
				path.items = pathItems()
			}

		}
	})
	path.step = 0
	path.items = pathItems()
	path.show()
}

function enterPath(info: Partial<SapiensProjectInfo>) {
	fileExplorer(
		info.path ?? "/",
		`This command is used to initialize a new Sapiens project. Please enter the root path where the directory of the project shall reside`,
		(currentPath) => enterId({...info, path: currentPath})
	)
}

function enterId(info: Partial<SapiensProjectInfo>) {
	const input = vscode.window.createInputBox()

	input.step = 1
	input.title = "Enter the ID of your mod"
	input.placeholder = "IDs should not contain any form of whitespace"
	input.value = info.id ?? ""
	input.show()

	input.onDidAccept(() => {
		input.hide()
		enterModPath({...info, id: input.value})
	})
}

function enterModPath(info: Partial<SapiensProjectInfo>) {

	fileExplorer(
		info.modPath ?? `/`,
		`Enter the path to the mods folder in your Sapiens installation location`,
		(currentPath) => enterName({...info, modPath: currentPath}),
		async () => {
			const found = (await util.promisify(exec)(`find / -type d -name 'majicjungle' -print 2>/dev/null`))
			return (found.stdout as string).split('\n').filter(f => f !== '')
		}
	)
}

function enterName(info: Partial<SapiensProjectInfo>) {
	const input = vscode.window.createInputBox()

	input.step = 2
	input.title = "Enter the name of your mod"
	input.value = info.MOD_NAME ?? ""
	input.show()

	input.onDidAccept(() => {
		input.hide()
		enterDescription({...info, MOD_NAME: input.value})
	})
}

function enterDescription(info: Partial<SapiensProjectInfo>) {
	const input = vscode.window.createInputBox()

	input.step = 3
	input.title = "Enter the description of your mod"
	input.value = info.MOD_DESCRIPTION ?? ""
	input.show()

	input.onDidAccept(() => {
		input.hide()
		enterModType({...info, MOD_DESCRIPTION: input.value})
	})
}

function enterModType(info: Partial<SapiensProjectInfo>) {
	const pick = vscode.window.createQuickPick()

	pick.step = 4
	pick.title = `Enter the type of your mod`
	pick.items = [
		{label: "world", description: "The 'standard' type of mod. They are run both on the client and the server, and are very useful when trying to add any sort of content."},
		{label: "app", description: "Mods that affect the whole game. They are run on the client, and are useful for things like Localization"}
	]
	pick.value = info.MOD_TYPE ?? ""
	pick.show()

	pick.onDidAccept(() => {
		pick.hide()

		if(pick.activeItems.length > 0) {
			const activeItem = pick.activeItems[0]

			pick.hide()
			enterDeveloper({...info, MOD_TYPE: activeItem.label as "world" | "app"})
		}

	})
}

function enterDeveloper(info: Partial<SapiensProjectInfo>) {
	const input = vscode.window.createInputBox()

	input.step = 5
	input.title = "Enter the developer's name of your mod"
	input.value = info.MOD_DEVELOPER ?? ""
	input.show()

	input.onDidAccept(() => {
		input.hide()
		enterWebsite({...info, MOD_DEVELOPER: input.value})
	})
}

function enterWebsite(info: Partial<SapiensProjectInfo>) {
	const input = vscode.window.createInputBox()

	input.step = 6
	input.title = "Enter an optional website for your mod"
	input.value = info.MOD_WEBSITE ?? ""
	input.show()

	input.onDidAccept(() => {
		input.hide()
		enterConfirmation({...info, MOD_WEBSITE: input.value} as SapiensProjectInfo)
	})
}

function enterConfirmation(info: SapiensProjectInfo) {
	const input = vscode.window.createQuickPick()

	input.step = 7
	input.title = `Please confirm the following information:\n
Setup of the project will be installed at ${info.path}/${info.id} (will write to this location).\n
Your Sapiens installation's mods folder is located at ${info.modPath} (will write to this location).\n
Mod name, description, etc. will be writted to modInfo.lua, where you can change their values any time you want.\n
Is this OK?`

	input.items = [{label: "Yes"}, {label: "No"}]
	input.show()

	input.onDidAccept(() => {
		
		if(input.activeItems.length > 0) {
			const activeItem = input.activeItems[0]
			console.log(activeItem)

			input.hide()
			if(activeItem.label === "Yes") {
				initializeProject(info)
			}
		}
	})
}

async function initializeProject(info: SapiensProjectInfo) {

	const repo = `https://github.com/nmattela/sapiens-cmake-template.git`
	const directory = `${info.path}/${info.id}`
	
	const execPromise = util.promisify(exec)
	
	try {

		log.appendLine(`Initializing project with the following information: ${JSON.stringify(info, null, 2)}`)

		log.appendLine(`cloning ${repo} to ${directory}`)
		const result = await execPromise(`git clone -b copyInsteadOfSymlink --recurse-submodules ${repo} ${directory}`)
		log.appendLine(`success`)

		log.appendLine(`removing .git file`)
		await execPromise(`rm -rf ${directory}/.git`)
		log.appendLine(`success`)

		log.appendLine(`reading modInfo.lua`)
		const modInfo = (await fsPromises.readFile(`${directory}/modInfo.lua`)).toString()
			.replace(`"MOD_NAME"`, `"${info.MOD_NAME}"`)
			.replace(`"MOD_DESCRIPTION"`, `"${info.MOD_DESCRIPTION}"`)
			.replace(`"MOD_TYPE"`, `"${info.MOD_TYPE}"`)
			.replace(`"MOD_DEVELOPER"`, `"${info.MOD_DEVELOPER}"`)
			.replace(`"MOD_WEBSITE"`, `"${info.MOD_WEBSITE}"`)
		log.appendLine(`success`)

		log.appendLine(`rewriting contents of modInfo.lua to:\n${modInfo}`)
		await fsPromises.writeFile(`${directory}/modInfo.lua`, modInfo)
		log.appendLine(`success`)

		const cmakeBuildBinary = process.platform === "linux" ? `x86_64-w64-mingw32-cmake` : `cmake`

		const cmakeBuild = `${cmakeBuildBinary} -DMOD_ID="${info.id}" -DAUTO_COPY_MOD=ON -DSAPIENS_MOD_DIRECTORY="${info.modPath}" ${directory} -B build`
		log.appendLine(`running ${cmakeBuild}`)
		await execPromise(cmakeBuild)
		log.appendLine(`success`)

		log.appendLine(`opening project in new window`)
		await execPromise(`code ${directory}`)
		log.appendLine(`success`)

		log.appendLine(`your project was opened in a new VSCode window`)


	} catch (e) {
		console.log(e)
		log.appendLine(e as string)
	}


	

}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "sapiens-vscode-extension" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('sapiens-vscode-extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from sapiens-vscode-extension!');
	});

	context.subscriptions.push(disposable);

	const newProject = vscode.commands.registerCommand('sapiens-vscode-extension.newProject', () => {

		const sapiensProjectInfo: Partial<SapiensProjectInfo> = {
			path: process.env.HOME ?? "/",
		}

		enterPath(sapiensProjectInfo)
	})

	context.subscriptions.push(newProject)
}

// This method is called when your extension is deactivated
export function deactivate() {}
