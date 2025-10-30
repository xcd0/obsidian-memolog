import {
	createMemoEntry,
	insertMemoIntoList,
	splitFileIntoMemos,
	findMemoIndexById,
	removeMemoFromList,
	updateMemoInList,
	joinMemosToFileContent,
	generateCacheKey,
} from "../src/core/memo-crud-operations";

//! memo-crud-operationsのテスト。
describe("memo-crud-operations", () => {
	describe("createMemoEntry", () => {
		test("基本的なメモエントリの作成", () => {
			const entry = createMemoEntry("work", "テスト内容");

			expect(entry.category).toBe("work");
			expect(entry.content).toBe("テスト内容");
			expect(entry.id).toBeDefined();
			expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		test("既存IDとタイムスタンプを使用", () => {
			const existingId = "test-id-123";
			const existingTimestamp = "2025-10-30T14:30:45.000Z";

			const entry = createMemoEntry("work", "内容", existingId, existingTimestamp);

			expect(entry.id).toBe(existingId);
			expect(entry.timestamp).toBe(existingTimestamp);
		});

		test("添付ファイル付きメモの作成", () => {
			const attachments = ["file1.pdf", "image.png"];

			const entry = createMemoEntry("work", "内容", undefined, undefined, attachments);

			expect(entry.attachments).toEqual(attachments);
		});

		test("テンプレート付きメモの作成", () => {
			const template = "# %Y-%m-%d\n{{content}}";

			const entry = createMemoEntry("work", "内容", undefined, undefined, undefined, template);

			expect(entry.template).toBe(template);
		});

		test("全パラメータ指定", () => {
			const entry = createMemoEntry(
				"personal",
				"全パラメータ",
				"id-456",
				"2025-10-30T10:00:00.000Z",
				["doc.pdf"],
				"template"
			);

			expect(entry.category).toBe("personal");
			expect(entry.content).toBe("全パラメータ");
			expect(entry.id).toBe("id-456");
			expect(entry.timestamp).toBe("2025-10-30T10:00:00.000Z");
			expect(entry.attachments).toEqual(["doc.pdf"]);
			expect(entry.template).toBe("template");
		});
	});

	describe("insertMemoIntoList", () => {
		const existingMemos = [
			"<!-- memo-id: memo-1 -->\n内容1\n",
			"<!-- memo-id: memo-2 -->\n内容2\n",
		];
		const newMemo = "<!-- memo-id: memo-new -->\n新しい内容\n";

		test("先頭に追加", () => {
			const result = insertMemoIntoList(newMemo, existingMemos, true);

			expect(result).toBe(
				"<!-- memo-id: memo-new -->\n新しい内容\n<!-- memo-id: memo-1 -->\n内容1\n<!-- memo-id: memo-2 -->\n内容2\n"
			);
		});

		test("末尾に追加", () => {
			const result = insertMemoIntoList(newMemo, existingMemos, false);

			expect(result).toBe(
				"<!-- memo-id: memo-1 -->\n内容1\n<!-- memo-id: memo-2 -->\n内容2\n<!-- memo-id: memo-new -->\n新しい内容\n"
			);
		});

		test("空のリストに追加", () => {
			const result = insertMemoIntoList(newMemo, [], true);

			expect(result).toBe(newMemo);
		});

		test("1つのメモに追加（先頭）", () => {
			const result = insertMemoIntoList(newMemo, [existingMemos[0]], true);

			expect(result).toBe(
				"<!-- memo-id: memo-new -->\n新しい内容\n<!-- memo-id: memo-1 -->\n内容1\n"
			);
		});

		test("1つのメモに追加（末尾）", () => {
			const result = insertMemoIntoList(newMemo, [existingMemos[0]], false);

			expect(result).toBe(
				"<!-- memo-id: memo-1 -->\n内容1\n<!-- memo-id: memo-new -->\n新しい内容\n"
			);
		});
	});

	describe("splitFileIntoMemos", () => {
		test("複数のメモを分割", () => {
			const fileContent = `<!-- memo-id: memo-1 -->
内容1
<!-- memo-id: memo-2 -->
内容2
<!-- memo-id: memo-3 -->
内容3`;

			const result = splitFileIntoMemos(fileContent);

			expect(result).toHaveLength(3);
			expect(result[0]).toContain("memo-1");
			expect(result[1]).toContain("memo-2");
			expect(result[2]).toContain("memo-3");
		});

		test("1つのメモのみ", () => {
			const fileContent = "<!-- memo-id: memo-1 -->\n内容1";

			const result = splitFileIntoMemos(fileContent);

			expect(result).toHaveLength(1);
			expect(result[0]).toContain("memo-1");
		});

		test("空のファイル", () => {
			const result = splitFileIntoMemos("");

			expect(result).toEqual([]);
		});

		test("空白のみのファイル", () => {
			const result = splitFileIntoMemos("   \n  \n  ");

			expect(result).toEqual([]);
		});

		test("メモ間に空行がある場合", () => {
			const fileContent = `<!-- memo-id: memo-1 -->
内容1

<!-- memo-id: memo-2 -->
内容2`;

			const result = splitFileIntoMemos(fileContent);

			expect(result).toHaveLength(2);
		});
	});

	describe("findMemoIndexById", () => {
		const memoTexts = [
			"<!-- memo-id: memo-1 -->\n内容1",
			"<!-- memo-id: memo-2 -->\n内容2",
			"<!-- memo-id: memo-3 -->\n内容3",
		];

		test("最初のメモを検索", () => {
			const index = findMemoIndexById(memoTexts, "memo-1");

			expect(index).toBe(0);
		});

		test("中間のメモを検索", () => {
			const index = findMemoIndexById(memoTexts, "memo-2");

			expect(index).toBe(1);
		});

		test("最後のメモを検索", () => {
			const index = findMemoIndexById(memoTexts, "memo-3");

			expect(index).toBe(2);
		});

		test("存在しないメモを検索", () => {
			const index = findMemoIndexById(memoTexts, "memo-999");

			expect(index).toBe(-1);
		});

		test("空のリストで検索", () => {
			const index = findMemoIndexById([], "memo-1");

			expect(index).toBe(-1);
		});
	});

	describe("removeMemoFromList", () => {
		const memoTexts = [
			"<!-- memo-id: memo-1 -->\n内容1",
			"<!-- memo-id: memo-2 -->\n内容2",
			"<!-- memo-id: memo-3 -->\n内容3",
		];

		test("最初のメモを削除", () => {
			const result = removeMemoFromList(memoTexts, "memo-1");

			expect(result.removed).toBe(true);
			expect(result.memos).toHaveLength(2);
			expect(result.memos[0]).toContain("memo-2");
			expect(result.memos[1]).toContain("memo-3");
		});

		test("中間のメモを削除", () => {
			const result = removeMemoFromList(memoTexts, "memo-2");

			expect(result.removed).toBe(true);
			expect(result.memos).toHaveLength(2);
			expect(result.memos[0]).toContain("memo-1");
			expect(result.memos[1]).toContain("memo-3");
		});

		test("最後のメモを削除", () => {
			const result = removeMemoFromList(memoTexts, "memo-3");

			expect(result.removed).toBe(true);
			expect(result.memos).toHaveLength(2);
			expect(result.memos[0]).toContain("memo-1");
			expect(result.memos[1]).toContain("memo-2");
		});

		test("存在しないメモを削除", () => {
			const result = removeMemoFromList(memoTexts, "memo-999");

			expect(result.removed).toBe(false);
			expect(result.memos).toEqual(memoTexts);
		});

		test("1つのメモのみのリストから削除", () => {
			const singleMemo = ["<!-- memo-id: memo-1 -->\n内容1"];
			const result = removeMemoFromList(singleMemo, "memo-1");

			expect(result.removed).toBe(true);
			expect(result.memos).toHaveLength(0);
		});

		test("空のリストから削除", () => {
			const result = removeMemoFromList([], "memo-1");

			expect(result.removed).toBe(false);
			expect(result.memos).toEqual([]);
		});
	});

	describe("updateMemoInList", () => {
		const memoTexts = [
			"<!-- memo-id: memo-1 -->\n内容1",
			"<!-- memo-id: memo-2 -->\n内容2",
			"<!-- memo-id: memo-3 -->\n内容3",
		];
		const newMemoText = "<!-- memo-id: memo-2 -->\n更新された内容2";

		test("最初のメモを更新", () => {
			const newText = "<!-- memo-id: memo-1 -->\n更新された内容1";
			const result = updateMemoInList(memoTexts, "memo-1", newText);

			expect(result.updated).toBe(true);
			expect(result.memos).toHaveLength(3);
			expect(result.memos[0]).toBe(newText);
			expect(result.memos[1]).toContain("memo-2");
			expect(result.memos[2]).toContain("memo-3");
		});

		test("中間のメモを更新", () => {
			const result = updateMemoInList(memoTexts, "memo-2", newMemoText);

			expect(result.updated).toBe(true);
			expect(result.memos).toHaveLength(3);
			expect(result.memos[0]).toContain("memo-1");
			expect(result.memos[1]).toBe(newMemoText);
			expect(result.memos[2]).toContain("memo-3");
		});

		test("最後のメモを更新", () => {
			const newText = "<!-- memo-id: memo-3 -->\n更新された内容3";
			const result = updateMemoInList(memoTexts, "memo-3", newText);

			expect(result.updated).toBe(true);
			expect(result.memos).toHaveLength(3);
			expect(result.memos[2]).toBe(newText);
		});

		test("存在しないメモを更新", () => {
			const result = updateMemoInList(memoTexts, "memo-999", newMemoText);

			expect(result.updated).toBe(false);
			expect(result.memos).toEqual(memoTexts);
		});

		test("1つのメモのみのリストを更新", () => {
			const singleMemo = ["<!-- memo-id: memo-1 -->\n内容1"];
			const newText = "<!-- memo-id: memo-1 -->\n更新された内容1";
			const result = updateMemoInList(singleMemo, "memo-1", newText);

			expect(result.updated).toBe(true);
			expect(result.memos).toHaveLength(1);
			expect(result.memos[0]).toBe(newText);
		});

		test("空のリストを更新", () => {
			const result = updateMemoInList([], "memo-1", newMemoText);

			expect(result.updated).toBe(false);
			expect(result.memos).toEqual([]);
		});
	});

	describe("joinMemosToFileContent", () => {
		test("複数のメモを結合", () => {
			const memos = [
				"<!-- memo-id: memo-1 -->\n内容1\n",
				"<!-- memo-id: memo-2 -->\n内容2\n",
				"<!-- memo-id: memo-3 -->\n内容3\n",
			];

			const result = joinMemosToFileContent(memos);

			expect(result).toBe(
				"<!-- memo-id: memo-1 -->\n内容1\n<!-- memo-id: memo-2 -->\n内容2\n<!-- memo-id: memo-3 -->\n内容3\n"
			);
		});

		test("1つのメモのみ", () => {
			const memos = ["<!-- memo-id: memo-1 -->\n内容1\n"];

			const result = joinMemosToFileContent(memos);

			expect(result).toBe("<!-- memo-id: memo-1 -->\n内容1\n");
		});

		test("空のリスト", () => {
			const result = joinMemosToFileContent([]);

			expect(result).toBe("");
		});

		test("改行なしのメモ", () => {
			const memos = ["<!-- memo-id: memo-1 -->内容1", "<!-- memo-id: memo-2 -->内容2"];

			const result = joinMemosToFileContent(memos);

			expect(result).toBe("<!-- memo-id: memo-1 -->内容1<!-- memo-id: memo-2 -->内容2");
		});
	});

	describe("generateCacheKey", () => {
		test("基本的なキャッシュキー生成", () => {
			const key = generateCacheKey("memolog/2025-10-30.md", "work");

			expect(key).toBe("memolog/2025-10-30.md::work");
		});

		test("異なるファイルパスとカテゴリ", () => {
			const key1 = generateCacheKey("path1/file.md", "category1");
			const key2 = generateCacheKey("path2/file.md", "category2");

			expect(key1).toBe("path1/file.md::category1");
			expect(key2).toBe("path2/file.md::category2");
			expect(key1).not.toBe(key2);
		});

		test("空のカテゴリ", () => {
			const key = generateCacheKey("memolog/file.md", "");

			expect(key).toBe("memolog/file.md::");
		});

		test("特殊文字を含むパス", () => {
			const key = generateCacheKey("memo log/2025-10-30 (1).md", "work/project");

			expect(key).toBe("memo log/2025-10-30 (1).md::work/project");
		});
	});
});
