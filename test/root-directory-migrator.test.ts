import { App, TFile, TFolder } from "obsidian"
import { RootDirectoryMigrator } from "../src/utils/root-directory-migrator"

// ! Obsidian API のモック。
jest.mock("obsidian", () => ({
	...jest.requireActual("obsidian"),
	TFile: jest.fn().mockImplementation(function(this: any) {
		return this
	}),
	TFolder: jest.fn().mockImplementation(function(this: any) {
		return this
	}),
}))

describe("RootDirectoryMigrator", () => {
	let app: App
	let migrator: RootDirectoryMigrator

	beforeEach(() => {
		// ! App のモック。
		app = {
			vault: {
				getAbstractFileByPath: jest.fn(),
				rename: jest.fn(),
				delete: jest.fn(),
			},
		} as unknown as App

		migrator = new RootDirectoryMigrator(app)
	})

	describe("calculateMappings", () => {
		it("should calculate mappings for files in old root directory", async () => {
			// ! モックデータ。
			const oldRootDir = "old-memolog"
			const newRootDir = "new-memolog"

			const mockFile1 = Object.assign(new TFile(), {
				path: "old-memolog/2025-11-01.md",
			})

			const mockFolder = Object.assign(new TFolder(), {
				children: [mockFile1],
			}) // ! vault.getAbstractFileByPath のモック - oldRootDir, newPath のチェック。
			;(app.vault.getAbstractFileByPath as jest.Mock).mockImplementation((path: string) => {
				if (path === oldRootDir) return mockFolder
				if (path.startsWith(newRootDir)) return null
				return null
			})

			// ! マッピングを計算。
			const mappings = await migrator.calculateMappings(oldRootDir, newRootDir)

			// ! 検証。
			expect(mappings.length).toBeGreaterThanOrEqual(1)
			if (mappings.length > 0) {
				expect(mappings[0]).toEqual({
					oldPath: "old-memolog/2025-11-01.md",
					newPath: "new-memolog/2025-11-01.md",
					hasConflict: false,
				})
			}
		})

		it("should return empty array when old root directory does not exist", async () => {
			const oldRootDir = "non-existent"
			const newRootDir = "new-memolog"
			;(app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(null)

			const mappings = await migrator.calculateMappings(oldRootDir, newRootDir)

			expect(mappings).toEqual([])
		})
	})

	describe("migrate", () => {
		it("should move files according to mappings", async () => {
			const mockFile = Object.assign(new TFile(), {
				path: "old-memolog/test.md",
			})

			const mockVaultHandler = {
				folderExists: jest.fn().mockReturnValue(false),
				createFolder: jest.fn().mockResolvedValue(undefined),
			} // ! VaultHandler のモックを設定。
			;(migrator as any).vaultHandler = mockVaultHandler
			;(app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(mockFile)
			;(app.vault.rename as jest.Mock).mockResolvedValueOnce(undefined)

			const mappings = [
				{
					oldPath: "old-memolog/test.md",
					newPath: "new-memolog/test.md",
					hasConflict: false,
				},
			]

			const result = await migrator.migrate(mappings)

			expect(result.movedCount).toBe(1)
			expect(result.errors).toEqual([])
			expect(app.vault.rename).toHaveBeenCalledWith(mockFile, "new-memolog/test.md")
		})

		it("should skip files with conflicts", async () => {
			const mappings = [
				{
					oldPath: "old-memolog/test.md",
					newPath: "new-memolog/test.md",
					hasConflict: true,
				},
			]

			const result = await migrator.migrate(mappings)

			expect(result.movedCount).toBe(0)
			expect(result.warnings).toHaveLength(1)
			expect(result.warnings[0]).toContain("Skipped (conflict)")
		})

		it("should report progress through callback", async () => {
			const mockFile1 = Object.assign(new TFile(), { path: "old-memolog/test1.md" })
			const mockFile2 = Object.assign(new TFile(), { path: "old-memolog/test2.md" })

			const mockVaultHandler = {
				folderExists: jest.fn().mockReturnValue(false),
				createFolder: jest.fn().mockResolvedValue(undefined),
			}
			;(migrator as any).vaultHandler = mockVaultHandler
			;(app.vault.getAbstractFileByPath as jest.Mock)
				.mockReturnValueOnce(mockFile1)
				.mockReturnValueOnce(mockFile2)
			;(app.vault.rename as jest.Mock).mockResolvedValue(undefined)

			const mappings = [
				{
					oldPath: "old-memolog/test1.md",
					newPath: "new-memolog/test1.md",
					hasConflict: false,
				},
				{
					oldPath: "old-memolog/test2.md",
					newPath: "new-memolog/test2.md",
					hasConflict: false,
				},
			]

			const progressCallback = jest.fn()
			await migrator.migrate(mappings, progressCallback)

			expect(progressCallback).toHaveBeenCalledTimes(2)
			expect(progressCallback).toHaveBeenCalledWith(1, 2)
			expect(progressCallback).toHaveBeenCalledWith(2, 2)
		})
	})

	describe("cleanupOldDirectory", () => {
		it("should delete empty old directory", async () => {
			const oldRootDir = "old-memolog"
			const mockFolder = Object.assign(new TFolder(), {
				children: [],
			})
			;(app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(mockFolder)
			;(app.vault.delete as jest.Mock).mockResolvedValueOnce(undefined)

			const result = await migrator.cleanupOldDirectory(oldRootDir)

			expect(result).toBe(true)
			expect(app.vault.delete).toHaveBeenCalledWith(mockFolder)
		})

		it("should not delete non-empty directory", async () => {
			const oldRootDir = "old-memolog"
			const mockFolder = {
				children: [{ path: "old-memolog/remaining.md" }],
			} as unknown as TFolder
			;(app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(mockFolder)

			const result = await migrator.cleanupOldDirectory(oldRootDir)

			expect(result).toBe(false)
			expect(app.vault.delete).not.toHaveBeenCalled()
		})

		it("should return false when directory does not exist", async () => {
			const oldRootDir = "non-existent"
			;(app.vault.getAbstractFileByPath as jest.Mock).mockReturnValueOnce(null)

			const result = await migrator.cleanupOldDirectory(oldRootDir)

			expect(result).toBe(false)
		})
	})
})
