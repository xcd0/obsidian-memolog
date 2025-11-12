import { App, Modal, Notice, Setting } from "obsidian"
import { SettingsManager } from "../core/settings"
import { BackupManager, BackupMetadata } from "../utils/backup-manager"
import { Logger } from "../utils/logger"
import {
	FileMapping,
	RootDirectoryMigrationResult,
} from "../utils/root-directory-migrator"

// ! ルートディレクトリ移行確認モーダル。
export class RootDirectoryMigrationConfirmModal extends Modal {
	private mappings: FileMapping[]
	private oldRootDir: string
	private newRootDir: string
	private backupManager: BackupManager
	private settingsManager: SettingsManager
	private onConfirm: (createBackup: boolean) => Promise<void>
	private onCancel?: () => void
	private isGitRepo: boolean
	private addToGitignore: boolean = false
	private migrationExecuted: boolean = false

	constructor(
		app: App,
		oldRootDir: string,
		newRootDir: string,
		mappings: FileMapping[],
		settingsManager: SettingsManager,
		onConfirm: (createBackup: boolean) => Promise<void>,
		onCancel?: () => void,
	) {
		super(app)
		this.oldRootDir = oldRootDir
		this.newRootDir = newRootDir
		this.mappings = mappings
		this.settingsManager = settingsManager
		this.onConfirm = onConfirm
		this.onCancel = onCancel
		this.backupManager = new BackupManager(app)
		this.isGitRepo = false
	}

