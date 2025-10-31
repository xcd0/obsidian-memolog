import { App, TFile } from "obsidian";
import { GlobalSettings, LocalSettings, DEFAULT_GLOBAL_SETTINGS } from "../types";
import {
	sanitizeCategoryName,
	sanitizeDirectoryName,
	sanitizePath,
	sanitizeTemplate,
	sanitizeString,
} from "../utils/sanitizer";

//! 設定ファイルを管理するクラス。
export class SettingsManager {
	private app: App;
	private globalSettings: GlobalSettings;
	private localSettingsCache: Map<string, LocalSettings>;

	//! グローバル設定ファイル名。
	private static readonly GLOBAL_SETTINGS_FILENAME = "memolog-setting.json";

	//! 旧グローバル設定ファイル名（マイグレーション用）。
	private static readonly OLD_GLOBAL_SETTINGS_FILENAME = "global-setting.json";

	//! ローカル設定ファイル名。
	private static readonly LOCAL_SETTINGS_FILENAME = "setting.json";

	//! コンストラクタ。
	constructor(app: App) {
		this.app = app;
		this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
		this.localSettingsCache = new Map();
	}

	//! グローバル設定を取得する。
	getGlobalSettings(): GlobalSettings {
		return { ...this.globalSettings };
	}

	//! グローバル設定ファイルのパスを取得する。
	private getGlobalSettingsPath(): string {
		return `${this.globalSettings.rootDirectory}/${SettingsManager.GLOBAL_SETTINGS_FILENAME}`;
	}

	//! Vault内から設定ファイルを探索する（最大3階層まで）。
	private findSettingsFile(filename: string, maxDepth: number = 3): string | null {
		const allFiles = this.app.vault.getFiles();

		for (const file of allFiles) {
			//! ファイル名が一致するか確認。
			if (file.name === filename) {
				//! パスの深さを確認（階層数）。
				const depth = file.path.split("/").length - 1;
				if (depth <= maxDepth) {
					return file.path;
				}
			}
		}

		return null;
	}

	//! 設定ファイルのパスからrootDirectoryを抽出する。
	private extractRootDirectoryFromPath(settingsPath: string): string {
		//! "public/memolog/memolog-setting.json" → "public/memolog"
		const parts = settingsPath.split("/");
		//! 最後の要素（ファイル名）を除去。
		parts.pop();
		return parts.join("/");
	}

	//! グローバル設定をサニタイズする。
	private sanitizeGlobalSettings(settings: GlobalSettings): GlobalSettings {
		const sanitized = { ...settings };

		//! カテゴリ設定をサニタイズ。
		sanitized.categories = sanitized.categories.map((cat) => ({
			...cat,
			name: sanitizeCategoryName(cat.name),
			directory: sanitizeDirectoryName(cat.directory),
			icon: sanitizeString(cat.icon, false),
		}));

		//! 文字列フィールドをサニタイズ。
		sanitized.defaultCategory = sanitizeDirectoryName(sanitized.defaultCategory);
		sanitized.rootDirectory = sanitizePath(sanitized.rootDirectory);
		sanitized.memoTemplate = sanitizeTemplate(sanitized.memoTemplate);
		sanitized.pathFormat = sanitizePath(sanitized.pathFormat);
		sanitized.attachmentPath = sanitizePath(sanitized.attachmentPath);
		sanitized.attachmentNameFormat = sanitizeString(sanitized.attachmentNameFormat, false);

		return sanitized;
	}

	//! ローカル設定をサニタイズする。
	private sanitizeLocalSettings(settings: LocalSettings): LocalSettings {
		const sanitized = { ...settings };

		if (sanitized.template) {
			sanitized.template = sanitizeTemplate(sanitized.template);
		}
		if (sanitized.attachmentPath) {
			sanitized.attachmentPath = sanitizePath(sanitized.attachmentPath);
		}
		if (sanitized.pathFormat) {
			sanitized.pathFormat = sanitizePath(sanitized.pathFormat);
		}

		return sanitized;
	}

