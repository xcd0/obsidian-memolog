import { App, TFile } from "obsidian";
import { PathGenerator } from "./path-generator";
import { MemologVaultHandler } from "../fs/vault-handler";
import { CategoryConfig } from "../types/settings";

//! ファイルパス変換のマッピング情報。
export interface PathMapping {
	//! 元のファイルパス。
	oldPath: string;
	//! 新しいファイルパス。
	newPath: string;
	//! カテゴリ名。
	category: string;
	//! 日付情報。
	date?: Date;
	//! 競合があるか。
	hasConflict: boolean;
}

//! パスマイグレーション結果。
export interface MigrationResult {
	//! 成功したマッピング数。
	successCount: number;
	//! 失敗したマッピング数。
	failureCount: number;
	//! スキップされたマッピング数。
	skippedCount: number;
	//! エラーメッセージ。
	errors: string[];
	//! 警告メッセージ。
	warnings: string[];
	//! 処理されたマッピング一覧。
	mappings: PathMapping[];
}

//! パス変換・ファイル移動を管理するクラス。
export class PathMigrator {
	private app: App;
	private vaultHandler: MemologVaultHandler;

	constructor(app: App, vaultHandler: MemologVaultHandler) {
		this.app = app;
		this.vaultHandler = vaultHandler;
	}

	//! 設定変更時のファイル移動を計画する。
	async planMigration(
		rootDir: string,
		oldPathFormat: string,
		newPathFormat: string,
		oldUseDirectoryCategory: boolean,
		newUseDirectoryCategory: boolean,
		categories: CategoryConfig[],
		defaultCategory: string
	): Promise<PathMapping[]> {
		const mappings: PathMapping[] = [];

		//! rootDir配下の全.mdファイルを取得。
		const allFiles = this.app.vault.getMarkdownFiles();
		const targetFiles = allFiles.filter((file) => file.path.startsWith(rootDir + "/"));

		for (const file of targetFiles) {
			const mapping = await this.analyzePath(
				file.path,
				rootDir,
				oldPathFormat,
				newPathFormat,
				oldUseDirectoryCategory,
				newUseDirectoryCategory,
				categories,
				defaultCategory
			);

			if (mapping) {
				mappings.push(mapping);
			}
		}

		//! 競合をチェック。
		this.detectConflicts(mappings);

		return mappings;
	}

	//! ファイルパスを解析して新しいパスを生成する。
	private async analyzePath(
		filePath: string,
		rootDir: string,
		oldPathFormat: string,
		newPathFormat: string,
		oldUseDirectoryCategory: boolean,
		newUseDirectoryCategory: boolean,
		categories: CategoryConfig[],
		defaultCategory: string
	): Promise<PathMapping | null> {
		//! rootDirを除いたパスを取得。
		const relativePath = filePath.substring(rootDir.length + 1);

		//! カテゴリを推定。
		let category: string | null = null;
		let dateInfo: Date | null = null;

		//! 旧フォーマットに%Cが含まれるかチェック。
		const oldHasC = oldPathFormat.includes("%C");

		if (oldHasC) {
			//! %Cがある場合はパスから抽出。
			const result = this.extractFromCustomPath(relativePath, oldPathFormat, categories);
			category = result.category;
			dateInfo = result.date;
		} else if (oldUseDirectoryCategory) {
			//! useDirectoryCategoryがtrueの場合は最初のディレクトリ名がカテゴリ。
			const parts = relativePath.split("/");
			if (parts.length > 0) {
				const dirName = parts[0];
				const matchedCategory = categories.find((c) => c.directory === dirName);
				if (matchedCategory) {
					category = matchedCategory.directory;
				}
			}
		} else {
			//! useDirectoryCategoryがfalseの場合はファイル内容からカテゴリを推定する必要がある。
			//! ここでは全カテゴリを試して、タグペアが存在するものを探す。
			//! 実装の簡略化のため、後で非同期処理で行う。
			category = null;
		}

		//! 日付情報がまだない場合はファイル名から抽出を試みる。
		if (!dateInfo) {
			dateInfo = this.extractDateFromPath(relativePath);
		}

		//! カテゴリが特定できない場合はファイル内容から読み取る。
		if (!category) {
			category = await this.extractCategoryFromFile(filePath);
		}

		//! それでも特定できない場合はデフォルトカテゴリを使用。
		if (!category) {
			category = defaultCategory;
		}

		//! 新しいパスを生成。
		const newPath = PathGenerator.generateCustomPath(
			rootDir,
			category,
			newPathFormat,
			newUseDirectoryCategory,
			dateInfo || new Date()
		);

		return {
			oldPath: filePath,
			newPath,
			category,
			date: dateInfo || undefined,
			hasConflict: false,
		};
	}

