import { BackupManager } from "../src/utils/backup-manager";
import { App, TFile } from "obsidian";

//! BackupManagerのテスト。
describe("BackupManager", () => {
	let app: App;
	let backupManager: BackupManager;

	beforeEach(() => {
		app = {
			vault: {
				adapter: {
					exists: jest.fn(),
					stat: jest.fn(),
				},
				getFiles: jest.fn(),
			},
		} as unknown as App;

		backupManager = new BackupManager(app);
	});

	describe("isGitRepository", () => {
		test(".gitディレクトリが存在する場合はtrueを返す", async () => {
			(app.vault.adapter.exists as jest.Mock).mockResolvedValue(true);
			(app.vault.adapter.stat as jest.Mock).mockResolvedValue({ type: "folder" });

			const result = await backupManager.isGitRepository();

			expect(result).toBe(true);
			expect(app.vault.adapter.exists).toHaveBeenCalledWith(".git");
		});

		test(".gitディレクトリが存在しない場合はfalseを返す", async () => {
			(app.vault.adapter.exists as jest.Mock).mockResolvedValue(false);

			const result = await backupManager.isGitRepository();

			expect(result).toBe(false);
		});

		test(".gitがファイルの場合はfalseを返す", async () => {
			(app.vault.adapter.exists as jest.Mock).mockResolvedValue(true);
			(app.vault.adapter.stat as jest.Mock).mockResolvedValue({ type: "file" });

			const result = await backupManager.isGitRepository();

			expect(result).toBe(false);
		});

		test("エラーが発生した場合はfalseを返す", async () => {
			(app.vault.adapter.exists as jest.Mock).mockRejectedValue(new Error("Test error"));

			const result = await backupManager.isGitRepository();

			expect(result).toBe(false);
		});
	});

	describe("listBackups", () => {
		test("バックアップファイルのリストを返す", () => {
			const mockFiles = [
				{ name: "backup-2025-01-01.zip" } as TFile,
				{ name: "backup-2025-01-02.zip" } as TFile,
				{ name: "regular-file.md" } as TFile,
				{ name: "backup-2025-01-03.txt" } as TFile,
			];

			(app.vault.getFiles as jest.Mock).mockReturnValue(mockFiles);

			const result = backupManager.listBackups("backup-");

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("backup-2025-01-01.zip");
			expect(result[1].name).toBe("backup-2025-01-02.zip");
		});

		test("カスタムプレフィックスでフィルタリングできる", () => {
			const mockFiles = [
				{ name: "custom-backup-1.zip" } as TFile,
				{ name: "backup-1.zip" } as TFile,
				{ name: "custom-backup-2.zip" } as TFile,
			];

			(app.vault.getFiles as jest.Mock).mockReturnValue(mockFiles);

			const result = backupManager.listBackups("custom-backup-");

			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("custom-backup-1.zip");
		});

		test("バックアップファイルがない場合は空配列を返す", () => {
			const mockFiles = [{ name: "regular-file.md" } as TFile];

			(app.vault.getFiles as jest.Mock).mockReturnValue(mockFiles);

			const result = backupManager.listBackups();

			expect(result).toHaveLength(0);
		});
	});

});
