import { App, TFile, TFolder } from "obsidian"
import { MemologVaultHandler } from "../fs/vault-handler"
import { Logger } from "./logger"

// ! ルートディレクトリ移行の結果。
export interface RootDirectoryMigrationResult {
	success: boolean
	movedCount: number
	errors: string[]
	warnings: string[]
}

// ! ファイルマッピング情報。
export interface FileMapping {
	oldPath: string
	newPath: string
	hasConflict: boolean
}

// ! ルートディレクトリ移行ユーティリティ。
export class RootDirectoryMigrator {
	private app: App
	private vaultHandler: MemologVaultHandler

	constructor(app: App) {
		this.app = app
		this.vaultHandler = new MemologVaultHandler(app)
	}

	// ! 移行が必要なファイルのマッピングを計算する。
	async calculateMappings(
		oldRootDir: string,
		newRootDir: string,
	): Promise<FileMapping[]> {
		const mappings: FileMapping[] = []

		// ! 旧ルートディレクトリ以下の全ファイルを取得。
		const oldFolder = this.app.vault.getAbstractFileByPath(oldRootDir)
		if (!(oldFolder instanceof TFolder)) {
			Logger.warn(`Old root directory not found: ${oldRootDir}`)
			return mappings
		}

		// ! 再帰的にファイルを収集。
		const collectFiles = (folder: TFolder, files: TFile[] = []): TFile[] => {
			for (const child of folder.children) {
				if (child instanceof TFile) {
					files.push(child)
				} else if (child instanceof TFolder) {
					collectFiles(child, files)
				}
			}
			return files
		}

		const allFiles = collectFiles(oldFolder)

		// ! 新しいパスへのマッピングを作成。
		const newPaths = new Set<string>()
		for (const file of allFiles) {
			// ! 旧ルートディレクトリからの相対パスを取得。
			const relativePath = file.path.substring(oldRootDir.length)
			// ! 先頭の/を除去。
			const cleanRelativePath = relativePath.startsWith("/")
				? relativePath.substring(1)
				: relativePath

			// ! 新しいパスを計算。
			const newPath = newRootDir + "/" + cleanRelativePath

			// ! 競合チェック（設定ファイルは上書きするので競合としない）。
			const isSettingsFile = cleanRelativePath.endsWith("memolog-setting.json")
			const hasConflict = !isSettingsFile &&
				(newPaths.has(newPath) || this.app.vault.getAbstractFileByPath(newPath) !== null)

			mappings.push({
				oldPath: file.path,
				newPath: newPath,
				hasConflict: hasConflict,
			})

			newPaths.add(newPath)
		}

		return mappings
	}

	// ! ファイルを移行する。
	async migrate(
		mappings: FileMapping[],
		progressCallback?: (current: number, total: number) => void,
	): Promise<RootDirectoryMigrationResult> {
		const result: RootDirectoryMigrationResult = {
			success: true,
			movedCount: 0,
			errors: [],
			warnings: [],
		}

		// ! 競合のないマッピングのみを処理。
		const validMappings = mappings.filter(m => !m.hasConflict)

		for (let i = 0; i < validMappings.length; i++) {
			const mapping = validMappings[i]

			try {
				// ! 進捗コールバック。
				if (progressCallback) {
					progressCallback(i + 1, validMappings.length)
				}

				// ! ファイルを移動。
				await this.moveFile(mapping.oldPath, mapping.newPath)

				result.movedCount++
			} catch (error) {
				const errorMsg = `Failed to move ${mapping.oldPath}: ${error instanceof Error ? error.message : "Unknown error"}`
				Logger.error(errorMsg)
				result.errors.push(errorMsg)
				result.success = false
			}
		}

		// ! 競合したファイルの警告。
		const conflictMappings = mappings.filter(m => m.hasConflict)
		for (const mapping of conflictMappings) {
			result.warnings.push(`Skipped (conflict): ${mapping.oldPath} -> ${mapping.newPath}`)
		}

		return result
	}

	// ! ファイルを移動する（ディレクトリ作成を含む）。
	private async moveFile(oldPath: string, newPath: string): Promise<void> {
		// ! 移動元ファイルを取得。
		const file = this.app.vault.getAbstractFileByPath(oldPath)
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${oldPath}`)
		}

		// ! 新しいディレクトリが存在しない場合は作成。
		const newDir = newPath.substring(0, newPath.lastIndexOf("/"))
		if (!this.vaultHandler.folderExists(newDir)) {
			await this.vaultHandler.createFolder(newDir)
		}

		// ! 設定ファイルの場合、既存ファイルを削除してから移動。
		const isSettingsFile = newPath.endsWith("memolog-setting.json")
		if (isSettingsFile) {
			const existingFile = this.app.vault.getAbstractFileByPath(newPath)
			if (existingFile instanceof TFile) {
				await this.app.vault.delete(existingFile)
			}
		}

		// ! ファイルを移動。
		await this.app.vault.rename(file, newPath)
	}

	// ! 旧ルートディレクトリが空になった場合に削除する。
	async cleanupOldDirectory(oldRootDir: string): Promise<boolean> {
		const folder = this.app.vault.getAbstractFileByPath(oldRootDir)
		if (!(folder instanceof TFolder)) {
			return false
		}

		// ! 空のフォルダのみ削除。
		if (folder.children.length === 0) {
			try {
				await this.app.vault.delete(folder)
				Logger.info(`Deleted empty old root directory: ${oldRootDir}`)
				return true
			} catch (error) {
				Logger.warn(
					`Failed to delete old root directory: ${error instanceof Error ? error.message : "Unknown error"}`,
				)
				return false
			}
		}

		return false
	}
}
