import { App, TFile, TFolder } from "obsidian"
import { SettingsManager } from "../src/core/settings"
import { CategoryConfig } from "../src/types"

// ! vault APIのモック関数。
const mockRead = jest.fn()
const mockCreate = jest.fn()
const mockModify = jest.fn()
const mockGetAbstractFileByPath = jest.fn()
const mockCreateFolder = jest.fn()
const mockDelete = jest.fn()
const mockGetFiles = jest.fn()

// ! TFileのモック作成ヘルパー。
const createMockTFile = (path: string): TFile => {
	const name = path.split("/").pop() || ""
	return Object.create(TFile.prototype, {
		path: { value: path },
		name: { value: name },
	}) as TFile
}

// ! TFolderのモック作成ヘルパー。
const createMockTFolder = (path: string): TFolder => {
	return Object.create(TFolder.prototype, {
		path: { value: path },
	}) as TFolder
}

// ! Appのモック。
const mockApp = {
	vault: {
		read: mockRead,
		create: mockCreate,
		modify: mockModify,
		getAbstractFileByPath: mockGetAbstractFileByPath,
		createFolder: mockCreateFolder,
		delete: mockDelete,
		getFiles: mockGetFiles,
	},
} as unknown as App

/**
 * ! カテゴリフィールドの段階的な変更をシミュレートする補助関数。
 */
async function simulateTyping(
	settingsManager: SettingsManager,
	initialCategories: CategoryConfig[],
	categoryIndex: number,
	fieldName: keyof CategoryConfig,
	targetValue: string,
): Promise<void> {
	const categories = [...initialCategories]
	const currentValue = categories[categoryIndex][fieldName] as string

	// ! 空文字列から1文字ずつ追加していく。
	if (targetValue.length > currentValue.length) {
		// ! 追加モード: 1文字ずつ追加。
		for (let i = currentValue.length; i <= targetValue.length; i++) {
			const newValue = targetValue.substring(0, i)
			categories[categoryIndex] = {
				...categories[categoryIndex],
				[fieldName]: newValue,
			}

			await settingsManager.updateGlobalSettings({
				categories: [...categories],
			})
		}
	} else if (targetValue.length < currentValue.length) {
		// ! 削除モード: 1文字ずつ削除。
		for (let i = currentValue.length; i >= targetValue.length; i--) {
			const newValue = currentValue.substring(0, i)
			categories[categoryIndex] = {
				...categories[categoryIndex],
				[fieldName]: newValue,
			}

			await settingsManager.updateGlobalSettings({
				categories: [...categories],
			})
		}
	} else {
		// ! 文字列長が同じ場合は直接設定。
		categories[categoryIndex] = {
			...categories[categoryIndex],
			[fieldName]: targetValue,
		}

		await settingsManager.updateGlobalSettings({
			categories: [...categories],
		})
	}
}

