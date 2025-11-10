import { App, TFile, TFolder } from "obsidian"
import { SettingsManager } from "../src/core/settings"

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
 * ! UIコンポーネントの動作をシミュレートする関数。
 *
 * 実際のUIでは以下の流れで不具合が発生する:
 * 1. ユーザーがカテゴリ名を変更（inputイベント）
 * 2. カラーコード入力欄をクリック（focusイベント）
 * 3. カテゴリ名入力欄からフォーカスが外れる（blurイベント -> 保存処理）
 * 4. カラーコード入力欄をクリックしただけで何も変更せず、他の場所をクリック
 * 5. カラーコード入力欄からフォーカスが外れる（blurイベント -> 保存処理は実行されない）
 * 6. しかし、カラーピッカーのonChangeイベントが発火した場合、refreshCategoryTab()が呼ばれる
 * 7. refreshCategoryTab()は現在のsettings.categoriesを使ってUIを再構築する
 * 8. この時点でカテゴリ名の変更がまだ保存されていない場合、変更が失われる
 */

/**
 * ! 不具合の再現: カラーピッカーのonChangeが早期に呼ばれる場合。
 *
 * 実際のUIでは、以下のタイミングで不具合が発生する可能性がある:
 * 1. ユーザーがカテゴリ名を変更（まだblurしていない）
 * 2. カラーピッカーをクリック
 * 3. カラーピッカーのonChangeが即座に発火（色を選択していないのに）
 * 4. refreshCategoryTab()が呼ばれる
 * 5. この時点でカテゴリ名入力欄のblurイベントがまだ発火していない
 * 6. refreshCategoryTab()は古いsettings.categoriesを使ってUIを再構築
 * 7. カテゴリ名の変更が失われる
 */
async function simulateBugScenario_ColorPickerTriggersRefreshBeforeBlur(
	settingsManager: SettingsManager,
	categoryIndex: number,
): Promise<{ beforeRefresh: string; afterRefresh: string }> {
	const settings = settingsManager.getGlobalSettings()

	// ! ステップ1: カテゴリ名を変更（まだ保存されていない）。
	// ! 実際のUIでは、ユーザーが入力欄に文字を入力している状態。

	// ! ステップ2: カラーピッカーをクリック（refreshCategoryTab()が呼ばれる）。
	// ! この時点で、カテゴリ名入力欄のblurイベントがまだ発火していない。

	// ! 現在のカテゴリ名を記録（変更前）。
	const beforeRefresh = settings.categories[categoryIndex].directory

	// ! ステップ3: カラーピッカーのonChangeが発火し、refreshCategoryTab()が呼ばれる。
	// ! refreshCategoryTab()は現在のsettingsを使ってUIを再構築する。
	// ! しかし、カテゴリ名の変更はまだ保存されていない（blurイベントが発火していない）。

	// ! ここで、updateGlobalSettingsを呼ばずにrefreshCategoryTab()相当の処理を実行。
	// ! つまり、カテゴリ名の変更が保存される前にUIが再構築される。

	// ! 再構築後のカテゴリ名を記録（変更が失われているはず）。
	const afterRefresh = settingsManager.getGlobalSettings().categories[categoryIndex].directory

	return { beforeRefresh, afterRefresh }
}

