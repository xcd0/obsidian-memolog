import { App, Notice, PluginSettingTab, setIcon, Setting } from "obsidian"
import MemologPlugin from "../../main"
import { MemoManager } from "../core/memo-manager"
import { TemplateManager } from "../core/template-manager"
import { MemologVaultHandler } from "../fs/vault-handler"
import { CategoryConfig, DEFAULT_GLOBAL_SETTINGS } from "../types"
import { BackupManager } from "../utils/backup-manager"
import { PathGenerator } from "../utils/path-generator"
import { PathMigrator } from "../utils/path-migrator"
import { RootDirectoryMigrator } from "../utils/root-directory-migrator"
import { IconPicker } from "./components/icon-picker"
import { MigrationConfirmModal, MigrationResultModal } from "./migration-modal"
import { RestoreBackupModal } from "./restore-modal"
import {
	RootDirectoryMigrationConfirmModal,
	RootDirectoryMigrationResultModal,
} from "./root-directory-migration-modal"
import { MemologSidebar, VIEW_TYPE_MEMOLOG } from "./sidebar"

// ! プリセットカラー定義。
const PRESET_COLORS = [
	{ name: "青", value: "#3b82f6" },
	{ name: "緑", value: "#22c55e" },
	{ name: "赤", value: "#ef4444" },
	{ name: "黄", value: "#eab308" },
	{ name: "紫", value: "#a855f7" },
	{ name: "ピンク", value: "#ec4899" },
	{ name: "橙", value: "#f97316" },
	{ name: "青緑", value: "#14b8a6" },
	{ name: "灰", value: "#6b7280" },
	{ name: "茶", value: "#92400e" },
]

// ! memolog設定タブ。
export class MemologSettingTab extends PluginSettingTab {
	plugin: MemologPlugin
	private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
	private initialPathFormat: string = ""
	private initialUseDirectoryCategory: boolean = false
	private migrationButton: HTMLButtonElement | null = null
	private initialRootDirectory: string = "" // ! ルートディレクトリの初期値。
	private rootDirectoryMigrationButton: HTMLButtonElement | null = null // ! ルートディレクトリ変更ボタン。
	private currentActiveTab: string = "basic" // ! 現在アクティブなタブ。
	// ! 設定画面表示時の初期設定値（JSON文字列）- 将来的な変更検出・比較機能用に保持。
	private _initialSettings: string = ""

