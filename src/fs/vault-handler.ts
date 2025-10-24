import { App, TFile, TFolder } from "obsidian";
import { TagManager, TagPair } from "../core/tag-manager";

//! ファイルロックの管理。
class FileLock {
	private locks: Map<string, Promise<void>>;
	private resolvers: Map<string, () => void>;

	constructor() {
		this.locks = new Map();
		this.resolvers = new Map();
	}

	//! ファイルに対してロックを取得する。
	async acquire(filePath: string): Promise<void> {
		console.log("[memolog DEBUG] FileLock.acquire called:", filePath);
		//! 既存のロックが解放されるまで待機。
		while (this.locks.has(filePath)) {
			console.log("[memolog DEBUG] Waiting for existing lock:", filePath);
			await this.locks.get(filePath);
		}

		console.log("[memolog DEBUG] Acquiring lock:", filePath);
		//! 新しいロックを作成。
		let resolve!: () => void;
		const promise = new Promise<void>((r) => {
			resolve = r;
		});

		this.locks.set(filePath, promise);
		this.resolvers.set(filePath, resolve);
		console.log("[memolog DEBUG] Lock acquired:", filePath);
	}

	//! ファイルのロックを解放する。
	release(filePath: string): void {
		console.log("[memolog DEBUG] FileLock.release called:", filePath);
		const resolve = this.resolvers.get(filePath);
		if (resolve) {
			console.log("[memolog DEBUG] Resolving lock promise:", filePath);
			resolve();
		}
		this.locks.delete(filePath);
		this.resolvers.delete(filePath);
		console.log("[memolog DEBUG] Lock released:", filePath);
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
		console.log("[memolog DEBUG] createFile called with:", filePath);
		try {
			await this.fileLock.acquire(filePath);

			//! 親ディレクトリが存在しない場合は作成。
			const dirPath = filePath.split("/").slice(0, -1).join("/");
			console.log("[memolog DEBUG] Parent directory:", dirPath);
			if (dirPath && !this.folderExists(dirPath)) {
				console.log("[memolog DEBUG] Parent directory does not exist, creating...");
				await this.createFolder(dirPath);
			}

			console.log("[memolog DEBUG] Creating file:", filePath);
			const file = await this.app.vault.create(filePath, content);
			console.log("[memolog DEBUG] File created successfully:", filePath);
			return file;
		} catch (error) {
			console.error("[memolog DEBUG] createFile error:", error);
			throw error;
		} finally {
			this.fileLock.release(filePath);
		}
	}

	//! フォルダを作成する。
	async createFolder(folderPath: string): Promise<void> {
		console.log("[memolog DEBUG] createFolder called with:", folderPath);
		if (this.folderExists(folderPath)) {
			console.log("[memolog DEBUG] Folder already exists:", folderPath);
			return;
		}

		try {
			console.log("[memolog DEBUG] Creating folder:", folderPath);
			await this.app.vault.createFolder(folderPath);
			console.log("[memolog DEBUG] Folder created successfully:", folderPath);
		} catch (error) {
			console.log("[memolog DEBUG] createFolder error:", error);
			//! 既に存在する場合はエラーを無視。
			if (!this.folderExists(folderPath)) {
				console.error("[memolog DEBUG] Folder creation failed and folder does not exist:", folderPath);
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
		console.log("[memolog DEBUG] writeFile called:", filePath);
		try {
			await this.fileLock.acquire(filePath);

			const file = this.app.vault.getAbstractFileByPath(filePath);
			console.log("[memolog DEBUG] File from vault:", file ? "exists" : "null", file?.constructor.name);

			if (file instanceof TFile) {
				console.log("[memolog DEBUG] File is TFile, modifying...");
				await this.app.vault.modify(file, content);
				console.log("[memolog DEBUG] File modified successfully");
			} else {
				console.log("[memolog DEBUG] File does not exist, creating...");
				await this.createFile(filePath, content);
				console.log("[memolog DEBUG] File created via createFile");
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
	async validateTagPairs(
		filePath: string
	): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
		const content = await this.readFile(filePath);
		return TagManager.validateTagPairs(content);
	}

	//! 壊れたタグペアを自動修復する。
	async repairTagPairs(
		filePath: string,
		createBackup = true
	): Promise<{ repaired: boolean; fixes: string[]; backupPath?: string }> {
		try {
			await this.fileLock.acquire(filePath);

			const content = await this.readFile(filePath);
			const result = TagManager.repairTagPairs(content);

			if (!result.repaired) {
				return { repaired: false, fixes: [] };
			}

			//! バックアップを作成。
			let backupPath: string | undefined;
			if (createBackup) {
				backupPath = `${filePath}.backup-${Date.now()}`;
				await this.createFile(backupPath, content);
			}

			//! 修復した内容を書き込む。
			await this.writeFile(filePath, result.content);

			return {
				repaired: true,
				fixes: result.fixes,
				backupPath,
			};
		} finally {
			this.fileLock.release(filePath);
		}
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
		console.log("[memolog DEBUG] initializeTagPair called:", { filePath, category, metadata });
		let content = "";

		const fileExists = this.fileExists(filePath);
		console.log("[memolog DEBUG] File exists in initializeTagPair:", fileExists);

		if (fileExists) {
			console.log("[memolog DEBUG] Reading existing file...");
			content = await this.readFile(filePath);
			console.log("[memolog DEBUG] File content length:", content.length);
		}

		console.log("[memolog DEBUG] Calling TagManager.initializeTagPair...");
		const newContent = TagManager.initializeTagPair(content, category, metadata);
		console.log("[memolog DEBUG] New content length:", newContent.length);
		console.log("[memolog DEBUG] Content changed:", newContent !== content);

		if (newContent !== content) {
			console.log("[memolog DEBUG] Writing file...");
			await this.writeFile(filePath, newContent);
			console.log("[memolog DEBUG] File written successfully");
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

			const content = await this.readFile(filePath);
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

			const content = await this.readFile(filePath);
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

	//! 全てのカテゴリ領域を取得する（複数カテゴリ対応）。
	async getAllCategories(filePath: string): Promise<Map<string, string>> {
		const content = await this.readFile(filePath);
		const pairMap = TagManager.getAllTagPairs(content);
		const contentMap = new Map<string, string>();

		for (const [category, pair] of pairMap.entries()) {
			contentMap.set(category, pair.content);
		}

		return contentMap;
	}

	//! 複数カテゴリのメモを一括取得する。
	async getMultipleCategoryContents(
		filePath: string,
		categories: string[]
	): Promise<Map<string, string>> {
		const allCategories = await this.getAllCategories(filePath);
		const result = new Map<string, string>();

		for (const category of categories) {
			const content = allCategories.get(category);
			if (content) {
				result.set(category, content);
			}
		}

		return result;
	}

	//! エラーハンドリング付きのファイル読み込み。
	async safeReadFile(filePath: string): Promise<{ content: string; error?: string }> {
		try {
			const content = await this.readFile(filePath);
			return { content };
		} catch (error) {
			return {
				content: "",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	//! エラーハンドリング付きのファイル書き込み。
	async safeWriteFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
		try {
			await this.writeFile(filePath, content);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}
}
