import {
	extractDateFromPath,
	getDateFromWeek,
	extractFromCustomPath,
	detectConflicts,
	detectSplitConflicts,
	isSpecialFile,
	extractCategoryFromDirectory,
} from "../src/utils/path-migration-helpers";
import { CategoryConfig } from "../src/types/settings";
import { PathMapping, MemoSplitMapping } from "../src/utils/path-migrator";

//! path-migration-helpersのテスト。
describe("path-migration-helpers", () => {
	describe("extractDateFromPath", () => {
		test("YYYY-MM-DD形式を抽出", () => {
			const result = extractDateFromPath("work/2025-10-23.md");
			expect(result).toEqual(new Date(2025, 9, 23));
		});

		test("YYYYMMDD形式を抽出", () => {
			const result = extractDateFromPath("work/20251023.md");
			expect(result).toEqual(new Date(2025, 9, 23));
		});

		test("YYYY-MM形式を抽出", () => {
			const result = extractDateFromPath("work/2025-10.md");
			expect(result).toEqual(new Date(2025, 9, 1));
		});

		test("YYYY-Wxx形式を抽出", () => {
			const result = extractDateFromPath("work/2025-W43.md");
			expect(result).toBeDefined();
			if (result !== null) {
				expect(result.getFullYear()).toBe(2025);
			}
		});

		test("YYYY形式を抽出", () => {
			const result = extractDateFromPath("work/2025.md");
			expect(result).toEqual(new Date(2025, 0, 1));
		});

		test("日付が含まれない場合はnull", () => {
			const result = extractDateFromPath("work/memo.md");
			expect(result).toBeNull();
		});

		test("複数の日付形式がある場合は最初にマッチしたものを返す", () => {
			const result = extractDateFromPath("work/2025-10-23-extra-2024-01-01.md");
			expect(result).toEqual(new Date(2025, 9, 23));
		});
	});

	describe("getDateFromWeek", () => {
		test("2025年第1週", () => {
			const result = getDateFromWeek(2025, 1);
			expect(result.getFullYear()).toBe(2024);
			expect(result.getMonth()).toBe(11); // December
			expect(result.getDate()).toBe(30); // Monday
		});

		test("2025年第43週", () => {
			const result = getDateFromWeek(2025, 43);
			expect(result.getFullYear()).toBe(2025);
			expect(result.getMonth()).toBe(9); // October
			expect(result.getDate()).toBe(20); // Monday
		});

		test("2024年第1週", () => {
			const result = getDateFromWeek(2024, 1);
			expect(result.getFullYear()).toBe(2024);
			expect(result.getMonth()).toBe(0); // January
			expect(result.getDate()).toBe(1); // Monday
		});
	});

	describe("extractFromCustomPath", () => {
		const categories: CategoryConfig[] = [
			{ name: "Work", directory: "work", color: "#ff0000", icon: "briefcase" },
			{ name: "Personal", directory: "personal", color: "#00ff00", icon: "user" },
		];

		test("%Cが含まれない場合はnullを返す", () => {
			const result = extractFromCustomPath("work/2025-10-23.md", "%Y-%m-%d.md", categories);
			expect(result).toEqual({ category: null, date: null });
		});

		test("%Cが含まれ、カテゴリがマッチする場合", () => {
			const result = extractFromCustomPath("work/2025-10-23.md", "%C/%Y-%m-%d.md", categories);
			expect(result.category).toBe("work");
			expect(result.date).toEqual(new Date(2025, 9, 23));
		});

		test("カテゴリがマッチしない場合はnull", () => {
			const result = extractFromCustomPath(
				"unknown/2025-10-23.md",
				"%C/%Y-%m-%d.md",
				categories
			);
			expect(result).toEqual({ category: null, date: null });
		});

		test("複数カテゴリの中から正しいものを抽出", () => {
			const result = extractFromCustomPath(
				"personal/2025-10-23.md",
				"%C/%Y-%m-%d.md",
				categories
			);
			expect(result.category).toBe("personal");
		});
	});

	describe("detectConflicts", () => {
		test("競合がない場合", () => {
			const mappings: PathMapping[] = [
				{
					oldPath: "work/old1.md",
					newPath: "work/2025-10-23.md",
					category: "work",
					hasConflict: false,
				},
				{
					oldPath: "work/old2.md",
					newPath: "work/2025-10-24.md",
					category: "work",
					hasConflict: false,
				},
			];

			detectConflicts(mappings);

			expect(mappings[0].hasConflict).toBe(false);
			expect(mappings[1].hasConflict).toBe(false);
		});

		test("競合がある場合", () => {
			const mappings: PathMapping[] = [
				{
					oldPath: "work/old1.md",
					newPath: "work/2025-10-23.md",
					category: "work",
					hasConflict: false,
				},
				{
					oldPath: "work/old2.md",
					newPath: "work/2025-10-23.md",
					category: "work",
					hasConflict: false,
				},
			];

			detectConflicts(mappings);

			expect(mappings[0].hasConflict).toBe(true);
			expect(mappings[1].hasConflict).toBe(true);
		});

		test("部分的な競合", () => {
			const mappings: PathMapping[] = [
				{
					oldPath: "work/old1.md",
					newPath: "work/2025-10-23.md",
					category: "work",
					hasConflict: false,
				},
				{
					oldPath: "work/old2.md",
					newPath: "work/2025-10-23.md",
					category: "work",
					hasConflict: false,
				},
				{
					oldPath: "work/old3.md",
					newPath: "work/2025-10-24.md",
					category: "work",
					hasConflict: false,
				},
			];

			detectConflicts(mappings);

			expect(mappings[0].hasConflict).toBe(true);
			expect(mappings[1].hasConflict).toBe(true);
			expect(mappings[2].hasConflict).toBe(false);
		});
	});

	describe("detectSplitConflicts", () => {
		test("競合がない場合", () => {
			const mappings: MemoSplitMapping[] = [
				{
					oldPath: "work/all.md",
					newPathToMemos: new Map([
						["work/2025-10-23.md", []],
						["work/2025-10-24.md", []],
					]),
					hasConflict: false,
				},
			];

			detectSplitConflicts(mappings);

			expect(mappings[0].hasConflict).toBe(false);
		});

		test("競合がある場合", () => {
			const mappings: MemoSplitMapping[] = [
				{
					oldPath: "work/all1.md",
					newPathToMemos: new Map([["work/2025-10-23.md", []]]),
					hasConflict: false,
				},
				{
					oldPath: "work/all2.md",
					newPathToMemos: new Map([["work/2025-10-23.md", []]]),
					hasConflict: false,
				},
			];

			detectSplitConflicts(mappings);

			expect(mappings[0].hasConflict).toBe(true);
			expect(mappings[1].hasConflict).toBe(true);
		});
	});

	describe("isSpecialFile", () => {
		test("index.mdは特別なファイル", () => {
			expect(isSpecialFile("index.md")).toBe(true);
		});

		test("_trash.mdは特別なファイル", () => {
			expect(isSpecialFile("_trash.md")).toBe(true);
		});

		test("_で始まる.mdファイルは特別なファイル", () => {
			expect(isSpecialFile("_backup.md")).toBe(true);
		});

		test("サブディレクトリのindex.mdは特別ではない", () => {
			expect(isSpecialFile("work/index.md")).toBe(false);
		});

		test("サブディレクトリの_trash.mdは特別ではない", () => {
			expect(isSpecialFile("work/_trash.md")).toBe(false);
		});

		test("通常のファイルは特別ではない", () => {
			expect(isSpecialFile("memo.md")).toBe(false);
			expect(isSpecialFile("work/2025-10-23.md")).toBe(false);
		});

		test("_で始まるが.mdでないファイルは特別ではない", () => {
			expect(isSpecialFile("_config.json")).toBe(false);
		});
	});

	describe("extractCategoryFromDirectory", () => {
		const categories: CategoryConfig[] = [
			{ name: "Work", directory: "work", color: "#ff0000", icon: "briefcase" },
			{ name: "Personal", directory: "personal", color: "#00ff00", icon: "user" },
		];

		test("ディレクトリ名からカテゴリを抽出", () => {
			const result = extractCategoryFromDirectory("work/2025-10-23.md", categories);
			expect(result).toBe("work");
		});

		test("複数階層のパスから最初のディレクトリを使用", () => {
			const result = extractCategoryFromDirectory("personal/2025/10/memo.md", categories);
			expect(result).toBe("personal");
		});

		test("マッチするカテゴリがない場合はnull", () => {
			const result = extractCategoryFromDirectory("unknown/2025-10-23.md", categories);
			expect(result).toBeNull();
		});

		test("ルート直下のファイルの場合はnull", () => {
			const result = extractCategoryFromDirectory("memo.md", categories);
			expect(result).toBeNull();
		});
	});
});
