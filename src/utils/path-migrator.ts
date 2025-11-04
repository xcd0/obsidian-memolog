import { App, TFile } from "obsidian"
import { sortMemosByTimestamp, splitFileIntoMemos } from "../core/memo-crud-operations"
import { memoToText } from "../core/memo-helpers"
import { MemoManager } from "../core/memo-manager"
import { MemologVaultHandler } from "../fs/vault-handler"
import { MemoEntry } from "../types/memo"
import { CategoryConfig } from "../types/settings"
import { isSpecialFileForSplit, planMemoSplit } from "./memo-split-operations"
import { PathGenerator } from "./path-generator"
import {
	detectConflicts,
	extractCategoryFromDirectory,
	extractDateFromPath,
	extractFromCustomPath,
	isSpecialFile,
} from "./path-migration-helpers"

// ! ファイルパス変換のマッピング情報。
export interface PathMapping {
	// ! 元のファイルパス。
	oldPath: string
	// ! 新しいファイルパス。
	newPath: string
	// ! カテゴリ名。
	category: string
	// ! 日付情報。
	date?: Date
	// ! 競合があるか。
	hasConflict: boolean
}

// ! メモ分割マイグレーションのマッピング情報。
export interface MemoSplitMapping {
	// ! 元のファイルパス。
	oldPath: string
	// ! 新しいファイルパスとそのパスに含まれるメモのマップ。
	newPathToMemos: Map<string, MemoEntry[]>
	// ! 競合があるか。
	hasConflict: boolean
}

// ! パスマイグレーション結果。
export interface MigrationResult {
	// ! 成功したマッピング数。
	successCount: number
	// ! 失敗したマッピング数。
	failureCount: number
	// ! スキップされたマッピング数。
	skippedCount: number
	// ! エラーメッセージ。
	errors: string[]
	// ! 警告メッセージ。
	warnings: string[]
	// ! 処理されたマッピング一覧。
	mappings: PathMapping[]
}

// ! パス変換・ファイル移動を管理するクラス。
export class PathMigrator {
	private app: App
	private vaultHandler: MemologVaultHandler
	private memoManager: MemoManager

	constructor(app: App, vaultHandler: MemologVaultHandler, memoManager: MemoManager) {
		this.app = app
		this.vaultHandler = vaultHandler
		this.memoManager = memoManager
	}

	// ! 設定変更時のファイル移動を計画する。
	async planMigration(
		rootDir: string,
		oldPathFormat: string,
		newPathFormat: string,
		oldUseDirectoryCategory: boolean,
		newUseDirectoryCategory: boolean,
		categories: CategoryConfig[],
		defaultCategory: string,
	): Promise<PathMapping[]> {
		const mappings: PathMapping[] = []

		// ! rootDir配下の全.mdファイルを取得。
		const allFiles = this.app.vault.getMarkdownFiles()
		const targetFiles = allFiles.filter(file => file.path.startsWith(rootDir + "/"))

		for (const file of targetFiles) {
			const mapping = await this.analyzePath(
				file.path,
				rootDir,
				oldPathFormat,
				newPathFormat,
				oldUseDirectoryCategory,
				newUseDirectoryCategory,
				categories,
				defaultCategory,
			)

			// ! 古いパス書式にマッチしないファイル（nullが返される）は除外。
			if (mapping) {
				mappings.push(mapping)
			}
		}

		// ! 競合をチェック。
		detectConflicts(mappings)

		return mappings
	}