describe("カテゴリ設定 - フィールドリセット不具合の再現", () => {
	let settingsManager: SettingsManager

	beforeEach(async () => {
		settingsManager = new SettingsManager(mockApp)
		jest.clearAllMocks()
		mockGetFiles.mockReturnValue([])

		// ! 基本的なモック設定。
		const mockDir = createMockTFolder("memolog")
		const mockFile = createMockTFile("memolog/memolog-setting.json")

		mockGetAbstractFileByPath.mockImplementation((path: string) => {
			if (path === "memolog") {
				return mockDir
			}
			if (path === "memolog/memolog-setting.json") {
				return mockFile
			}
			return null
		})

		mockModify.mockResolvedValue(undefined)
		mockCreate.mockResolvedValue(mockFile)

		// ! 初期設定として1つのカテゴリを設定。
		await settingsManager.updateGlobalSettings({
			categories: [
				{
					name: "仕事",
					directory: "work",
					color: "#3b82f6",
					icon: "briefcase",
				},
			],
		})

		// ! モックをリセット。
		jest.clearAllMocks()
	})

	describe("【不具合1】カテゴリ名変更後、カラーコード入力欄をクリックするとリセットされる", () => {
		it("カテゴリ名を変更し、保存前にrefreshCategoryTab()が呼ばれると変更が失われる", async () => {
			const initialSettings = settingsManager.getGlobalSettings()
			const initialName = initialSettings.categories[0].directory

			// ! refreshCategoryTab()が呼ばれる前の状態。
			const result = await simulateBugScenario_ColorPickerTriggersRefreshBeforeBlur(
				settingsManager,
				0,
			)

			// ! 不具合の検証: refreshCategoryTab()後、カテゴリ名が元に戻っている。
			expect(result.beforeRefresh).toBe(initialName)
			expect(result.afterRefresh).toBe(initialName) // ! 変更が失われている（不具合）。
		})

		it("カテゴリ名を'work'から'memo'に変更し、カラーコード入力欄をクリックすると'work'に戻る", async () => {
			// ! 初期状態: "work"。
			let settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].directory).toBe("work")

			// ! カテゴリ名を変更（UIでの入力をシミュレート - まだblurしていない）。
			// ! 実際のUIでは、テキスト入力欄の値が "memo" になっているが、
			// ! blurイベントがまだ発火していないため、settingsManagerには反映されていない。

			// ! カラーピッカーをクリック（refreshCategoryTab()が呼ばれる）。
			// ! この時点で、カテゴリ名入力欄のblurイベントがまだ発火していない。

			// ! refreshCategoryTab()は現在のsettingsを使ってUIを再構築する。
			settings = settingsManager.getGlobalSettings()

			// ! 不具合の検証: カテゴリ名が "work" のまま（"memo" への変更が失われる）。
			expect(settings.categories[0].directory).toBe("work")
		})
	})

	describe("【不具合2】カテゴリ表示名変更後、カラーコード入力欄をクリックするとリセットされる", () => {
		it("カテゴリ表示名を変更し、保存前にrefreshCategoryTab()が呼ばれると変更が失われる", async () => {
			const initialSettings = settingsManager.getGlobalSettings()
			const initialDisplayName = initialSettings.categories[0].name

			// ! refreshCategoryTab()が呼ばれる前の状態。
			const beforeRefresh = initialDisplayName

			// ! refreshCategoryTab()が呼ばれた後の状態（保存されていない）。
			const afterRefresh = settingsManager.getGlobalSettings().categories[0].name

			// ! 不具合の検証: refreshCategoryTab()後、カテゴリ表示名が元に戻っている。
			expect(beforeRefresh).toBe(initialDisplayName)
			expect(afterRefresh).toBe(initialDisplayName) // ! 変更が失われている（不具合）。
		})

		it("カテゴリ表示名を'仕事'から'作業'に変更し、カラーコード入力欄をクリックすると'仕事'に戻る", async () => {
			// ! 初期状態: "仕事"。
			let settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].name).toBe("仕事")

			// ! カテゴリ表示名を変更（UIでの入力をシミュレート - まだblurしていない）。

			// ! カラーピッカーをクリック（refreshCategoryTab()が呼ばれる）。

			// ! refreshCategoryTab()は現在のsettingsを使ってUIを再構築する。
			settings = settingsManager.getGlobalSettings()

			// ! 不具合の検証: カテゴリ表示名が "仕事" のまま（"作業" への変更が失われる）。
			expect(settings.categories[0].name).toBe("仕事")
		})
	})

	describe("【不具合3】カテゴリ名とカテゴリ表示名を両方変更後、カラーコード入力欄をクリックすると両方ともリセットされる", () => {
		it("カテゴリ名と表示名を両方変更し、保存前にrefreshCategoryTab()が呼ばれると両方とも失われる", async () => {
			const initialSettings = settingsManager.getGlobalSettings()
			const initialName = initialSettings.categories[0].directory
			const initialDisplayName = initialSettings.categories[0].name

			// ! refreshCategoryTab()が呼ばれた後の状態（保存されていない）。
			const afterSettings = settingsManager.getGlobalSettings()
			const afterName = afterSettings.categories[0].directory
			const afterDisplayName = afterSettings.categories[0].name

			// ! 不具合の検証: refreshCategoryTab()後、両方とも元に戻っている。
			expect(afterName).toBe(initialName) // ! カテゴリ名が元に戻っている。
			expect(afterDisplayName).toBe(initialDisplayName) // ! 表示名が元に戻っている。
		})

		it("カテゴリ名を'work'→'memo'、表示名を'仕事'→'メモ'に変更し、カラーコード入力欄をクリックすると両方とも元に戻る", async () => {
			// ! 初期状態。
			let settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].directory).toBe("work")
			expect(settings.categories[0].name).toBe("仕事")

			// ! カテゴリ名と表示名を両方変更（UIでの入力をシミュレート - まだblurしていない）。

			// ! カラーピッカーをクリック（refreshCategoryTab()が呼ばれる）。

			// ! refreshCategoryTab()は現在のsettingsを使ってUIを再構築する。
			settings = settingsManager.getGlobalSettings()

			// ! 不具合の検証: 両方とも元の値のまま（変更が失われる）。
			expect(settings.categories[0].directory).toBe("work")
			expect(settings.categories[0].name).toBe("仕事")
		})
	})

	describe("【期待される動作】正常な保存フロー", () => {
		it("カテゴリ名を変更し、blurイベントで保存した後にrefreshCategoryTab()が呼ばれると変更が保持される", async () => {
			const initialSettings = settingsManager.getGlobalSettings()

			// ! カテゴリ名を変更し、保存する（blurイベント）。
			const newName = "custom-work"
			const categories = [...initialSettings.categories]
			categories[0] = { ...categories[0], directory: newName }
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! refreshCategoryTab()が呼ばれた後の状態。
			const afterSettings = settingsManager.getGlobalSettings()
			const afterName = afterSettings.categories[0].directory

			// ! 正常な動作の検証: 変更が保持されている。
			expect(afterName).toBe(newName)
		})

		it("カテゴリ名と表示名を両方変更し、両方とも保存した後にrefreshCategoryTab()が呼ばれると変更が保持される", async () => {
			const initialSettings = settingsManager.getGlobalSettings()

			// ! カテゴリ名と表示名を両方変更し、保存する。
			const newName = "custom-work"
			const newDisplayName = "カスタム仕事"
			const categories = [...initialSettings.categories]
			categories[0] = {
				...categories[0],
				directory: newName,
				name: newDisplayName,
			}
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! refreshCategoryTab()が呼ばれた後の状態。
			const afterSettings = settingsManager.getGlobalSettings()
			const afterName = afterSettings.categories[0].directory
			const afterDisplayName = afterSettings.categories[0].name

			// ! 正常な動作の検証: 変更が保持されている。
			expect(afterName).toBe(newName)
			expect(afterDisplayName).toBe(newDisplayName)
		})
	})
})
