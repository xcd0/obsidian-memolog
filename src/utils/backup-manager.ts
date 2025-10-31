import { App, TFile, TFolder } from "obsidian";
import JSZip from "jszip";
import {
	generateBackupName,
	filterBackupFiles,
	getBackupRecommendationMessage,
	getMetadataPath,
	sortBackupsByDate,
	getOldBackupsToDelete,
} from "./backup-helpers";

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

//! バックアップメタデータ。
export interface BackupMetadata {
	//! バックアップ作成日時。
	timestamp: string;
	//! 変換前の書式。
	oldPathFormat: string;
	//! 変換後の書式。
	newPathFormat: string;
	//! バックアップファイルのパス。
	backupPath: string;
	//! 対象ディレクトリ。
	targetDirectory: string;
}

//! リストア結果。
export interface RestoreResult {
	//! 成功したか。
	success: boolean;
	//! リストアしたファイル数。
	fileCount: number;
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
			const zipName = backupName || generateBackupName(targetDir);
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
		try {
			//! Vault adapter経由でファイルシステムレベルで.gitディレクトリの存在をチェック。
			//! Obsidianの通常のAPI (.getAbstractFileByPath) は隠しファイルを返さないため、
			//! adapter.exists()を使用する。
			const adapter = this.app.vault.adapter;
			const gitPath = ".git";

			//! .gitディレクトリの存在確認。
			const exists = await adapter.exists(gitPath);

			if (!exists) {
				return false;
			}

			//! .gitがディレクトリかどうか確認（stat経由）。
			//! adapter.stat()で取得できればディレクトリとして判定。
			try {
				const stat = await adapter.stat(gitPath);
				return stat?.type === "folder";
			} catch {
				//! statが失敗した場合でもexistsがtrueなら、
				//! Gitリポジトリの可能性が高いと判断。
				return true;
			}
		} catch (error) {
			console.error("Failed to check git repository:", error);
			return false;
		}
	}

	//! バックアップ推奨メッセージを取得。
	async getBackupRecommendation(): Promise<string> {
		const isGit = await this.isGitRepository();
		return getBackupRecommendationMessage(isGit);
	}

	//! バックアップ一覧を取得。
	listBackups(pattern = "backup-"): TFile[] {
		const allFiles = this.app.vault.getFiles();
		return filterBackupFiles(allFiles, pattern);
	}

	//! 古いバックアップを削除。
	async cleanOldBackups(maxBackups = 10, pattern = "backup-"): Promise<number> {
		const backups = this.listBackups(pattern);

		//! 日付でソート（新しい順）。
		const sortedBackups = sortBackupsByDate(backups);

		//! 古いバックアップを削除。
		const toDelete = getOldBackupsToDelete(sortedBackups, maxBackups);

		for (const backup of toDelete) {
			await this.app.vault.delete(backup);
		}

		return toDelete.length;
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

	//! バックアップメタデータを保存。
	async saveMetadata(metadata: BackupMetadata): Promise<void> {
		const metadataPath = getMetadataPath(metadata.backupPath);
		const jsonContent = JSON.stringify(metadata, null, 2);
		await this.app.vault.create(metadataPath, jsonContent);
	}

	//! バックアップメタデータを読み込み。
	async loadMetadata(zipPath: string): Promise<BackupMetadata | null> {
		const metadataPath = getMetadataPath(zipPath);
		const file = this.app.vault.getAbstractFileByPath(metadataPath);

		if (!(file instanceof TFile)) {
			return null;
		}

		try {
			const content = await this.app.vault.read(file);
			return JSON.parse(content) as BackupMetadata;
		} catch (error) {
			console.error("Failed to load metadata:", error);
			return null;
		}
	}

	//! メタデータ付きバックアップ一覧を取得。
	async listBackupsWithMetadata(
		pattern = "backup-memolog-"
	): Promise<Array<{ file: TFile; metadata: BackupMetadata | null }>> {
		const backups = this.listBackups(pattern);
		const results: Array<{ file: TFile; metadata: BackupMetadata | null }> = [];

		for (const backup of backups) {
			const metadata = await this.loadMetadata(backup.path);
			results.push({ file: backup, metadata });
		}

		//! 日付でソート（新しい順）。
		const sortedFiles = sortBackupsByDate(results.map((r) => r.file));
		const sortedResults = sortedFiles
			.map((file) => {
				const result = results.find((r) => r.file === file);
				return result;
			})
			.filter((result): result is { file: TFile; metadata: BackupMetadata | null } => result !== undefined);

		return sortedResults;
	}

	//! ZIPバックアップからリストア。
	async restoreFromZip(
		zipPath: string,
		targetDirectory: string,
		settingsFileName = "memolog-setting.json"
	): Promise<RestoreResult> {
		const result: RestoreResult = {
			success: false,
			fileCount: 0,
		};

		try {
			//! バックアップファイルを読み込み。
			const zipFile = this.app.vault.getAbstractFileByPath(zipPath);

			if (!(zipFile instanceof TFile)) {
				throw new Error(`Backup file not found: ${zipPath}`);
			}

			const zipData = await this.app.vault.readBinary(zipFile);
			const zip = await JSZip.loadAsync(zipData);

			//! 対象ディレクトリ配下を削除（設定ファイル以外）。
			const targetFolder = this.app.vault.getAbstractFileByPath(targetDirectory);

			if (targetFolder instanceof TFolder) {
				await this.deleteDirectoryContents(targetFolder, settingsFileName);
			}

			//! ZIPの内容をリストア。
			let fileCount = 0;
			const promises: Promise<void>[] = [];

			zip.forEach((relativePath, zipEntry) => {
				if (!zipEntry.dir) {
					const fullPath = `${targetDirectory}/${relativePath}`;
					const promise = zipEntry.async("uint8array").then(async (content) => {
						//! ディレクトリを作成。
						const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
						if (dirPath) {
							await this.ensureDirectory(dirPath);
						}

						//! ファイルを作成。
						await this.app.vault.createBinary(fullPath, content.buffer as ArrayBuffer);
						fileCount++;
					});

					promises.push(promise);
				}
			});

			await Promise.all(promises);

			result.success = true;
			result.fileCount = fileCount;

			return result;
		} catch (error) {
			result.success = false;
			result.error = error instanceof Error ? error.message : "Unknown error";
			return result;
		}
	}

	//! ディレクトリの内容を削除（特定ファイルを除く）。
	private async deleteDirectoryContents(folder: TFolder, excludeFile: string): Promise<void> {
		for (const child of folder.children) {
			if (child instanceof TFile) {
				if (child.name !== excludeFile) {
					await this.app.vault.delete(child);
				}
			} else if (child instanceof TFolder) {
				//! サブフォルダは再帰的に削除。
				await this.app.vault.delete(child, true);
			}
		}
	}

	//! ディレクトリを確保（存在しなければ作成）。
	private async ensureDirectory(dirPath: string): Promise<void> {
		const parts = dirPath.split("/");
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;

			const existing = this.app.vault.getAbstractFileByPath(currentPath);

			if (!existing) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	//! .gitignoreにパターンを追加。
	async addToGitignore(pattern: string): Promise<boolean> {
		try {
			const gitignorePath = ".gitignore";
			let content = "";

			//! 既存の.gitignoreを読み込み。
			const gitignoreFile = this.app.vault.getAbstractFileByPath(gitignorePath);

			if (gitignoreFile instanceof TFile) {
				content = await this.app.vault.read(gitignoreFile);

				//! 既にパターンが存在する場合はスキップ。
				if (content.includes(pattern)) {
					return true;
				}

				//! 末尾に追加。
				content = content.trim() + `\n${pattern}\n`;
				await this.app.vault.modify(gitignoreFile, content);
			} else {
				//! .gitignoreが存在しない場合は新規作成。
				content = `${pattern}\n`;
				await this.app.vault.create(gitignorePath, content);
			}

			return true;
		} catch (error) {
			console.error("Failed to update .gitignore:", error);
			return false;
		}
	}
}
