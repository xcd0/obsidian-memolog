import { App, TFile, TFolder } from "obsidian";
import JSZip from "jszip";

//! バックアップ結果。
export interface BackupResult {
	//! バックアップファイルのパス。
	backupPath: string;
	//! バックアップしたファイル数。
	fileCount: number;
	//! バックアップサイズ（バイト）。
	size: number;
	//! 成功したか。
	success: boolean;
	//! エラーメッセージ。
	error?: string;
}

//! バックアップ管理クラス。
export class BackupManager {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	//! 指定ディレクトリをZIPバックアップする。
	async createZipBackup(targetDir: string, backupName?: string): Promise<BackupResult> {
		const result: BackupResult = {
			backupPath: "",
			fileCount: 0,
			size: 0,
			success: false,
		};

		try {
			//! バックアップ名を生成。
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const zipName = backupName || `backup-${targetDir.replace(/\//g, "-")}-${timestamp}.zip`;
			result.backupPath = zipName;

			//! JSZipインスタンスを作成。
			const zip = new JSZip();

			//! 対象ディレクトリ配下のファイルを取得。
			const folder = this.app.vault.getAbstractFileByPath(targetDir);

			if (!(folder instanceof TFolder)) {
				throw new Error(`Directory not found: ${targetDir}`);
			}

			//! 再帰的にファイルを追加。
			await this.addFolderToZip(zip, folder, targetDir);

			//! ZIPファイルを生成。
			const zipBlob = await zip.generateAsync({
				type: "uint8array",
				compression: "DEFLATE",
				compressionOptions: {
					level: 9,
				},
			});

			result.size = zipBlob.byteLength;

			//! ZIPファイルを保存（Uint8ArrayからArrayBufferを作成）。
			const buffer = zipBlob.buffer.slice(0) as ArrayBuffer;
			await this.app.vault.createBinary(zipName, buffer);

			//! ファイル数をカウント。
			result.fileCount = await this.countFiles(folder);
			result.success = true;

			return result;
		} catch (error) {
			result.success = false;
			result.error = error instanceof Error ? error.message : "Unknown error";
			return result;
		}
	}

	//! フォルダ内のファイルを再帰的にZIPに追加。
	private async addFolderToZip(zip: JSZip, folder: TFolder, baseDir: string): Promise<void> {
		for (const child of folder.children) {
			if (child instanceof TFile) {
				//! ファイルの場合。
				const relativePath = child.path.substring(baseDir.length + 1);
				const content = await this.app.vault.readBinary(child);
				zip.file(relativePath, content);
			} else if (child instanceof TFolder) {
				//! フォルダの場合は再帰的に処理。
				await this.addFolderToZip(zip, child, baseDir);
			}
		}
	}

	//! フォルダ内のファイル数をカウント。
	private async countFiles(folder: TFolder): Promise<number> {
		let count = 0;

		for (const child of folder.children) {
			if (child instanceof TFile) {
				count++;
			} else if (child instanceof TFolder) {
				count += await this.countFiles(child);
			}
		}

		return count;
	}

	//! Gitリポジトリかどうかを判定。
	async isGitRepository(): Promise<boolean> {
		//! .gitディレクトリの存在をチェック。
		const gitDir = this.app.vault.getAbstractFileByPath(".git");
		return gitDir instanceof TFolder;
	}

	//! バックアップ推奨メッセージを取得。
	async getBackupRecommendation(): Promise<string> {
		const isGit = await this.isGitRepository();

		if (isGit) {
			return "このVaultはGit管理されているようです。Gitでバックアップされている場合、ZIPバックアップは不要かもしれません。";
		} else {
			return "このVaultはGit管理されていないようです。ZIPバックアップを作成することを強く推奨します。";
		}
	}

	//! バックアップ一覧を取得。
	async listBackups(pattern = "backup-"): Promise<TFile[]> {
		const allFiles = this.app.vault.getFiles();
		return allFiles.filter((file) => file.name.startsWith(pattern) && file.name.endsWith(".zip"));
	}

	//! 古いバックアップを削除。
	async cleanOldBackups(maxBackups = 10, pattern = "backup-"): Promise<number> {
		const backups = await this.listBackups(pattern);

		//! 日付でソート（新しい順）。
		backups.sort((a, b) => b.stat.mtime - a.stat.mtime);

		//! 古いバックアップを削除。
		let deletedCount = 0;
		for (let i = maxBackups; i < backups.length; i++) {
			await this.app.vault.delete(backups[i]);
			deletedCount++;
		}

		return deletedCount;
	}

	//! バックアップからリストア（ZIPの中身を確認する機能）。
	async listZipContents(zipPath: string): Promise<string[]> {
		const file = this.app.vault.getAbstractFileByPath(zipPath);

		if (!(file instanceof TFile)) {
			throw new Error(`Backup file not found: ${zipPath}`);
		}

		const zipData = await this.app.vault.readBinary(file);
		const zip = await JSZip.loadAsync(zipData);

		const files: string[] = [];
		zip.forEach((relativePath, zipEntry) => {
			if (!zipEntry.dir) {
				files.push(relativePath);
			}
		});

		return files;
	}
}