	override async onOpen() {
		const { contentEl, modalEl } = this
		contentEl.empty()
		contentEl.addClass("memolog-migration-modal")

		// ! モーダルのサイズを大きくする。
		modalEl.style.width = "800px"
		modalEl.style.maxWidth = "90vw"

		// ! タイトル。
		contentEl.createEl("h2", { text: "ルートディレクトリ移行の確認" })

		// ! Git判定。
		this.isGitRepo = await this.backupManager.isGitRepository()

		// ! 概要説明。
		const descDiv = contentEl.createDiv({ cls: "migration-description" })
		descDiv.createEl("p", {
			text: "ルートディレクトリの変更により、既存のファイルを新しいディレクトリに移動します。",
		})

		// ! ディレクトリ移行の情報。
		const dirDiv = contentEl.createDiv({ cls: "migration-format-info" })
		dirDiv.createEl("h3", { text: "ディレクトリの変更" })

		const dirTable = dirDiv.createEl("div", { cls: "format-conversion-table" })

		const oldDirRow = dirTable.createEl("div", { cls: "format-row" })
		oldDirRow.createEl("span", { text: "移行前:", cls: "format-label" })
		oldDirRow.createEl("code", { text: this.oldRootDir, cls: "format-value old-format" })

		const arrowRow = dirTable.createEl("div", { cls: "format-arrow" })
		arrowRow.createEl("span", { text: "↓" })

		const newDirRow = dirTable.createEl("div", { cls: "format-row" })
		newDirRow.createEl("span", { text: "移行後:", cls: "format-label" })
		newDirRow.createEl("code", { text: this.newRootDir, cls: "format-value new-format" })

		// ! 統計情報。
		const statsDiv = contentEl.createDiv({ cls: "migration-stats" })
		const totalCount = this.mappings.length
		const conflictCount = this.mappings.filter(m => m.hasConflict).length
		const validCount = totalCount - conflictCount

		statsDiv.createEl("p", { text: `対象ファイル: ${totalCount}個` })
		statsDiv.createEl("p", {
			text: `移動予定: ${validCount}個`,
			cls: validCount > 0 ? "stat-success" : "",
		})

		if (conflictCount > 0) {
			statsDiv.createEl("p", {
				text: `競合あり: ${conflictCount}個（スキップされます）`,
				cls: "stat-warning",
			})
		}

		// ! 移動予定を表示（全件）。
		if (validCount > 0) {
			const examplesDiv = contentEl.createDiv({ cls: "migration-examples" })
			examplesDiv.createEl("h3", { text: "移動予定一覧" })

			// ! スクロール可能なテーブルコンテナ。
			const tableContainer = examplesDiv.createDiv({ cls: "migration-table-container" })
			tableContainer.style.maxHeight = "400px"
			tableContainer.style.overflowY = "auto"
			tableContainer.style.border = "1px solid var(--background-modifier-border)"
			tableContainer.style.borderRadius = "4px"

			const table = tableContainer.createEl("table", { cls: "migration-table" })
			table.style.width = "100%"
			table.style.borderCollapse = "collapse"

			// ! ヘッダー。
			const thead = table.createEl("thead")
			const headerRow = thead.createEl("tr")
			headerRow.createEl("th", {
				text: "移行前",
				attr: {
					style:
						"padding: 8px; border-bottom: 2px solid var(--background-modifier-border); text-align: left; position: sticky; top: 0; background: var(--background-primary);",
				},
			})
			headerRow.createEl("th", {
				text: "移行後",
				attr: {
					style:
						"padding: 8px; border-bottom: 2px solid var(--background-modifier-border); text-align: left; position: sticky; top: 0; background: var(--background-primary);",
				},
			})

			// ! ボディ（全件表示）。
			const tbody = table.createEl("tbody")
			const validMappings = this.mappings.filter(m => !m.hasConflict)

			for (const mapping of validMappings) {
				const row = tbody.createEl("tr")
				row.createEl("td", {
					text: mapping.oldPath,
					attr: {
						style:
							"padding: 8px; border-bottom: 1px solid var(--background-modifier-border); font-family: monospace; font-size: 0.9em;",
					},
				})
				row.createEl("td", {
					text: mapping.newPath,
					attr: {
						style:
							"padding: 8px; border-bottom: 1px solid var(--background-modifier-border); font-family: monospace; font-size: 0.9em;",
					},
				})
			}
		}

		// ! 競合がある場合の警告。
		if (conflictCount > 0) {
			const conflictDiv = contentEl.createDiv({ cls: "migration-conflicts" })
			conflictDiv.createEl("h3", { text: "⚠️ 競合の詳細" })
			conflictDiv.createEl("p", {
				text: "以下のファイルは同じパスに移動されるため、スキップされます:",
			})

			const conflictList = conflictDiv.createEl("ul")
			const conflictMappings = this.mappings.filter(m => m.hasConflict)

			for (const mapping of conflictMappings.slice(0, 10)) {
				conflictList.createEl("li", { text: mapping.oldPath })
			}

			if (conflictMappings.length > 10) {
				conflictDiv.createEl("p", {
					text: `他 ${conflictMappings.length - 10}件...`,
					cls: "more-info",
				})
			}
		}

		// ! バックアップに関する情報。
		const backupDiv = contentEl.createDiv({ cls: "migration-backup-info" })
		backupDiv.createEl("h3", { text: "バックアップについて" })

		if (this.isGitRepo) {
			backupDiv.createEl("p", {
				text: "✓ このVaultはGit管理されています。Gitでバックアップされている場合、ZIPバックアップは不要かもしれません。",
				cls: "info-git",
			})
		} else {
			backupDiv.createEl("p", {
				text: "⚠️ このVaultはGit管理されていません。ZIPバックアップを作成することを強く推奨します。",
				cls: "warning-no-git",
			})
		}

		backupDiv.createEl("p", {
			text: `バックアップ対象: ${this.oldRootDir}ディレクトリ全体`,
		})

		// ! .gitignoreチェックボックス（Gitリポジトリの場合のみ）。
		if (this.isGitRepo) {
			new Setting(backupDiv)
				.setName("backup-memolog-*.zipを.gitignoreに追加")
				.setDesc("バックアップファイルをGit管理から除外します")
				.addToggle(toggle =>
					toggle.setValue(this.addToGitignore).onChange(value => {
						this.addToGitignore = value
					})
				)
		}

		// ! ボタン群。
		const buttonDiv = contentEl.createDiv({ cls: "migration-buttons" })

		// ! バックアップして移行ボタン。
		new Setting(buttonDiv)
			.addButton(btn =>
				btn
					.setButtonText("バックアップして移行")
					.setCta()
					.onClick(async () => {
						await this.executeWithBackup()
					})
			)
			.addButton(btn =>
				btn.setButtonText("バックアップのみ").onClick(async () => {
					await this.executeBackupOnly()
				})
			)
			.addButton(btn =>
				btn.setButtonText("バックアップせずに移行").onClick(async () => {
					await this.executeWithoutBackup()
				})
			)
			.addButton(btn =>
				btn.setButtonText("キャンセル").onClick(() => {
					this.close()
				})
			)

		// ! 注意事項。
		const noteDiv = contentEl.createDiv({ cls: "migration-notes" })
		noteDiv.createEl("h4", { text: "注意事項" })
		noteDiv.createEl("ul").innerHTML = `
			<li>移行処理は元に戻せません。必要に応じてバックアップを作成してください。</li>
			<li>移行中は他の操作を行わないでください。</li>
			<li>競合するファイルはスキップされます。手動で対応してください。</li>
			<li>大量のファイルがある場合、処理に時間がかかることがあります。</li>
		`
	}