	constructor(app: App, plugin: MemologPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	// ! debounce関数 - 連続入力時に過度な保存を防ぐ。
	private debounce(key: string, callback: () => void | Promise<void>, delay: number = 200): void {
		// ! 既存のタイマーをクリア。
		const existingTimer = this.debounceTimers.get(key)
		if (existingTimer) {
			clearTimeout(existingTimer)
		}

		// ! 新しいタイマーをセット。
		const timer = setTimeout(() => {
			void callback()
			this.debounceTimers.delete(key)
		}, delay)

		this.debounceTimers.set(key, timer)
	}

	// ! 設定を保存する（再読み込みはしない）。
	private async saveSettings(updates: Partial<import("../types").GlobalSettings>): Promise<void> {
		await this.plugin.settingsManager.updateGlobalSettings(updates)
		// ! 再読み込みはしない（他の入力欄の編集中の値を保持するため）。
	}

	// ! 初期設定値を取得する（変更検出用）。
	getInitialSettings(): string {
		return this._initialSettings
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		containerEl.createEl("h2", { text: "memolog 設定" })

		// ! 初期値を保存（変更検出用）。
		const settings = this.plugin.settingsManager.getGlobalSettings()
		this.initialPathFormat = settings.pathFormat
		this.initialUseDirectoryCategory = settings.useDirectoryCategory
		// ! 設定画面表示時の全設定値をJSON文字列として保存。
		this._initialSettings = JSON.stringify(settings)

		// ! タブUIを作成。
		this.createTabUI(containerEl)
	}

	// ! タブUIを作成する。
	private createTabUI(containerEl: HTMLElement): void {
		// ! タブコンテナ。
		const tabContainer = containerEl.createDiv({ cls: "memolog-settings-tab-container" })

		// ! タブヘッダー（タブボタン）。
		const tabHeader = tabContainer.createDiv({ cls: "memolog-settings-tab-header" })

		// ! タブコンテンツエリア。
		const tabContent = tabContainer.createDiv({ cls: "memolog-settings-tab-content" })

		// ! タブ定義。
		const tabs = [
			{ id: "basic", label: "基本", render: (el: HTMLElement) => this.addBasicSettings(el) },
			{ id: "category", label: "カテゴリ", render: (el: HTMLElement) => this.addCategorySettings(el) },
			{ id: "trash", label: "ゴミ箱", render: (el: HTMLElement) => this.addTrashSettings(el) },
			{ id: "advanced", label: "高度な機能", render: (el: HTMLElement) => this.addAdvancedFeaturesWithActions(el) },
		]

		// ! タブボタンを作成。
		const tabButtons: HTMLElement[] = []
		const tabContents: HTMLElement[] = []

		for (const tab of tabs) {
			// ! タブボタン。
			const tabBtn = tabHeader.createEl("button", {
				cls: "memolog-settings-tab-button",
				text: tab.label,
				attr: { "data-tab": tab.id },
			})
			tabButtons.push(tabBtn)

			// ! タブコンテンツ。
			const tabPane = tabContent.createDiv({
				cls: "memolog-settings-tab-pane",
				attr: { "data-tab": tab.id },
			})
			tabPane.style.display = "none"
			tabContents.push(tabPane)

			// ! タブボタンクリックイベント。
			tabBtn.addEventListener("click", () => {
				// ! 全てのタブを非アクティブ化。
				tabButtons.forEach(btn => btn.removeClass("memolog-settings-tab-button-active"))
				tabContents.forEach(pane => (pane.style.display = "none"))

				// ! クリックされたタブをアクティブ化。
				tabBtn.addClass("memolog-settings-tab-button-active")
				tabPane.style.display = "block"

				// ! 現在のアクティブなタブを保存。
				this.currentActiveTab = tab.id
			})
		}

		// ! 保存されているタブをアクティブ化（または最初のタブ）。
		if (tabButtons.length > 0) {
			const activeTabIndex = tabs.findIndex(tab => tab.id === this.currentActiveTab)
			const indexToActivate = activeTabIndex >= 0 ? activeTabIndex : 0

			tabButtons[indexToActivate].addClass("memolog-settings-tab-button-active")
			tabContents[indexToActivate].style.display = "block"
		}

		// ! 各タブのコンテンツをレンダリング。
		tabs.forEach((tab, index) => {
			tab.render(tabContents[index])
		})
	}

	// ! 高度な機能とアクションボタンを追加する。
	private addAdvancedFeaturesWithActions(containerEl: HTMLElement): void {
		this.addAdvancedFeatures(containerEl)
		this.addActionButtons(containerEl)
	}

	// ! 基本設定を追加する。
	private addBasicSettings(containerEl: HTMLElement): void {
		const settings = this.plugin.settingsManager.getGlobalSettings()

		// ! プレビュー更新関数を格納する変数（後で定義）。
		let updatePathPreview: (format: string, rootDirectory?: string) => void
		let updateAttachmentPathPreview: (attachmentPathFormat: string, pathFormat?: string, rootDirectory?: string) => void

		// ! ルートディレクトリの初期値を保存。
		this.initialRootDirectory = settings.rootDirectory

		// ! ルートディレクトリ変更ボタンのチェック関数。
		const checkRootDirectoryMigrationNeeded = () => {
			const currentSettings = this.plugin.settingsManager.getGlobalSettings()
			const hasChanged = currentSettings.rootDirectory !== this.initialRootDirectory

			if (this.rootDirectoryMigrationButton) {
				this.rootDirectoryMigrationButton.disabled = !hasChanged
				this.rootDirectoryMigrationButton.toggleClass("mod-cta", hasChanged)
			}
		}

		// ! ルートディレクトリ設定。
		new Setting(containerEl)
			.setName("ルートディレクトリ")
			.setDesc("memologファイルを保存するルートディレクトリ")
			.addText(text => {
				text
					.setPlaceholder("memolog")
					.setValue(settings.rootDirectory)

				const saveRootDirectory = async (value: string) => {
					await this.plugin.settingsManager.updateGlobalSettings({
						rootDirectory: value,
					})
					checkRootDirectoryMigrationNeeded()
				}

				// ! リアルタイム保存 - input イベントを監視。
				text.inputEl.addEventListener("input", () => {
					const value = text.inputEl.value
					// ! プレビューを即座に更新（新しいrootDirectoryを渡す）。
					if (updatePathPreview) {
						updatePathPreview(settings.pathFormat, value)
					}
					if (updateAttachmentPathPreview) {
						updateAttachmentPathPreview(settings.attachmentPath, settings.pathFormat, value)
					}
					this.debounce("root-directory", () => {
						void saveRootDirectory(value)
					})
				})

				// ! フォーカスが外れた時も即座に保存。
				text.inputEl.addEventListener("blur", () => {
					const value = text.inputEl.value
					const existingTimer = this.debounceTimers.get("root-directory")
					if (existingTimer) {
						clearTimeout(existingTimer)
						this.debounceTimers.delete("root-directory")
					}
					void saveRootDirectory(value)
				})

				return text
			})
			.addButton(btn => {
				btn
					.setButtonText("変更")
					.setDisabled(true)
					.onClick(async () => {
						await this.showRootDirectoryMigrationDialog()
					})

				this.rootDirectoryMigrationButton = btn.buttonEl
				return btn
			})

		// ! ソート順設定。
		const sortOrderSetting = new Setting(containerEl)
			.setName("ソート順")
			.setDesc("メモの表示順序（行をクリックして選択）")

		// ! 表を作成。
		const sortOrderTableContainer = sortOrderSetting.controlEl.createDiv({
			cls: "memolog-sort-order-table-container",
		})
		const sortOrderTable = sortOrderTableContainer.createEl("table", { cls: "memolog-sort-order-table" })

		// ! ヘッダー。
		const sortOrderThead = sortOrderTable.createEl("thead")
		const sortOrderHeaderRow = sortOrderThead.createEl("tr")
		sortOrderHeaderRow.createEl("th", { text: "選択" })
		sortOrderHeaderRow.createEl("th", { text: "ソート順" })
		sortOrderHeaderRow.createEl("th", { text: "説明" })

		// ! ボディ。
		const sortOrderTbody = sortOrderTable.createEl("tbody")
		const sortOrderOptions = [
			{ value: "asc", label: "昇順", desc: "古い投稿が上、最新が下" },
			{ value: "desc", label: "降順", desc: "最新の投稿が上、古いものが下" },
		]

		for (const option of sortOrderOptions) {
			const row = sortOrderTbody.createEl("tr", { cls: "memolog-sort-order-row" })

			// ! 選択されているオプションをハイライト。
			if (option.value === settings.order) {
				row.addClass("memolog-sort-order-selected")
			}

			// ! ラジオボタン。
			const radioCell = row.createEl("td")
			const radio = radioCell.createEl("input", { type: "radio" })
			radio.name = "sort-order"
			radio.checked = option.value === settings.order

			// ! ソート順ラベル。
			row.createEl("td", { text: option.label })

			// ! 説明。
			row.createEl("td", { text: option.desc, cls: "memolog-sort-order-desc" })

			// ! 行クリックで選択。
			row.addEventListener("click", () => {
				void (async () => {
					// ! 全ての行から選択状態を解除。
					sortOrderTbody.querySelectorAll(".memolog-sort-order-row").forEach(r => {
						r.removeClass("memolog-sort-order-selected")
						const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
						if (radioInput) radioInput.checked = false
					})

					// ! この行を選択。
					row.addClass("memolog-sort-order-selected")
					radio.checked = true

					// ! 設定を更新。
					await this.plugin.settingsManager.updateGlobalSettings({
						order: option.value as typeof settings.order,
					})

					// ! サイドバーを再描画。
					this.refreshSidebar()
				})()
			})
		}

		// ! ファイルパス書式設定。
		const pathFormatSetting = new Setting(containerEl)
			.setName("ファイルパスの書式")
			.setDesc(
				"保存ファイルパスの書式を指定します。%Y=年、%m=月、%d=日、%H=時、%M=分、%C=カテゴリ名（行をクリックして選択）",
			)

		// ! プレビュー表示領域を説明側に追加。
		const pathPreviewContainer = pathFormatSetting.descEl.createDiv({
			cls: "memolog-template-preview-container",
			attr: {
				style:
					"margin-top: 8px; padding: 8px 12px; background-color: var(--background-secondary); border-radius: 4px; border: 1px solid var(--background-modifier-border);",
			},
		})
		pathPreviewContainer.createDiv({
			text: "出力例:",
			attr: {
				style: "font-weight: 600; margin-bottom: 4px; color: var(--text-muted); font-size: 0.85rem;",
			},
		})
		const pathPreviewContent = pathPreviewContainer.createDiv({
			cls: "memolog-template-preview-content",
			attr: {
				style:
					"white-space: pre-wrap; font-family: var(--font-monospace); line-height: 1.5; color: var(--text-normal); font-size: 0.9rem;",
			},
		})

		// ! パスプレビュー更新関数。
		updatePathPreview = (format: string, rootDirectory?: string) => {
			try {
				const currentSettings = this.plugin.settingsManager.getGlobalSettings()
				const effectiveRootDirectory = rootDirectory ?? currentSettings.rootDirectory
				const preview = PathGenerator.generateCustomPath(
					effectiveRootDirectory,
					currentSettings.categories[0]?.directory || "default",
					format,
					currentSettings.useDirectoryCategory,
					new Date(),
				)
				pathPreviewContent.setText(preview)
			} catch (error) {
				pathPreviewContent.setText(`エラー: ${(error as Error).message}`)
			}
		}

		// ! 初期プレビューを表示。
		updatePathPreview(settings.pathFormat)

		// ! 変換ボタンのチェック関数。
		const checkMigrationNeeded = () => {
			const currentSettings = this.plugin.settingsManager.getGlobalSettings()
			const hasChanged = currentSettings.pathFormat !== this.initialPathFormat ||
				currentSettings.useDirectoryCategory !== this.initialUseDirectoryCategory

			if (this.migrationButton) {
				this.migrationButton.disabled = !hasChanged
				this.migrationButton.toggleClass("mod-cta", hasChanged)
			}
		}

		// ! プリセットオプション。
		const pathPresets = [
			{ label: "%Y%m%d.md", value: "%Y%m%d.md" },
			{ label: "%Y-%m-%d.md", value: "%Y-%m-%d.md" },
			{ label: "%C.md", value: "%C.md" },
			{ label: "%Y%m%d-%C.md", value: "%Y%m%d-%C.md" },
			{ label: "%Y/%m/%d.md", value: "%Y/%m/%d.md" },
			{ label: "%Y-%m-%d/memo.md", value: "%Y-%m-%d/memo.md" },
			{ label: "%C/%Y%m%d.md", value: "%C/%Y%m%d.md" },
			{ label: "%C/%Y-%m-%d.md", value: "%C/%Y-%m-%d.md" },
			{ label: "%Y-%m-%d/%C.md", value: "%Y-%m-%d/%C.md" },
			{ label: "%C/%Y-%m-%d/memo.md", value: "%C/%Y-%m-%d/memo.md" },
		]

		// ! 現在の設定値がプリセットに含まれるか確認。
		const isPathCustom = !pathPresets.some(preset => preset.value === settings.pathFormat)

		// ! 表を作成。
		const pathFormatTableContainer = pathFormatSetting.controlEl.createDiv({
			cls: "memolog-path-format-table-container",
		})
		const pathFormatTable = pathFormatTableContainer.createEl("table", { cls: "memolog-path-format-table" })

		// ! ヘッダー。
		const pathFormatThead = pathFormatTable.createEl("thead")
		const pathFormatHeaderRow = pathFormatThead.createEl("tr")
		pathFormatHeaderRow.createEl("th", { text: "選択" })
		pathFormatHeaderRow.createEl("th", { text: "書式" })

		// ! ボディ。
		const pathFormatTbody = pathFormatTable.createEl("tbody")

		// ! プリセットオプション。
		for (const preset of pathPresets) {
			const row = pathFormatTbody.createEl("tr", { cls: "memolog-path-format-row" })

			// ! 選択されているオプションをハイライト。
			if (preset.value === settings.pathFormat) {
				row.addClass("memolog-path-format-selected")
			}

			// ! ラジオボタン。
			const radioCell = row.createEl("td")
			const radio = radioCell.createEl("input", { type: "radio" })
			radio.name = "path-format"
			radio.checked = preset.value === settings.pathFormat

			// ! 書式ラベル。
			row.createEl("td", { text: preset.label, cls: "memolog-path-format-label" })

			// ! 行クリックで選択。
			row.addEventListener("click", () => {
				void (async () => {
					// ! 全ての行から選択状態を解除。
					pathFormatTbody.querySelectorAll(".memolog-path-format-row").forEach(r => {
						r.removeClass("memolog-path-format-selected")
						const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
						if (radioInput) radioInput.checked = false
					})

					// ! この行を選択。
					row.addClass("memolog-path-format-selected")
					radio.checked = true

					// ! プレビューを更新。
					updatePathPreview(preset.value)
					// ! 添付ファイルパスのプレビューも更新（新しいpathFormatを渡す）。
					if (updateAttachmentPathPreview) {
						const currentSettings = this.plugin.settingsManager.getGlobalSettings()
						updateAttachmentPathPreview(currentSettings.attachmentPath, preset.value)
					}

					// ! 設定を更新。
					await this.plugin.settingsManager.updateGlobalSettings({
						pathFormat: preset.value,
					})

					checkMigrationNeeded()

					// ! サイドバーを再描画。
					this.refreshSidebar()
				})()
			})
		}

		// ! カスタム入力行。
		const customRow = pathFormatTbody.createEl("tr", { cls: "memolog-path-format-row memolog-path-format-custom-row" })

		if (isPathCustom) {
			customRow.addClass("memolog-path-format-selected")
		}

		// ! ラジオボタン。
		const customRadioCell = customRow.createEl("td")
		const customRadio = customRadioCell.createEl("input", { type: "radio" })
		customRadio.name = "path-format"
		customRadio.checked = isPathCustom

		// ! カスタム入力欄。
		const customInputCell = customRow.createEl("td")
		const customInput = customInputCell.createEl("input", {
			type: "text",
			placeholder: "%Y-%m-%d/memo.md",
			value: isPathCustom ? settings.pathFormat : "",
			cls: "memolog-path-format-custom-input",
		})

		// ! カスタム入力欄フォーカス時、ラジオボタンを選択。
		customInput.addEventListener("focus", () => {
			// ! 全ての行から選択状態を解除。
			pathFormatTbody.querySelectorAll(".memolog-path-format-row").forEach(r => {
				r.removeClass("memolog-path-format-selected")
				const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
				if (radioInput) radioInput.checked = false
			})

			// ! カスタム行を選択。
			customRow.addClass("memolog-path-format-selected")
			customRadio.checked = true
		})

		// ! カスタム入力変更時。
		customInput.addEventListener("input", () => {
			const value = customInput.value
			if (value) {
				// ! プレビューを即座に更新。
				updatePathPreview(value)
				// ! 添付ファイルパスのプレビューも更新（新しいpathFormatを渡す）。
				if (updateAttachmentPathPreview) {
					const currentSettings = this.plugin.settingsManager.getGlobalSettings()
					updateAttachmentPathPreview(currentSettings.attachmentPath, value)
				}
				this.debounce("path-format-custom", async () => {
					await this.plugin.settingsManager.updateGlobalSettings({
						pathFormat: value,
					})
					checkMigrationNeeded()
					this.refreshSidebar()
				}, 300)
			}
		})

		// ! カスタム行クリック。
		customRow.addEventListener("click", e => {
			// ! 入力欄自体をクリックした場合は何もしない。
			if (e.target === customInput) return

			// ! 全ての行から選択状態を解除。
			pathFormatTbody.querySelectorAll(".memolog-path-format-row").forEach(r => {
				r.removeClass("memolog-path-format-selected")
				const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
				if (radioInput) radioInput.checked = false
			})

			// ! カスタム行を選択。
			customRow.addClass("memolog-path-format-selected")
			customRadio.checked = true

			// ! 入力欄にフォーカス。
			customInput.focus()
		})

		// ! 変換ボタンを追加。
		const migrationSetting = new Setting(containerEl)
			.setName("既存ファイルの変換")
			.setDesc(
				"ファイルパス書式を変更した場合、このボタンで既存のファイルを新しい構造に変換できます。",
			)

		migrationSetting.addButton(btn => {
			this.migrationButton = btn.buttonEl
			btn.setButtonText("ファイルを変換").onClick(async () => {
				await this.showMigrationDialog()
			})
			btn.buttonEl.disabled = true
		})

		// ! リストアボタンを追加。
		const restoreSetting = new Setting(containerEl)
			.setName("バックアップから元に戻す")
			.setDesc("既存ファイルの変換処理時に作成されたバックアップからファイルを元の状態に戻します。")

		restoreSetting.addButton(async btn => {
			// ! バックアップの存在を確認。
			const backupManager = new BackupManager(this.app)
			const backups = await backupManager.listBackupsWithMetadata("backup-memolog-")

			// ! バックアップがない場合はボタンを無効化。
			if (backups.length === 0) {
				btn.setButtonText("元に戻す").setDisabled(true)
			} else {
				btn.setButtonText("元に戻す").onClick(() => {
					const settings = this.plugin.settingsManager.getGlobalSettings()
					const modal = new RestoreBackupModal(
						this.app,
						settings.rootDirectory,
						() => {
							// ! リストア後に画面を再描画。
							this.display()
							this.refreshSidebar()
						},
					)
					modal.open()
				})
			}
		})

		// ! 添付ファイル保存先設定。
		const attachmentPathSetting = new Setting(containerEl)
			.setName("添付ファイルの保存先")
			.setDesc(
				"画像などの添付ファイルの保存先を指定します。%Y=年、%m=月、%d=日などの書式が使用できます（行をクリックして選択）",
			)

		// ! プレビュー表示領域を説明側に追加。
		const attachmentPathPreviewContainer = attachmentPathSetting.descEl.createDiv({
			cls: "memolog-template-preview-container",
			attr: {
				style:
					"margin-top: 8px; padding: 8px 12px; background-color: var(--background-secondary); border-radius: 4px; border: 1px solid var(--background-modifier-border);",
			},
		})
		attachmentPathPreviewContainer.createDiv({
			text: "出力例:",
			attr: {
				style: "font-weight: 600; margin-bottom: 4px; color: var(--text-muted); font-size: 0.85rem;",
			},
		})
		const attachmentPathPreviewContent = attachmentPathPreviewContainer.createDiv({
			cls: "memolog-template-preview-content",
			attr: {
				style:
					"white-space: pre-wrap; font-family: var(--font-monospace); line-height: 1.5; color: var(--text-normal); font-size: 0.9rem;",
			},
		})

		// ! プレビュー更新関数。
		updateAttachmentPathPreview = (attachmentPathFormat: string, pathFormat?: string, rootDirectory?: string) => {
			try {
				const now = new Date()
				const currentSettings = this.plugin.settingsManager.getGlobalSettings()

				// ! 指定されていない場合は現在の設定を使用。
				const effectivePathFormat = pathFormat ?? currentSettings.pathFormat
				const effectiveRootDirectory = rootDirectory ?? currentSettings.rootDirectory

				// ! 日付フォーマット展開用のヘルパー関数。
				const expandDateFormat = (str: string): string => {
					const year = now.getFullYear()
					const month = (now.getMonth() + 1).toString().padStart(2, "0")
					const day = now.getDate().toString().padStart(2, "0")
					const hour = now.getHours().toString().padStart(2, "0")
					const minute = now.getMinutes().toString().padStart(2, "0")
					const second = now.getSeconds().toString().padStart(2, "0")

					return str
						.replace(/%Y/g, year.toString())
						.replace(/%m/g, month)
						.replace(/%d/g, day)
						.replace(/%H/g, hour)
						.replace(/%M/g, minute)
						.replace(/%S/g, second)
				}

				// ! メモファイルのパスを生成（指定された値または現在の設定を使用）。
				const memoPath = PathGenerator.generateCustomPath(
					effectiveRootDirectory,
					currentSettings.categories[0]?.directory || "default",
					effectivePathFormat,
					currentSettings.useDirectoryCategory,
					now,
				)

				// ! 添付ファイルの保存先パスを計算。
				let attachmentPath: string
				if (attachmentPathFormat.startsWith("./")) {
					// ! 相対パス: メモファイルと同じディレクトリからの相対パス。
					const memoDir = memoPath.substring(0, memoPath.lastIndexOf("/"))
					const relativePath = attachmentPathFormat.substring(2) // "./" を除去。
					const expandedPath = expandDateFormat(relativePath)
					attachmentPath = `${memoDir}/${expandedPath}`
				} else if (attachmentPathFormat.startsWith("/")) {
					// ! 絶対パス: ルートディレクトリからの絶対パス。
					const absolutePath = attachmentPathFormat.substring(1) // "/" を除去。
					const expandedPath = expandDateFormat(absolutePath)
					attachmentPath = `${effectiveRootDirectory}/${expandedPath}`
				} else {
					// ! その他: そのまま表示。
					attachmentPath = expandDateFormat(attachmentPathFormat)
				}

				attachmentPathPreviewContent.setText(attachmentPath)
			} catch (error) {
				attachmentPathPreviewContent.setText(`エラー: ${(error as Error).message}`)
			}
		}

		// ! 初期プレビューを表示。
		updateAttachmentPathPreview(settings.attachmentPath)

		// ! プリセットオプション。
		const attachmentPresets = [
			{ label: "./attachments", value: "./attachments" },
			{ label: "/attachments", value: "/attachments" },
			{ label: "/attachments/%Y", value: "/attachments/%Y" },
			{ label: "./attachments/%Y%m%d", value: "./attachments/%Y%m%d" },
			{ label: "./attachments/%Y-%m-%d", value: "./attachments/%Y-%m-%d" },
			{ label: "/attachments/%Y/%m", value: "/attachments/%Y/%m" },
		]

		// ! 現在の設定値がプリセットに含まれるか確認。
		const isAttachmentCustom = !attachmentPresets.some(preset => preset.value === settings.attachmentPath)

		// ! 表を作成。
		const attachmentPathTableContainer = attachmentPathSetting.controlEl.createDiv({
			cls: "memolog-attachment-path-table-container",
		})
		const attachmentPathTable = attachmentPathTableContainer.createEl("table", { cls: "memolog-attachment-path-table" })

		// ! ヘッダー。
		const attachmentPathThead = attachmentPathTable.createEl("thead")
		const attachmentPathHeaderRow = attachmentPathThead.createEl("tr")
		attachmentPathHeaderRow.createEl("th", { text: "選択" })
		attachmentPathHeaderRow.createEl("th", { text: "保存先" })

		// ! ボディ。
		const attachmentPathTbody = attachmentPathTable.createEl("tbody")

		// ! プリセットオプション。
		for (const preset of attachmentPresets) {
			const row = attachmentPathTbody.createEl("tr", { cls: "memolog-attachment-path-row" })

			// ! 選択されているオプションをハイライト。
			if (preset.value === settings.attachmentPath) {
				row.addClass("memolog-attachment-path-selected")
			}

			// ! ラジオボタン。
			const radioCell = row.createEl("td")
			const radio = radioCell.createEl("input", { type: "radio" })
			radio.name = "attachment-path"
			radio.checked = preset.value === settings.attachmentPath

			// ! 保存先ラベル。
			row.createEl("td", { text: preset.label, cls: "memolog-attachment-path-label" })

			// ! 行クリックで選択。
			row.addEventListener("click", () => {
				void (async () => {
					// ! 全ての行から選択状態を解除。
					attachmentPathTbody.querySelectorAll(".memolog-attachment-path-row").forEach(r => {
						r.removeClass("memolog-attachment-path-selected")
						const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
						if (radioInput) radioInput.checked = false
					})

					// ! この行を選択。
					row.addClass("memolog-attachment-path-selected")
					radio.checked = true

					// ! プレビューを更新。
					updateAttachmentPathPreview(preset.value)

					// ! 設定を更新。
					await this.plugin.settingsManager.updateGlobalSettings({
						attachmentPath: preset.value,
					})
				})()
			})
		}

		// ! カスタム入力行。
		const attachmentCustomRow = attachmentPathTbody.createEl("tr", {
			cls: "memolog-attachment-path-row memolog-attachment-path-custom-row",
		})

		if (isAttachmentCustom) {
			attachmentCustomRow.addClass("memolog-attachment-path-selected")
		}

		// ! ラジオボタン。
		const attachmentCustomRadioCell = attachmentCustomRow.createEl("td")
		const attachmentCustomRadio = attachmentCustomRadioCell.createEl("input", { type: "radio" })
		attachmentCustomRadio.name = "attachment-path"
		attachmentCustomRadio.checked = isAttachmentCustom

		// ! カスタム入力欄。
		const attachmentCustomInputCell = attachmentCustomRow.createEl("td")
		const attachmentCustomInput = attachmentCustomInputCell.createEl("input", {
			type: "text",
			placeholder: "./attachments",
			value: isAttachmentCustom ? settings.attachmentPath : "",
			cls: "memolog-attachment-path-custom-input",
		})

		// ! カスタム入力欄フォーカス時、ラジオボタンを選択。
		attachmentCustomInput.addEventListener("focus", () => {
			// ! 全ての行から選択状態を解除。
			attachmentPathTbody.querySelectorAll(".memolog-attachment-path-row").forEach(r => {
				r.removeClass("memolog-attachment-path-selected")
				const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
				if (radioInput) radioInput.checked = false
			})

			// ! カスタム行を選択。
			attachmentCustomRow.addClass("memolog-attachment-path-selected")
			attachmentCustomRadio.checked = true
		})

		// ! カスタム入力変更時。
		attachmentCustomInput.addEventListener("input", () => {
			const value = attachmentCustomInput.value
			if (value) {
				updateAttachmentPathPreview(value)
				this.debounce("attachment-path-custom", async () => {
					await this.plugin.settingsManager.updateGlobalSettings({
						attachmentPath: value,
					})
				}, 300)
			}
		})

		// ! カスタム行クリック。
		attachmentCustomRow.addEventListener("click", e => {
			// ! 入力欄自体をクリックした場合は何もしない。
			if (e.target === attachmentCustomInput) return

			// ! 全ての行から選択状態を解除。
			attachmentPathTbody.querySelectorAll(".memolog-attachment-path-row").forEach(r => {
				r.removeClass("memolog-attachment-path-selected")
				const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
				if (radioInput) radioInput.checked = false
			})

			// ! カスタム行を選択。
			attachmentCustomRow.addClass("memolog-attachment-path-selected")
			attachmentCustomRadio.checked = true

			// ! 入力欄にフォーカス。
			attachmentCustomInput.focus()
		})

		// ! 添付ファイル名書式設定。
		const attachmentNameSetting = new Setting(containerEl)
			.setName("添付ファイル名の書式")
			.setDesc(
				"添付ファイルの名前を指定します。%Y=年、%m=月、%d=日、%H=時、%M=分、%S=秒、%s=タイムスタンプ、%f=元ファイル名、%e=拡張子（行をクリックして選択）",
			)

		// ! プレビュー表示領域を説明側に追加。
		const attachmentNamePreviewContainer = attachmentNameSetting.descEl.createDiv({
			cls: "memolog-template-preview-container",
			attr: {
				style:
					"margin-top: 8px; padding: 8px 12px; background-color: var(--background-secondary); border-radius: 4px; border: 1px solid var(--background-modifier-border);",
			},
		})
		attachmentNamePreviewContainer.createDiv({
			text: "出力例:",
			attr: {
				style: "font-weight: 600; margin-bottom: 4px; color: var(--text-muted); font-size: 0.85rem;",
			},
		})
		const attachmentNamePreviewContent = attachmentNamePreviewContainer.createDiv({
			cls: "memolog-template-preview-content",
			attr: {
				style:
					"white-space: pre-wrap; font-family: var(--font-monospace); line-height: 1.5; color: var(--text-normal); font-size: 0.9rem;",
			},
		})

		// ! プレビュー更新関数。
		const updateAttachmentNamePreview = (format: string) => {
			try {
				const now = new Date()
				const examples = [
					{ label: "クリップボード貼り付け", fileName: "image.png" },
					{ label: "動画ファイル", fileName: "video.mp4" },
					{ label: "PDFファイル", fileName: "document.pdf" },
				]

				const previews = examples.map(example => {
					const generated = PathGenerator.generateAttachmentName(format, example.fileName, now)
					return `${example.label}:\n${generated}`
				})

				attachmentNamePreviewContent.setText(previews.join("\n\n"))
			} catch (error) {
				attachmentNamePreviewContent.setText(`エラー: ${(error as Error).message}`)
			}
		}

		// ! 初期プレビューを表示。
		updateAttachmentNamePreview(settings.attachmentNameFormat)

		// ! プリセットオプション。
		const attachmentNamePresets = [
			{ label: "pasted-%s-%f%e", value: "pasted-%s-%f%e" },
			{ label: "%Y%m%d-%H%M%S-%f%e", value: "%Y%m%d-%H%M%S-%f%e" },
			{ label: "%f-%s%e", value: "%f-%s%e" },
		]

		// ! 現在の設定値がプリセットに含まれるか確認。
		const isAttachmentNameCustom = !attachmentNamePresets.some(preset => preset.value === settings.attachmentNameFormat)

		// ! 表を作成。
		const attachmentNameTableContainer = attachmentNameSetting.controlEl.createDiv({
			cls: "memolog-attachment-name-table-container",
		})
		const attachmentNameTable = attachmentNameTableContainer.createEl("table", { cls: "memolog-attachment-name-table" })

		// ! ヘッダー。
		const attachmentNameThead = attachmentNameTable.createEl("thead")
		const attachmentNameHeaderRow = attachmentNameThead.createEl("tr")
		attachmentNameHeaderRow.createEl("th", { text: "選択" })
		attachmentNameHeaderRow.createEl("th", { text: "書式" })

		// ! ボディ。
		const attachmentNameTbody = attachmentNameTable.createEl("tbody")

		// ! プリセットオプション。
		for (const preset of attachmentNamePresets) {
			const row = attachmentNameTbody.createEl("tr", { cls: "memolog-attachment-name-row" })

			// ! 選択されているオプションをハイライト。
			if (preset.value === settings.attachmentNameFormat) {
				row.addClass("memolog-attachment-name-selected")
			}

			// ! ラジオボタン。
			const radioCell = row.createEl("td")
			const radio = radioCell.createEl("input", { type: "radio" })
			radio.name = "attachment-name-format"
			radio.checked = preset.value === settings.attachmentNameFormat

			// ! 書式ラベル。
			row.createEl("td", { text: preset.label, cls: "memolog-attachment-name-label" })

			// ! 行クリックで選択。
			row.addEventListener("click", () => {
				void (async () => {
					// ! 全ての行から選択状態を解除。
					attachmentNameTbody.querySelectorAll(".memolog-attachment-name-row").forEach(r => {
						r.removeClass("memolog-attachment-name-selected")
						const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
						if (radioInput) radioInput.checked = false
					})

					// ! この行を選択。
					row.addClass("memolog-attachment-name-selected")
					radio.checked = true

					// ! プレビューを更新。
					updateAttachmentNamePreview(preset.value)

					// ! 設定を更新。
					await this.plugin.settingsManager.updateGlobalSettings({
						attachmentNameFormat: preset.value,
					})
				})()
			})
		}

		// ! カスタム入力行。
		const attachmentNameCustomRow = attachmentNameTbody.createEl("tr", {
			cls: "memolog-attachment-name-row memolog-attachment-name-custom-row",
		})

		if (isAttachmentNameCustom) {
			attachmentNameCustomRow.addClass("memolog-attachment-name-selected")
		}

		// ! ラジオボタン。
		const attachmentNameCustomRadioCell = attachmentNameCustomRow.createEl("td")
		const attachmentNameCustomRadio = attachmentNameCustomRadioCell.createEl("input", { type: "radio" })
		attachmentNameCustomRadio.name = "attachment-name-format"
		attachmentNameCustomRadio.checked = isAttachmentNameCustom

		// ! カスタム入力欄。
		const attachmentNameCustomInputCell = attachmentNameCustomRow.createEl("td")
		const attachmentNameCustomInput = attachmentNameCustomInputCell.createEl("input", {
			type: "text",
			placeholder: "pasted-%s-%f%e",
			value: isAttachmentNameCustom ? settings.attachmentNameFormat : "",
			cls: "memolog-attachment-name-custom-input",
		})

		// ! カスタム入力欄フォーカス時、ラジオボタンを選択。
		attachmentNameCustomInput.addEventListener("focus", () => {
			// ! 全ての行から選択状態を解除。
			attachmentNameTbody.querySelectorAll(".memolog-attachment-name-row").forEach(r => {
				r.removeClass("memolog-attachment-name-selected")
				const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
				if (radioInput) radioInput.checked = false
			})

			// ! カスタム行を選択。
			attachmentNameCustomRow.addClass("memolog-attachment-name-selected")
			attachmentNameCustomRadio.checked = true
		})

		// ! カスタム入力変更時。
		attachmentNameCustomInput.addEventListener("input", () => {
			const value = attachmentNameCustomInput.value
			if (value) {
				updateAttachmentNamePreview(value)
				this.debounce("attachment-name-format-custom", async () => {
					await this.plugin.settingsManager.updateGlobalSettings({
						attachmentNameFormat: value,
					})
				}, 300)
			}
		})

		// ! カスタム行クリック。
		attachmentNameCustomRow.addEventListener("click", e => {
			// ! 入力欄自体をクリックした場合は何もしない。
			if (e.target === attachmentNameCustomInput) return

			// ! 全ての行から選択状態を解除。
			attachmentNameTbody.querySelectorAll(".memolog-attachment-name-row").forEach(r => {
				r.removeClass("memolog-attachment-name-selected")
				const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
				if (radioInput) radioInput.checked = false
			})

			// ! カスタム行を選択。
			attachmentNameCustomRow.addClass("memolog-attachment-name-selected")
			attachmentNameCustomRadio.checked = true

			// ! 入力欄にフォーカス。
			attachmentNameCustomInput.focus()
		})

		// ! メモのテンプレート設定。
		const templateSetting = new Setting(containerEl)
			.setName("メモのテンプレート")

		// ! 説明文を追加。
		templateSetting.descEl.createDiv({
			text: "メモの書式を指定します。{{content}}が実際のメモ内容に置き換えられます（行をクリックして選択）",
		})
		templateSetting.descEl.createDiv({
			text: "※この書式はファイルに保存される形式です。カード形式の表示では{{content}}の内容のみが表示されます。",
			attr: { style: "margin-top: 4px; color: var(--text-muted); font-size: 0.9em;" },
		})

		// ! プリセットオプション。
		const templatePresets = [
			{ label: "{{content}}", value: "{{content}}" },
			{ label: "# %Y-%m-%d %H:%M:%S\\n{{content}}", value: "# %Y-%m-%d %H:%M:%S\n{{content}}" },
			{ label: "%Y/%m/%d-%H:%M:%S {{content}}", value: "%Y/%m/%d-%H:%M:%S {{content}}" },
		]

		// ! 現在の設定値がプリセットに含まれるか確認。
		const isTemplateCustom = !templatePresets.some(preset => preset.value === settings.memoTemplate)

		// ! 表を作成。
		const templateTableContainer = templateSetting.controlEl.createDiv({
			cls: "memolog-template-table-container",
		})
		const templateTable = templateTableContainer.createEl("table", { cls: "memolog-template-table" })

		// ! ヘッダー。
		const templateThead = templateTable.createEl("thead")
		const templateHeaderRow = templateThead.createEl("tr")
		templateHeaderRow.createEl("th", { text: "選択" })
		templateHeaderRow.createEl("th", { text: "テンプレート" })

		// ! ボディ。
		const templateTbody = templateTable.createEl("tbody")

		// ! プリセットオプション。
		for (const preset of templatePresets) {
			const row = templateTbody.createEl("tr", { cls: "memolog-template-row" })

			// ! 選択されているオプションをハイライト。
			if (preset.value === settings.memoTemplate) {
				row.addClass("memolog-template-selected")
			}

			// ! ラジオボタン。
			const radioCell = row.createEl("td")
			const radio = radioCell.createEl("input", { type: "radio" })
			radio.name = "memo-template"
			radio.checked = preset.value === settings.memoTemplate

			// ! テンプレートラベル。
			row.createEl("td", { text: preset.label, cls: "memolog-template-label" })

			// ! 行クリックで選択。
			row.addEventListener("click", () => {
				void (async () => {
					// ! 全ての行から選択状態を解除。
					templateTbody.querySelectorAll(".memolog-template-row").forEach(r => {
						r.removeClass("memolog-template-selected")
						const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
						if (radioInput) radioInput.checked = false
					})

					// ! この行を選択。
					row.addClass("memolog-template-selected")
					radio.checked = true

					// ! 設定を更新。
					await this.plugin.settingsManager.updateGlobalSettings({
						memoTemplate: preset.value,
					})

					// ! プレビューを更新。
					updatePreview(preset.value)
				})()
			})
		}

		// ! カスタム入力行。
		const templateCustomRow = templateTbody.createEl("tr", {
			cls: "memolog-template-row memolog-template-custom-row",
		})

		if (isTemplateCustom) {
			templateCustomRow.addClass("memolog-template-selected")
		}

		// ! ラジオボタン。
		const templateCustomRadioCell = templateCustomRow.createEl("td")
		const templateCustomRadio = templateCustomRadioCell.createEl("input", { type: "radio" })
		templateCustomRadio.name = "memo-template"
		templateCustomRadio.checked = isTemplateCustom

		// ! カスタム入力欄。
		const templateCustomInputCell = templateCustomRow.createEl("td")
		const templateCustomInput = templateCustomInputCell.createEl("textarea", {
			placeholder: "# %Y-%m-%d %H:%M:%S\\n{{content}}",
			value: isTemplateCustom ? settings.memoTemplate : "",
			cls: "memolog-template-custom-input",
		})
		templateCustomInput.rows = 3

		// ! カスタム入力欄フォーカス時、ラジオボタンを選択。
		templateCustomInput.addEventListener("focus", () => {
			// ! 全ての行から選択状態を解除。
			templateTbody.querySelectorAll(".memolog-template-row").forEach(r => {
				r.removeClass("memolog-template-selected")
				const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
				if (radioInput) radioInput.checked = false
			})

			// ! カスタム行を選択。
			templateCustomRow.addClass("memolog-template-selected")
			templateCustomRadio.checked = true
		})

		// ! カスタム入力変更時。
		templateCustomInput.addEventListener("input", () => {
			const value = templateCustomInput.value
			if (value) {
				updatePreview(value)
				this.debounce("template-custom", async () => {
					await this.plugin.settingsManager.updateGlobalSettings({
						memoTemplate: value,
					})
				}, 300)
			}
		})

		// ! カスタム入力欄からフォーカスが外れた時、{{content}}が含まれているかチェック。
		templateCustomInput.addEventListener("blur", () => {
			let value = templateCustomInput.value.trim()
			if (!value.includes("{{content}}")) {
				// ! {{content}}が含まれていない場合は追加。
				if (value) {
					value = value + "\n{{content}}"
				} else {
					value = "{{content}}"
				}
				templateCustomInput.value = value
				if (templateCustomRadio.checked) {
					updatePreview(value)
					void this.plugin.settingsManager.updateGlobalSettings({
						memoTemplate: value,
					})
				}
			}
		})

		// ! カスタム行クリック。
		templateCustomRow.addEventListener("click", e => {
			// ! 入力欄自体をクリックした場合は何もしない。
			if (e.target === templateCustomInput) return

			// ! 全ての行から選択状態を解除。
			templateTbody.querySelectorAll(".memolog-template-row").forEach(r => {
				r.removeClass("memolog-template-selected")
				const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
				if (radioInput) radioInput.checked = false
			})

			// ! カスタム行を選択。
			templateCustomRow.addClass("memolog-template-selected")
			templateCustomRadio.checked = true

			// ! 入力欄にフォーカス。
			templateCustomInput.focus()
		})

		// ! プレビュー表示領域を追加。
		const previewContainer = templateSetting.descEl.createDiv({
			cls: "memolog-template-preview-container",
			attr: {
				style:
					"margin-top: 12px; padding: 12px; background-color: var(--background-secondary); border-radius: 4px; border: 1px solid var(--background-modifier-border);",
			},
		})
		previewContainer.createDiv({
			text: "投稿例:",
			attr: {
				style: "font-weight: 600; margin-bottom: 8px; color: var(--text-muted);",
			},
		})
		const previewContent = previewContainer.createDiv({
			cls: "memolog-template-preview-content",
			attr: {
				style: "white-space: pre-wrap; font-family: var(--font-text); line-height: 1.5; color: var(--text-normal);",
			},
		})

		// ! プレビュー更新関数。
		const updatePreview = (template: string) => {
			try {
				const preview = TemplateManager.preview(template)
				previewContent.setText(preview)
			} catch (error) {
				previewContent.setText(`エラー: ${(error as Error).message}`)
			}
		}

		// ! 初期プレビューを表示。
		updatePreview(settings.memoTemplate)

		templateSetting.descEl.createEl("br")
		templateSetting.descEl.createDiv({ text: "利用可能な書式:", cls: "setting-item-description" })

		// ! 書式コード一覧表を作成。
		const table = templateSetting.descEl.createEl("table", {
			attr: { style: "width: 100%; margin-top: 8px; border-collapse: collapse;" },
		})

		// ! ヘッダー行。
		const thead = table.createEl("thead")
		const headerRow = thead.createEl("tr")
		headerRow.createEl("th", {
			text: "書式",
			attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; text-align: left;" },
		})
		headerRow.createEl("th", {
			text: "説明",
			attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; text-align: left;" },
		})
		headerRow.createEl("th", {
			text: "例",
			attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; text-align: left;" },
		})

		// ! データ行。
		const tbody = table.createEl("tbody")
		const formatData = [
			{ code: "%Y", desc: "年(4桁)", example: "2025" },
			{ code: "%y", desc: "年(2桁)", example: "25" },
			{ code: "%m", desc: "月(01-12)", example: "01" },
			{ code: "%B", desc: "月名", example: "1月" },
			{ code: "%b", desc: "月名略", example: "1月" },
			{ code: "%d", desc: "日(01-31)", example: "27" },
			{ code: "%A", desc: "曜日", example: "月曜日" },
			{ code: "%a", desc: "曜日略", example: "月" },
			{ code: "%u", desc: "曜日(1-7)", example: "1" },
			{ code: "%H", desc: "時(24h)", example: "14" },
			{ code: "%I", desc: "時(12h)", example: "02" },
			{ code: "%M", desc: "分", example: "30" },
			{ code: "%S", desc: "秒", example: "45" },
			{ code: "%s", desc: "UNIX時刻", example: "1738017045" },
		]

		for (const format of formatData) {
			const row = tbody.createEl("tr")
			row.createEl("td", {
				text: format.code,
				attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; font-family: monospace;" },
			})
			row.createEl("td", {
				text: format.desc,
				attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px;" },
			})
			row.createEl("td", {
				text: format.example,
				attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; font-family: monospace;" },
			})
		}
	}

	// ! ゴミ箱設定を追加する。
	private addTrashSettings(containerEl: HTMLElement): void {
		const settings = this.plugin.settingsManager.getGlobalSettings()

		// ! ゴミ箱機能設定。
		new Setting(containerEl)
			.setName("ゴミ箱機能を有効化")
			.setDesc("削除したメモをゴミ箱ファイルに移動します")
			.addToggle(toggle =>
				toggle.setValue(settings.enableTrash).onChange(async value => {
					await this.plugin.settingsManager.updateGlobalSettings({
						enableTrash: value,
					})
				})
			)

		// ! ゴミ箱保持期間設定。
		new Setting(containerEl)
			.setName("ゴミ箱保持期間（日数）")
			.setDesc("ゴミ箱内のメモを保持する期間（日数）。この期間を過ぎたメモは自動的に削除されます")
			.addText(text =>
				text
					.setPlaceholder("30")
					.setValue(String(settings.trashRetentionDays))
					.onChange(async value => {
						const days = parseInt(value, 10)
						if (!isNaN(days) && days > 0) {
							await this.plugin.settingsManager.updateGlobalSettings({
								trashRetentionDays: days,
							})
						}
					})
			)

		// ! ゴミ箱タブ表示設定。
		new Setting(containerEl)
			.setName("ゴミ箱タブを表示")
			.setDesc("ゴミ箱内のメモを表示するタブを追加します")
			.addToggle(toggle =>
				toggle.setValue(settings.showTrashTab).onChange(async value => {
					await this.plugin.settingsManager.updateGlobalSettings({
						showTrashTab: value,
					})
					this.refreshSidebar()
				})
			)
	}

	// ! 高度な機能設定を追加する。
	private addAdvancedFeatures(containerEl: HTMLElement): void {
		const settings = this.plugin.settingsManager.getGlobalSettings()

		// ! ログ設定。
		containerEl.createEl("h4", { text: "ログ設定" })

		new Setting(containerEl)
			.setName("ログ出力レベル")
			.setDesc("コンソールに出力するログのレベルを設定します")
			.addDropdown(dropdown =>
				dropdown
					.addOption("none", "なし")
					.addOption("error", "エラーのみ")
					.addOption("warn", "警告以上")
					.addOption("info", "情報以上")
					.addOption("debug", "デバッグ（全て）")
					.setValue(settings.logLevel)
					.onChange(async value => {
						await this.plugin.settingsManager.updateGlobalSettings({
							logLevel: value as "none" | "error" | "warn" | "info" | "debug",
						})
						// ! Loggerのログレベルを更新。
						const { Logger } = await import("../utils/logger")
						Logger.setLogLevel(value as "none" | "error" | "warn" | "info" | "debug")
					})
			)

		// ! 検索履歴設定。
		containerEl.createEl("h4", { text: "検索履歴" })

		new Setting(containerEl)
			.setName("検索履歴を有効化")
			.setDesc("検索履歴を保存して再利用可能にする")
			.addToggle(toggle =>
				toggle.setValue(true).onChange(_value => {
					// ! 検索履歴の有効/無効を切り替え。
					this.plugin.refreshSidebar()
				})
			)

		new Setting(containerEl)
			.setName("検索履歴の最大サイズ")
			.setDesc("保存する検索履歴の最大数（1-100）")
			.addText(text => {
				text
					.setPlaceholder("50")
					.setValue(String(settings.searchHistoryMaxSize))

				const saveMaxSize = async (value: string) => {
					const numValue = parseInt(value, 10)
					if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
						await this.plugin.settingsManager.updateGlobalSettings({
							searchHistoryMaxSize: numValue,
						})
					}
				}

				// ! リアルタイム保存 - input イベントを監視。
				text.inputEl.addEventListener("input", () => {
					const value = text.inputEl.value
					this.debounce("search-history-max-size", async () => {
						await saveMaxSize(value)
					})
				})

				// ! フォーカスが外れた時も即座に保存。
				text.inputEl.addEventListener("blur", () => {
					const value = text.inputEl.value
					const existingTimer = this.debounceTimers.get("search-history-max-size")
					if (existingTimer) {
						clearTimeout(existingTimer)
						this.debounceTimers.delete("search-history-max-size")
					}
					void saveMaxSize(value)
				})

				return text
			})
	}