	// ! ファイルパスを解析して新しいパスを生成する。
	private async analyzePath(
		filePath: string,
		rootDir: string,
		oldPathFormat: string,
		newPathFormat: string,
		oldUseDirectoryCategory: boolean,
		newUseDirectoryCategory: boolean,
		categories: CategoryConfig[],
		defaultCategory: string,
	): Promise<PathMapping | null> {
		// ! rootDirを除いたパスを取得。
		const relativePath = filePath.substring(rootDir.length + 1)

		// ! 特別なファイルを除外。
		if (isSpecialFile(relativePath)) {
			return null
		}

		// ! カテゴリを推定。
		let category: string | null = null
		let dateInfo: Date | null = null

		// ! 旧フォーマットに%Cが含まれるかチェック。
		const oldHasC = oldPathFormat.includes("%C")

		if (oldHasC) {
			// ! %Cがある場合はパスから抽出。
			const result = extractFromCustomPath(relativePath, oldPathFormat, categories)
			category = result.category
			dateInfo = result.date
		} else if (oldUseDirectoryCategory) {
			// ! useDirectoryCategoryがtrueの場合は最初のディレクトリ名がカテゴリ。
			category = extractCategoryFromDirectory(relativePath, categories)
		} else {
			// ! useDirectoryCategoryがfalseの場合はファイル内容からカテゴリを推定する必要がある。
			// ! ここでは全カテゴリを試して、タグペアが存在するものを探す。
			// ! 実装の簡略化のため、後で非同期処理で行う。
			category = null
		}

		// ! 日付情報がまだない場合はファイル名から抽出を試みる。
		if (!dateInfo) {
			dateInfo = extractDateFromPath(relativePath)
		}

		// ! 日付情報が抽出できない場合は、古いパス書式にマッチしていない可能性が高い。
		// ! このようなファイルは変換対象から除外する。
		if (!dateInfo) {
			return null
		}

		// ! カテゴリが特定できない場合はファイル内容から読み取る。
		if (!category) {
			category = await this.extractCategoryFromFile(filePath)
		}

		// ! それでも特定できない場合はデフォルトカテゴリを使用。
		if (!category) {
			category = defaultCategory
		}

		// ! 新しいパスを生成。
		const newPath = PathGenerator.generateCustomPath(
			rootDir,
			category,
			newPathFormat,
			newUseDirectoryCategory,
			dateInfo || new Date(),
		)

		return {
			oldPath: filePath,
			newPath,
			category,
			date: dateInfo || undefined,
			hasConflict: false,
		}
	}

	// ! マイグレーションを実行する。
	async executeMigration(
		mappings: PathMapping[],
		skipConflicts = true,
		createBackup = true,
	): Promise<MigrationResult> {
		const result: MigrationResult = {
			successCount: 0,
			failureCount: 0,
			skippedCount: 0,
			errors: [],
			warnings: [],
			mappings,
		}

		for (const mapping of mappings) {
			// ! 競合がある場合はスキップ。
			if (mapping.hasConflict && skipConflicts) {
				result.skippedCount++
				result.warnings.push(`競合のためスキップ: ${mapping.oldPath} -> ${mapping.newPath}`)
				continue
			}

			// ! 同じパスの場合はスキップ。
			if (mapping.oldPath === mapping.newPath) {
				result.skippedCount++
				continue
			}

			try {
				// ! バックアップ作成。
				if (createBackup) {
					const content = await this.vaultHandler.readFile(mapping.oldPath)
					const backupPath = `${mapping.oldPath}.backup-${Date.now()}`
					await this.vaultHandler.createFile(backupPath, content)
				}

				// ! ファイルを移動。
				await this.moveFile(mapping.oldPath, mapping.newPath)
				result.successCount++
			} catch (error) {
				result.failureCount++
				result.errors.push(
					`移動失敗: ${mapping.oldPath} -> ${mapping.newPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
				)
			}
		}

		return result
	}

	// ! ファイルを移動する。
	private async moveFile(oldPath: string, newPath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(oldPath)

		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${oldPath}`)
		}

		// ! 新しいパスのディレクトリを作成。
		const newDir = newPath.substring(0, newPath.lastIndexOf("/"))
		if (newDir && !this.vaultHandler.folderExists(newDir)) {
			await this.vaultHandler.createFolder(newDir)
		}

		// ! ファイルをリネーム/移動。
		await this.app.vault.rename(file, newPath)
	}

	// ! ファイル内容からカテゴリを抽出する（HTMLコメント形式）。
	private async extractCategoryFromFile(filePath: string): Promise<string | null> {
		try {
			const content = await this.vaultHandler.readFile(filePath)

			// ! <!-- memolog: start category="work" --> の形式を検索。
			const match = content.match(/<!--\s*memolog:\s*start\s+category="([^"]+)"\s*-->/)
			if (match && match[1]) {
				return match[1]
			}

			return null
		} catch (error) {
			return null
		}
	}

	// ! カテゴリを非同期で推定する（ファイル内容を読む必要がある）。
	async detectCategoryFromContent(
		filePath: string,
		categories: CategoryConfig[],
	): Promise<string | null> {
		try {
			const allCategories = await this.vaultHandler.getAllCategories(filePath)

			// ! 最初に見つかったカテゴリを返す。
			for (const cat of categories) {
				if (allCategories.has(cat.directory)) {
					return cat.directory
				}
			}

			return null
		} catch (error) {
			return null
		}
	}

	// ! 拡張版のマイグレーション計画（ファイル内容からカテゴリを推定）。
	async planMigrationAdvanced(
		rootDir: string,
		oldPathFormat: string,
		newPathFormat: string,
		oldUseDirectoryCategory: boolean,
		newUseDirectoryCategory: boolean,
		categories: CategoryConfig[],
		defaultCategory: string,
	): Promise<PathMapping[]> {
		// ! 基本的なplanMigrationを呼び出す（既にファイル内容からカテゴリを読み取る機能が含まれている）。
		return await this.planMigration(
			rootDir,
			oldPathFormat,
			newPathFormat,
			oldUseDirectoryCategory,
			newUseDirectoryCategory,
			categories,
			defaultCategory,
		)
	}

