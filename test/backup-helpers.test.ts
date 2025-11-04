import { TFile } from "obsidian"
import {
	filterBackupFiles,
	generateBackupName,
	getBackupRecommendationMessage,
	getMetadataPath,
	getOldBackupsToDelete,
	sortBackupsByDate,
} from "../src/utils/backup-helpers"

// ! backup-helpersのテスト。
describe("backup-helpers", () => {
	describe("generateBackupName", () => {
		test("デフォルトタイムスタンプで正しいバックアップ名を生成する", () => {
			const result = generateBackupName("memolog")

			expect(result).toMatch(/^backup-memolog-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.zip$/)
		})

		test("カスタムタイムスタンプで正しいバックアップ名を生成する", () => {
			const timestamp = new Date("2025-01-15T10:30:00.000Z")
			const result = generateBackupName("memolog", timestamp)

			expect(result).toBe("backup-memolog-2025-01-15T10-30-00-000Z.zip")
		})

		test("スラッシュを含むディレクトリ名を正しく処理する", () => {
			const timestamp = new Date("2025-01-15T10:30:00.000Z")
			const result = generateBackupName("memolog/subfolder", timestamp)

			expect(result).toBe("backup-memolog-subfolder-2025-01-15T10-30-00-000Z.zip")
		})

		test("空のディレクトリ名を処理する", () => {
			const timestamp = new Date("2025-01-15T10:30:00.000Z")
			const result = generateBackupName("", timestamp)

			expect(result).toBe("backup--2025-01-15T10-30-00-000Z.zip")
		})
	})

	describe("filterBackupFiles", () => {
		const mockFiles = [
			{ name: "backup-2025-01-01.zip" } as TFile,
			{ name: "backup-2025-01-02.zip" } as TFile,
			{ name: "regular-file.md" } as TFile,
			{ name: "backup-2025-01-03.txt" } as TFile,
			{ name: "custom-backup-1.zip" } as TFile,
			{ name: "notbackup.zip" } as TFile,
		]

		test("デフォルトパターンでバックアップファイルをフィルタリングする", () => {
			const result = filterBackupFiles(mockFiles, "backup-")

			expect(result).toHaveLength(2)
			expect(result[0].name).toBe("backup-2025-01-01.zip")
			expect(result[1].name).toBe("backup-2025-01-02.zip")
		})

		test("カスタムパターンでフィルタリングする", () => {
			const result = filterBackupFiles(mockFiles, "custom-")

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe("custom-backup-1.zip")
		})

		test("マッチするファイルがない場合は空配列を返す", () => {
			const result = filterBackupFiles(mockFiles, "nonexistent-")

			expect(result).toHaveLength(0)
		})

		test("空の配列を処理する", () => {
			const result = filterBackupFiles([], "backup-")

			expect(result).toHaveLength(0)
		})

		test(".zipで終わらないファイルは除外する", () => {
			const result = filterBackupFiles(mockFiles, "backup-")

			const txtFile = result.find(f => f.name === "backup-2025-01-03.txt")
			expect(txtFile).toBeUndefined()
		})
	})

	describe("getBackupRecommendationMessage", () => {
		test("Gitリポジトリの場合は適切なメッセージを返す", () => {
			const result = getBackupRecommendationMessage(true)

			expect(result).toBe(
				"このVaultはGit管理されているようです。Gitでバックアップされている場合、ZIPバックアップは不要かもしれません。",
			)
		})

		test("Gitリポジトリでない場合は適切なメッセージを返す", () => {
			const result = getBackupRecommendationMessage(false)

			expect(result).toBe(
				"このVaultはGit管理されていないようです。ZIPバックアップを作成することを強く推奨します。",
			)
		})
	})

	describe("getMetadataPath", () => {
		test(".zipを.jsonに置き換える", () => {
			const result = getMetadataPath("backup-2025-01-01.zip")

			expect(result).toBe("backup-2025-01-01.json")
		})

		test("パスを含む場合も正しく処理する", () => {
			const result = getMetadataPath("backups/backup-2025-01-01.zip")

			expect(result).toBe("backups/backup-2025-01-01.json")
		})

		test(".zipがない場合は何も変換しない", () => {
			const result = getMetadataPath("backup-2025-01-01")

			expect(result).toBe("backup-2025-01-01")
		})
	})

	describe("sortBackupsByDate", () => {
		test("ファイルを新しい順にソートする", () => {
			const mockFiles = [
				{ name: "backup-1.zip", stat: { mtime: 1000 } } as TFile,
				{ name: "backup-3.zip", stat: { mtime: 3000 } } as TFile,
				{ name: "backup-2.zip", stat: { mtime: 2000 } } as TFile,
			]

			const result = sortBackupsByDate(mockFiles)

			expect(result).toHaveLength(3)
			expect(result[0].name).toBe("backup-3.zip")
			expect(result[1].name).toBe("backup-2.zip")
			expect(result[2].name).toBe("backup-1.zip")
		})

		test("空の配列を処理する", () => {
			const result = sortBackupsByDate([])

			expect(result).toHaveLength(0)
		})

		test("1つのファイルの場合も正しく処理する", () => {
			const mockFiles = [{ name: "backup-1.zip", stat: { mtime: 1000 } } as TFile]

			const result = sortBackupsByDate(mockFiles)

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe("backup-1.zip")
		})

		test("元の配列を変更しない（イミュータブル）", () => {
			const mockFiles = [
				{ name: "backup-1.zip", stat: { mtime: 1000 } } as TFile,
				{ name: "backup-2.zip", stat: { mtime: 2000 } } as TFile,
			]

			const original = [...mockFiles]
			sortBackupsByDate(mockFiles)

			expect(mockFiles).toEqual(original)
		})
	})

	describe("getOldBackupsToDelete", () => {
		const mockFiles = [
			{ name: "backup-3.zip", stat: { mtime: 3000 } } as TFile,
			{ name: "backup-2.zip", stat: { mtime: 2000 } } as TFile,
			{ name: "backup-1.zip", stat: { mtime: 1000 } } as TFile,
		]

		test("最大数を超えたファイルを返す", () => {
			const result = getOldBackupsToDelete(mockFiles, 2)

			expect(result).toHaveLength(1)
			expect(result[0].name).toBe("backup-1.zip")
		})

		test("最大数未満の場合は空配列を返す", () => {
			const result = getOldBackupsToDelete(mockFiles, 5)

			expect(result).toHaveLength(0)
		})

		test("最大数と同じ場合は空配列を返す", () => {
			const result = getOldBackupsToDelete(mockFiles, 3)

			expect(result).toHaveLength(0)
		})

		test("最大数が0の場合は全てのファイルを返す", () => {
			const result = getOldBackupsToDelete(mockFiles, 0)

			expect(result).toHaveLength(3)
		})

		test("空の配列を処理する", () => {
			const result = getOldBackupsToDelete([], 2)

			expect(result).toHaveLength(0)
		})
	})
})
