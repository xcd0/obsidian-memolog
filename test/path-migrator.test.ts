import { PathMigrator, PathMapping, MemoSplitMapping } from "../src/utils/path-migrator";
import { MemologVaultHandler } from "../src/fs/vault-handler";
import { MemoManager } from "../src/core/memo-manager";
import { TFile } from "obsidian";

//! PathMigratorのモックベーステスト。
//! I/O操作に依存するため、App、VaultHandler、MemoManagerをモック化してテスト。
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
describe("PathMigrator", () => {
	let pathMigrator: PathMigrator;
	let mockApp: {
		vault: {
			getMarkdownFiles: jest.Mock;
			getAbstractFileByPath: jest.Mock;
			rename: jest.Mock;
			delete: jest.Mock;
		};
	};
	let mockVaultHandler: jest.Mocked<MemologVaultHandler>;
	let mockMemoManager: jest.Mocked<MemoManager>;

	beforeEach(() => {
		//! Appのモック作成。
		mockApp = {
			vault: {
				getMarkdownFiles: jest.fn(),
				getAbstractFileByPath: jest.fn(),
				rename: jest.fn(),
				delete: jest.fn(),
			},
		};

		//! VaultHandlerのモック作成。
		mockVaultHandler = {
			readFile: jest.fn(),
			writeFile: jest.fn(),
			createFile: jest.fn(),
			createFolder: jest.fn(),
			fileExists: jest.fn(),
			folderExists: jest.fn(),
			getAllCategories: jest.fn(),
		} as jest.Mocked<MemologVaultHandler>;

		//! MemoManagerのモック作成。
		mockMemoManager = {
			getMemos: jest.fn(),
		} as jest.Mocked<MemoManager>;

		pathMigrator = new PathMigrator(mockApp, mockVaultHandler, mockMemoManager);
	});

	describe("planMigration", () => {
		test("should plan migration for simple path format change", async () => {
			//! モックファイルリストを設定。
			const mockFiles = [
				{ path: "memolog/work/2025-10-01.md" } as TFile,
				{ path: "memolog/hobby/2025-10-02.md" } as TFile,
			];
			mockApp.vault.getMarkdownFiles.mockReturnValue(mockFiles);

			//! VaultHandlerのモックを設定。
			mockVaultHandler.readFile.mockResolvedValue(
				'<!-- memolog: start category="work" -->\nContent\n<!-- memolog: end -->'
			);

			//! マイグレーション計画を実行。
			const mappings = await pathMigrator.planMigration(
				"memolog",
				"%Y-%m-%d.md",
				"%Y%m%d.md",
				true,
				true,
				[
					{ name: "Work", directory: "work", icon: "💼", color: "#ff0000" },
					{ name: "Hobby", directory: "hobby", icon: "🎨", color: "#00ff00" },
				],
				"default"
			);

			//! 結果を検証。
			expect(mappings.length).toBe(2);
			expect(mappings[0].oldPath).toBe("memolog/work/2025-10-01.md");
			expect(mappings[0].newPath).toBe("memolog/work/20251001.md");
			expect(mappings[0].category).toBe("work");
			expect(mappings[0].hasConflict).toBe(false);
		});

		test("should exclude special files from migration", async () => {
			//! モックファイルリストに特別なファイルを含める。
			const mockFiles = [
				{ path: "memolog/index.md" } as TFile,
				{ path: "memolog/_trash.md" } as TFile,
				{ path: "memolog/work/2025-10-01.md" } as TFile,
			];
			mockApp.vault.getMarkdownFiles.mockReturnValue(mockFiles);

			mockVaultHandler.readFile.mockResolvedValue(
				'<!-- memolog: start category="work" -->\nContent\n<!-- memolog: end -->'
			);

			const mappings = await pathMigrator.planMigration(
				"memolog",
				"%Y-%m-%d.md",
				"%Y%m%d.md",
				true,
				true,
				[{ name: "Work", directory: "work", icon: "💼", color: "#ff0000" }],
				"default"
			);

			//! index.mdと_trash.mdは除外されるため、1件のみ。
			expect(mappings.length).toBe(1);
			expect(mappings[0].oldPath).toBe("memolog/work/2025-10-01.md");
		});

		test("should handle empty file list", async () => {
			mockApp.vault.getMarkdownFiles.mockReturnValue([]);

			const mappings = await pathMigrator.planMigration(
				"memolog",
				"%Y-%m-%d.md",
				"%Y%m%d.md",
				true,
				true,
				[],
				"default"
			);

			expect(mappings.length).toBe(0);
		});

		test("should exclude files without date information", async () => {
			//! 日付情報がないファイル。
			const mockFiles = [
				{ path: "memolog/work/notes.md" } as TFile,
				{ path: "memolog/work/2025-10-01.md" } as TFile,
			];
			mockApp.vault.getMarkdownFiles.mockReturnValue(mockFiles);

			mockVaultHandler.readFile.mockResolvedValue(
				'<!-- memolog: start category="work" -->\nContent\n<!-- memolog: end -->'
			);

			const mappings = await pathMigrator.planMigration(
				"memolog",
				"%Y-%m-%d.md",
				"%Y%m%d.md",
				true,
				true,
				[{ name: "Work", directory: "work", icon: "💼", color: "#ff0000" }],
				"default"
			);

			//! 日付情報がないnotes.mdは除外される。
			expect(mappings.length).toBe(1);
			expect(mappings[0].oldPath).toBe("memolog/work/2025-10-01.md");
		});
	});

	describe("executeMigration", () => {
		test("should execute migration successfully", async () => {
			//! マッピング情報を準備。
			const mappings: PathMapping[] = [
				{
					oldPath: "memolog/work/2025-10-01.md",
					newPath: "memolog/work/20251001.md",
					category: "work",
					hasConflict: false,
				},
			];

			//! モックの設定。
			mockVaultHandler.readFile.mockResolvedValue("File content");
			mockVaultHandler.createFile.mockResolvedValue(undefined);
			mockVaultHandler.createFolder.mockResolvedValue(undefined);
			mockVaultHandler.folderExists.mockReturnValue(true); //! フォルダが存在する場合はcreateFolder呼び出しをスキップ。

			const mockFile = Object.create(TFile.prototype);
			mockFile.path = "memolog/work/2025-10-01.md";
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.rename.mockResolvedValue(undefined);

			//! マイグレーションを実行。
			const result = await pathMigrator.executeMigration(mappings, true, true);

			//! 結果を検証。
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(0);
			expect(result.skippedCount).toBe(0);
			expect(mockVaultHandler.createFile).toHaveBeenCalled(); //! バックアップ作成。
			expect(mockApp.vault.rename).toHaveBeenCalled();
		});

		test("should skip conflicted mappings", async () => {
			const mappings: PathMapping[] = [
				{
					oldPath: "memolog/work/2025-10-01.md",
					newPath: "memolog/work/20251001.md",
					category: "work",
					hasConflict: true,
				},
			];

			const result = await pathMigrator.executeMigration(mappings, true, false);

			//! 競合があるためスキップされる。
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(0);
			expect(result.skippedCount).toBe(1);
			expect(result.warnings.length).toBeGreaterThan(0);
		});

		test("should skip when oldPath equals newPath", async () => {
			const mappings: PathMapping[] = [
				{
					oldPath: "memolog/work/2025-10-01.md",
					newPath: "memolog/work/2025-10-01.md",
					category: "work",
					hasConflict: false,
				},
			];

			const result = await pathMigrator.executeMigration(mappings, true, false);

			//! 同じパスのためスキップされる。
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(0);
			expect(result.skippedCount).toBe(1);
		});

		test("should handle migration errors", async () => {
			const mappings: PathMapping[] = [
				{
					oldPath: "memolog/work/2025-10-01.md",
					newPath: "memolog/work/20251001.md",
					category: "work",
					hasConflict: false,
				},
			];

			mockVaultHandler.readFile.mockResolvedValue("File content");
			mockVaultHandler.createFile.mockResolvedValue(undefined);
			mockVaultHandler.folderExists.mockReturnValue(true);

			//! ファイルが見つからないエラーをシミュレート。
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			const result = await pathMigrator.executeMigration(mappings, true, true);

			//! エラーが記録される。
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(1);
			expect(result.errors.length).toBe(1);
			expect(result.errors[0]).toContain("移動失敗");
		});

		test("should create backup when createBackup is true", async () => {
			const mappings: PathMapping[] = [
				{
					oldPath: "memolog/work/2025-10-01.md",
					newPath: "memolog/work/20251001.md",
					category: "work",
					hasConflict: false,
				},
			];

			mockVaultHandler.readFile.mockResolvedValue("File content");
			mockVaultHandler.createFile.mockResolvedValue(undefined);
			mockVaultHandler.folderExists.mockReturnValue(true);

			const mockFile = { path: "memolog/work/2025-10-01.md" } as TFile;
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.rename.mockResolvedValue(undefined);

			await pathMigrator.executeMigration(mappings, true, true);

			//! バックアップファイルが作成される。
			expect(mockVaultHandler.createFile).toHaveBeenCalledTimes(1);
			expect(mockVaultHandler.createFile.mock.calls[0][0]).toContain(".backup-");
		});

		test("should not create backup when createBackup is false", async () => {
			const mappings: PathMapping[] = [
				{
					oldPath: "memolog/work/2025-10-01.md",
					newPath: "memolog/work/20251001.md",
					category: "work",
					hasConflict: false,
				},
			];

			mockVaultHandler.folderExists.mockReturnValue(true);

			const mockFile = { path: "memolog/work/2025-10-01.md" } as TFile;
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.rename.mockResolvedValue(undefined);

			await pathMigrator.executeMigration(mappings, true, false);

			//! バックアップは作成されない。
			expect(mockVaultHandler.createFile).not.toHaveBeenCalled();
		});
	});

	describe("planMemoSplitMigration", () => {
		test("should plan memo split migration", async () => {
			//! モックファイルリストを設定。
			const mockFiles = [{ path: "memolog/daily/2025-10-01.md" } as TFile];
			mockApp.vault.getMarkdownFiles.mockReturnValue(mockFiles);

			//! メモマネージャーのモックを設定（複数カテゴリのメモ）。
			mockMemoManager.getMemos.mockResolvedValue([
				{
					id: "1",
					category: "work",
					content: "Work memo",
					timestamp: "2025-10-01T10:00:00Z",
				},
				{
					id: "2",
					category: "hobby",
					content: "Hobby memo",
					timestamp: "2025-10-01T11:00:00Z",
				},
			]);

			const mappings = await pathMigrator.planMemoSplitMigration(
				"memolog",
				"%C/%Y%m%d.md",
				true,
				"default"
			);

			//! 結果を検証。
			expect(mappings.length).toBe(1);
			expect(mappings[0].oldPath).toBe("memolog/daily/2025-10-01.md");
			expect(mappings[0].newPathToMemos.size).toBe(2); //! workとhobbyの2つ。
		});

		test("should exclude special files from memo split", async () => {
			const mockFiles = [
				{ path: "memolog/index.md" } as TFile,
				{ path: "memolog/daily/2025-10-01.md" } as TFile,
			];
			mockApp.vault.getMarkdownFiles.mockReturnValue(mockFiles);

			mockMemoManager.getMemos.mockResolvedValue([
				{
					id: "1",
					category: "work",
					content: "Work memo",
					timestamp: "2025-10-01T10:00:00Z",
				},
			]);

			const mappings = await pathMigrator.planMemoSplitMigration(
				"memolog",
				"%C/%Y%m%d.md",
				true,
				"default"
			);

			//! index.mdは除外される。
			expect(mappings.length).toBe(1);
			expect(mappings[0].oldPath).toBe("memolog/daily/2025-10-01.md");
		});

		test("should exclude files with no memos", async () => {
			const mockFiles = [{ path: "memolog/daily/2025-10-01.md" } as TFile];
			mockApp.vault.getMarkdownFiles.mockReturnValue(mockFiles);

			//! メモが0件。
			mockMemoManager.getMemos.mockResolvedValue([]);

			const mappings = await pathMigrator.planMemoSplitMigration(
				"memolog",
				"%C/%Y%m%d.md",
				true,
				"default"
			);

			//! メモがないファイルは除外される。
			expect(mappings.length).toBe(0);
		});
	});

	describe("executeMemoSplitMigration", () => {
		test("should execute memo split migration successfully", async () => {
			//! メモ分割マッピングを準備。
			const newPathToMemos = new Map([
				[
					"memolog/work/20251001.md",
					[
						{
							id: "1",
							category: "work",
							content: "Work memo",
							timestamp: "2025-10-01T10:00:00Z",
							tags: [],
							links: [],
							isPinned: false,
							isDeleted: false,
							deletedAt: undefined,
						},
					],
				],
			]);

			const mappings: MemoSplitMapping[] = [
				{
					oldPath: "memolog/daily/2025-10-01.md",
					newPathToMemos,
					hasConflict: false,
				},
			];

			//! モックの設定。
			mockVaultHandler.readFile.mockResolvedValue("Old content");
			mockVaultHandler.createFile.mockResolvedValue(undefined);
			mockVaultHandler.writeFile.mockResolvedValue(undefined);
			mockVaultHandler.folderExists.mockReturnValue(true); //! フォルダは既に存在。
			mockVaultHandler.fileExists.mockReturnValue(false); //! ファイルは存在しない。

			const mockFile = Object.create(TFile.prototype);
			mockFile.path = "memolog/daily/2025-10-01.md";
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.delete.mockResolvedValue(undefined);

			const result = await pathMigrator.executeMemoSplitMigration(mappings, true);

			//! 結果を検証。
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(0);
			expect(mockVaultHandler.writeFile).toHaveBeenCalled();
			expect(mockApp.vault.delete).toHaveBeenCalled();
		});

		test("should append to existing file when target exists", async () => {
			const newPathToMemos = new Map([
				[
					"memolog/work/20251001.md",
					[
						{
							id: "1",
							category: "work",
							content: "New memo",
							timestamp: "2025-10-01T10:00:00Z",
							tags: [],
							links: [],
							isPinned: false,
							isDeleted: false,
							deletedAt: undefined,
						},
					],
				],
			]);

			const mappings: MemoSplitMapping[] = [
				{
					oldPath: "memolog/daily/2025-10-01.md",
					newPathToMemos,
					hasConflict: false,
				},
			];

			//! 既存ファイルがある場合。
			mockVaultHandler.readFile.mockImplementation((path: string) => {
				if (path === "memolog/work/20251001.md") {
					return Promise.resolve("Existing content");
				}
				return Promise.resolve("Old content");
			});
			mockVaultHandler.createFile.mockResolvedValue(undefined);
			mockVaultHandler.writeFile.mockResolvedValue(undefined);
			mockVaultHandler.folderExists.mockReturnValue(true);
			mockVaultHandler.fileExists.mockReturnValue(true);

			const mockFile = { path: "memolog/daily/2025-10-01.md" } as TFile;
			mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
			mockApp.vault.delete.mockResolvedValue(undefined);

			await pathMigrator.executeMemoSplitMigration(mappings, true);

			//! 既存コンテンツに追記される。
			expect(mockVaultHandler.writeFile).toHaveBeenCalledTimes(1);
			const writtenContent = mockVaultHandler.writeFile.mock.calls[0][1];
			expect(writtenContent).toContain("Existing content");
			expect(writtenContent).toContain("New memo");
		});

		test("should handle migration errors", async () => {
			const newPathToMemos = new Map([
				[
					"memolog/work/20251001.md",
					[
						{
							id: "1",
							category: "work",
							content: "Work memo",
							timestamp: "2025-10-01T10:00:00Z",
							tags: [],
							links: [],
							isPinned: false,
							isDeleted: false,
							deletedAt: undefined,
						},
					],
				],
			]);

			const mappings: MemoSplitMapping[] = [
				{
					oldPath: "memolog/daily/2025-10-01.md",
					newPathToMemos,
					hasConflict: false,
				},
			];

			//! エラーをシミュレート。
			mockVaultHandler.readFile.mockRejectedValue(new Error("Read error"));

			const result = await pathMigrator.executeMemoSplitMigration(mappings, true);

			//! エラーが記録される。
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(1);
			expect(result.errors.length).toBe(1);
			expect(result.errors[0]).toContain("移動失敗");
		});
	});

	describe("detectCategoryFromContent", () => {
		test("should detect category from file content", async () => {
			mockVaultHandler.getAllCategories.mockResolvedValue(
				new Set(["work", "hobby"])
			);

			const categories = [
				{ name: "Work", directory: "work", icon: "💼", color: "#ff0000" },
				{ name: "Hobby", directory: "hobby", icon: "🎨", color: "#00ff00" },
			];

			const category = await pathMigrator.detectCategoryFromContent(
				"memolog/test.md",
				categories
			);

			expect(category).toBe("work");
		});

		test("should return null when no matching category", async () => {
			mockVaultHandler.getAllCategories.mockResolvedValue(new Set(["unknown"]));

			const categories = [
				{ name: "Work", directory: "work", icon: "💼", color: "#ff0000" },
				{ name: "Hobby", directory: "hobby", icon: "🎨", color: "#00ff00" },
			];

			const category = await pathMigrator.detectCategoryFromContent(
				"memolog/test.md",
				categories
			);

			expect(category).toBeNull();
		});

		test("should handle errors gracefully", async () => {
			mockVaultHandler.getAllCategories.mockRejectedValue(
				new Error("Read error")
			);

			const categories = [
				{ name: "Work", directory: "work", icon: "💼", color: "#ff0000" },
			];

			const category = await pathMigrator.detectCategoryFromContent(
				"memolog/test.md",
				categories
			);

			expect(category).toBeNull();
		});
	});

	describe("planMigrationAdvanced", () => {
		test("should call planMigration internally", async () => {
			const mockFiles = [{ path: "memolog/work/2025-10-01.md" } as TFile];
			mockApp.vault.getMarkdownFiles.mockReturnValue(mockFiles);

			mockVaultHandler.readFile.mockResolvedValue(
				'<!-- memolog: start category="work" -->\nContent\n<!-- memolog: end -->'
			);

			const mappings = await pathMigrator.planMigrationAdvanced(
				"memolog",
				"%Y-%m-%d.md",
				"%Y%m%d.md",
				true,
				true,
				[{ name: "Work", directory: "work", icon: "💼", color: "#ff0000" }],
				"default"
			);

			//! planMigrationと同じ結果が得られる。
			expect(mappings.length).toBe(1);
			expect(mappings[0].oldPath).toBe("memolog/work/2025-10-01.md");
		});
	});
});
