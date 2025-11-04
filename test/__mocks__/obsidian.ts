// ! Obsidian APIのモック。
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/require-await */

export class App {
	vault: Vault = new Vault()
	workspace: Workspace = new Workspace()
}

export class Vault {
	adapter: any = {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async read(_file: TFile): Promise<string> {
		return ""
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async modify(_file: TFile, _data: string): Promise<void> {
		// モック実装
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async create(_path: string, _data: string): Promise<TFile> {
		return new TFile()
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async delete(_file: TFile): Promise<void> {
		// モック実装
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	getAbstractFileByPath(_path: string): TFile | TFolder | null {
		return null
	}

	getMarkdownFiles(): TFile[] {
		return []
	}
}

export class Workspace {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	getRightLeaf(_split: boolean): WorkspaceLeaf {
		return new WorkspaceLeaf()
	}
}

export class WorkspaceLeaf {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async setViewState(_viewState: any): Promise<void> {
		// モック実装
	}
}

export class TFile {
	path: string = ""
	name: string = ""
	extension: string = "md"
	basename: string = ""
	parent: TFolder | null = null
}

export class TFolder {
	path: string = ""
	name: string = ""
	parent: TFolder | null = null
	children: (TFile | TFolder)[] = []
}

export class Plugin {
	app: App = new App()
	manifest: any = {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	addCommand(_command: any): void {
		// モック実装
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	registerView(_type: string, _viewCreator: any): void {
		// モック実装
	}

	async loadData(): Promise<any> {
		return {}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async saveData(_data: any): Promise<void> {
		// モック実装
	}
}

export class ItemView {
	containerEl: HTMLElement = document.createElement("div")
	app: App = new App()
	leaf: WorkspaceLeaf = new WorkspaceLeaf()

	getViewType(): string {
		return ""
	}

	getDisplayText(): string {
		return ""
	}

	getIcon(): string {
		return ""
	}

	async onOpen(): Promise<void> {
		// モック実装
	}

	async onClose(): Promise<void> {
		// モック実装
	}
}

export class Notice {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	constructor(_message: string, _duration?: number) {
		// モック実装
	}
}

export class Modal {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	constructor(_app: App) {
		// モック実装
	}

	open(): void {
		// モック実装
	}

	close(): void {
		// モック実装
	}
}

export class PluginSettingTab {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	constructor(_app: App, _plugin: Plugin) {
		// モック実装
	}

	display(): void {
		// モック実装
	}

	hide(): void {
		// モック実装
	}
}
