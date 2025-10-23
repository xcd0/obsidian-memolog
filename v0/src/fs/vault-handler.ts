import { App, TFile, TFolder } from "obsidian";
import { TagManager, TagPair } from "../core/tag-manager";

//! ファイルロックの管理。
class FileLock {
	private locks: Map<string, Promise<void>>;

	constructor() {
		this.locks = new Map();
	}

	//! ファイルに対してロックを取得する。
	async acquire(filePath: string): Promise<void> {
		while (this.locks.has(filePath)) {
			await this.locks.get(filePath);
		}

		let release: () => void;
		const promise = new Promise<void>((resolve) => {
			release = resolve;
		});

		this.locks.set(filePath, promise);

		return new Promise((resolve) => {
			resolve();
			//! ロック解放用の関数を返す。
			return release!;
		});
	}

	//! ファイルのロックを解放する。
	release(filePath: string): void {
		this.locks.delete(filePath);
	}
}

//! Vaultへのファイルアクセスを管理するクラス。
export class MemologVaultHandler {
	private app: App;
	private fileLock: FileLock;

	constructor(app: App) {
		this.app = app;
		this.fileLock = new FileLock();
	}

	//! ファイルが存在するかチェックする。
	fileExists(filePath: string): boolean {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		return file instanceof TFile;
	}

	//! フォルダが存在するかチェックする。
	folderExists(folderPath: string): boolean {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		return folder instanceof TFolder;
	}

	//! ファイルを作成する。
	async createFile(filePath: string, content: string): Promise<TFile> {
		try {
			await this.fileLock.acquire(filePath);

			//! 親ディレクトリが存在しない場合は作成。
			const dirPath = filePath.split("/").slice(0, -1).join("/");
			if (dirPath && !this.folderExists(dirPath)) {
				await this.createFolder(dirPath);
			}

			const file = await this.app.vault.create(filePath, content);
			return file;
		} finally {
			this.fileLock.release(filePath);
		}
	}

	//! フォルダを作成する。
	async createFolder(folderPath: string): Promise<void> {
		if (this.folderExists(folderPath)) {
			return;
		}

		try {
			await this.app.vault.createFolder(folderPath);
		} catch (error) {
			//! 既に存在する場合はエラーを無視。
			if (!this.folderExists(folderPath)) {
				throw error;
			}
		}
	}

	//! ファイルを読み込む。
	async readFile(filePath: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${filePath}`);
		}

		return await this.app.vault.read(file);
	}

	//! ファイルに書き込む。
	async writeFile(filePath: string, content: string): Promise<void> {
		try {
			await this.fileLock.acquire(filePath);

			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (file instanceof TFile) {
				await this.app.vault.modify(file, content);
			} else {
				await this.createFile(filePath, content);
			}
		} finally {
			this.fileLock.release(filePath);
		}
	}

	//! ファイルを削除する。
	async deleteFile(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file instanceof TFile) {
			await this.app.vault.delete(file);
		}
	}

	//! ファイル内のタグペアを解析する。
	async parseTagPairs(filePath: string): Promise<TagPair[]> {
		const content = await this.readFile(filePath);
		return TagManager.parseTagPairs(content);
	}

	//! ファイル内のタグペアの整合性をチェックする。
	async validateTagPairs(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
		const content = await this.readFile(filePath);
		return TagManager.validateTagPairs(content);
	}

	//! ファイル内の特定カテゴリのタグペアを取得する。
	async findTagPairByCategory(filePath: string, category: string): Promise<TagPair | null> {
		const content = await this.readFile(filePath);
		return TagManager.findTagPairByCategory(content, category);
	}

	//! ファイルにタグペアを初期化する。
	async initializeTagPair(
		filePath: string,
		category: string,
		metadata?: { format?: string; order?: "asc" | "desc"; timestamp?: string }
	): Promise<void> {
		let content = "";

		if (this.fileExists(filePath)) {
			content = await this.readFile(filePath);
		}

		const newContent = TagManager.initializeTagPair(content, category, metadata);

		if (newContent !== content) {
			await this.writeFile(filePath, newContent);
		}
	}

	//! カテゴリ領域にテキストを挿入する。
	async insertTextInCategory(
		filePath: string,
		category: string,
		text: string,
		position: "top" | "bottom"
	): Promise<void> {
		try {
			await this.fileLock.acquire(filePath);

			let content = await this.readFile(filePath);
			const lines = content.split("\n");
			const pair = TagManager.findTagPairByCategory(content, category);

			if (!pair) {
				throw new Error(`Category "${category}" not found in file: ${filePath}`);
			}

			//! 挿入位置を決定。
			const insertLine = position === "top" ? pair.startLine + 1 : pair.endLine;

			//! テキストを挿入。
			lines.splice(insertLine, 0, text);

			const newContent = lines.join("\n");
			await this.writeFile(filePath, newContent);
		} finally {
			this.fileLock.release(filePath);
		}
	}

	//! カテゴリ領域の内容を取得する。
	async getCategoryContent(filePath: string, category: string): Promise<string | null> {
		const pair = await this.findTagPairByCategory(filePath, category);
		return pair ? pair.content : null;
	}

	//! カテゴリ領域の内容を置換する。
	async replaceCategoryContent(
		filePath: string,
		category: string,
		newContent: string
	): Promise<void> {
		try {
			await this.fileLock.acquire(filePath);

			let content = await this.readFile(filePath);
			const lines = content.split("\n");
			const pair = TagManager.findTagPairByCategory(content, category);

			if (!pair) {
				throw new Error(`Category "${category}" not found in file: ${filePath}`);
			}

			//! 既存の内容を削除。
			lines.splice(pair.startLine + 1, pair.endLine - pair.startLine - 1, newContent);

			const updatedContent = lines.join("\n");
			await this.writeFile(filePath, updatedContent);
		} finally {
			this.fileLock.release(filePath);
		}
	}
}