	// ! バックアップして移行を実行。
	private async executeWithBackup() {
		const notice = new Notice("バックアップを作成中...", 0)

		try {
			// ! 設定ファイルに古いrootDirectoryを一時的に書き込む。
			await this.settingsManager.updateGlobalSettings({
				rootDirectory: this.oldRootDir,
			})

			// ! バックアップ作成。
			const result = await this.backupManager.createZipBackup(this.oldRootDir)

			// ! 設定ファイルを新しいrootDirectoryに戻す。
			await this.settingsManager.updateGlobalSettings({
				rootDirectory: this.newRootDir,
			})

			if (!result.success) {
				notice.hide()
				new Notice(`❌ バックアップ失敗: ${result.error}`)
				return
			}

			// ! バックアップメタデータを保存。
			const metadata: BackupMetadata = {
				timestamp: new Date().toISOString(),
				oldPathFormat: this.oldRootDir,
				newPathFormat: this.newRootDir,
				backupPath: result.backupPath,
				targetDirectory: this.oldRootDir,
			}
			await this.backupManager.saveMetadata(metadata)

			// ! .gitignoreに追加（チェックされている場合）。
			if (this.addToGitignore) {
				const gitignoreSuccess = await this.backupManager.addToGitignore(
					"backup-memolog-*.zip",
				)
				if (gitignoreSuccess) {
					Logger.info(".gitignoreにbackup-memolog-*.zipを追加しました")
				}
			}

			notice.hide()
			new Notice(
				`✓ バックアップ作成完了: ${result.backupPath} (${result.fileCount}ファイル)`,
			)

			// ! 移行実行。
			this.migrationExecuted = true
			await this.onConfirm(true)
			this.close()
		} catch (error) {
			notice.hide()
			new Notice(`❌ エラー: ${error instanceof Error ? error.message : "Unknown error"}`)
		}
	}

	// ! バックアップのみを実行。
	private async executeBackupOnly() {
		const notice = new Notice("バックアップを作成中...", 0)

		try {
			// ! 設定ファイルに古いrootDirectoryを一時的に書き込む。
			await this.settingsManager.updateGlobalSettings({
				rootDirectory: this.oldRootDir,
			})

			// ! バックアップ作成。
			const result = await this.backupManager.createZipBackup(this.oldRootDir)

			// ! 設定ファイルを新しいrootDirectoryに戻す。
			await this.settingsManager.updateGlobalSettings({
				rootDirectory: this.newRootDir,
			})

			if (!result.success) {
				notice.hide()
				new Notice(`❌ バックアップ失敗: ${result.error}`)
				return
			}

			// ! バックアップメタデータを保存。
			const metadata: BackupMetadata = {
				timestamp: new Date().toISOString(),
				oldPathFormat: this.oldRootDir,
				newPathFormat: this.newRootDir,
				backupPath: result.backupPath,
				targetDirectory: this.oldRootDir,
			}
			await this.backupManager.saveMetadata(metadata)

			// ! .gitignoreに追加(チェックされている場合)。
			if (this.addToGitignore) {
				const gitignoreSuccess = await this.backupManager.addToGitignore(
					"backup-memolog-*.zip",
				)
				if (gitignoreSuccess) {
					Logger.info(".gitignoreにbackup-memolog-*.zipを追加しました")
				}
			}

			notice.hide()
			new Notice(
				`✓ バックアップ作成完了: ${result.backupPath} (${result.fileCount}ファイル)`,
			)

			// ! 移行は実行せずにモーダルを閉じる。
			this.close()
		} catch (error) {
			notice.hide()
			new Notice(`❌ エラー: ${error instanceof Error ? error.message : "Unknown error"}`)
		}
	}