	//! カスタムパスフォーマットから情報を抽出。
	private extractFromCustomPath(
		relativePath: string,
		pathFormat: string,
		categories: CategoryConfig[]
	): { category: string | null; date: Date | null } {
		//! %Cの位置を特定。
		const cIndex = pathFormat.indexOf("%C");
		if (cIndex === -1) {
			return { category: null, date: null };
		}

		//! カテゴリ名を抽出するための正規表現を構築。
		//! 簡略化のため、/で区切られたパスからカテゴリ名を探す。
		for (const cat of categories) {
			if (relativePath.includes(cat.directory)) {
				return { category: cat.directory, date: this.extractDateFromPath(relativePath) };
			}
		}

		return { category: null, date: null };
	}

	//! ファイルパスから日付情報を抽出する。
	private extractDateFromPath(path: string): Date | null {
		//! YYYY-MM-DD形式を検索。
		const match1 = path.match(/(\d{4})-(\d{2})-(\d{2})/);
		if (match1) {
			const year = parseInt(match1[1], 10);
			const month = parseInt(match1[2], 10) - 1;
			const day = parseInt(match1[3], 10);
			return new Date(year, month, day);
		}

		//! YYYYMMDD形式を検索。
		const match2 = path.match(/(\d{4})(\d{2})(\d{2})/);
		if (match2) {
			const year = parseInt(match2[1], 10);
			const month = parseInt(match2[2], 10) - 1;
			const day = parseInt(match2[3], 10);
			return new Date(year, month, day);
		}

		//! YYYY-MM形式を検索。
		const match3 = path.match(/(\d{4})-(\d{2})(?!-\d{2})/);
		if (match3) {
			const year = parseInt(match3[1], 10);
			const month = parseInt(match3[2], 10) - 1;
			return new Date(year, month, 1);
		}

		//! YYYY-Wxx形式（週番号）を検索。
		const match4 = path.match(/(\d{4})-W(\d{2})/);
		if (match4) {
			const year = parseInt(match4[1], 10);
			const week = parseInt(match4[2], 10);
			//! 週番号から日付を復元（ISO 8601の第1週の木曜日から計算）。
			return this.getDateFromWeek(year, week);
		}

		//! YYYY形式を検索。
		const match5 = path.match(/(\d{4})(?!-?\d)/);
		if (match5) {
			const year = parseInt(match5[1], 10);
			return new Date(year, 0, 1);
		}

		return null;
	}

	//! ISO 8601週番号から日付を取得する。
	private getDateFromWeek(year: number, week: number): Date {
		//! その年の1月1日を取得。
		const jan1 = new Date(year, 0, 1);
		//! 1月1日の曜日（0=日曜、1=月曜、...、6=土曜）。
		const day = jan1.getDay();
		//! ISO週の開始日（月曜日）までのオフセット。
		const offset = day <= 4 ? 1 - day : 8 - day;
		//! 第1週の月曜日。
		const firstMonday = new Date(year, 0, 1 + offset);
		//! 指定週の月曜日。
		const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
		return targetDate;
	}

