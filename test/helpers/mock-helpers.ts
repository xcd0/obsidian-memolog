import { App, TFile, TFolder } from "obsidian";

//! TFileのモック作成ヘルパー。
export function createMockTFile(path: string): TFile {
	const name = path.split("/").pop() || "";
	return Object.create(TFile.prototype, {
		path: { value: path },
		name: { value: name },
	}) as TFile;
}

//! TFolderのモック作成ヘルパー。
export function createMockTFolder(path: string): TFolder {
	return Object.create(TFolder.prototype, {
		path: { value: path },
	}) as TFolder;
}

//! Appのモック作成ヘルパー。
export interface MockAppConfig {
	files?: Map<string, string>; //! パスとコンテンツのマップ。
	folders?: Set<string>; //! 存在するフォルダのセット。
}

export function createMockApp(config: MockAppConfig = {}): App {
	const files = config.files || new Map<string, string>();
	const folders = config.folders || new Set<string>();

	const mockRead = jest.fn((file: TFile) => {
		const content = files.get(file.path);
		if (content === undefined) {
			return Promise.reject(new Error(`File not found: ${file.path}`));
		}
		return Promise.resolve(content);
	});

	const mockCreate = jest.fn((path: string, content: string) => {
		files.set(path, content);
		return Promise.resolve(createMockTFile(path));
	});

	const mockModify = jest.fn((file: TFile, content: string) => {
		files.set(file.path, content);
		return Promise.resolve();
	});

	const mockGetAbstractFileByPath = jest.fn((path: string) => {
		if (files.has(path)) {
			return createMockTFile(path);
		}
		if (folders.has(path)) {
			return createMockTFolder(path);
		}
		return null;
	});

	const mockCreateFolder = jest.fn((path: string) => {
		folders.add(path);
		return Promise.resolve(createMockTFolder(path));
	});

	const mockDelete = jest.fn((file: TFile) => {
		files.delete(file.path);
		return Promise.resolve();
	});

	const mockGetFiles = jest.fn(() => {
		return Array.from(files.keys()).map((path) => createMockTFile(path));
	});

	const mockExists = jest.fn((path: string) => {
		return Promise.resolve(files.has(path) || folders.has(path));
	});

	const mockAdapterRead = jest.fn((path: string) => {
		const content = files.get(path);
		if (content === undefined) {
			return Promise.reject(new Error(`File not found: ${path}`));
		}
		return Promise.resolve(content);
	});

	const mockAdapterWrite = jest.fn((path: string, content: string) => {
		files.set(path, content);
		return Promise.resolve();
	});

	const mockAdapterRemove = jest.fn((path: string) => {
		files.delete(path);
		return Promise.resolve();
	});

	const mockAdapterStat = jest.fn(() => {
		return Promise.resolve({
			mtime: Date.now(),
			ctime: Date.now(),
			size: 1000,
		});
	});

	return {
		vault: {
			read: mockRead,
			create: mockCreate,
			modify: mockModify,
			getAbstractFileByPath: mockGetAbstractFileByPath,
			createFolder: mockCreateFolder,
			delete: mockDelete,
			getFiles: mockGetFiles,
			adapter: {
				exists: mockExists,
				read: mockAdapterRead,
				write: mockAdapterWrite,
				remove: mockAdapterRemove,
				list: jest.fn(),
				stat: mockAdapterStat,
			},
		},
	} as unknown as App;
}

//! モックAppにファイルを追加するヘルパー。
export function addMockFile(app: App, path: string, content: string): void {
	const mockApp = app as unknown as { vault: { create: jest.Mock } };
	mockApp.vault.create(path, content);
}

//! モックAppにフォルダを追加するヘルパー。
export function addMockFolder(app: App, path: string): void {
	const mockApp = app as unknown as { vault: { createFolder: jest.Mock } };
	mockApp.vault.createFolder(path);
}