	//! グローバル設定を更新する。
	async updateGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
		this.globalSettings = { ...this.globalSettings, ...settings };
		await this.saveGlobalSettings();
	}

	//! グローバル設定を読み込む。
	async loadGlobalSettings(): Promise<void> {
		try {
			//! まず、Vault内から設定ファイルを探索（最大3階層）。
			let foundPath = this.findSettingsFile(SettingsManager.GLOBAL_SETTINGS_FILENAME);

			if (!foundPath) {
				//! 新しい設定ファイルが見つからない場合、デフォルトパスで確認。
				const defaultPath = `${DEFAULT_GLOBAL_SETTINGS.rootDirectory}/${SettingsManager.GLOBAL_SETTINGS_FILENAME}`;
				const file = this.app.vault.getAbstractFileByPath(defaultPath);
				if (file instanceof TFile) {
					foundPath = defaultPath;
				}
			}

			if (foundPath) {
				//! 設定ファイルが見つかった場合は読み込む。
				const file = this.app.vault.getAbstractFileByPath(foundPath);
				if (file instanceof TFile) {
					const content = await this.app.vault.read(file);
					const parsed = JSON.parse(content) as Partial<GlobalSettings>;

					//! 見つかったパスからrootDirectoryを抽出。
					const extractedRoot = this.extractRootDirectoryFromPath(foundPath);

					//! 設定にrootDirectoryが含まれていない、または異なる場合は抽出した値を使用。
					if (!parsed.rootDirectory || parsed.rootDirectory !== extractedRoot) {
						parsed.rootDirectory = extractedRoot;
					}

					//! 読み込んだ設定をサニタイズ。
					const merged = { ...DEFAULT_GLOBAL_SETTINGS, ...parsed };
					this.globalSettings = this.sanitizeGlobalSettings(merged);
					return;
				}
			}

			//! 新しい設定ファイルが見つからない場合、古いファイルを探索。
			let oldFoundPath = this.findSettingsFile(SettingsManager.OLD_GLOBAL_SETTINGS_FILENAME);

			if (!oldFoundPath) {
				//! 古いファイルもデフォルトパスで確認。
				const defaultOldPath = `${DEFAULT_GLOBAL_SETTINGS.rootDirectory}/${SettingsManager.OLD_GLOBAL_SETTINGS_FILENAME}`;
				const oldFile = this.app.vault.getAbstractFileByPath(defaultOldPath);
				if (oldFile instanceof TFile) {
					oldFoundPath = defaultOldPath;
				}
			}

			if (oldFoundPath) {
				//! 古いファイルが見つかった場合、マイグレーション。
				const oldFile = this.app.vault.getAbstractFileByPath(oldFoundPath);
				if (oldFile instanceof TFile) {
					console.log(`Migrating settings from ${oldFoundPath} to new format`);
					const content = await this.app.vault.read(oldFile);
					const parsed = JSON.parse(content) as Partial<GlobalSettings>;

					//! 見つかったパスからrootDirectoryを抽出。
					const extractedRoot = this.extractRootDirectoryFromPath(oldFoundPath);

					//! 設定にrootDirectoryが含まれていない、または異なる場合は抽出した値を使用。
					if (!parsed.rootDirectory || parsed.rootDirectory !== extractedRoot) {
						parsed.rootDirectory = extractedRoot;
					}

					//! 読み込んだ設定をサニタイズ。
					const merged = { ...DEFAULT_GLOBAL_SETTINGS, ...parsed };
					this.globalSettings = this.sanitizeGlobalSettings(merged);
					//! 新しいファイルに保存。
					await this.saveGlobalSettings();
					//! 古いファイルを削除。
					await this.app.vault.delete(oldFile);
					console.log("Settings migration completed");
					return;
				}
			}

			//! どちらのファイルも見つからない場合はデフォルト設定で初期化。
			await this.saveGlobalSettings();
		} catch (error) {
			console.error("Failed to load global settings:", error);
			//! エラー時はデフォルト設定を使用。
			this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
		}
	}

	//! グローバル設定を保存する。
	async saveGlobalSettings(): Promise<void> {
		try {
			//! 保存前にサニタイズして、メモリにも反映。
			this.globalSettings = this.sanitizeGlobalSettings(this.globalSettings);

			//! 現在のrootDirectoryを使ってパスを生成。
			const settingsPath = this.getGlobalSettingsPath();
			const dirPath = settingsPath.split("/").slice(0, -1).join("/");

			//! ディレクトリが存在しない場合は作成。
			const dir = this.app.vault.getAbstractFileByPath(dirPath);
			if (!dir) {
				await this.app.vault.createFolder(dirPath);
			}

			const content = JSON.stringify(this.globalSettings, null, "\t");
			const file = this.app.vault.getAbstractFileByPath(settingsPath);

			if (file instanceof TFile) {
				await this.app.vault.modify(file, content);
			} else {
				await this.app.vault.create(settingsPath, content);
			}
		} catch (error) {
			console.error("Failed to save global settings:", error);
			throw error;
		}
	}

	//! ローカル設定を読み込む。
	async loadLocalSettings(directoryPath: string): Promise<LocalSettings | null> {
		//! キャッシュに存在する場合は返す。
		if (this.localSettingsCache.has(directoryPath)) {
			return this.localSettingsCache.get(directoryPath) || null;
		}

		try {
			const settingsPath = `${directoryPath}/${SettingsManager.LOCAL_SETTINGS_FILENAME}`;
			const file = this.app.vault.getAbstractFileByPath(settingsPath);

			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				const parsed = JSON.parse(content) as LocalSettings;
				//! 読み込んだ設定をサニタイズ。
				const sanitized = this.sanitizeLocalSettings(parsed);
				//! キャッシュに保存。
				this.localSettingsCache.set(directoryPath, sanitized);
				return sanitized;
			}

			return null;
		} catch (error) {
			console.error(`Failed to load local settings from ${directoryPath}:`, error);
			return null;
		}
	}

	//! ローカル設定を保存する。
	async saveLocalSettings(directoryPath: string, settings: LocalSettings): Promise<void> {
		try {
			//! 保存前にサニタイズ。
			const sanitized = this.sanitizeLocalSettings(settings);
			const settingsPath = `${directoryPath}/${SettingsManager.LOCAL_SETTINGS_FILENAME}`;
			const content = JSON.stringify(sanitized, null, "\t");
			const file = this.app.vault.getAbstractFileByPath(settingsPath);

			if (file instanceof TFile) {
				await this.app.vault.modify(file, content);
			} else {
				await this.app.vault.create(settingsPath, content);
			}

			//! キャッシュを更新。
			this.localSettingsCache.set(directoryPath, sanitized);
		} catch (error) {
			console.error(`Failed to save local settings to ${directoryPath}:`, error);
			throw error;
		}
	}

	//! マージされた設定を取得する（グローバル + ローカル）。
	async getMergedSettings(directoryPath?: string): Promise<GlobalSettings & LocalSettings> {
		const global = this.getGlobalSettings();
		const local = directoryPath ? await this.loadLocalSettings(directoryPath) : null;

		return {
			...global,
			...local,
		};
	}

	//! キャッシュをクリアする。
	clearCache(): void {
		this.localSettingsCache.clear();
	}

	//! 設定をバリデーションする。
	validateSettings(settings: Partial<GlobalSettings>): boolean {
		//! カテゴリ配列が存在し、少なくとも1つのカテゴリがあること。
		if (settings.categories && settings.categories.length === 0) {
			return false;
		}

		//! defaultCategoryが存在する場合、categoriesに含まれていること。
		if (settings.defaultCategory && settings.categories) {
			const categoryDirectories = settings.categories.map((c) => c.directory);
			if (!categoryDirectories.includes(settings.defaultCategory)) {
				return false;
			}
		}

		return true;
	}
}
