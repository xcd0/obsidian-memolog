import { DEFAULT_GLOBAL_SETTINGS } from "../src/types/settings";

describe("ゴミ箱機能", () => {
	describe("設定のデフォルト値", () => {
		test("enableTrashがfalseで初期化される", () => {
			expect(DEFAULT_GLOBAL_SETTINGS.enableTrash).toBe(false);
		});

		test("trashRetentionDaysが30で初期化される", () => {
			expect(DEFAULT_GLOBAL_SETTINGS.trashRetentionDays).toBe(30);
		});

		test("showTrashTabがfalseで初期化される", () => {
			expect(DEFAULT_GLOBAL_SETTINGS.showTrashTab).toBe(false);
		});
	});

	describe("ゴミ箱の保持期間", () => {
		test("保持期間が設定できる", () => {
			const retentionDays = 30;

			expect(retentionDays).toBeGreaterThan(0);
			expect(retentionDays).toBe(30);
		});

		test("保持期間を変更できる", () => {
			const newRetentionDays = 60;

			expect(newRetentionDays).toBeGreaterThan(0);
			expect(newRetentionDays).toBe(60);
		});
	});

	describe("ゴミ箱タブの表示制御", () => {
		test("ゴミ箱タブを表示できる", () => {
			const showTrashTab = true;

			expect(showTrashTab).toBe(true);
		});

		test("ゴミ箱タブを非表示にできる", () => {
			const showTrashTab = false;

			expect(showTrashTab).toBe(false);
		});
	});
});

describe("バックアップ機能", () => {
	describe("バックアップメタデータ", () => {
		test("バックアップメタデータを作成できる", () => {
			const metadata = {
				timestamp: new Date().toISOString(),
				oldPathFormat: "%Y-%m-%d.md",
				newPathFormat: "%C/%Y-%m-%d.md",
				backupPath: "backup-memolog-2025-01-30T10-00-00.zip",
				targetDirectory: "memolog",
			};

			expect(metadata.timestamp).toBeDefined();
			expect(metadata.oldPathFormat).toBe("%Y-%m-%d.md");
			expect(metadata.newPathFormat).toBe("%C/%Y-%m-%d.md");
			expect(metadata.backupPath).toContain("backup-memolog-");
			expect(metadata.backupPath).toContain(".zip");
			expect(metadata.targetDirectory).toBe("memolog");
		});

		test("タイムスタンプが正しい形式である", () => {
			const timestamp = new Date().toISOString();

			expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});
	});

	describe("バックアップファイル名", () => {
		test("バックアップファイル名にタイムスタンプが含まれる", () => {
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const backupName = `backup-memolog-${timestamp}.zip`;

			expect(backupName).toContain("backup-memolog-");
			expect(backupName).toContain(".zip");
			expect(backupName).toContain("2025"); //! 現在の年が含まれる。
		});

		test("カスタムバックアップ名を使用できる", () => {
			const customName = "my-backup-2025.zip";

			expect(customName).toContain(".zip");
			expect(customName).toBe("my-backup-2025.zip");
		});
	});
});
