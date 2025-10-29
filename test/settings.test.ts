import { SettingsManager } from "../src/core/settings";
import { GlobalSettings, LocalSettings, DEFAULT_GLOBAL_SETTINGS } from "../src/types";
import { App, TFile, TFolder } from "obsidian";

//! vault APIのモック関数。
const mockRead = jest.fn();
const mockCreate = jest.fn();
const mockModify = jest.fn();
const mockGetAbstractFileByPath = jest.fn();
const mockCreateFolder = jest.fn();
const mockDelete = jest.fn();

//! TFileのモック作成ヘルパー。
const createMockTFile = (path: string): TFile => {
	return Object.create(TFile.prototype, {
		path: { value: path },
	}) as TFile;
};

//! TFolderのモック作成ヘルパー。
const createMockTFolder = (path: string): TFolder => {
	return Object.create(TFolder.prototype, {
		path: { value: path },
	}) as TFolder;
};

//! Appのモック。
const mockApp = {
	vault: {
		read: mockRead,
		create: mockCreate,
		modify: mockModify,
		getAbstractFileByPath: mockGetAbstractFileByPath,
		createFolder: mockCreateFolder,
		delete: mockDelete,
	},
} as unknown as App;

describe("SettingsManager", () => {
	let settingsManager: SettingsManager;

	beforeEach(() => {
		//! 各テストの前にSettingsManagerを初期化。
		settingsManager = new SettingsManager(mockApp);
		jest.clearAllMocks();
	});

	describe("getGlobalSettings", () => {
		it("デフォルトのグローバル設定を取得できる", () => {
			const settings = settingsManager.getGlobalSettings();
			expect(settings).toEqual(DEFAULT_GLOBAL_SETTINGS);
		});

		it("設定オブジェクトのコピーを返す（参照渡しではない）", () => {
			const settings1 = settingsManager.getGlobalSettings();
			const settings2 = settingsManager.getGlobalSettings();
			expect(settings1).not.toBe(settings2);
		});
	});

	describe("updateGlobalSettings", () => {
		it("グローバル設定を部分的に更新できる", async () => {
			//! 設定ファイルが存在する場合のモック。
			const mockDir = createMockTFolder("memolog");
			const mockFile = createMockTFile("memolog/memolog-setting.json");
			mockGetAbstractFileByPath
				.mockReturnValueOnce(mockDir) //! ディレクトリチェック。
				.mockReturnValueOnce(mockFile); //! ファイルチェック。
			mockModify.mockResolvedValue(undefined);

			const updates: Partial<GlobalSettings> = {
				defaultCategory: "hobby",
				searchHistoryMaxSize: 100,
			};

			await settingsManager.updateGlobalSettings(updates);

			const settings = settingsManager.getGlobalSettings();
			expect(settings.defaultCategory).toBe("hobby");
			expect(settings.searchHistoryMaxSize).toBe(100);
			expect(mockModify).toHaveBeenCalledWith(
				mockFile,
				expect.stringContaining('"defaultCategory": "hobby"')
			);
		});

		it("更新時にファイルが存在しない場合は作成する", async () => {
			//! ディレクトリは存在するがファイルが存在しない場合のモック。
			const mockDir = createMockTFolder("memolog");
			mockGetAbstractFileByPath
				.mockReturnValueOnce(mockDir) //! ディレクトリチェック。
				.mockReturnValueOnce(null); //! ファイルチェック。
			mockCreate.mockResolvedValue(createMockTFile("memolog/memolog-setting.json"));

			await settingsManager.updateGlobalSettings({ searchHistoryMaxSize: 100 });

			expect(mockCreate).toHaveBeenCalledWith(
				"memolog/memolog-setting.json",
				expect.stringContaining('"searchHistoryMaxSize": 100')
			);
		});
	});

	describe("loadGlobalSettings", () => {
		it("設定ファイルが存在する場合は読み込む", async () => {
			const mockFile = createMockTFile("memolog/memolog-setting.json");
			const savedSettings: Partial<GlobalSettings> = {
				defaultCategory: "hobby",
				searchHistoryMaxSize: 100,
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockRead.mockResolvedValue(JSON.stringify(savedSettings));

			await settingsManager.loadGlobalSettings();

			const settings = settingsManager.getGlobalSettings();
			expect(settings.defaultCategory).toBe("hobby");
			expect(settings.searchHistoryMaxSize).toBe(100);
		});

		it("設定ファイルが存在しない場合はデフォルト設定で初期化する", async () => {
			mockGetAbstractFileByPath
				.mockReturnValueOnce(null) //! 新しいファイルチェック。
				.mockReturnValueOnce(null) //! 古いファイルチェック（マイグレーション）。
				.mockReturnValueOnce(null) //! ディレクトリチェック（saveGlobalSettings内）。
				.mockReturnValueOnce(null); //! ファイルチェック（saveGlobalSettings内）。
			mockCreateFolder.mockResolvedValue(undefined);
			mockCreate.mockResolvedValue(createMockTFile("memolog/memolog-setting.json"));

			await settingsManager.loadGlobalSettings();

			const settings = settingsManager.getGlobalSettings();
			expect(settings).toEqual(DEFAULT_GLOBAL_SETTINGS);
			expect(mockCreate).toHaveBeenCalled();
		});

		it("古いファイルから新しいファイルにマイグレーションする", async () => {
			const oldFile = createMockTFile("memolog/global-setting.json");
			const oldSettings = {
				...DEFAULT_GLOBAL_SETTINGS,
				defaultCategory: "personal",
			};

			mockGetAbstractFileByPath
				.mockReturnValueOnce(null) //! 新しいファイルチェック（存在しない）。
				.mockReturnValueOnce(oldFile) //! 古いファイルチェック（存在する）。
				.mockReturnValueOnce(null) //! ディレクトリチェック（saveGlobalSettings内）。
				.mockReturnValueOnce(null); //! ファイルチェック（saveGlobalSettings内）。

			mockRead.mockResolvedValue(JSON.stringify(oldSettings));
			mockCreateFolder.mockResolvedValue(undefined);
			mockCreate.mockResolvedValue(createMockTFile("memolog/memolog-setting.json"));
			mockDelete.mockResolvedValue(undefined);

			//! マイグレーションログをモック。
			const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

			await settingsManager.loadGlobalSettings();

			const settings = settingsManager.getGlobalSettings();
			expect(settings.defaultCategory).toBe("personal");
			expect(mockCreate).toHaveBeenCalled();
			expect(mockDelete).toHaveBeenCalledWith(oldFile);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"Migrating settings from global-setting.json to memolog-setting.json"
			);
			expect(consoleLogSpy).toHaveBeenCalledWith("Settings migration completed");

			consoleLogSpy.mockRestore();
		});

		it("読み込みエラー時はデフォルト設定を使用する", async () => {
			const mockFile = createMockTFile("memolog/memolog-setting.json");
			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockRead.mockRejectedValue(new Error("Read error"));

			//! エラーを出力しないようにconsole.errorをモック。
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

			await settingsManager.loadGlobalSettings();

			const settings = settingsManager.getGlobalSettings();
			expect(settings).toEqual(DEFAULT_GLOBAL_SETTINGS);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to load global settings:",
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("saveGlobalSettings", () => {
		it("設定ファイルが存在する場合は更新する", async () => {
			const mockDir = createMockTFolder("memolog");
			const mockFile = createMockTFile("memolog/memolog-setting.json");
			mockGetAbstractFileByPath
				.mockReturnValueOnce(mockDir) //! ディレクトリチェック。
				.mockReturnValueOnce(mockFile); //! ファイルチェック。
			mockModify.mockResolvedValue(undefined);

			await settingsManager.saveGlobalSettings();

			expect(mockModify).toHaveBeenCalledWith(
				mockFile,
				expect.stringContaining(DEFAULT_GLOBAL_SETTINGS.defaultCategory)
			);
		});

		it("設定ファイルが存在しない場合は作成する", async () => {
			const mockDir = createMockTFolder("memolog");
			mockGetAbstractFileByPath
				.mockReturnValueOnce(mockDir) //! ディレクトリチェック。
				.mockReturnValueOnce(null); //! ファイルチェック。
			mockCreate.mockResolvedValue(createMockTFile("memolog/memolog-setting.json"));

			await settingsManager.saveGlobalSettings();

			expect(mockCreate).toHaveBeenCalledWith(
				"memolog/memolog-setting.json",
				expect.stringContaining(DEFAULT_GLOBAL_SETTINGS.defaultCategory)
			);
		});

		it("ディレクトリが存在しない場合は作成する", async () => {
			mockGetAbstractFileByPath
				.mockReturnValueOnce(null) //! ディレクトリチェック。
				.mockReturnValueOnce(null); //! ファイルチェック。
			mockCreateFolder.mockResolvedValue(undefined);
			mockCreate.mockResolvedValue(createMockTFile("memolog/memolog-setting.json"));

			await settingsManager.saveGlobalSettings();

			expect(mockCreateFolder).toHaveBeenCalledWith("memolog");
			expect(mockCreate).toHaveBeenCalled();
		});

		it("保存エラー時は例外をスローする", async () => {
			const mockDir = createMockTFolder("memolog");
			const mockFile = createMockTFile("memolog/memolog-setting.json");
			mockGetAbstractFileByPath
				.mockReturnValueOnce(mockDir)
				.mockReturnValueOnce(mockFile);
			mockModify.mockRejectedValue(new Error("Write error"));

			//! エラーを出力しないようにconsole.errorをモック。
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

			await expect(settingsManager.saveGlobalSettings()).rejects.toThrow("Write error");
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to save global settings:",
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("loadLocalSettings", () => {
		it("ローカル設定ファイルが存在する場合は読み込む", async () => {
			const mockFile = createMockTFile("work/setting.json");
			const localSettings: LocalSettings = {
				template: "カスタムテンプレート",
				order: "desc",
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockRead.mockResolvedValue(JSON.stringify(localSettings));

			const settings = await settingsManager.loadLocalSettings("work");
			expect(settings).toEqual(localSettings);
		});

		it("キャッシュに存在する場合はキャッシュから取得する", async () => {
			const mockFile = createMockTFile("work/setting.json");
			const localSettings: LocalSettings = {
				template: "カスタムテンプレート",
				order: "desc",
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockRead.mockResolvedValue(JSON.stringify(localSettings));

			//! 1回目: ファイルから読み込み。
			const settings1 = await settingsManager.loadLocalSettings("work");
			expect(mockRead).toHaveBeenCalledTimes(1);

			//! 2回目: キャッシュから取得。
			const settings2 = await settingsManager.loadLocalSettings("work");
			expect(mockRead).toHaveBeenCalledTimes(1); //! キャッシュから取得するので増えない。
			expect(settings2).toEqual(settings1);
		});

		it("ローカル設定ファイルが存在しない場合はnullを返す", async () => {
			mockGetAbstractFileByPath.mockReturnValue(null);

			const settings = await settingsManager.loadLocalSettings("work");
			expect(settings).toBeNull();
		});

		it("読み込みエラー時はnullを返す", async () => {
			const mockFile = createMockTFile("work/setting.json");
			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockRead.mockRejectedValue(new Error("Read error"));

			//! エラーを出力しないようにconsole.errorをモック。
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

			const settings = await settingsManager.loadLocalSettings("work");
			expect(settings).toBeNull();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to load local settings from work:",
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("saveLocalSettings", () => {
		it("ローカル設定ファイルが存在する場合は更新する", async () => {
			const mockFile = createMockTFile("work/setting.json");
			const localSettings: LocalSettings = {
				template: "カスタムテンプレート",
				order: "desc",
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockModify.mockResolvedValue(undefined);

			await settingsManager.saveLocalSettings("work", localSettings);

			expect(mockModify).toHaveBeenCalledWith(
				mockFile,
				expect.stringContaining('"template": "カスタムテンプレート"')
			);
		});

		it("ローカル設定ファイルが存在しない場合は作成する", async () => {
			const localSettings: LocalSettings = {
				template: "カスタムテンプレート",
				order: "desc",
			};

			mockGetAbstractFileByPath.mockReturnValue(null);
			mockCreate.mockResolvedValue(createMockTFile("work/setting.json"));

			await settingsManager.saveLocalSettings("work", localSettings);

			expect(mockCreate).toHaveBeenCalledWith(
				"work/setting.json",
				expect.stringContaining('"template": "カスタムテンプレート"')
			);
		});

		it("保存後にキャッシュを更新する", async () => {
			const mockFile = createMockTFile("work/setting.json");
			const localSettings: LocalSettings = {
				template: "カスタムテンプレート",
				order: "desc",
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockModify.mockResolvedValue(undefined);

			await settingsManager.saveLocalSettings("work", localSettings);

			//! キャッシュから取得できることを確認。
			const cached = await settingsManager.loadLocalSettings("work");
			expect(cached).toEqual(localSettings);
			expect(mockRead).not.toHaveBeenCalled(); //! ファイル読み込みは発生しない。
		});

		it("保存エラー時は例外をスローする", async () => {
			const mockFile = createMockTFile("work/setting.json");
			const localSettings: LocalSettings = {
				template: "カスタムテンプレート",
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockModify.mockRejectedValue(new Error("Write error"));

			//! エラーを出力しないようにconsole.errorをモック。
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

			await expect(settingsManager.saveLocalSettings("work", localSettings)).rejects.toThrow(
				"Write error"
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to save local settings to work:",
				expect.any(Error)
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("getMergedSettings", () => {
		it("グローバル設定のみの場合は返す", async () => {
			const merged = await settingsManager.getMergedSettings();
			expect(merged).toEqual(DEFAULT_GLOBAL_SETTINGS);
		});

		it("ローカル設定がある場合はマージする", async () => {
			const mockFile = createMockTFile("work/setting.json");
			const localSettings: LocalSettings = {
				template: "カスタムテンプレート",
				order: "desc",
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockRead.mockResolvedValue(JSON.stringify(localSettings));

			const merged = await settingsManager.getMergedSettings("work");
			expect(merged.template).toBe("カスタムテンプレート");
			expect(merged.order).toBe("desc");
			expect(merged.defaultCategory).toBe(DEFAULT_GLOBAL_SETTINGS.defaultCategory);
		});

		it("ローカル設定がグローバル設定を上書きする", async () => {
			const mockFile = createMockTFile("work/setting.json");
			const localSettings: LocalSettings = {
				order: "desc", //! グローバル設定は"asc"。
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockRead.mockResolvedValue(JSON.stringify(localSettings));

			const merged = await settingsManager.getMergedSettings("work");
			expect(merged.order).toBe("desc"); //! ローカル設定が優先される。
		});
	});

	describe("clearCache", () => {
		it("キャッシュをクリアできる", async () => {
			const mockFile = createMockTFile("work/setting.json");
			const localSettings: LocalSettings = {
				template: "カスタムテンプレート",
			};

			mockGetAbstractFileByPath.mockReturnValue(mockFile);
			mockRead.mockResolvedValue(JSON.stringify(localSettings));

			//! キャッシュに保存。
			await settingsManager.loadLocalSettings("work");
			expect(mockRead).toHaveBeenCalledTimes(1);

			//! キャッシュをクリア。
			settingsManager.clearCache();

			//! 再度読み込み（キャッシュがクリアされているのでファイルから読み込む）。
			await settingsManager.loadLocalSettings("work");
			expect(mockRead).toHaveBeenCalledTimes(2);
		});
	});

	describe("validateSettings", () => {
		it("有効な設定の場合はtrueを返す", () => {
			const validSettings: Partial<GlobalSettings> = {
				categories: [
					{
						name: "仕事",
						directory: "work",
						color: "#3b82f6",
						icon: "briefcase",
					},
				],
				defaultCategory: "work",
			};

			expect(settingsManager.validateSettings(validSettings)).toBe(true);
		});

		it("カテゴリが空配列の場合はfalseを返す", () => {
			const invalidSettings: Partial<GlobalSettings> = {
				categories: [],
			};

			expect(settingsManager.validateSettings(invalidSettings)).toBe(false);
		});

		it("defaultCategoryがcategoriesに含まれていない場合はfalseを返す", () => {
			const invalidSettings: Partial<GlobalSettings> = {
				categories: [
					{
						name: "仕事",
						directory: "work",
						color: "#3b82f6",
						icon: "briefcase",
					},
				],
				defaultCategory: "invalid", //! categoriesに存在しない。
			};

			expect(settingsManager.validateSettings(invalidSettings)).toBe(false);
		});

		it("categoriesのみが設定されている場合はtrueを返す", () => {
			const validSettings: Partial<GlobalSettings> = {
				categories: [
					{
						name: "仕事",
						directory: "work",
						color: "#3b82f6",
						icon: "briefcase",
					},
				],
			};

			expect(settingsManager.validateSettings(validSettings)).toBe(true);
		});
	});
});
