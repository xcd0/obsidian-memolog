import { App, Modal, Notice, Setting } from "obsidian";
import { BackupManager } from "../utils/backup-manager";

//! バックアップリストアモーダル。
export class RestoreBackupModal extends Modal {
	private backupManager: BackupManager;
	private targetDirectory: string;
	private onRestore: () => void;

	constructor(app: App, targetDirectory: string, onRestore: () => void) {
		super(app);
		this.targetDirectory = targetDirectory;
		this.backupManager = new BackupManager(app);
		this.onRestore = onRestore;
	}

	override async onOpen() {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		contentEl.addClass("memolog-restore-modal");

		//! モーダルのサイズを大きくする。
		modalEl.style.width = "800px";
		modalEl.style.maxWidth = "90vw";

		//! タイトル。
		contentEl.createEl("h2", { text: "バックアップからリストア" });

		//! バックアップ一覧を取得。
		const notice = new Notice("バックアップ一覧を読み込み中...", 0);
		const backups = await this.backupManager.listBackupsWithMetadata();
		notice.hide();

		if (backups.length === 0) {
			contentEl.createEl("p", {
				text: "バックアップが見つかりません。",
				cls: "restore-no-backups",
			});

			new Setting(contentEl).addButton((btn) =>
				btn
					.setButtonText("閉じる")
					.setCta()
					.onClick(() => {
						this.close();
					})
			);

			return;
		}

		//! 説明。
		const descDiv = contentEl.createDiv({ cls: "restore-description" });
		descDiv.createEl("p", {
			text: `リストアすると、${this.targetDirectory}ディレクトリの内容が選択したバックアップの状態に復元されます。`,
		});

		descDiv.createEl("p", {
			text: "⚠️ 現在のデータは失われます（設定ファイルは除く）。必要に応じて事前にバックアップを作成してください。",
			cls: "restore-warning",
		});

		//! バックアップテーブル。
		const tableDiv = contentEl.createDiv({ cls: "restore-table-container" });
		const table = tableDiv.createEl("table", { cls: "restore-table" });

		//! ヘッダー。
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "選択" });
		headerRow.createEl("th", { text: "作成日時" });
		headerRow.createEl("th", { text: "変換前" });
		headerRow.createEl("th", { text: "変換後" });
		headerRow.createEl("th", { text: "ファイル" });

		//! ボディ。
		const tbody = table.createEl("tbody");
		let selectedBackup: string | null = null;

		for (const backup of backups) {
			const row = tbody.createEl("tr", { cls: "restore-row" });

			//! ラジオボタン。
			const radioCell = row.createEl("td");
			const radio = radioCell.createEl("input", { type: "radio", attr: { name: "backup" } });

			//! 日時。
			const timestamp = backup.metadata?.timestamp
				? new Date(backup.metadata.timestamp).toLocaleString("ja-JP")
				: backup.file.stat.mtime
					? new Date(backup.file.stat.mtime).toLocaleString("ja-JP")
					: "不明";
			row.createEl("td", { text: timestamp });

			//! 変換前。
			const oldFormat = backup.metadata?.oldPathFormat || "不明";
			row.createEl("td", { text: oldFormat, cls: "restore-format" });

			//! 変換後。
			const newFormat = backup.metadata?.newPathFormat || "不明";
			row.createEl("td", { text: newFormat, cls: "restore-format" });

			//! ファイル名。
			row.createEl("td", { text: backup.file.name, cls: "restore-filename" });

			//! 行クリックで選択。
			row.addEventListener("click", () => {
				tbody.querySelectorAll(".restore-row").forEach((r) => {
					r.removeClass("restore-row-selected");
					const radioInput = r.querySelector('input[type="radio"]') as HTMLInputElement;
					if (radioInput) radioInput.checked = false;
				});

				row.addClass("restore-row-selected");
				radio.checked = true;
				selectedBackup = backup.file.path;
			});
		}

		//! ボタン群。
		const buttonDiv = contentEl.createDiv({ cls: "restore-buttons" });

		new Setting(buttonDiv)
			.addButton((btn) =>
				btn
					.setButtonText("リストア実行")
					.setCta()
					.onClick(async () => {
						if (!selectedBackup) {
							new Notice("バックアップを選択してください。");
							return;
						}

						await this.executeRestore(selectedBackup);
					})
			)
			.addButton((btn) =>
				btn.setButtonText("キャンセル").onClick(() => {
					this.close();
				})
			);
	}

	//! リストアを実行。
	private async executeRestore(zipPath: string): Promise<void> {
		//! 確認ダイアログ。
		const confirmed = confirm(
			`本当にリストアを実行しますか？\n\n現在の${this.targetDirectory}ディレクトリの内容は削除され、バックアップの状態に復元されます。\n\nこの操作は元に戻せません。`
		);

		if (!confirmed) {
			return;
		}

		const notice = new Notice("リストア中...", 0);

		try {
			const result = await this.backupManager.restoreFromZip(zipPath, this.targetDirectory);

			notice.hide();

			if (result.success) {
				new Notice(`✓ リストア完了: ${result.fileCount}ファイルを復元しました。`);
				this.onRestore();
				this.close();
			} else {
				new Notice(`❌ リストア失敗: ${result.error}`);
			}
		} catch (error) {
			notice.hide();
			new Notice(`❌ リストアエラー: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
