import { TFile } from "obsidian";

//! バックアップ名を生成する。
//! @param targetDir - 対象ディレクトリ。
//! @param timestamp - タイムスタンプ（省略時は現在日時）。
//! @returns バックアップファイル名。
export function generateBackupName(targetDir: string, timestamp?: Date): string {
	const ts = timestamp || new Date();
	const isoTimestamp = ts.toISOString().replace(/[:.]/g, "-");
	const dirName = targetDir.replace(/\//g, "-");
	return `backup-${dirName}-${isoTimestamp}.zip`;
}

//! バックアップファイルをフィルタリングする。
//! @param files - 全ファイルのリスト。
//! @param pattern - 検索パターン（プレフィックス）。
//! @returns フィルタリングされたバックアップファイルのリスト。
export function filterBackupFiles(files: TFile[], pattern: string): TFile[] {
	return files.filter((file) => file.name.startsWith(pattern) && file.name.endsWith(".zip"));
}

//! Gitリポジトリ状態に応じたバックアップ推奨メッセージを取得する。
//! @param isGitRepo - Gitリポジトリかどうか。
//! @returns 推奨メッセージ。
export function getBackupRecommendationMessage(isGitRepo: boolean): string {
	if (isGitRepo) {
		return "このVaultはGit管理されているようです。Gitでバックアップされている場合、ZIPバックアップは不要かもしれません。";
	} else {
		return "このVaultはGit管理されていないようです。ZIPバックアップを作成することを強く推奨します。";
	}
}

//! メタデータファイルパスを取得する。
//! @param zipPath - ZIPファイルパス。
//! @returns メタデータファイルパス。
export function getMetadataPath(zipPath: string): string {
	return zipPath.replace(/\.zip$/, ".json");
}

//! バックアップファイルをソートする（新しい順）。
//! @param files - バックアップファイルのリスト。
//! @returns ソート済みファイルリスト。
export function sortBackupsByDate(files: TFile[]): TFile[] {
	return [...files].sort((a, b) => b.stat.mtime - a.stat.mtime);
}

//! 削除対象の古いバックアップファイルを取得する。
//! @param backups - バックアップファイルのリスト（ソート済み）。
//! @param maxBackups - 保持する最大バックアップ数。
//! @returns 削除対象のファイルリスト。
export function getOldBackupsToDelete(backups: TFile[], maxBackups: number): TFile[] {
	if (backups.length <= maxBackups) {
		return [];
	}
	return backups.slice(maxBackups);
}