describe("SettingsManager - カテゴリの段階的な変更", () => {
	let settingsManager: SettingsManager

	beforeEach(async () => {
		settingsManager = new SettingsManager(mockApp)
		jest.clearAllMocks()
		mockGetFiles.mockReturnValue([])

		// ! 基本的なモック設定。
		const mockDir = createMockTFolder("memolog")
		const mockFile = createMockTFile("memolog/memolog-setting.json")

		// ! getAbstractFileByPath は呼び出しごとに異なる値を返す必要がある。
		mockGetAbstractFileByPath
			.mockReturnValue(mockDir) // ! ディレクトリチェック。

		mockModify.mockResolvedValue(undefined)
		mockCreate.mockResolvedValue(mockFile)

		// ! 初期設定として2つのカテゴリを設定。
		await settingsManager.updateGlobalSettings({
			categories: [
				{
					name: "仕事",
					directory: "work",
					color: "#3b82f6",
					icon: "briefcase",
				},
				{
					name: "趣味",
					directory: "hobby",
					color: "#22c55e",
					icon: "gamepad",
				},
			],
		})

		// ! モックをリセットして、テストでの呼び出しをカウント。
		jest.clearAllMocks()
		mockGetAbstractFileByPath.mockImplementation((path: string) => {
			if (path === "memolog") {
				return mockDir
			}
			if (path === "memolog/memolog-setting.json") {
				return mockFile
			}
			return null
		})
	})

	describe("状態1: カテゴリ追加", () => {
		it("新しいカテゴリを追加した状態で正しく保存される", async () => {
			const settings = settingsManager.getGlobalSettings()

			// ! 3つ目のカテゴリを追加。
			const newCategory: CategoryConfig = {
				name: "新しいカテゴリ",
				directory: "new-category",
				color: "#a855f7",
				icon: "folder",
			}

			await settingsManager.updateGlobalSettings({
				categories: [...settings.categories, newCategory],
			})

			const updatedSettings = settingsManager.getGlobalSettings()
			expect(updatedSettings.categories).toHaveLength(3)
			expect(updatedSettings.categories[2]).toEqual(newCategory)
			expect(mockModify).toHaveBeenCalled()
		})

		it("複数の新しいカテゴリを連続して追加できる", async () => {
			const settings = settingsManager.getGlobalSettings()

			// ! 1つ目を追加。
			await settingsManager.updateGlobalSettings({
				categories: [
					...settings.categories,
					{
						name: "新しいカテゴリ",
						directory: "new-category",
						color: "#a855f7",
						icon: "folder",
					},
				],
			})

			// ! 2つ目を追加。
			const settings2 = settingsManager.getGlobalSettings()
			await settingsManager.updateGlobalSettings({
				categories: [
					...settings2.categories,
					{
						name: "新しいカテゴリ",
						directory: "new-category",
						color: "#a855f7",
						icon: "folder",
					},
				],
			})

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories).toHaveLength(4)
		})
	})

	describe("状態3: カテゴリのディレクトリ名を変更", () => {
		it("new-category → memo への段階的な変更が保存される", async () => {
			// ! 初期状態: 3つのカテゴリ。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
					{ name: "趣味", directory: "hobby", color: "#22c55e", icon: "gamepad" },
					{ name: "新しいカテゴリ", directory: "new-category", color: "#a855f7", icon: "folder" },
				],
			})

			// ! "new-category" を削除して "memo" を入力する過程をシミュレート。
			const categories = settingsManager.getGlobalSettings().categories

			// ! "new-category" → "" (全削除)。
			await simulateTyping(settingsManager, categories, 2, "directory", "")

			// ! "" → "m" → "me" → "mem" → "memo" (1文字ずつ入力)。
			await simulateTyping(settingsManager, settingsManager.getGlobalSettings().categories, 2, "directory", "memo")

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[2].directory).toBe("memo")
			// ! 複数回の保存が呼ばれていることを確認。
			expect(mockModify.mock.calls.length).toBeGreaterThan(1)
		})
	})

	describe("状態4: カテゴリの表示名を削除", () => {
		it("表示名を段階的に削除できる", async () => {
			// ! 初期状態。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
					{ name: "趣味", directory: "hobby", color: "#22c55e", icon: "gamepad" },
					{ name: "新しいカテゴリ", directory: "memo", color: "#a855f7", icon: "folder" },
				],
			})

			// ! "新しいカテゴリ" → "" (1文字ずつ削除)。
			const categories = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories, 2, "name", "")

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[2].name).toBe("")
		})
	})

	describe("状態5: アイコンを変更", () => {
		it("アイコンをfolder → file-textに変更できる", async () => {
			// ! 初期状態。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
					{ name: "趣味", directory: "hobby", color: "#22c55e", icon: "gamepad" },
					{ name: "", directory: "memo", color: "#a855f7", icon: "folder" },
				],
			})

			// ! アイコンを変更。
			const categories = settingsManager.getGlobalSettings().categories
			categories[2] = {
				...categories[2],
				icon: "file-text",
			}

			await settingsManager.updateGlobalSettings({
				categories: [...categories],
			})

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[2].icon).toBe("file-text")
		})
	})

	describe("状態6-7: 4つ目のカテゴリを追加してディレクトリ名と表示名を変更", () => {
		it("new-category → random への変更と表示名の削除ができる", async () => {
			// ! 初期状態: 4つ目のカテゴリを追加。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
					{ name: "趣味", directory: "hobby", color: "#22c55e", icon: "gamepad" },
					{ name: "", directory: "memo", color: "#a855f7", icon: "file-text" },
					{ name: "新しいカテゴリ", directory: "new-category", color: "#ec4899", icon: "folder" },
				],
			})

			// ! "new-category" → "random"。
			const categories1 = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories1, 3, "directory", "")
			await simulateTyping(settingsManager, settingsManager.getGlobalSettings().categories, 3, "directory", "random")

			// ! 表示名を削除。
			const categories2 = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories2, 3, "name", "")

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[3].directory).toBe("random")
			expect(finalSettings.categories[3].name).toBe("")
		})

		it("アイコンをfolder → twitterに変更できる", async () => {
			// ! 初期状態。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
					{ name: "趣味", directory: "hobby", color: "#22c55e", icon: "gamepad" },
					{ name: "", directory: "memo", color: "#a855f7", icon: "file-text" },
					{ name: "", directory: "random", color: "#ec4899", icon: "folder" },
				],
			})

			// ! アイコンを変更。
			const categories = settingsManager.getGlobalSettings().categories
			categories[3] = {
				...categories[3],
				icon: "twitter",
			}

			await settingsManager.updateGlobalSettings({
				categories: [...categories],
			})

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[3].icon).toBe("twitter")
		})
	})

	describe("状態8-9-10-11: 5つ目のカテゴリを追加してselfmadeに変更", () => {
		it("5つ目のカテゴリをselfmadeに変更し、表示名を削除、アイコンをlist-checksに変更できる", async () => {
			// ! 初期状態: 5つ目のカテゴリを追加。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
					{ name: "趣味", directory: "hobby", color: "#22c55e", icon: "gamepad" },
					{ name: "", directory: "memo", color: "#a855f7", icon: "file-text" },
					{ name: "", directory: "random", color: "#ec4899", icon: "twitter" },
					{ name: "新しいカテゴリ", directory: "new-category", color: "#14b8a6", icon: "folder" },
				],
			})

			// ! "new-category" → "selfmade"。
			const categories1 = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories1, 4, "directory", "")
			await simulateTyping(settingsManager, settingsManager.getGlobalSettings().categories, 4, "directory", "selfmade")

			// ! 表示名を削除。
			const categories2 = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories2, 4, "name", "")

			// ! アイコンを変更。
			const categories3 = settingsManager.getGlobalSettings().categories
			categories3[4] = {
				...categories3[4],
				icon: "list-checks",
			}

			await settingsManager.updateGlobalSettings({
				categories: [...categories3],
			})

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[4].directory).toBe("selfmade")
			expect(finalSettings.categories[4].name).toBe("")
			expect(finalSettings.categories[4].icon).toBe("list-checks")
		})
	})

	describe("JSON保存の検証", () => {
		it("全ての段階的な変更がJSONに正しく保存される", async () => {
			// ! 完全なシナリオをシミュレート。

			// ! 状態1: 初期状態 (work, hobby)。
			const initialCategories: CategoryConfig[] = [
				{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
				{ name: "趣味", directory: "hobby", color: "#22c55e", icon: "gamepad" },
			]

			await settingsManager.updateGlobalSettings({
				categories: initialCategories,
			})

			// ! 状態2: 3つ目のカテゴリを追加。
			await settingsManager.updateGlobalSettings({
				categories: [
					...initialCategories,
					{ name: "新しいカテゴリ", directory: "new-category", color: "#a855f7", icon: "folder" },
				],
			})

			// ! 状態3-5: 3つ目のカテゴリを編集 (new-category → memo, 表示名削除, アイコン変更)。
			let categories = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories, 2, "directory", "")
			await simulateTyping(settingsManager, settingsManager.getGlobalSettings().categories, 2, "directory", "memo")

			categories = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories, 2, "name", "")

			categories = settingsManager.getGlobalSettings().categories
			categories[2] = { ...categories[2], icon: "file-text" }
			await settingsManager.updateGlobalSettings({ categories: [...categories] })

			// ! 最終確認。
			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories).toHaveLength(3)
			expect(finalSettings.categories[2]).toEqual({
				name: "",
				directory: "memo",
				color: "#a855f7",
				icon: "file-text",
			})

			// ! JSONに正しく保存されていることを確認。
			expect(mockModify).toHaveBeenCalled()
			const lastCall = mockModify.mock.calls[mockModify.mock.calls.length - 1]
			const savedJson = lastCall[1] as string
			const savedData = JSON.parse(savedJson)
			expect(savedData.categories[2].directory).toBe("memo")
			expect(savedData.categories[2].name).toBe("")
			expect(savedData.categories[2].icon).toBe("file-text")
		})
	})

	describe("アイコン変更時の他フィールド保持検証", () => {
		it("アイコン変更時にカテゴリ名が保持される", async () => {
			// ! 初期状態: カテゴリ名とディレクトリ名を設定。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "カスタム名", directory: "custom-dir", color: "#3b82f6", icon: "briefcase" },
				],
			})

			jest.clearAllMocks()

			// ! アイコンを変更。
			const categories = settingsManager.getGlobalSettings().categories
			categories[0] = {
				...categories[0],
				icon: "folder",
			}

			await settingsManager.updateGlobalSettings({
				categories: [...categories],
			})

			// ! カテゴリ名とディレクトリ名が保持されていることを確認。
			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[0].name).toBe("カスタム名")
			expect(finalSettings.categories[0].directory).toBe("custom-dir")
			expect(finalSettings.categories[0].icon).toBe("folder")
		})

		it("アイコン変更時にカテゴリ表示名が保持される", async () => {
			// ! 初期状態: 空の表示名を設定。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "", directory: "memo", color: "#3b82f6", icon: "briefcase" },
				],
			})

			jest.clearAllMocks()

			// ! アイコンを変更。
			const categories = settingsManager.getGlobalSettings().categories
			categories[0] = {
				...categories[0],
				icon: "file-text",
			}

			await settingsManager.updateGlobalSettings({
				categories: [...categories],
			})

			// ! 表示名が空のまま保持されていることを確認。
			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[0].name).toBe("")
			expect(finalSettings.categories[0].directory).toBe("memo")
			expect(finalSettings.categories[0].icon).toBe("file-text")
		})

		it("アイコン変更後にカテゴリ名を変更しても正しく保存される", async () => {
			// ! 初期状態。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "元の名前", directory: "original", color: "#3b82f6", icon: "briefcase" },
				],
			})

			// ! アイコンを変更。
			let categories = settingsManager.getGlobalSettings().categories
			categories[0] = { ...categories[0], icon: "folder" }
			await settingsManager.updateGlobalSettings({ categories: [...categories] })

			// ! カテゴリ名を変更。
			categories = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories, 0, "name", "")
			await simulateTyping(settingsManager, settingsManager.getGlobalSettings().categories, 0, "name", "新しい名前")

			// ! すべての変更が保持されていることを確認。
			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[0].name).toBe("新しい名前")
			expect(finalSettings.categories[0].directory).toBe("original")
			expect(finalSettings.categories[0].icon).toBe("folder")
		})

		it("複数フィールドを連続して変更しても正しく保存される", async () => {
			// ! 初期状態。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
				],
			})

			// ! 1. カテゴリ名を変更。
			let categories = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories, 0, "name", "")

			// ! 2. アイコンを変更。
			categories = settingsManager.getGlobalSettings().categories
			categories[0] = { ...categories[0], icon: "folder" }
			await settingsManager.updateGlobalSettings({ categories: [...categories] })

			// ! 3. ディレクトリ名を変更。
			categories = settingsManager.getGlobalSettings().categories
			await simulateTyping(settingsManager, categories, 0, "directory", "")
			await simulateTyping(settingsManager, settingsManager.getGlobalSettings().categories, 0, "directory", "memo")

			// ! 4. 再度アイコンを変更。
			categories = settingsManager.getGlobalSettings().categories
			categories[0] = { ...categories[0], icon: "file-text" }
			await settingsManager.updateGlobalSettings({ categories: [...categories] })

			// ! すべての変更が保持されていることを確認。
			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[0].name).toBe("")
			expect(finalSettings.categories[0].directory).toBe("memo")
			expect(finalSettings.categories[0].icon).toBe("file-text")
		})
	})

	describe("空文字列の保存検証", () => {
		it("ディレクトリ名が空文字列の状態でも保存される", async () => {
			// ! 初期状態。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
				],
			})

			// ! ディレクトリ名を空にする。
			const categories = settingsManager.getGlobalSettings().categories
			categories[0] = { ...categories[0], directory: "" }

			await settingsManager.updateGlobalSettings({
				categories: [...categories],
			})

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[0].directory).toBe("")

			// ! JSONに保存されていることを確認。
			const lastCall = mockModify.mock.calls[mockModify.mock.calls.length - 1]
			const savedJson = lastCall[1] as string
			const savedData = JSON.parse(savedJson)
			expect(savedData.categories[0].directory).toBe("")
		})

		it("表示名が空文字列の状態でも保存される", async () => {
			// ! 初期状態。
			await settingsManager.updateGlobalSettings({
				categories: [
					{ name: "仕事", directory: "work", color: "#3b82f6", icon: "briefcase" },
				],
			})

			// ! 表示名を空にする。
			const categories = settingsManager.getGlobalSettings().categories
			categories[0] = { ...categories[0], name: "" }

			await settingsManager.updateGlobalSettings({
				categories: [...categories],
			})

			const finalSettings = settingsManager.getGlobalSettings()
			expect(finalSettings.categories[0].name).toBe("")

			// ! JSONに保存されていることを確認。
			const lastCall = mockModify.mock.calls[mockModify.mock.calls.length - 1]
			const savedJson = lastCall[1] as string
			const savedData = JSON.parse(savedJson)
			expect(savedData.categories[0].name).toBe("")
		})
	})
})
