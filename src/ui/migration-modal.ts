import { App, Modal, Notice, Setting } from "obsidian";
import { PathMapping, MigrationResult } from "../utils/path-migrator";
import { BackupManager, BackupMetadata } from "../utils/backup-manager";
import { SettingsManager } from "../core/settings";

//! マイグレーション確認モーダル。
export class MigrationConfirmModal extends Modal {
	private mappings: PathMapping[];
	private rootDir: string;
	private backupManager: BackupManager;
	private settingsManager: SettingsManager;
	private onConfirm: (createBackup: boolean) => Promise<void>;
	private isGitRepo: boolean;
	private oldPathFormat: string;
	private newPathFormat: string;
	private addToGitignore: boolean = false;

	constructor(
		app: App,
		rootDir: string,
		mappings: PathMapping[],
		oldPathFormat: string,
		newPathFormat: string,
		settingsManager: SettingsManager,
		onConfirm: (createBackup: boolean) => Promise<void>
	) {
		super(app);
		this.rootDir = rootDir;
		this.mappings = mappings;
		this.oldPathFormat = oldPathFormat;
		this.newPathFormat = newPathFormat;
		this.settingsManager = settingsManager;
		this.onConfirm = onConfirm;
		this.backupManager = new BackupManager(app);
		this.isGitRepo = false;
	}

	override async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("memolog-migration-modal");

		//! タイトル。
		contentEl.createEl("h2", { text: "ファイルパス変換の確認" });

		//! Git判定。
		this.isGitRepo = await this.backupManager.isGitRepository();

		//! 概要説明。
		const descDiv = contentEl.createDiv({ cls: "migration-description" });
		descDiv.createEl("p", {
			text: "ファイルパス書式の変更により、既存のファイルを新しい構造に変換します。",
		});

		//! 書式変換の情報。
		const formatDiv = contentEl.createDiv({ cls: "migration-format-info" });
		formatDiv.createEl("h3", { text: "書式の変換" });

		const formatTable = formatDiv.createEl("div", { cls: "format-conversion-table" });

		const oldFormatRow = formatTable.createEl("div", { cls: "format-row" });
		oldFormatRow.createEl("span", { text: "変換前:", cls: "format-label" });
		oldFormatRow.createEl("code", { text: this.oldPathFormat, cls: "format-value old-format" });

		const arrowRow = formatTable.createEl("div", { cls: "format-arrow" });
		arrowRow.createEl("span", { text: "↓" });

		const newFormatRow = formatTable.createEl("div", { cls: "format-row" });
		newFormatRow.createEl("span", { text: "変換後:", cls: "format-label" });
		newFormatRow.createEl("code", { text: this.newPathFormat, cls: "format-value new-format" });

		//! 統計情報。
		const statsDiv = contentEl.createDiv({ cls: "migration-stats" });
		const totalCount = this.mappings.length;
		const conflictCount = this.mappings.filter((m) => m.hasConflict).length;
		const validCount = totalCount - conflictCount;

		statsDiv.createEl("p", { text: `対象ファイル: ${totalCount}個` });
		statsDiv.createEl("p", {
			text: `変換予定: ${validCount}個`,
			cls: validCount > 0 ? "stat-success" : "",
		});

		if (conflictCount > 0) {
			statsDiv.createEl("p", {
				text: `競合あり: ${conflictCount}個（スキップされます）`,
				cls: "stat-warning",
			});
		}

		//! 変換例を表示（最初の5件）。
		if (validCount > 0) {
			const examplesDiv = contentEl.createDiv({ cls: "migration-examples" });
			examplesDiv.createEl("h3", { text: "変換例" });

			const exampleList = examplesDiv.createEl("ul");
			const validMappings = this.mappings.filter((m) => !m.hasConflict);

			for (let i = 0; i < Math.min(5, validMappings.length); i++) {
				const mapping = validMappings[i];
				const item = exampleList.createEl("li");
				item.createEl("div", {
					text: `変換前: ${mapping.oldPath}`,
					cls: "path-old",
				});
				item.createEl("div", {
					text: `変換後: ${mapping.newPath}`,
					cls: "path-new",
				});
			}

			if (validMappings.length > 5) {
				examplesDiv.createEl("p", {
					text: `他 ${validMappings.length - 5}件...`,
					cls: "more-info",
				});
			}
		}