	// ! バックアップせずに移行を実行。
	private async executeWithoutBackup() {
		// ! 確認ダイアログ。
		const confirmed = confirm(
			"本当にバックアップなしで移行を実行しますか？この操作は元に戻せません。",
		)

		if (!confirmed) {
			return
		}

		try {
			this.migrationExecuted = true
			await this.onConfirm(false)
			this.close()
		} catch (error) {
			new Notice(`❌ エラー: ${error instanceof Error ? error.message : "Unknown error"}`)
		}
	}

	override onClose() {
		const { contentEl } = this
		contentEl.empty()

		// ! 移行が実行されなかった場合（キャンセルまたはバックアップのみ）、キャンセルコールバックを呼ぶ。
		if (!this.migrationExecuted && this.onCancel) {
			this.onCancel()
		}
	}
}

// ! ルートディレクトリ移行結果表示モーダル。
export class RootDirectoryMigrationResultModal extends Modal {
	private result: RootDirectoryMigrationResult

	constructor(app: App, result: RootDirectoryMigrationResult) {
		super(app)
		this.result = result
	}

	override onOpen() {
		const { contentEl, modalEl } = this
		contentEl.empty()
		contentEl.addClass("memolog-migration-result-modal")

		// ! モーダルのサイズを大きくする。
		modalEl.style.width = "800px"
		modalEl.style.maxWidth = "90vw"

		// ! タイトル。
		contentEl.createEl("h2", { text: "移行結果" })

		// ! 統計情報。
		const statsDiv = contentEl.createDiv({ cls: "result-stats" })
		statsDiv.createEl("p", {
			text: `✓ 成功: ${this.result.movedCount}件`,
			cls: "stat-success",
		})

		if (this.result.warnings.length > 0) {
			statsDiv.createEl("p", {
				text: `⊘ スキップ: ${this.result.warnings.length}件`,
				cls: "stat-skipped",
			})
		}

		if (this.result.errors.length > 0) {
			statsDiv.createEl("p", {
				text: `✗ 失敗: ${this.result.errors.length}件`,
				cls: "stat-failure",
			})
		}

		// ! 警告。
		if (this.result.warnings.length > 0) {
			const warningDiv = contentEl.createDiv({ cls: "result-warnings" })
			warningDiv.createEl("h3", { text: "警告" })

			const warningList = warningDiv.createEl("ul")
			for (const warning of this.result.warnings.slice(0, 10)) {
				warningList.createEl("li", { text: warning })
			}

			if (this.result.warnings.length > 10) {
				warningDiv.createEl("p", {
					text: `他 ${this.result.warnings.length - 10}件...`,
					cls: "more-info",
				})
			}
		}

		// ! エラー。
		if (this.result.errors.length > 0) {
			const errorDiv = contentEl.createDiv({ cls: "result-errors" })
			errorDiv.createEl("h3", { text: "エラー" })

			const errorList = errorDiv.createEl("ul")
			for (const error of this.result.errors.slice(0, 10)) {
				errorList.createEl("li", { text: error })
			}

			if (this.result.errors.length > 10) {
				errorDiv.createEl("p", {
					text: `他 ${this.result.errors.length - 10}件...`,
					cls: "more-info",
				})
			}
		}

		// ! 閉じるボタン。
		new Setting(contentEl).addButton(btn =>
			btn
				.setButtonText("閉じる")
				.setCta()
				.onClick(() => {
					this.close()
				})
		)
	}

	override onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