	// ! カテゴリタブのコンテンツを再描画する（ちらつき防止）。
	private refreshCategoryTab(): void {
		// ! カテゴリタブのコンテンツエリアを取得。
		const categoryPane = document.querySelector("[data-tab=\"category\"].memolog-settings-tab-pane") as HTMLElement
		if (!categoryPane) return

		// ! 内容をクリアして再構築。
		categoryPane.empty()
		this.addCategorySettings(categoryPane)
	}

	// ! カテゴリ設定を追加する。
	private addCategorySettings(containerEl: HTMLElement): void {
		const settings = this.plugin.settingsManager.getGlobalSettings()

		// ! 全カテゴリタブ表示設定。
		new Setting(containerEl)
			.setName("Allタブを表示")
			.setDesc("全カテゴリの投稿をまとめて表示するタブを追加します")
			.addToggle(toggle =>
				toggle.setValue(settings.showAllTab).onChange(async value => {
					await this.plugin.settingsManager.updateGlobalSettings({
						showAllTab: value,
					})
					this.refreshSidebar()
				})
			)

		// ! ピン留めタブ表示設定。
		new Setting(containerEl)
			.setName("ピン留めタブを表示")
			.setDesc("ピン留めされた投稿を表示するタブを追加します")
			.addToggle(toggle =>
				toggle.setValue(settings.showPinnedTab).onChange(async value => {
					await this.plugin.settingsManager.updateGlobalSettings({
						showPinnedTab: value,
					})
					this.refreshSidebar()
				})
			)

		// ! デフォルトカテゴリ設定。
		const defaultCategorySetting = new Setting(containerEl)
			.setName("デフォルトカテゴリ")
			.setDesc("新規メモ作成時のデフォルトカテゴリ（行をクリックして選択）")

		// ! カテゴリが1つもない場合。
		if (settings.categories.length === 0) {
			defaultCategorySetting.setDesc("カテゴリを追加してください")
			return
		}

		// ! デフォルトカテゴリが存在しない場合、一番上のカテゴリを選択。
		const categoryExists = settings.categories.some(c => c.directory === settings.defaultCategory)
		if (!categoryExists || !settings.defaultCategory) {
			const firstCategory = settings.categories[0]
			// ! 非同期で設定を更新（awaitしない）。
			void this.plugin.settingsManager
				.updateGlobalSettings({
					defaultCategory: firstCategory.directory,
				})
				.then(() => {
					// ! 更新後にサイドバーを再描画。
					this.refreshSidebar()
				})
			// ! 表示用に現在の設定を更新。
			settings.defaultCategory = firstCategory.directory
		}

		// ! 表を作成。
		const tableContainer = defaultCategorySetting.controlEl.createDiv({
			cls: "memolog-default-category-table-container",
		})
		const table = tableContainer.createEl("table", { cls: "memolog-default-category-table" })

		// ! ヘッダー。
		const thead = table.createEl("thead")
		const headerRow = thead.createEl("tr")
		headerRow.createEl("th", { text: "選択" })
		headerRow.createEl("th", { text: "カテゴリ名" })
		headerRow.createEl("th", { text: "カテゴリ表示名" })
		headerRow.createEl("th", { text: "アイコン" })
		headerRow.createEl("th", { text: "色" })

		// ! ボディ。
		const tbody = table.createEl("tbody")
		for (const category of settings.categories) {
			const row = tbody.createEl("tr", { cls: "memolog-default-category-row" })

			// ! 選択されているカテゴリをハイライト。
			if (category.directory === settings.defaultCategory) {
				row.addClass("memolog-default-category-selected")
			}

			// ! ラジオボタン。
			const radioCell = row.createEl("td")
			const radio = radioCell.createEl("input", { type: "radio" })
			radio.name = "default-category"
			radio.checked = category.directory === settings.defaultCategory

			// ! カテゴリ名（ディレクトリ名）。
			row.createEl("td", { text: category.directory, cls: "memolog-directory-name" })

			// ! カテゴリ表示名。
			row.createEl("td", { text: category.name })

			// ! アイコン。
			const iconCell = row.createEl("td")
			if (category.showIcon !== false && category.icon) {
				setIcon(iconCell, category.icon)
				// ! アイコンの色をカテゴリの色に設定。
				iconCell.style.color = category.color
			}

			// ! 色。
			const colorCell = row.createEl("td")
			const colorBox = colorCell.createDiv({ cls: "memolog-color-box" })
			colorBox.style.backgroundColor = category.color

			// ! 行クリックで選択。
			row.addEventListener("click", () => {
				void (async () => {
					// ! 全ての行から選択状態を解除。
					tbody.querySelectorAll(".memolog-default-category-row").forEach(r => {
						r.removeClass("memolog-default-category-selected")
						const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
						if (radioInput) radioInput.checked = false
					})

					// ! この行を選択。
					row.addClass("memolog-default-category-selected")
					radio.checked = true

					// ! 設定を更新。
					await this.plugin.settingsManager.updateGlobalSettings({
						defaultCategory: category.directory,
					})

					// ! サイドバーを再描画。
					this.refreshSidebar()
				})()
			})
		}
		// ! カテゴリ一覧を表示。
		for (let i = 0; i < settings.categories.length; i++) {
			this.addCategoryItem(containerEl, settings.categories[i], i)
		}

		// ! カテゴリ追加ボタン。
		new Setting(containerEl).addButton(button =>
			button
				.setButtonText("+ カテゴリを追加")
				.setCta()
				.onClick(async () => {
					const newCategory: CategoryConfig = {
						name: "新しいカテゴリ",
						directory: "new-category",
						color: "#3b82f6",
						icon: "folder",
					}
					const updatedCategories = [...settings.categories, newCategory]
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					})
					this.display()
					this.refreshSidebar()
				})
		)
	}

	// ! カテゴリアイテムを追加する。
	private addCategoryItem(containerEl: HTMLElement, category: CategoryConfig, index: number): void {
		const categoryDiv = containerEl.createDiv({ cls: "memolog-category-setting" })

		// ! カテゴリ名（ディレクトリ名）。
		const directorySetting = new Setting(categoryDiv)
			.setName("カテゴリ名 (必須)")
			.setDesc("ディレクトリでカテゴリ分離がONの時にディレクトリ名として使用されます。")

		directorySetting.addText(text => {
			text
				.setPlaceholder("directory-name")
				.setValue(category.directory)

			// ! バリデーション処理。
			const validate = (value: string) => {
				// ! ディレクトリ名が空の場合はエラーメッセージを表示。
				if (!value.trim()) {
					text.inputEl.addClass("memolog-input-error")
					directorySetting.setDesc(
						"⚠️ カテゴリ名は必須です。ディレクトリでカテゴリ分離がONの時にディレクトリ名として使用されます。",
					)
				} else {
					text.inputEl.removeClass("memolog-input-error")
					directorySetting.setDesc("ディレクトリでカテゴリ分離がONの時にディレクトリ名として使用されます。")
				}
			}

			// ! 保存処理。
			const save = async (value: string) => {
				// ! イベントハンドラ内で最新の設定を取得する。
				const currentSettings = this.plugin.settingsManager.getGlobalSettings()
				const updatedCategories = [...currentSettings.categories]
				updatedCategories[index] = { ...updatedCategories[index], directory: value }
				await this.saveSettings({
					categories: updatedCategories,
				})
				this.refreshSidebar()
				// ! デフォルトカテゴリ選択の表を更新。
				this.updateDefaultCategoryTable()
			}

			// ! 入力時はバリデーションのみ。
			text.inputEl.addEventListener("input", () => {
				validate(text.inputEl.value)
			})

			// ! フォーカスが外れた時に保存。
			text.inputEl.addEventListener("blur", () => {
				const value = text.inputEl.value
				validate(value)
				void save(value)
			})

			// ! 初期表示時のチェック。
			if (!category.directory.trim()) {
				text.inputEl.addClass("memolog-input-error")
				directorySetting.setDesc(
					"⚠️ カテゴリ名は必須です。ディレクトリでカテゴリ分離がONの時にディレクトリ名として使用されます。",
				)
			}

			return text
		})

		// ! カテゴリ表示名。
		new Setting(categoryDiv)
			.setName("カテゴリ表示名 (空欄可)")
			.setDesc("タブ表示にのみ使用されます。空欄の場合はカテゴリ名が表示されます。")
			.addText(text => {
				text
					.setPlaceholder("表示名")
					.setValue(category.name)

				// ! 保存処理（空文字列も許容）。
				const save = async (value: string) => {
					// ! イベントハンドラ内で最新の設定を取得する。
					const currentSettings = this.plugin.settingsManager.getGlobalSettings()
					const updatedCategories = [...currentSettings.categories]
					updatedCategories[index] = { ...updatedCategories[index], name: value }
					await this.saveSettings({
						categories: updatedCategories,
					})
					this.refreshSidebar()
					// ! デフォルトカテゴリ選択の表を更新。
					this.updateDefaultCategoryTable()
				}

				// ! フォーカスが外れた時に保存。
				text.inputEl.addEventListener("blur", () => {
					void save(text.inputEl.value)
				})

				return text
			})

		// ! プリセットカラー選択。
		const colorSetting = new Setting(categoryDiv).setName("プリセットカラー")

		// ! プリセットカラーボタンを追加。
		const colorContainer = colorSetting.controlEl.createDiv({ cls: "memolog-color-preset-container" })

		for (const preset of PRESET_COLORS) {
			const colorBtn = colorContainer.createDiv({ cls: "memolog-color-preset-btn" })
			colorBtn.style.backgroundColor = preset.value
			colorBtn.setAttribute("aria-label", preset.name)
			if (category.color === preset.value) {
				colorBtn.addClass("memolog-color-preset-btn-selected")
			}
			colorBtn.addEventListener("click", () => {
				void (async () => {
					// ! イベントハンドラ内で最新の設定を取得する。
					const currentSettings = this.plugin.settingsManager.getGlobalSettings()
					const updatedCategories = [...currentSettings.categories]
					updatedCategories[index] = { ...updatedCategories[index], color: preset.value }
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					})
					this.refreshCategoryTab()
					this.updateDefaultCategoryTable()
					this.refreshSidebar()
				})()
			})
		}

		// ! カラーコード入力（カラーピッカー + テキスト入力欄）。
		new Setting(categoryDiv)
			.setName("カラーコード")
			.addColorPicker(colorPicker =>
				colorPicker.setValue(category.color).onChange(async value => {
					// ! イベントハンドラ内で最新の設定を取得する。
					const currentSettings = this.plugin.settingsManager.getGlobalSettings()
					const updatedCategories = [...currentSettings.categories]
					updatedCategories[index] = { ...updatedCategories[index], color: value }
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					})
					this.refreshCategoryTab()
					this.updateDefaultCategoryTable()
					this.refreshSidebar()
				})
			)
			.addText(text => {
				text
					.setValue(category.color)
					.setPlaceholder("#3b82f6")

				// ! 保存処理。
				const save = async (value: string) => {
					// ! #で始まる6桁の16進数かチェック。
					if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
						// ! イベントハンドラ内で最新の設定を取得する。
						const currentSettings = this.plugin.settingsManager.getGlobalSettings()
						const updatedCategories = [...currentSettings.categories]
						updatedCategories[index] = { ...updatedCategories[index], color: value }
						await this.saveSettings({
							categories: updatedCategories,
						})
						this.refreshCategoryTab()
						this.updateDefaultCategoryTable()
						this.refreshSidebar()
					}
				}

				// ! フォーカスが外れた時に保存。
				text.inputEl.addEventListener("blur", () => {
					void save(text.inputEl.value)
				})

				return text
			})

		// ! アイコン選択（アイコンピッカーを使用）。
		const iconSetting = new Setting(categoryDiv)
			.setName("アイコン")
			.setDesc("カテゴリのアイコンを選択（1000種類以上から選択可能）")

		// ! アイコンピッカーを作成。
		const iconPickerContainer = iconSetting.controlEl.createDiv({
			cls: "memolog-icon-picker-container",
		})
		iconPickerContainer.style.position = "relative"

		const iconPicker = new IconPicker(iconPickerContainer, category.icon, {
			onIconSelect: (iconName: string) => {
				void (async () => {
					// ! イベントハンドラ内で最新の設定を取得する。
					const currentSettings = this.plugin.settingsManager.getGlobalSettings()
					const updatedCategories = [...currentSettings.categories]
					updatedCategories[index] = { ...updatedCategories[index], icon: iconName }
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					})
					this.refreshCategoryTab()
					this.refreshSidebar()
				})()
			},
		})

		iconPicker.render()

		// ! アイコン表示トグル。
		new Setting(categoryDiv)
			.setName("アイコンを表示")
			.setDesc("このカテゴリのタブにアイコンを表示します")
			.addToggle(toggle =>
				toggle.setValue(category.showIcon ?? true).onChange(async value => {
					// ! イベントハンドラ内で最新の設定を取得する。
					const currentSettings = this.plugin.settingsManager.getGlobalSettings()
					const updatedCategories = [...currentSettings.categories]
					updatedCategories[index] = { ...updatedCategories[index], showIcon: value }
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					})
					this.refreshSidebar()
				})
			)

		// ! TODOリストとして使用するかのトグル。
		new Setting(categoryDiv)
			.setName("TODOリストにする")
			.setDesc(
				"このカテゴリをTODOリストとして使用します。投稿にチェックボックスが表示され、チェックを入れると非表示になります（このカテゴリのタブ選択時のみ）。",
			)
			.addToggle(toggle =>
				toggle.setValue(category.useTodoList ?? false).onChange(async value => {
					// ! イベントハンドラ内で最新の設定を取得する。
					const currentSettings = this.plugin.settingsManager.getGlobalSettings()
					const updatedCategories = [...currentSettings.categories]
					updatedCategories[index] = { ...updatedCategories[index], useTodoList: value }
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					})
					this.refreshSidebar()
				})
			)

		// ! 順序変更と削除ボタン。
		new Setting(categoryDiv)
			.addButton(button =>
				button
					.setButtonText("↑")
					.setTooltip("上に移動")
					.setDisabled(index === 0)
					.onClick(async () => {
						// ! イベントハンドラ内で最新の設定を取得する。
						const currentSettings = this.plugin.settingsManager.getGlobalSettings()
						const updatedCategories = [...currentSettings.categories] // ! 配列の要素を入れ替え。
						;[updatedCategories[index - 1], updatedCategories[index]] = [
							updatedCategories[index],
							updatedCategories[index - 1],
						]
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						})
						this.display()
						this.refreshSidebar()
					})
			)
			.addButton(button => {
				// ! イベントハンドラ内で最新の設定を取得する。
				const currentSettings = this.plugin.settingsManager.getGlobalSettings()
				return button
					.setButtonText("↓")
					.setTooltip("下に移動")
					.setDisabled(index === currentSettings.categories.length - 1)
					.onClick(async () => {
						// ! イベントハンドラ内で最新の設定を取得する。
						const currentSettings = this.plugin.settingsManager.getGlobalSettings()
						const updatedCategories = [...currentSettings.categories] // ! 配列の要素を入れ替え。
						;[updatedCategories[index], updatedCategories[index + 1]] = [
							updatedCategories[index + 1],
							updatedCategories[index],
						]
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						})
						this.display()
						this.refreshSidebar()
					})
			})
			.addButton(button =>
				button
					.setButtonText("削除")
					.setWarning()
					.onClick(async () => {
						// ! イベントハンドラ内で最新の設定を取得する。
						const currentSettings = this.plugin.settingsManager.getGlobalSettings()
						const updatedCategories = currentSettings.categories.filter(
							(_: CategoryConfig, i: number) => i !== index,
						)
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						})
						this.display()
						this.refreshSidebar()
					})
			)
	}

	// ! アクションボタン（設定リセット、保存）を追加する。
	private addActionButtons(containerEl: HTMLElement): void {
		// ! ボタンコンテナ。
		const buttonContainer = containerEl.createDiv({
			cls: "memolog-settings-actions",
		})

		// ! 左側: 設定リセットボタン。
		const resetContainer = buttonContainer.createDiv({
			cls: "memolog-settings-reset-container",
		})

		new Setting(resetContainer)
			.setName("設定をリセット")
			.setDesc("全ての設定をデフォルト値に戻します。この操作は取り消せません。")
			.addButton(button =>
				button
					.setButtonText("設定をリセット")
					.setWarning()
					.onClick(async () => {
						// ! 確認ダイアログ。
						const confirmed = await this.showResetConfirmDialog()
						if (confirmed) {
							// ! デフォルト設定に戻す。
							await this.plugin.settingsManager.updateGlobalSettings(
								{ ...DEFAULT_GLOBAL_SETTINGS },
							)
							// ! 画面を再描画。
							this.display()
							this.refreshSidebar()
							// ! 成功通知。
							new Notice("設定をリセットしました")
						}
					})
			)

		// ! 右側: 設定保存ボタン。
		const saveContainer = buttonContainer.createDiv({
			cls: "memolog-settings-save-container",
		})

		new Setting(saveContainer)
			.setName("設定を保存")
			.setDesc("設定はリアルタイムで自動保存されています。このボタンは手動で保存を確認したい場合に使用できます。")
			.addButton(button =>
				button
					.setButtonText("設定を保存")
					.setCta()
					.onClick(async () => {
						await this.plugin.settingsManager.saveGlobalSettings()
						// ! 成功通知。
						new Notice("設定を保存しました")
					})
			)
	}

	// ! 設定リセット確認ダイアログを表示する。
	private async showResetConfirmDialog(): Promise<boolean> {
		return new Promise(resolve => {
			// ! モーダルダイアログを作成。
			const modal = document.createElement("div")
			modal.addClass("modal-container")
			modal.addClass("mod-dim")

			const modalBg = modal.createDiv({ cls: "modal-bg" })
			const modalContent = modal.createDiv({ cls: "modal" })

			// ! タイトル。
			modalContent.createEl("h3", {
				text: "設定をリセットしますか？",
				cls: "modal-title",
			})

			// ! メッセージ。
			modalContent.createEl("p", {
				text: "全ての設定がデフォルト値に戻ります。この操作は取り消せません。",
				cls: "modal-content",
			})

			// ! ボタン群。
			const buttonGroup = modalContent.createDiv({ cls: "modal-button-container" })

			const cancelBtn = buttonGroup.createEl("button", {
				text: "キャンセル",
				cls: "mod-cta",
			})

			const confirmBtn = buttonGroup.createEl("button", {
				text: "リセット",
				cls: "mod-warning",
			})

			// ! イベントリスナー。
			const closeModal = () => {
				modal.remove()
			}

			cancelBtn.addEventListener("click", () => {
				closeModal()
				resolve(false)
			})

			confirmBtn.addEventListener("click", () => {
				closeModal()
				resolve(true)
			})

			modalBg.addEventListener("click", () => {
				closeModal()
				resolve(false)
			})

			// ! モーダルを表示。
			document.body.appendChild(modal)
		})
	}

	// ! サイドバーをリフレッシュする。
	private refreshSidebar(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MEMOLOG)
		for (const leaf of leaves) {
			const view = leaf.view
			if (view instanceof MemologSidebar) {
				view.refresh()
			}
		}
	}

	// ! デフォルトカテゴリ選択の表を更新する。
	private updateDefaultCategoryTable(): void {
		const settings = this.plugin.settingsManager.getGlobalSettings()

		// ! 既存の表を探す。
		const table = document.querySelector(".memolog-default-category-table") as HTMLTableElement
		if (!table) return

		// ! tbody の内容を再生成。
		const tbody = table.querySelector("tbody")
		if (!tbody) return

		tbody.empty()

		// ! 各カテゴリの行を再作成。
		for (const category of settings.categories) {
			const row = tbody.createEl("tr", { cls: "memolog-default-category-row" })

			// ! 選択されているカテゴリをハイライト。
			if (category.directory === settings.defaultCategory) {
				row.addClass("memolog-default-category-selected")
			}

			// ! ラジオボタン。
			const radioCell = row.createEl("td")
			const radio = radioCell.createEl("input", { type: "radio" })
			radio.name = "default-category"
			radio.checked = category.directory === settings.defaultCategory

			// ! カテゴリ名（ディレクトリ名）。
			row.createEl("td", { text: category.directory, cls: "memolog-directory-name" })

			// ! カテゴリ表示名。
			row.createEl("td", { text: category.name })

			// ! アイコン。
			const iconCell = row.createEl("td")
			if (category.showIcon !== false && category.icon) {
				setIcon(iconCell, category.icon)
			}

			// ! 色。
			const colorCell = row.createEl("td")
			const colorBox = colorCell.createDiv({ cls: "memolog-color-box" })
			colorBox.style.backgroundColor = category.color

			// ! 行クリックで選択。
			row.addEventListener("click", () => {
				void (async () => {
					// ! 全ての行から選択状態を解除。
					tbody.querySelectorAll(".memolog-default-category-row").forEach(r => {
						r.removeClass("memolog-default-category-selected")
						const radioInput = r.querySelector("input[type=\"radio\"]") as HTMLInputElement
						if (radioInput) radioInput.checked = false
					})

					// ! この行を選択。
					row.addClass("memolog-default-category-selected")
					radio.checked = true

					// ! 設定を更新。
					await this.plugin.settingsManager.updateGlobalSettings({
						defaultCategory: category.directory,
					})

					// ! サイドバーを再描画。
					this.refreshSidebar()
				})()
			})
		}
	}

	// ! メモマッピングを通常のPathMapping形式に変換（表示用）。
	private convertMemoMappingsToPathMappings(
		memoMappings: import("../utils/path-migrator").MemoSplitMapping[],
	): import("../utils/path-migrator").PathMapping[] {
		const mappings: import("../utils/path-migrator").PathMapping[] = []

		for (const memoMapping of memoMappings) {
			for (const [newPath, memos] of memoMapping.newPathToMemos) {
				mappings.push({
					oldPath: memoMapping.oldPath,
					newPath,
					category: memos[0]?.category || "",
					date: memos[0] ? new Date(memos[0].timestamp) : undefined,
					hasConflict: memoMapping.hasConflict,
				})
			}
		}

		return mappings
	}

	// ! マイグレーションダイアログを表示。
	private async showMigrationDialog() {
		const settings = this.plugin.settingsManager.getGlobalSettings()
		const vaultHandler = new MemologVaultHandler(this.app)
		const memoManager = new MemoManager(this.app)
		const migrator = new PathMigrator(this.app, vaultHandler, memoManager)

		// ! マイグレーション計画を作成。
		const notice = new Notice("変換計画を作成中...", 0)
		try {
			// ! メモ分割マイグレーションを使用。
			const memoMappings = await migrator.planMemoSplitMigration(
				settings.rootDirectory,
				settings.pathFormat,
				settings.useDirectoryCategory,
				settings.defaultCategory,
			)

			notice.hide()

			if (memoMappings.length === 0) {
				new Notice("変換対象のファイルがありません。")
				return
			}

			// ! メモマッピングを通常のPathMapping形式に変換（モーダル表示用）。
			const displayMappings = this.convertMemoMappingsToPathMappings(memoMappings)

			// ! 確認モーダルを表示。
			const modal = new MigrationConfirmModal(
				this.app,
				settings.rootDirectory,
				displayMappings,
				this.initialPathFormat,
				settings.pathFormat,
				this.plugin.settingsManager,
				async (createBackup: boolean) => {
					const progressNotice = new Notice("ファイルを変換中...", 0)

					try {
						// ! メモ分割マイグレーションを実行。
						const result = await migrator.executeMemoSplitMigration(
							memoMappings,
							createBackup,
						)

						progressNotice.hide()

						// ! 結果を表示。
						const resultModal = new MigrationResultModal(this.app, result)
						resultModal.open()

						// ! 成功した場合は初期値を更新。
						if (result.successCount > 0) {
							this.initialPathFormat = settings.pathFormat
							this.initialUseDirectoryCategory = settings.useDirectoryCategory

							// ! 変換ボタンを無効化。
							if (this.migrationButton) {
								this.migrationButton.disabled = true
								this.migrationButton.removeClass("mod-cta")
							}
						}
					} catch (error) {
						progressNotice.hide()
						new Notice(
							`❌ 変換エラー: ${error instanceof Error ? error.message : "Unknown error"}`,
						)
					}
				},
			)

			modal.open()
		} catch (error) {
			notice.hide()
			new Notice(
				`❌ 計画作成エラー: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}

	// ! ルートディレクトリ移行ダイアログを表示。
	private async showRootDirectoryMigrationDialog() {
		const settings = this.plugin.settingsManager.getGlobalSettings()
		const migrator = new RootDirectoryMigrator(this.app)

		// ! ルートディレクトリが変更されているか確認。
		if (settings.rootDirectory === this.initialRootDirectory) {
			new Notice("ルートディレクトリが変更されていません。")
			return
		}

		// ! 旧ルートディレクトリの存在確認。
		const oldFolder = this.app.vault.getAbstractFileByPath(this.initialRootDirectory)
		if (!oldFolder) {
			new Notice(
				`旧ルートディレクトリ「${this.initialRootDirectory}」が見つかりません。\n` +
					`新しいルートディレクトリ「${settings.rootDirectory}」を使用する場合は、` +
					`既に移行されているか、データがない状態です。`,
				8000,
			)
			// ! 初期値を更新してボタンを無効化。
			this.initialRootDirectory = settings.rootDirectory
			if (this.rootDirectoryMigrationButton) {
				this.rootDirectoryMigrationButton.disabled = true
				this.rootDirectoryMigrationButton.removeClass("mod-cta")
			}
			return
		}

		// ! 移行計画を作成。
		const notice = new Notice("移行計画を作成中...", 0)
		try {
			const mappings = await migrator.calculateMappings(
				this.initialRootDirectory,
				settings.rootDirectory,
			)

			notice.hide()

			if (mappings.length === 0) {
				new Notice(
					`旧ルートディレクトリ「${this.initialRootDirectory}」に移行対象のファイルがありません。\n` +
						`ディレクトリは空か、既にファイルが移行されています。`,
					6000,
				)
				// ! 初期値を更新してボタンを無効化。
				this.initialRootDirectory = settings.rootDirectory
				if (this.rootDirectoryMigrationButton) {
					this.rootDirectoryMigrationButton.disabled = true
					this.rootDirectoryMigrationButton.removeClass("mod-cta")
				}
				return
			}

			// ! 確認モーダルを表示。
			const modal = new RootDirectoryMigrationConfirmModal(
				this.app,
				this.initialRootDirectory,
				settings.rootDirectory,
				mappings,
				this.plugin.settingsManager,
				async (_createBackup: boolean) => {
					const progressNotice = new Notice("ファイルを移行中...", 0)

					try {
						// ! 移行を実行。
						const result = await migrator.migrate(mappings, (current, total) => {
							progressNotice.setMessage(`ファイルを移行中... (${current}/${total})`)
						})

						progressNotice.hide()

						// ! 旧ディレクトリのクリーンアップ。
						await migrator.cleanupOldDirectory(this.initialRootDirectory)

						// ! 結果を表示。
						const resultModal = new RootDirectoryMigrationResultModal(this.app, result)
						resultModal.open()

						// ! 成功した場合は初期値を更新。
						if (result.movedCount > 0) {
							this.initialRootDirectory = settings.rootDirectory

							// ! 変更ボタンを無効化。
							if (this.rootDirectoryMigrationButton) {
								this.rootDirectoryMigrationButton.disabled = true
								this.rootDirectoryMigrationButton.removeClass("mod-cta")
							}

							// ! サイドバーを再描画。
							this.refreshSidebar()
						}
					} catch (error) {
						progressNotice.hide()
						new Notice(
							`❌ 移行エラー: ${error instanceof Error ? error.message : "Unknown error"}`,
						)
					}
				},
			)

			modal.open()
		} catch (error) {
			notice.hide()
			new Notice(
				`❌ 計画作成エラー: ${error instanceof Error ? error.message : "Unknown error"}`,
			)
		}
	}
}