		//! 競合がある場合の警告。
		if (conflictCount > 0) {
			const conflictDiv = contentEl.createDiv({ cls: "migration-conflicts" });
			conflictDiv.createEl("h3", { text: "⚠️ 競合の詳細" });
			conflictDiv.createEl("p", {
				text: "以下のファイルは同じパスに変換されるため、スキップされます:",
			});

			const conflictList = conflictDiv.createEl("ul");
			const conflictMappings = this.mappings.filter((m) => m.hasConflict);

			for (const mapping of conflictMappings.slice(0, 10)) {
				conflictList.createEl("li", { text: mapping.oldPath });
			}

			if (conflictMappings.length > 10) {
				conflictDiv.createEl("p", {
					text: `他 ${conflictMappings.length - 10}件...`,
					cls: "more-info",
				});
			}
		}

		//! バックアップに関する情報。
		const backupDiv = contentEl.createDiv({ cls: "migration-backup-info" });
		backupDiv.createEl("h3", { text: "バックアップについて" });

		if (this.isGitRepo) {
			backupDiv.createEl("p", {
				text: "✓ このVaultはGit管理されています。Gitでバックアップされている場合、ZIPバックアップは不要かもしれません。",
				cls: "info-git",
			});
		} else {
			backupDiv.createEl("p", {
				text: "⚠️ このVaultはGit管理されていません。ZIPバックアップを作成することを強く推奨します。",
				cls: "warning-no-git",
			});
		}

		backupDiv.createEl("p", {
			text: `バックアップ対象: ${this.rootDir}ディレクトリ全体`,
		});

		//! .gitignoreチェックボックス（Gitリポジトリの場合のみ）。
		if (this.isGitRepo) {
			new Setting(backupDiv)
				.setName("backup-memolog-*.zipを.gitignoreに追加")
				.setDesc("バックアップファイルをGit管理から除外します")
				.addToggle((toggle) =>
					toggle.setValue(this.addToGitignore).onChange((value) => {
						this.addToGitignore = value;
					})
				);
		}

		//! ボタン群。
		const buttonDiv = contentEl.createDiv({ cls: "migration-buttons" });

		//! バックアップして変換ボタン。
		new Setting(buttonDiv)
			.addButton((btn) =>
				btn
					.setButtonText("バックアップして変換")
					.setCta()
					.onClick(async () => {
						await this.executeWithBackup();
					})
			)
			.addButton((btn) =>
				btn.setButtonText("バックアップせずに変換").onClick(async () => {
					await this.executeWithoutBackup();
				})
			)
			.addButton((btn) =>
				btn.setButtonText("キャンセル").onClick(() => {
					this.close();
				})
			);

