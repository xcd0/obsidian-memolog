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

describe("refreshCategoryTab() 不具合の原因分析", () => {
	let settingsManager: SettingsManager
	let savedJsonContent: string | null = null

	beforeEach(async () => {
		settingsManager = new SettingsManager(mockApp)
		jest.clearAllMocks()
		mockGetFiles.mockReturnValue([])
		savedJsonContent = null

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

		// ! mockModifyが呼ばれたら、保存されたJSON内容を記録。
		mockModify.mockImplementation(async (_file: TFile, content: string) => {
			savedJsonContent = content
			return undefined
		})

		// ! mockCreateが呼ばれたら、保存されたJSON内容を記録。
		mockCreate.mockImplementation(async (_path: string, content: string) => {
			savedJsonContent = content
			return mockFile
		})

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
		savedJsonContent = null
	})

	describe("【仮説1】再構築前に設定値が保存されていない", () => {
		it("カテゴリ名を変更してupdateGlobalSettings()を呼ぶと、JSONファイルに保存される", async () => {
			// ! 初期状態。
			const initialSettings = settingsManager.getGlobalSettings()
			expect(initialSettings.categories[0].directory).toBe("work")

			// ! カテゴリ名を変更。
			const categories = [...initialSettings.categories]
			categories[0] = { ...categories[0], directory: "memo" }

			// ! 設定を更新（保存）。
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! 検証1: mockModifyが呼ばれた。
			expect(mockModify).toHaveBeenCalledTimes(1)

			// ! 検証2: 保存されたJSON内容に新しい値が含まれている。
			expect(savedJsonContent).not.toBeNull()
			const savedData = JSON.parse(savedJsonContent!)
			expect(savedData.categories[0].directory).toBe("memo")
		})

		it("カラーピッカーのonChangeイベントで設定が保存される", async () => {
			// ! カラーピッカーのonChangeイベントをシミュレート。
			const initialSettings = settingsManager.getGlobalSettings()

			// ! カラーを変更。
			const categories = [...initialSettings.categories]
			categories[0] = { ...categories[0], color: "#ff0000" }

			// ! 設定を更新（カラーピッカーのonChangeで実行される処理）。
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! 検証1: mockModifyが呼ばれた。
			expect(mockModify).toHaveBeenCalledTimes(1)

			// ! 検証2: 保存されたJSON内容に新しい色が含まれている。
			expect(savedJsonContent).not.toBeNull()
			const savedData = JSON.parse(savedJsonContent!)
			expect(savedData.categories[0].color).toBe("#ff0000")
		})

		it("【不具合シナリオ】カテゴリ名を変更（未保存）→ カラーピッカーでrefreshCategoryTab()", async () => {
			// ! ステップ1: カテゴリ名を変更（まだ保存していない）。
			// ! 実際のUIでは、ユーザーがテキスト入力欄に「memo」と入力している状態。
			// ! この時点では、settingsManager.getGlobalSettings()は「work」を返す。

			const beforeChange = settingsManager.getGlobalSettings()
			expect(beforeChange.categories[0].directory).toBe("work")

			// ! ステップ2: カラーピッカーをクリック。
			// ! カラーピッカーのonChangeが発火し、設定が保存される。
			const categories = [...beforeChange.categories]
			categories[0] = { ...categories[0], color: "#ff0000" }
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ3: refreshCategoryTab()が呼ばれる。
			// ! この時点で、getGlobalSettings()を呼ぶと何が返るか？

			const afterRefresh = settingsManager.getGlobalSettings()

			// ! 検証: カテゴリ名は「work」のまま（未保存の「memo」は失われる）。
			expect(afterRefresh.categories[0].directory).toBe("work")
			expect(afterRefresh.categories[0].color).toBe("#ff0000")

			// ! 結論: カテゴリ名の変更は保存されていないため、refreshCategoryTab()で失われる。
		})
	})

	describe("【仮説2】変更された設定値が保存されたJSONから読み込まれていない", () => {
		it("設定を保存した後、getGlobalSettings()は最新の値を返す", async () => {
			// ! カテゴリ名を変更して保存。
			const categories = [
				{
					name: "仕事",
					directory: "memo",
					color: "#3b82f6",
					icon: "briefcase",
				},
			]
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! getGlobalSettings()が最新の値を返すか確認。
			const settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].directory).toBe("memo")
		})

		it("複数回の設定変更後、getGlobalSettings()は常に最新の値を返す", async () => {
			// ! 1回目の変更。
			await settingsManager.updateGlobalSettings({
				categories: [
					{
						name: "仕事",
						directory: "memo",
						color: "#3b82f6",
						icon: "briefcase",
					},
				],
			})

			let settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].directory).toBe("memo")

			// ! 2回目の変更。
			await settingsManager.updateGlobalSettings({
				categories: [
					{
						name: "仕事",
						directory: "work",
						color: "#ff0000",
						icon: "briefcase",
					},
				],
			})

			settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].directory).toBe("work")
			expect(settings.categories[0].color).toBe("#ff0000")
		})

		it("【不具合シナリオ】カラーピッカーのonChange後、getGlobalSettings()は最新の色を返す", async () => {
			// ! カラーピッカーのonChangeをシミュレート。
			const categories = [...settingsManager.getGlobalSettings().categories]
			categories[0] = { ...categories[0], color: "#ff0000" }
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! getGlobalSettings()が最新の色を返すか確認。
			const settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].color).toBe("#ff0000")

			// ! 結論: getGlobalSettings()は正しく最新の値を返している。
		})
	})

	describe("【仮説3】読み込んだ設定値がUIに再構築されない", () => {
		it("【UIシミュレーション】addCategoryItem()相当の処理で設定値が使用される", async () => {
			// ! これはUIコンポーネントの動作をシミュレートします。
			// ! 実際の addCategoryItem() では、category オブジェクトを受け取り、
			// ! その値を使ってテキスト入力欄の初期値を設定します。

			// ! ステップ1: 初期設定を取得。
			const settings1 = settingsManager.getGlobalSettings()
			const category1 = settings1.categories[0]

			// ! ステップ2: UIコンポーネントが category.directory を使って入力欄の初期値を設定。
			const textInputValue1 = category1.directory
			expect(textInputValue1).toBe("work")

			// ! ステップ3: カテゴリ名を変更して保存。
			const categories = [...settings1.categories]
			categories[0] = { ...categories[0], directory: "memo" }
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ4: refreshCategoryTab()をシミュレート - 設定を再取得してUIを再構築。
			const settings2 = settingsManager.getGlobalSettings()
			const category2 = settings2.categories[0]

			// ! ステップ5: 新しいUIコンポーネントが category.directory を使って入力欄の初期値を設定。
			const textInputValue2 = category2.directory

			// ! 検証: 再構築後のUIは最新の値を使用している。
			expect(textInputValue2).toBe("memo")

			// ! 結論: getGlobalSettings()で取得した値でUIを再構築すれば、
			// ! 正しく最新の値が表示される。
		})

		it("【不具合の再現】カテゴリ名変更（未保存）→ カラー変更（保存）→ refreshCategoryTab()", async () => {
			// ! ステップ1: 初期状態のUI構築。
			const settings1 = settingsManager.getGlobalSettings()
			const textInputValue1 = settings1.categories[0].directory
			expect(textInputValue1).toBe("work")

			// ! ステップ2: ユーザーがカテゴリ名を変更（まだblurしていない）。
			// ! 実際のUIでは、テキスト入力欄の値が「memo」になっているが、
			// ! settingsManagerには反映されていない。
			const userInputValue = "memo"

			// ! この時点で getGlobalSettings() を呼ぶと、古い値が返る。
			const settingsBeforeSave = settingsManager.getGlobalSettings()
			expect(settingsBeforeSave.categories[0].directory).toBe("work") // ! まだ "work"

			// ! ステップ3: カラーピッカーのonChangeが発火（カラーを変更して保存）。
			const categories = [...settingsBeforeSave.categories]
			categories[0] = { ...categories[0], color: "#ff0000" }
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ4: refreshCategoryTab()をシミュレート - UIを再構築。
			const settings2 = settingsManager.getGlobalSettings()
			const textInputValue2 = settings2.categories[0].directory

			// ! 検証: 再構築後のUIは「work」を表示する（ユーザーの入力「memo」は失われる）。
			expect(textInputValue2).toBe("work")
			expect(userInputValue).toBe("memo") // ! ユーザーの入力は「memo」だったが...

			// ! 結論:
			// ! - カラー変更時の保存では、カテゴリ名は古い値（"work"）で保存される
			// ! - refreshCategoryTab()でUIを再構築すると、古い値（"work"）が表示される
			// ! - ユーザーの入力（"memo"）は失われる
			// !
			// ! 【原因】: カラーピッカーのonChangeで保存される categories 配列は、
			// ! getGlobalSettings()で取得した古い値を基にしているため、
			// ! ユーザーがテキスト入力欄に入力した値（未保存）は含まれていない。
		})

		it("【不具合の詳細分析】カラーピッカーのonChangeで保存される値を確認", async () => {
			// ! ステップ1: 初期状態。
			const settings1 = settingsManager.getGlobalSettings()
			expect(settings1.categories[0].directory).toBe("work")
			expect(settings1.categories[0].color).toBe("#3b82f6")

			// ! ステップ2: ユーザーがカテゴリ名を「memo」に変更（未保存）。
			// ! 実際のUIでは、テキスト入力欄の値が「memo」になっているが、
			// ! settingsManagerには反映されていない（blurイベント待ち）。

			// ! ステップ3: カラーピッカーをクリックして色を変更。
			// ! settings-tab.ts の実装では、以下のようなコードが実行される:
			// !
			// ! const updatedCategories = [...settings.categories]
			// ! updatedCategories[index] = { ...updatedCategories[index], color: value }
			// ! await this.plugin.settingsManager.updateGlobalSettings({ categories: updatedCategories })
			// !
			// ! ここで重要なのは、`settings.categories` は addCategoryItem() が呼ばれた時点の値。
			// ! つまり、カテゴリ名が「work」の状態。

			const settingsBeforeColorChange = settingsManager.getGlobalSettings()
			const categories = [...settingsBeforeColorChange.categories]
			categories[0] = { ...categories[0], color: "#ff0000" }

			// ! 保存される categories を確認。
			expect(categories[0].directory).toBe("work") // ! カテゴリ名は "work" のまま
			expect(categories[0].color).toBe("#ff0000") // ! 色だけが変更されている

			// ! 設定を保存。
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ4: 保存されたJSON内容を確認。
			expect(savedJsonContent).not.toBeNull()
			const savedData = JSON.parse(savedJsonContent!)
			expect(savedData.categories[0].directory).toBe("work") // ! "work" が保存されている
			expect(savedData.categories[0].color).toBe("#ff0000")

			// ! ステップ5: refreshCategoryTab()をシミュレート。
			const settingsAfterRefresh = settingsManager.getGlobalSettings()
			expect(settingsAfterRefresh.categories[0].directory).toBe("work") // ! "work" が表示される

			// ! 結論:
			// ! カラーピッカーのonChangeで保存される categories 配列は、
			// ! addCategoryItem() が呼ばれた時点の settings.categories を基にしている。
			// ! そのため、ユーザーがテキスト入力欄に入力した値（未保存）は含まれず、
			// ! 古い値（"work"）が保存される。
			// !
			// ! refreshCategoryTab() で UI を再構築すると、保存された古い値（"work"）が
			// ! 表示されるため、ユーザーの入力（"memo"）は失われる。
		})
	})

	describe("【検証】JSON読み込み→変更→保存→読み込み→確認", () => {
		it("初期状態のJSONを読み込む → 設定値を変更 → 保存 → 読み込み → 変更が反映されているか確認", async () => {
			// ! ステップ1: 初期状態のJSONを読み込む。
			// ! beforeEach で既に初期設定が読み込まれている。
			const initialSettings = settingsManager.getGlobalSettings()
			expect(initialSettings.categories[0].directory).toBe("work")
			expect(initialSettings.categories[0].name).toBe("仕事")
			expect(initialSettings.categories[0].color).toBe("#3b82f6")

			// ! ステップ2: 設定値を変更（保存されることを期待）。
			const categories = [...initialSettings.categories]
			categories[0] = {
				...categories[0],
				directory: "memo",
				name: "メモ",
				color: "#ff0000",
			}

			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ3: 設定値を読み込む。
			const updatedSettings = settingsManager.getGlobalSettings()

			// ! ステップ4: 設定値が変更されているか確認する。
			expect(updatedSettings.categories[0].directory).toBe("memo")
			expect(updatedSettings.categories[0].name).toBe("メモ")
			expect(updatedSettings.categories[0].color).toBe("#ff0000")

			// ! ステップ5: JSONファイルにも正しく保存されているか確認。
			expect(savedJsonContent).not.toBeNull()
			const savedData = JSON.parse(savedJsonContent!)
			expect(savedData.categories[0].directory).toBe("memo")
			expect(savedData.categories[0].name).toBe("メモ")
			expect(savedData.categories[0].color).toBe("#ff0000")
		})

		it("カテゴリ名のみ変更 → 保存 → 読み込み → カテゴリ名が変更されている", async () => {
			// ! ステップ1: 初期状態。
			const initialSettings = settingsManager.getGlobalSettings()
			expect(initialSettings.categories[0].directory).toBe("work")

			// ! ステップ2: カテゴリ名のみ変更。
			const categories = [...initialSettings.categories]
			categories[0] = { ...categories[0], directory: "custom-category" }

			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ3: 読み込み。
			const updatedSettings = settingsManager.getGlobalSettings()

			// ! ステップ4: 確認 - カテゴリ名のみ変更されている。
			expect(updatedSettings.categories[0].directory).toBe("custom-category")
			// ! 他のフィールドは変更されていない。
			expect(updatedSettings.categories[0].name).toBe("仕事")
			expect(updatedSettings.categories[0].color).toBe("#3b82f6")
			expect(updatedSettings.categories[0].icon).toBe("briefcase")
		})

		it("カラーのみ変更 → 保存 → 読み込み → カラーが変更されている", async () => {
			// ! ステップ1: 初期状態。
			const initialSettings = settingsManager.getGlobalSettings()
			expect(initialSettings.categories[0].color).toBe("#3b82f6")

			// ! ステップ2: カラーのみ変更。
			const categories = [...initialSettings.categories]
			categories[0] = { ...categories[0], color: "#00ff00" }

			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ3: 読み込み。
			const updatedSettings = settingsManager.getGlobalSettings()

			// ! ステップ4: 確認 - カラーのみ変更されている。
			expect(updatedSettings.categories[0].color).toBe("#00ff00")
			// ! 他のフィールドは変更されていない。
			expect(updatedSettings.categories[0].directory).toBe("work")
			expect(updatedSettings.categories[0].name).toBe("仕事")
			expect(updatedSettings.categories[0].icon).toBe("briefcase")
		})

		it("複数回の変更 → 保存 → 読み込み → 最後の変更が反映されている", async () => {
			// ! 1回目の変更。
			let categories = [...settingsManager.getGlobalSettings().categories]
			categories[0] = { ...categories[0], directory: "memo" }
			await settingsManager.updateGlobalSettings({ categories })

			// ! 2回目の変更。
			categories = [...settingsManager.getGlobalSettings().categories]
			categories[0] = { ...categories[0], color: "#ff0000" }
			await settingsManager.updateGlobalSettings({ categories })

			// ! 3回目の変更。
			categories = [...settingsManager.getGlobalSettings().categories]
			categories[0] = { ...categories[0], name: "メモ" }
			await settingsManager.updateGlobalSettings({ categories })

			// ! 読み込み。
			const finalSettings = settingsManager.getGlobalSettings()

			// ! 確認 - すべての変更が反映されている。
			expect(finalSettings.categories[0].directory).toBe("memo")
			expect(finalSettings.categories[0].color).toBe("#ff0000")
			expect(finalSettings.categories[0].name).toBe("メモ")
		})

		it("【不具合シナリオ】古い設定を使って保存すると、最新の変更が上書きされる", async () => {
			// ! ステップ1: カテゴリ名を「memo」に変更して保存。
			let categories = [...settingsManager.getGlobalSettings().categories]
			categories[0] = { ...categories[0], directory: "memo" }
			await settingsManager.updateGlobalSettings({ categories })

			// ! 確認: カテゴリ名が「memo」になっている。
			let settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].directory).toBe("memo")

			// ! ステップ2: 古い設定を取得（addCategoryItem呼び出し時点の設定をシミュレート）。
			// ! 実際のUIでは、addCategoryItem() が呼ばれた時点で settings がキャプチャされる。
			// ! この時点ではカテゴリ名は「work」。
			const oldSettings = {
				categories: [
					{
						name: "仕事",
						directory: "work", // ← 古い値
						color: "#3b82f6",
						icon: "briefcase",
					},
				],
			}

			// ! ステップ3: ユーザーがカラーを変更。
			// ! カラーピッカーのonChangeで、古い設定を使って保存。
			const oldCategories = [...oldSettings.categories]
			oldCategories[0] = { ...oldCategories[0], color: "#ff0000" }
			await settingsManager.updateGlobalSettings({
				categories: oldCategories,
			})

			// ! ステップ4: 読み込み。
			settings = settingsManager.getGlobalSettings()

			// ! 確認: カテゴリ名が「work」に戻っている（最新の変更が上書きされた）。
			expect(settings.categories[0].directory).toBe("work") // ← "memo" → "work" に戻った!
			expect(settings.categories[0].color).toBe("#ff0000")

			// ! 結論: 古い設定を使って保存すると、最新の変更が上書きされる。
			// ! これが不具合の原因。
		})

		it("【正しい実装】最新の設定を取得してから変更すると、上書きされない", async () => {
			// ! ステップ1: カテゴリ名を「memo」に変更して保存。
			let categories = [...settingsManager.getGlobalSettings().categories]
			categories[0] = { ...categories[0], directory: "memo" }
			await settingsManager.updateGlobalSettings({ categories })

			// ! 確認: カテゴリ名が「memo」になっている。
			let settings = settingsManager.getGlobalSettings()
			expect(settings.categories[0].directory).toBe("memo")

			// ! ステップ2: カラーを変更する際、最新の設定を取得。
			const currentSettings = settingsManager.getGlobalSettings() // ← 最新を取得!
			const currentCategories = [...currentSettings.categories]
			currentCategories[0] = { ...currentCategories[0], color: "#ff0000" }
			await settingsManager.updateGlobalSettings({
				categories: currentCategories,
			})

			// ! ステップ3: 読み込み。
			settings = settingsManager.getGlobalSettings()

			// ! 確認: カテゴリ名もカラーも正しく保存されている。
			expect(settings.categories[0].directory).toBe("memo") // ← "memo" のまま!
			expect(settings.categories[0].color).toBe("#ff0000")

			// ! 結論: 最新の設定を取得してから変更すれば、上書きされない。
			// ! これが正しい実装。
		})
	})

	describe("【結論】不具合の根本原因", () => {
		it("settings.categories は addCategoryItem() 呼び出し時点でキャプチャされる", async () => {
			// ! addCategoryItem() が呼ばれた時点の settings をキャプチャ。
			const settingsAtRenderTime = settingsManager.getGlobalSettings()
			const categoriesAtRenderTime = settingsAtRenderTime.categories

			// ! この categories が、カラーピッカーのonChangeイベントハンドラで使用される。
			// ! つまり、以下のようなクロージャが形成される:
			// !
			// ! colorPicker.onChange(async value => {
			// !     const updatedCategories = [...settings.categories]  // ← ここの settings は古い
			// !     updatedCategories[index] = { ...updatedCategories[index], color: value }
			// !     await this.plugin.settingsManager.updateGlobalSettings({ categories: updatedCategories })
			// !     this.refreshCategoryTab()  // ← ここでUIが再構築される
			// ! })

			// ! 検証: categories は UI 構築時点の値を保持している。
			expect(categoriesAtRenderTime[0].directory).toBe("work")

			// ! ユーザーがカテゴリ名を「memo」に変更しても、
			// ! categoriesAtRenderTime は「work」のまま。
			expect(categoriesAtRenderTime[0].directory).toBe("work")

			// ! カラーピッカーのonChangeで保存される値も「work」。
			const categories = [...categoriesAtRenderTime]
			categories[0] = { ...categories[0], color: "#ff0000" }
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! refreshCategoryTab() 後も「work」が表示される。
			const settingsAfterRefresh = settingsManager.getGlobalSettings()
			expect(settingsAfterRefresh.categories[0].directory).toBe("work")

			// ! 【結論】
			// ! 不具合の原因は、settings.categories が addCategoryItem() 呼び出し時点で
			// ! キャプチャされ、クロージャとして保持されるため。
			// !
			// ! ユーザーがテキスト入力欄に入力した値は、blur イベントで保存されるが、
			// ! カラーピッカーのonChangeイベントハンドラは、古い categories を使用して
			// ! 保存処理を実行するため、ユーザーの入力が上書きされてしまう。
		})

		it("【修正の方向性】カラーピッカーのonChangeで最新の設定を取得する必要がある", async () => {
			// ! 現在の実装（問題あり）:
			// ! const updatedCategories = [...settings.categories]  // ← 古い値
			// ! updatedCategories[index] = { ...updatedCategories[index], color: value }

			// ! 修正後の実装（推奨）:
			// ! const currentSettings = this.plugin.settingsManager.getGlobalSettings()  // ← 最新の値を取得
			// ! const updatedCategories = [...currentSettings.categories]
			// ! updatedCategories[index] = { ...updatedCategories[index], color: value }

			// ! この修正により、ユーザーがテキスト入力欄に入力した値（blurで保存済み）も
			// ! 含まれた状態で保存されるため、refreshCategoryTab() で失われない。

			// ! 検証シナリオ:

			// ! ステップ1: カテゴリ名を変更して保存（blurイベント）。
			let categories = [...settingsManager.getGlobalSettings().categories]
			categories[0] = { ...categories[0], directory: "memo" }
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ2: カラーを変更して保存（onChangeイベント）。
			// ! ここで、最新の設定を取得する。
			const currentSettings = settingsManager.getGlobalSettings() // ← 最新の値
			categories = [...currentSettings.categories]
			categories[0] = { ...categories[0], color: "#ff0000" }
			await settingsManager.updateGlobalSettings({
				categories,
			})

			// ! ステップ3: refreshCategoryTab() をシミュレート。
			const settingsAfterRefresh = settingsManager.getGlobalSettings()

			// ! 検証: カテゴリ名も色も正しく保存されている。
			expect(settingsAfterRefresh.categories[0].directory).toBe("memo") // ← 正しい
			expect(settingsAfterRefresh.categories[0].color).toBe("#ff0000")

			// ! 結論: カラーピッカーのonChangeで最新の設定を取得することで、
			// ! ユーザーの入力が失われる問題を防げる。
		})
	})
})