	// ! メモ分割マイグレーションの計画を作成する。
	async planMemoSplitMigration(
		rootDir: string,
		newPathFormat: string,
		newUseDirectoryCategory: boolean,
		defaultCategory: string,
	): Promise<MemoSplitMapping[]> {
		const mappings: MemoSplitMapping[] = []

		// ! rootDir配下の全.mdファイルを取得。
		const allFiles = this.app.vault.getMarkdownFiles()
		const targetFiles = allFiles.filter(file => file.path.startsWith(rootDir + "/"))

		for (const file of targetFiles) {
			const mapping = await this.analyzeMemoSplit(
				file.path,
				rootDir,
				newPathFormat,
				newUseDirectoryCategory,
				defaultCategory,
			)

			if (mapping) {
				mappings.push(mapping)
			}
		}

		return mappings
	}

	// ! ファイル内のメモを分析してカテゴリ別に分割する計画を立てる。
	private async analyzeMemoSplit(
		filePath: string,
		rootDir: string,
		newPathFormat: string,
		newUseDirectoryCategory: boolean,
		defaultCategory: string,
	): Promise<MemoSplitMapping | null> {
		// ! rootDirを除いたパスを取得。
		const relativePath = filePath.substring(rootDir.length + 1)

		// ! 特別なファイルを除外。
		if (isSpecialFileForSplit(relativePath)) {
			return null
		}

		// ! ファイルからすべてのメモを取得（カテゴリフィルタなし）。
		const allMemos = await this.memoManager.getMemos(filePath, "")

		if (allMemos.length === 0) {
			return null
		}

		// ! パス生成関数を定義。
		const pathGenerator = (category: string, date: Date) => {
			return PathGenerator.generateCustomPath(
				rootDir,
				category,
				newPathFormat,
				newUseDirectoryCategory,
				date,
			)
		}

		// ! 純粋関数でメモ分割計画を作成。
		const newPathToMemos = planMemoSplit(allMemos, defaultCategory, pathGenerator)

		return {
			oldPath: filePath,
			newPathToMemos,
			hasConflict: false,
		}
	}

	// ! メモ分割マイグレーションを実行する。
	async executeMemoSplitMigration(
		mappings: MemoSplitMapping[],
		createBackup = true,
	): Promise<MigrationResult> {
		const result: MigrationResult = {
			successCount: 0,
			failureCount: 0,
			skippedCount: 0,
			errors: [],
			warnings: [],
			mappings: [],
		}

		for (const mapping of mappings) {
			try {
				// ! バックアップ作成。
				if (createBackup) {
					const content = await this.vaultHandler.readFile(mapping.oldPath)
					const backupPath = `${mapping.oldPath}.backup-${Date.now()}`
					await this.vaultHandler.createFile(backupPath, content)
				}

				// ! 各カテゴリごとに新しいファイルを作成または追記。
				for (const [newPath, memos] of mapping.newPathToMemos) {
					// ! 新しいパスのディレクトリを作成。
					const newDir = newPath.substring(0, newPath.lastIndexOf("/"))
					if (newDir && !this.vaultHandler.folderExists(newDir)) {
						await this.vaultHandler.createFolder(newDir)
					}

					// ! 既存ファイルがあれば読み込む。
					let existingContent = ""
					if (this.vaultHandler.fileExists(newPath)) {
						existingContent = await this.vaultHandler.readFile(newPath)
					}

					// ! メモをテキストに変換（memo-helpers.tsの標準関数を使用）。
					const memoTexts = memos.map(memo => memoToText(memo)).join("\n")

					// ! ファイルに書き込み。
					let combinedContent: string
					if (existingContent.trim()) {
						combinedContent = `${existingContent.trim()}\n${memoTexts}`
					} else {
						combinedContent = memoTexts
					}

					// ! タイムスタンプ順にソート。
					const allMemoTexts = splitFileIntoMemos(combinedContent)
					const sortedMemos = sortMemosByTimestamp(allMemoTexts)
					const newContent = sortedMemos.join("")

					await this.vaultHandler.writeFile(newPath, newContent)
				}

				// ! 元のファイルを削除。
				const oldFile = this.app.vault.getAbstractFileByPath(mapping.oldPath)
				if (oldFile instanceof TFile) {
					await this.app.vault.delete(oldFile)
				}

				result.successCount++
			} catch (error) {
				result.failureCount++
				result.errors.push(
					`移動失敗: ${mapping.oldPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
				)
			}
		}

		return result
	}
}
