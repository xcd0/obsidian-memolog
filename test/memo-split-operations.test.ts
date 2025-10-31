import { MemoEntry } from "../src/types/memo";
import {
	groupMemosByCategory,
	sortCategoryGroupsByTimestamp,
	generatePathMappingsFromGroups,
	isSpecialFileForSplit,
	planMemoSplit,
} from "../src/utils/memo-split-operations";

//! memo-split-operationsのテスト。
describe("memo-split-operations", () => {
	//! テスト用のサンプルメモデータ。
	const sampleMemos: MemoEntry[] = [
		{
			id: "memo-1",
			category: "work",
			timestamp: "2025-10-30T14:00:00.000Z",
			content: "仕事のメモ1",
		},
		{
			id: "memo-2",
			category: "personal",
			timestamp: "2025-10-30T12:00:00.000Z",
			content: "個人的なメモ2",
		},
		{
			id: "memo-3",
			category: "work",
			timestamp: "2025-10-30T10:00:00.000Z",
			content: "仕事のメモ3",
		},
		{
			id: "memo-4",
			category: "study",
			timestamp: "2025-10-31T09:00:00.000Z",
			content: "勉強のメモ4",
		},
		{
			id: "memo-5",
			category: "", //! カテゴリなし。
			timestamp: "2025-10-31T11:00:00.000Z",
			content: "カテゴリなしメモ5",
		},
	];

	describe("groupMemosByCategory", () => {
		test("メモをカテゴリごとにグループ化", () => {
			const result = groupMemosByCategory(sampleMemos, "default");

			expect(result.size).toBe(4); //! work, personal, study, default。
			expect(result.get("work")?.length).toBe(2);
			expect(result.get("personal")?.length).toBe(1);
			expect(result.get("study")?.length).toBe(1);
			expect(result.get("default")?.length).toBe(1); //! カテゴリなしはdefaultに分類。
		});

		test("カテゴリなしメモはデフォルトカテゴリに分類", () => {
			const memos: MemoEntry[] = [
				{
					id: "memo-1",
					category: "",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "メモ1",
				},
				{
					id: "memo-2",
					category: "",
					timestamp: "2025-10-30T11:00:00.000Z",
					content: "メモ2",
				},
			];

			const result = groupMemosByCategory(memos, "general");

			expect(result.size).toBe(1);
			expect(result.get("general")?.length).toBe(2);
		});

		test("空のメモ配列をグループ化", () => {
			const result = groupMemosByCategory([], "default");

			expect(result.size).toBe(0);
		});

		test("同じカテゴリのメモを正しくグループ化", () => {
			const memos: MemoEntry[] = [
				{
					id: "memo-1",
					category: "test",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "メモ1",
				},
				{
					id: "memo-2",
					category: "test",
					timestamp: "2025-10-30T11:00:00.000Z",
					content: "メモ2",
				},
				{
					id: "memo-3",
					category: "test",
					timestamp: "2025-10-30T12:00:00.000Z",
					content: "メモ3",
				},
			];

			const result = groupMemosByCategory(memos, "default");

			expect(result.size).toBe(1);
			expect(result.get("test")?.length).toBe(3);
		});
	});

	describe("sortCategoryGroupsByTimestamp", () => {
		test("各カテゴリのメモをタイムスタンプ順にソート", () => {
			const groups = new Map<string, MemoEntry[]>();
			groups.set("work", [sampleMemos[0], sampleMemos[2]]); //! 14:00, 10:00。
			groups.set("personal", [sampleMemos[1]]);

			const result = sortCategoryGroupsByTimestamp(groups);

			expect(result.get("work")?.[0].id).toBe("memo-3"); //! 10:00が先頭。
			expect(result.get("work")?.[1].id).toBe("memo-1"); //! 14:00が2番目。
		});

		test("元のMapを変更しない", () => {
			const groups = new Map<string, MemoEntry[]>();
			const workMemos = [sampleMemos[0], sampleMemos[2]];
			groups.set("work", workMemos);

			const originalOrder = [...workMemos];
			sortCategoryGroupsByTimestamp(groups);

			expect(groups.get("work")).toEqual(originalOrder); //! 元のMapは変更されない。
		});

		test("空のMapをソート", () => {
			const result = sortCategoryGroupsByTimestamp(new Map());

			expect(result.size).toBe(0);
		});

		test("単一メモのグループをソート", () => {
			const groups = new Map<string, MemoEntry[]>();
			groups.set("single", [sampleMemos[0]]);

			const result = sortCategoryGroupsByTimestamp(groups);

			expect(result.get("single")?.length).toBe(1);
			expect(result.get("single")?.[0].id).toBe("memo-1");
		});
	});

	describe("generatePathMappingsFromGroups", () => {
		test("カテゴリグループから新しいパスマッピングを生成", () => {
			const groups = new Map<string, MemoEntry[]>();
			groups.set("work", [
				{
					id: "memo-1",
					category: "work",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "メモ1",
				},
			]);
			groups.set("personal", [
				{
					id: "memo-2",
					category: "personal",
					timestamp: "2025-10-31T10:00:00.000Z",
					content: "メモ2",
				},
			]);

			const pathGenerator = (category: string, date: Date) => {
				const year = date.getFullYear();
				const month = String(date.getMonth() + 1).padStart(2, "0");
				const day = String(date.getDate()).padStart(2, "0");
				return `memolog/${category}/${year}-${month}-${day}.md`;
			};

			const result = generatePathMappingsFromGroups(groups, pathGenerator);

			expect(result.size).toBe(2);
			expect(result.get("memolog/work/2025-10-30.md")?.length).toBe(1);
			expect(result.get("memolog/personal/2025-10-31.md")?.length).toBe(1);
		});

		test("空のメモグループはスキップ", () => {
			const groups = new Map<string, MemoEntry[]>();
			groups.set("empty", []);
			groups.set("work", [sampleMemos[0]]);

			const pathGenerator = (category: string) => `memolog/${category}.md`;

			const result = generatePathMappingsFromGroups(groups, pathGenerator);

			expect(result.size).toBe(1); //! emptyはスキップされる。
			expect(result.has("memolog/work.md")).toBe(true);
		});

		test("空のMapから生成", () => {
			const pathGenerator = (category: string) => `memolog/${category}.md`;

			const result = generatePathMappingsFromGroups(new Map(), pathGenerator);

			expect(result.size).toBe(0);
		});

		test("複数メモを同じパスにマッピング", () => {
			const groups = new Map<string, MemoEntry[]>();
			groups.set("work", [sampleMemos[0], sampleMemos[2]]);

			const pathGenerator = (category: string) => `memolog/${category}.md`;

			const result = generatePathMappingsFromGroups(groups, pathGenerator);

			expect(result.size).toBe(1);
			expect(result.get("memolog/work.md")?.length).toBe(2);
		});
	});

	describe("isSpecialFileForSplit", () => {
		test("index.mdは特別なファイル", () => {
			expect(isSpecialFileForSplit("index.md")).toBe(true);
		});

		test("_trash.mdは特別なファイル", () => {
			expect(isSpecialFileForSplit("_trash.md")).toBe(true);
		});

		test("_で始まる.mdファイルは特別なファイル", () => {
			expect(isSpecialFileForSplit("_archive.md")).toBe(true);
			expect(isSpecialFileForSplit("_backup.md")).toBe(true);
		});

		test("サブディレクトリ内のファイルは特別なファイルではない", () => {
			expect(isSpecialFileForSplit("work/index.md")).toBe(false);
			expect(isSpecialFileForSplit("personal/_trash.md")).toBe(false);
		});

		test("通常のファイルは特別なファイルではない", () => {
			expect(isSpecialFileForSplit("memo.md")).toBe(false);
			expect(isSpecialFileForSplit("notes.md")).toBe(false);
		});

		test(".md以外の_ファイルは特別なファイルではない", () => {
			expect(isSpecialFileForSplit("_config.txt")).toBe(false);
		});
	});

	describe("planMemoSplit", () => {
		test("メモ分割の完全な計画を作成", () => {
			const pathGenerator = (category: string, date: Date) => {
				const year = date.getFullYear();
				const month = String(date.getMonth() + 1).padStart(2, "0");
				const day = String(date.getDate()).padStart(2, "0");
				return `memolog/${category}/${year}-${month}-${day}.md`;
			};

			const result = planMemoSplit(sampleMemos, "default", pathGenerator);

			expect(result.size).toBe(4); //! work, personal, study, default。

			//! workカテゴリは最も古いメモ（memo-3, 10:00）の日付でパス生成。
			const workPath = "memolog/work/2025-10-30.md";
			expect(result.has(workPath)).toBe(true);
			expect(result.get(workPath)?.length).toBe(2);
			expect(result.get(workPath)?.[0].id).toBe("memo-3"); //! ソート済み。
			expect(result.get(workPath)?.[1].id).toBe("memo-1");
		});

		test("空のメモ配列で計画作成", () => {
			const pathGenerator = (category: string) => `memolog/${category}.md`;

			const result = planMemoSplit([], "default", pathGenerator);

			expect(result.size).toBe(0);
		});

		test("単一カテゴリで計画作成", () => {
			const memos: MemoEntry[] = [
				{
					id: "memo-1",
					category: "test",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "メモ1",
				},
				{
					id: "memo-2",
					category: "test",
					timestamp: "2025-10-30T11:00:00.000Z",
					content: "メモ2",
				},
			];

			const pathGenerator = (category: string) => `memolog/${category}.md`;

			const result = planMemoSplit(memos, "default", pathGenerator);

			expect(result.size).toBe(1);
			expect(result.get("memolog/test.md")?.length).toBe(2);
		});

		test("デフォルトカテゴリが正しく適用される", () => {
			const memos: MemoEntry[] = [
				{
					id: "memo-1",
					category: "",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "メモ1",
				},
			];

			const pathGenerator = (category: string) => `memolog/${category}.md`;

			const result = planMemoSplit(memos, "uncategorized", pathGenerator);

			expect(result.size).toBe(1);
			expect(result.has("memolog/uncategorized.md")).toBe(true);
		});

		test("タイムスタンプが正しくソートされる", () => {
			const memos: MemoEntry[] = [
				{
					id: "memo-3",
					category: "test",
					timestamp: "2025-10-30T14:00:00.000Z",
					content: "メモ3",
				},
				{
					id: "memo-1",
					category: "test",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "メモ1",
				},
				{
					id: "memo-2",
					category: "test",
					timestamp: "2025-10-30T12:00:00.000Z",
					content: "メモ2",
				},
			];

			const pathGenerator = (category: string) => `memolog/${category}.md`;

			const result = planMemoSplit(memos, "default", pathGenerator);

			const testMemos = result.get("memolog/test.md");
			expect(testMemos?.[0].id).toBe("memo-1"); //! 10:00。
			expect(testMemos?.[1].id).toBe("memo-2"); //! 12:00。
			expect(testMemos?.[2].id).toBe("memo-3"); //! 14:00。
		});
	});
});
