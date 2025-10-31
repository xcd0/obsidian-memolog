import {
	findMemoInFiles,
	findDeletedMemoInFiles,
	extractCategoryFromMemo,
	extractMemoIdFromText,
	findMemoIndexById,
	isMemoPinned,
	isMemoDeleted,
	filterMemologFiles,
	findMemoTextById,
	filterActiveMemos,
	filterDeletedMemos,
	filterPinnedMemos,
} from "../src/core/memo-search-operations";

describe("memo-search-operations", () => {
	describe("findMemoInFiles", () => {
		test("指定されたメモIDを持つメモを検索できる", () => {
			const fileContents = new Map([
				[
					"file1.md",
					`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->
## 2025-10-31 10:00
メモ1

<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z -->
## 2025-10-31 11:00
メモ2`,
				],
				[
					"file2.md",
					`<!-- memo-id: id3, timestamp: 2025-10-31T12:00:00Z -->
## 2025-10-31 12:00
メモ3`,
				],
			]);

			const result = findMemoInFiles(fileContents, "id2");

			expect(result).not.toBeNull();
			expect(result?.filePath).toBe("file1.md");
			expect(result?.memoIndex).toBe(1);
			expect(result?.allMemos).toHaveLength(2);
		});

		test("メモが見つからない場合はnullを返す", () => {
			const fileContents = new Map([
				[
					"file1.md",
					`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->
## 2025-10-31 10:00
メモ1`,
				],
			]);

			const result = findMemoInFiles(fileContents, "nonexistent");

			expect(result).toBeNull();
		});

		test("複数ファイルから最初に見つかったメモを返す", () => {
			const fileContents = new Map([
				[
					"file1.md",
					`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->
## 2025-10-31 10:00
メモ1`,
				],
				[
					"file2.md",
					`<!-- memo-id: id1, timestamp: 2025-10-31T11:00:00Z -->
## 2025-10-31 11:00
メモ1重複`,
				],
			]);

			const result = findMemoInFiles(fileContents, "id1");

			expect(result?.filePath).toBe("file1.md");
		});

		test("空のファイルリストではnullを返す", () => {
			const fileContents = new Map<string, string>();

			const result = findMemoInFiles(fileContents, "id1");

			expect(result).toBeNull();
		});
	});

	describe("findDeletedMemoInFiles", () => {
		test("削除フラグ付きのメモを検索できる", () => {
			const fileContents = new Map([
				[
					"file1.md",
					`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z, deleted: "true", trashedAt: "2025-10-31T15:00:00Z" -->
<!--
## 2025-10-31 10:00
削除されたメモ
-->`,
				],
			]);

			const result = findDeletedMemoInFiles(fileContents, "id1");

			expect(result).not.toBeNull();
			expect(result?.filePath).toBe("file1.md");
			expect(result?.memoIndex).toBe(0);
		});

		test("削除フラグのないメモは検索されない", () => {
			const fileContents = new Map([
				[
					"file1.md",
					`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->
## 2025-10-31 10:00
通常のメモ`,
				],
			]);

			const result = findDeletedMemoInFiles(fileContents, "id1");

			expect(result).toBeNull();
		});

		test("削除フラグ付きメモが複数ある場合は最初のものを返す", () => {
			const fileContents = new Map([
				[
					"file1.md",
					`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z, deleted: "true", trashedAt: "2025-10-31T15:00:00Z" -->
<!--
メモ1
-->`,
				],
				[
					"file2.md",
					`<!-- memo-id: id1, timestamp: 2025-10-31T11:00:00Z, deleted: "true", trashedAt: "2025-10-31T16:00:00Z" -->
<!--
メモ1重複
-->`,
				],
			]);

			const result = findDeletedMemoInFiles(fileContents, "id1");

			expect(result?.filePath).toBe("file1.md");
		});
	});

	describe("extractCategoryFromMemo", () => {
		test("メモテキストからカテゴリ名を抽出できる", () => {
			const memoText = `<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z, category: "work" -->
## 2025-10-31 10:00
メモ内容`;

			const category = extractCategoryFromMemo(memoText);

			expect(category).toBe("work");
		});

		test("カテゴリがない場合はnullを返す", () => {
			const memoText = `<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->
## 2025-10-31 10:00
メモ内容`;

			const category = extractCategoryFromMemo(memoText);

			expect(category).toBeNull();
		});

		test("カテゴリ名に特殊文字が含まれる場合も抽出できる", () => {
			const memoText = `<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z, category: "プロジェクト-A" -->
## 2025-10-31 10:00
メモ内容`;

			const category = extractCategoryFromMemo(memoText);

			expect(category).toBe("プロジェクト-A");
		});
	});

	describe("extractMemoIdFromText", () => {
		test("メモテキストからメモIDを抽出できる", () => {
			const memoText = `<!-- memo-id: test-id-123, timestamp: 2025-10-31T10:00:00Z -->
## 2025-10-31 10:00
メモ内容`;

			const memoId = extractMemoIdFromText(memoText);

			expect(memoId).toBe("test-id-123");
		});

		test("メモIDがない場合はnullを返す", () => {
			const memoText = `## 2025-10-31 10:00
メモ内容`;

			const memoId = extractMemoIdFromText(memoText);

			expect(memoId).toBeNull();
		});

		test("UUIDv7形式のメモIDを抽出できる", () => {
			const memoText = `<!-- memo-id: 01933e4a-7890-7b89-a123-456789abcdef, timestamp: 2025-10-31T10:00:00Z -->
メモ内容`;

			const memoId = extractMemoIdFromText(memoText);

			expect(memoId).toBe("01933e4a-7890-7b89-a123-456789abcdef");
		});
	});

	describe("findMemoIndexById", () => {
		test("メモIDから配列内のインデックスを検索できる", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->メモ1`,
				`<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z -->メモ2`,
				`<!-- memo-id: id3, timestamp: 2025-10-31T12:00:00Z -->メモ3`,
			];

			const index = findMemoIndexById(memos, "id2");

			expect(index).toBe(1);
		});

		test("メモIDが見つからない場合は-1を返す", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->メモ1`,
			];

			const index = findMemoIndexById(memos, "nonexistent");

			expect(index).toBe(-1);
		});

		test("空の配列では-1を返す", () => {
			const memos: string[] = [];

			const index = findMemoIndexById(memos, "id1");

			expect(index).toBe(-1);
		});
	});

	describe("isMemoPinned", () => {
		test("ピン留めフラグがある場合はtrueを返す", () => {
			const memoText = `<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z, pinnedAt: "2025-10-31T15:00:00Z" -->
メモ内容`;

			const result = isMemoPinned(memoText);

			expect(result).toBe(true);
		});

		test("ピン留めフラグがない場合はfalseを返す", () => {
			const memoText = `<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->
メモ内容`;

			const result = isMemoPinned(memoText);

			expect(result).toBe(false);
		});
	});

	describe("isMemoDeleted", () => {
		test("削除フラグがある場合はtrueを返す", () => {
			const memoText = `<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z, deleted: "true", trashedAt: "2025-10-31T15:00:00Z" -->
<!--
削除されたメモ
-->`;

			const result = isMemoDeleted(memoText);

			expect(result).toBe(true);
		});

		test("削除フラグがない場合はfalseを返す", () => {
			const memoText = `<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->
メモ内容`;

			const result = isMemoDeleted(memoText);

			expect(result).toBe(false);
		});
	});

	describe("filterMemologFiles", () => {
		test("rootDirectory配下のファイルのみをフィルタリングできる", () => {
			const fileContents = new Map([
				["memolog/work/2025-10-31.md", "内容1"],
				["memolog/hobby/2025-10-31.md", "内容2"],
				["other/file.md", "内容3"],
				["memolog/index.md", "内容4"],
			]);

			const filtered = filterMemologFiles(fileContents, "memolog");

			expect(filtered.size).toBe(3);
			expect(filtered.has("memolog/work/2025-10-31.md")).toBe(true);
			expect(filtered.has("memolog/hobby/2025-10-31.md")).toBe(true);
			expect(filtered.has("memolog/index.md")).toBe(true);
			expect(filtered.has("other/file.md")).toBe(false);
		});

		test("空のマップに対しても正常に動作する", () => {
			const fileContents = new Map<string, string>();

			const filtered = filterMemologFiles(fileContents, "memolog");

			expect(filtered.size).toBe(0);
		});

		test("全てのファイルが対象外の場合は空のマップを返す", () => {
			const fileContents = new Map([
				["other1/file.md", "内容1"],
				["other2/file.md", "内容2"],
			]);

			const filtered = filterMemologFiles(fileContents, "memolog");

			expect(filtered.size).toBe(0);
		});
	});

	describe("findMemoTextById", () => {
		test("メモIDからメモテキストを検索できる", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->メモ1`,
				`<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z -->メモ2`,
				`<!-- memo-id: id3, timestamp: 2025-10-31T12:00:00Z -->メモ3`,
			];

			const result = findMemoTextById(memos, "id2");

			expect(result).toBe(`<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z -->メモ2`);
		});

		test("メモIDが見つからない場合はnullを返す", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->メモ1`,
			];

			const result = findMemoTextById(memos, "nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("filterActiveMemos", () => {
		test("削除されていないメモのみを抽出できる", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->通常メモ1`,
				`<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z, deleted: "true", trashedAt: "2025-10-31T15:00:00Z" --><!--削除メモ-->`,
				`<!-- memo-id: id3, timestamp: 2025-10-31T12:00:00Z -->通常メモ2`,
			];

			const result = filterActiveMemos(memos);

			expect(result).toHaveLength(2);
			expect(result[0]).toContain("id1");
			expect(result[1]).toContain("id3");
		});

		test("全て削除済みの場合は空配列を返す", () => {
			const memos = [
				`<!-- memo-id: id1, deleted: "true" --><!--削除1-->`,
				`<!-- memo-id: id2, deleted: "true" --><!--削除2-->`,
			];

			const result = filterActiveMemos(memos);

			expect(result).toHaveLength(0);
		});

		test("空の配列に対しても正常に動作する", () => {
			const memos: string[] = [];

			const result = filterActiveMemos(memos);

			expect(result).toHaveLength(0);
		});
	});

	describe("filterDeletedMemos", () => {
		test("削除されたメモのみを抽出できる", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->通常メモ1`,
				`<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z, deleted: "true", trashedAt: "2025-10-31T15:00:00Z" --><!--削除メモ1-->`,
				`<!-- memo-id: id3, timestamp: 2025-10-31T12:00:00Z, deleted: "true", trashedAt: "2025-10-31T16:00:00Z" --><!--削除メモ2-->`,
			];

			const result = filterDeletedMemos(memos);

			expect(result).toHaveLength(2);
			expect(result[0]).toContain("id2");
			expect(result[1]).toContain("id3");
		});

		test("削除されたメモがない場合は空配列を返す", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->通常メモ1`,
				`<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z -->通常メモ2`,
			];

			const result = filterDeletedMemos(memos);

			expect(result).toHaveLength(0);
		});
	});

	describe("filterPinnedMemos", () => {
		test("ピン留めされたメモのみを抽出できる", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->通常メモ`,
				`<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z, pinnedAt: "2025-10-31T15:00:00Z" -->ピン留めメモ1`,
				`<!-- memo-id: id3, timestamp: 2025-10-31T12:00:00Z, pinnedAt: "2025-10-31T16:00:00Z" -->ピン留めメモ2`,
			];

			const result = filterPinnedMemos(memos);

			expect(result).toHaveLength(2);
			expect(result[0]).toContain("id2");
			expect(result[1]).toContain("id3");
		});

		test("ピン留めされたメモがない場合は空配列を返す", () => {
			const memos = [
				`<!-- memo-id: id1, timestamp: 2025-10-31T10:00:00Z -->通常メモ1`,
				`<!-- memo-id: id2, timestamp: 2025-10-31T11:00:00Z -->通常メモ2`,
			];

			const result = filterPinnedMemos(memos);

			expect(result).toHaveLength(0);
		});

		test("空の配列に対しても正常に動作する", () => {
			const memos: string[] = [];

			const result = filterPinnedMemos(memos);

			expect(result).toHaveLength(0);
		});
	});
});
