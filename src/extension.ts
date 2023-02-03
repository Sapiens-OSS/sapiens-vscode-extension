// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
const { execSync } = require("child_process");

type SapiensProjectInfo = {
	path: string,
	MOD_ID: string,
	MOD_NAME: string,
	MOD_DESCRIPTION: string,
	DEVELOPER: string,
	DEVELOPER_URL: string,
	MOD_TYPE: "world" | "app"
}



const log = vscode.window.createOutputChannel("sapiens-vscode-extension-log");

function enterLocation(info: Partial<SapiensProjectInfo>) {
	let currentPath = info.path ?? `/`
	let contentOnPath = fs.readdirSync(currentPath)
	
	const path = vscode.window.createQuickPick()
	path.title = `This command is used to initialize a new Sapiens project. Please enter the root path where the directory of the project shall reside`
	path.placeholder = currentPath
	path.onDidAccept(() => {
		if(path.selectedItems.length > 0) {
			const selectedItem = path.selectedItems[0]
			console.log(selectedItem)
			if(selectedItem.label === ".") {
				path.hide()
				enterId({...info, path: currentPath})
			} else {
				currentPath += `${selectedItem.label}/`
				contentOnPath = fs.readdirSync(currentPath)

				path.value = ""
				path.placeholder = currentPath
				path.items = [{label: '.'}, ...contentOnPath.map(c => ({label: c}))]
			}

		}
	})
	path.step = 0
	path.items = [{label: '.'}, ...contentOnPath.map(c => ({label: c}))]
	path.show()
}

function enterId(info: Partial<SapiensProjectInfo>) {
	const input = vscode.window.createInputBox()

	input.step = 1
	input.title = "Enter the ID of your mod"
	input.value = info.MOD_ID ?? ""
	input.show()

	input.onDidAccept(() => {
		input.hide()
		enterName({...info, MOD_ID: input.value})
	})
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
		enterDeveloper({...info, MOD_TYPE: pick.value as "world" | "app"})
	})
}

function enterDeveloper(info: Partial<SapiensProjectInfo>) {
	const input = vscode.window.createInputBox()

	input.step = 5
	input.title = "Enter the developer's name of your mod"
	input.value = info.DEVELOPER ?? ""
	input.show()

	input.onDidAccept(() => {
		input.hide()
		enterDeveloperUrl({...info, DEVELOPER: input.value})
	})
}

function enterDeveloperUrl(info: Partial<SapiensProjectInfo>) {
	const input = vscode.window.createInputBox()

	input.step = 6
	input.title = "Enter the developer's URL of your mod"
	input.value = info.DEVELOPER_URL ?? ""
	input.show()

	input.onDidAccept(() => {
		input.hide()
		enterConfirmation({...info, DEVELOPER_URL: input.value} as SapiensProjectInfo)
	})
}

function enterConfirmation(info: SapiensProjectInfo) {
	const input = vscode.window.createQuickPick()

	input.step = 7
	input.title = `A new folder will be created at ${info.path}${info.MOD_ID} in which the project will be initialized. Is this OK?`
	input.items = [{label: "Sure buddy :)"}, {label: "Nope. Abort! >:("}]
	input.show()

	input.onDidAccept(() => {
		input.hide()
		initializeProject(info)
	})
}

async function initializeProject(info: SapiensProjectInfo) {

	const repo = `https://github.com/Sapiens-OSS/sapiens-cmake-template.git`
	
	log.appendLine(`cloning ${repo} to ${info.path}${info.MOD_ID}...`)


	try {
		const result = execSync(`git clone ${repo} ${info.path}${info.MOD_ID}`)
		console.log(result)
	
		// const clone = await Git.Clone.clone(repo, info.path)
		log.appendLine(`success`)
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
			path: process.env.HOME ? `${process.env.HOME}/` : "/",
			MOD_TYPE: "world"
		}

		enterLocation(sapiensProjectInfo)
	})

	context.subscriptions.push(newProject)
}

// This method is called when your extension is deactivated
export function deactivate() {}
