import { App, TFile } from "obsidian";
import { GlobalSettings, LocalSettings, DEFAULT_GLOBAL_SETTINGS } from "../types";

//! 設定ファイルを管理するクラス。
export class SettingsManager {
	private app: App;
	private globalSettings: GlobalSettings;
	private localSettingsCache: Map<string, LocalSettings>;

	//! グローバル設定ファイルのパス。
	private static readonly GLOBAL_SETTINGS_PATH = "memolog/global-setting.json";

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

	//! グローバル設定を更新する。
	async updateGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
		this.globalSettings = { ...this.globalSettings, ...settings };
		await this.saveGlobalSettings();
	}

	//! グローバル設定を読み込む。
	async loadGlobalSettings(): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(
				SettingsManager.GLOBAL_SETTINGS_PATH
			);

			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				const parsed = JSON.parse(content) as Partial<GlobalSettings>;
				this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...parsed };
			} else {
				//! ファイルが存在しない場合はデフォルト設定で初期化。
				await this.saveGlobalSettings();
			}
		} catch (error) {
			console.error("Failed to load global settings:", error);
			//! エラー時はデフォルト設定を使用。
			this.globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };
		}
	}

	//! グローバル設定を保存する。
	async saveGlobalSettings(): Promise<void> {
		try {
			const dirPath = SettingsManager.GLOBAL_SETTINGS_PATH.split("/")
				.slice(0, -1)
				.join("/");

			//! ディレクトリが存在しない場合は作成。
			const dir = this.app.vault.getAbstractFileByPath(dirPath);
			if (!dir) {
				await this.app.vault.createFolder(dirPath);
			}

			const content = JSON.stringify(this.globalSettings, null, "\t");
			const file = this.app.vault.getAbstractFileByPath(
				SettingsManager.GLOBAL_SETTINGS_PATH
			);

			if (file instanceof TFile) {
				await this.app.vault.modify(file, content);
			} else {
				await this.app.vault.create(SettingsManager.GLOBAL_SETTINGS_PATH, content);
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
				//! キャッシュに保存。
				this.localSettingsCache.set(directoryPath, parsed);
				return parsed;
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
			const settingsPath = `${directoryPath}/${SettingsManager.LOCAL_SETTINGS_FILENAME}`;
			const content = JSON.stringify(settings, null, "\t");
			const file = this.app.vault.getAbstractFileByPath(settingsPath);

			if (file instanceof TFile) {
				await this.app.vault.modify(file, content);
			} else {
				await this.app.vault.create(settingsPath, content);
			}

			//! キャッシュを更新。
			this.localSettingsCache.set(directoryPath, settings);
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
			const categoryNames = settings.categories.map((c) => c.name);
			if (!categoryNames.includes(settings.defaultCategory)) {
				return false;
			}
		}

		return true;
	}
}