		//! 注意事項。
		const noteDiv = contentEl.createDiv({ cls: "migration-notes" });
		noteDiv.createEl("h4", { text: "注意事項" });
		noteDiv.createEl("ul").innerHTML = `
			<li>変換処理は元に戻せません。必要に応じてバックアップを作成してください。</li>
			<li>変換中は他の操作を行わないでください。</li>
			<li>競合するファイルはスキップされます。手動で対応してください。</li>
			<li>大量のファイルがある場合、処理に時間がかかることがあります。</li>
		`;
	}

	//! バックアップして変換を実行。
	private async executeWithBackup() {
		const notice = new Notice("バックアップを作成中...", 0);

		try {
			//! 設定ファイルに古いpathFormatを一時的に書き込む。
			await this.settingsManager.updateGlobalSettings({
				pathFormat: this.oldPathFormat,
			});

			//! バックアップ作成。
			const result = await this.backupManager.createZipBackup(this.rootDir);

			//! 設定ファイルを新しいpathFormatに戻す。
			await this.settingsManager.updateGlobalSettings({
				pathFormat: this.newPathFormat,
			});

			if (!result.success) {
				notice.hide();
				new Notice(`❌ バックアップ失敗: ${result.error}`);
				return;
			}

			//! バックアップメタデータを保存。
			const metadata: BackupMetadata = {
				timestamp: new Date().toISOString(),
				oldPathFormat: this.oldPathFormat,
				newPathFormat: this.newPathFormat,
				backupPath: result.backupPath,
				targetDirectory: this.rootDir,
			};
			await this.backupManager.saveMetadata(metadata);

			//! .gitignoreに追加（チェックされている場合）。
			if (this.addToGitignore) {
				const gitignoreSuccess = await this.backupManager.addToGitignore(
					"backup-memolog-*.zip"
				);
				if (gitignoreSuccess) {
					console.log(".gitignoreにbackup-memolog-*.zipを追加しました");
				}
			}

			notice.hide();
			new Notice(
				`✓ バックアップ作成完了: ${result.backupPath} (${result.fileCount}ファイル)`
			);

			//! 変換実行。
			await this.onConfirm(true);
			this.close();
		} catch (error) {
			notice.hide();
			new Notice(`❌ エラー: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	//! バックアップせずに変換を実行。
	private async executeWithoutBackup() {
		//! 確認ダイアログ。
		const confirmed = confirm(
			"本当にバックアップなしで変換を実行しますか？この操作は元に戻せません。"
		);

		if (!confirmed) {
			return;
		}

		try {
			await this.onConfirm(false);
			this.close();
		} catch (error) {
			new Notice(`❌ エラー: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

//! マイグレーション結果表示モーダル。
export class MigrationResultModal extends Modal {
	private result: MigrationResult;

	constructor(app: App, result: MigrationResult) {
		super(app);
		this.result = result;
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("memolog-migration-result-modal");

		//! タイトル。
		contentEl.createEl("h2", { text: "変換結果" });

		//! 統計情報。
		const statsDiv = contentEl.createDiv({ cls: "result-stats" });
		statsDiv.createEl("p", {
			text: `✓ 成功: ${this.result.successCount}件`,
			cls: "stat-success",
		});

		if (this.result.skippedCount > 0) {
			statsDiv.createEl("p", {
				text: `⊘ スキップ: ${this.result.skippedCount}件`,
				cls: "stat-skipped",
			});
		}

		if (this.result.failureCount > 0) {
			statsDiv.createEl("p", {
				text: `✗ 失敗: ${this.result.failureCount}件`,
				cls: "stat-failure",
			});
		}

		//! 警告。
		if (this.result.warnings.length > 0) {
			const warningDiv = contentEl.createDiv({ cls: "result-warnings" });
			warningDiv.createEl("h3", { text: "警告" });

			const warningList = warningDiv.createEl("ul");
			for (const warning of this.result.warnings.slice(0, 10)) {
				warningList.createEl("li", { text: warning });
			}

			if (this.result.warnings.length > 10) {
				warningDiv.createEl("p", {
					text: `他 ${this.result.warnings.length - 10}件...`,
					cls: "more-info",
				});
			}
		}

		//! エラー。
		if (this.result.errors.length > 0) {
			const errorDiv = contentEl.createDiv({ cls: "result-errors" });
			errorDiv.createEl("h3", { text: "エラー" });

			const errorList = errorDiv.createEl("ul");
			for (const error of this.result.errors.slice(0, 10)) {
				errorList.createEl("li", { text: error });
			}

			if (this.result.errors.length > 10) {
				errorDiv.createEl("p", {
					text: `他 ${this.result.errors.length - 10}件...`,
					cls: "more-info",
				});
			}
		}

		//! 閉じるボタン。
		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("閉じる")
				.setCta()
				.onClick(() => {
					this.close();
				})
		);
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