	//! 競合を検出する。
	private detectConflicts(mappings: PathMapping[]): void {
		const pathCounts = new Map<string, number>();

		//! 新しいパスの重複をカウント。
		for (const mapping of mappings) {
			const count = pathCounts.get(mapping.newPath) || 0;
			pathCounts.set(mapping.newPath, count + 1);
		}

		//! 競合フラグを設定。
		for (const mapping of mappings) {
			if (pathCounts.get(mapping.newPath)! > 1) {
				mapping.hasConflict = true;
			}
		}
	}

	//! マイグレーションを実行する。
	async executeMigration(
		mappings: PathMapping[],
		skipConflicts = true,
		createBackup = true
	): Promise<MigrationResult> {
		const result: MigrationResult = {
			successCount: 0,
			failureCount: 0,
			skippedCount: 0,
			errors: [],
			warnings: [],
			mappings,
		};

		for (const mapping of mappings) {
			//! 競合がある場合はスキップ。
			if (mapping.hasConflict && skipConflicts) {
				result.skippedCount++;
				result.warnings.push(`競合のためスキップ: ${mapping.oldPath} -> ${mapping.newPath}`);
				continue;
			}

			//! 同じパスの場合はスキップ。
			if (mapping.oldPath === mapping.newPath) {
				result.skippedCount++;
				continue;
			}

			try {
				//! バックアップ作成。
				if (createBackup) {
					const content = await this.vaultHandler.readFile(mapping.oldPath);
					const backupPath = `${mapping.oldPath}.backup-${Date.now()}`;
					await this.vaultHandler.createFile(backupPath, content);
				}

				//! ファイルを移動。
				await this.moveFile(mapping.oldPath, mapping.newPath);
				result.successCount++;
			} catch (error) {
				result.failureCount++;
				result.errors.push(
					`移動失敗: ${mapping.oldPath} -> ${mapping.newPath}: ${error instanceof Error ? error.message : "Unknown error"}`
				);
			}
		}

		return result;
	}

	//! ファイルを移動する。
	private async moveFile(oldPath: string, newPath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(oldPath);

		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${oldPath}`);
		}

		//! 新しいパスのディレクトリを作成。
		const newDir = newPath.substring(0, newPath.lastIndexOf("/"));
		if (newDir && !this.vaultHandler.folderExists(newDir)) {
			await this.vaultHandler.createFolder(newDir);
		}

		//! ファイルをリネーム/移動。
		await this.app.vault.rename(file, newPath);
	}

	//! ファイル内容からカテゴリを抽出する（HTMLコメント形式）。
	private async extractCategoryFromFile(filePath: string): Promise<string | null> {
		try {
			const content = await this.vaultHandler.readFile(filePath);

			//! <!-- memolog: start category="work" --> の形式を検索。
			const match = content.match(/<!--\s*memolog:\s*start\s+category="([^"]+)"\s*-->/);
			if (match && match[1]) {
				return match[1];
			}

			return null;
		} catch (error) {
			return null;
		}
	}

	//! カテゴリを非同期で推定する（ファイル内容を読む必要がある）。
	async detectCategoryFromContent(
		filePath: string,
		categories: CategoryConfig[]
	): Promise<string | null> {
		try {
			const allCategories = await this.vaultHandler.getAllCategories(filePath);

			//! 最初に見つかったカテゴリを返す。
			for (const cat of categories) {
				if (allCategories.has(cat.directory)) {
					return cat.directory;
				}
			}

			return null;
		} catch (error) {
			return null;
		}
	}

	//! 拡張版のマイグレーション計画（ファイル内容からカテゴリを推定）。
	async planMigrationAdvanced(
		rootDir: string,
		oldPathFormat: string,
		newPathFormat: string,
		oldUseDirectoryCategory: boolean,
		newUseDirectoryCategory: boolean,
		categories: CategoryConfig[],
		defaultCategory: string
	): Promise<PathMapping[]> {
		//! 基本的なplanMigrationを呼び出す（既にファイル内容からカテゴリを読み取る機能が含まれている）。
		return await this.planMigration(
			rootDir,
			oldPathFormat,
			newPathFormat,
			oldUseDirectoryCategory,
			newUseDirectoryCategory,
			categories,
			defaultCategory
		);
	}
}
