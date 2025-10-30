import {
	formatTimestamp,
	memoToText,
	parseMetadata,
	extractContent,
	extractAttachments,
	commentOutMemo,
	uncommentMemo,
	addFlagToHeader,
	removeFlagFromHeader,
	isDeletedMemo,
	isPinnedMemo,
	updateTodoStatus,
} from "../src/core/memo-helpers";
import { MemoEntry } from "../src/types/memo";

//! memo-helpersのテスト。
describe("memo-helpers", () => {
	describe("formatTimestamp", () => {
		const timestamp = "2025-10-23T14:30:45.000Z";

		test("年月日フォーマット", () => {
			expect(formatTimestamp(timestamp, "%Y-%m-%d")).toBe("2025-10-23");
			expect(formatTimestamp(timestamp, "%Y/%m/%d")).toBe("2025/10/23");
			expect(formatTimestamp(timestamp, "%y-%m-%d")).toBe("25-10-23");
		});

		test("時分秒フォーマット", () => {
			expect(formatTimestamp(timestamp, "%H:%M:%S")).toMatch(/^\d{2}:\d{2}:\d{2}$/);
			expect(formatTimestamp(timestamp, "%I:%M")).toMatch(/^\d{2}:\d{2}$/);
		});

		test("曜日フォーマット", () => {
			const result = formatTimestamp(timestamp, "%A");
			expect(["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"]).toContain(
				result
			);
		});

		test("月名フォーマット", () => {
			expect(formatTimestamp(timestamp, "%B")).toBe("10月");
			expect(formatTimestamp(timestamp, "%b")).toBe("10月");
		});

		test("Unixタイムスタンプ", () => {
			const result = formatTimestamp(timestamp, "%s");
			expect(result).toMatch(/^\d+$/);
		});

		test("複合フォーマット", () => {
			const result = formatTimestamp(timestamp, "## %Y-%m-%d %H:%M");
			expect(result).toMatch(/^## \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
		});
	});

	describe("memoToText", () => {
		const baseMemo: MemoEntry = {
			id: "test-id-123",
			content: "テストメモの内容",
			timestamp: "2025-10-23T14:30:45.000Z",
			category: "work",
		};

		test("基本的なメモ変換", () => {
			const result = memoToText(baseMemo);

			expect(result).toContain("<!-- memo-id: test-id-123");
			expect(result).toContain('timestamp: 2025-10-23T14:30:45.000Z');
			expect(result).toContain('category: "work"');
			expect(result).toContain("テストメモの内容");
		});

		test("カスタムテンプレートの使用", () => {
			const result = memoToText(baseMemo, "# %Y-%m-%d");

			expect(result).toMatch(/# \d{4}-\d{2}-\d{2}/);
		});

		test("{{content}}プレースホルダー", () => {
			const result = memoToText(baseMemo, "メモ: {{content}}");

			expect(result).toContain("メモ: テストメモの内容");
		});

		test("TODOリスト形式", () => {
			const result = memoToText(baseMemo, undefined, true);

			expect(result).toContain("- [ ]");
		});

		test("添付ファイル付きメモ", () => {
			const memoWithAttachments = {
				...baseMemo,
				attachments: ["file1.pdf", "image.png"],
			};

			const result = memoToText(memoWithAttachments);

			expect(result).toContain("添付: [[file1.pdf]], [[image.png]]");
		});

		test("テンプレート保存済みメモ", () => {
			const memoWithTemplate = {
				...baseMemo,
				template: "カスタム: %Y-%m-%d",
			};

			const result = memoToText(memoWithTemplate);

			expect(result).toContain('template: "カスタム: %Y-%m-%d"');
			expect(result).toMatch(/カスタム: \d{4}-\d{2}-\d{2}/);
		});
	});

	describe("parseMetadata", () => {
		test("基本的なメタデータ抽出", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z, category: "work" -->\n内容';

			const result = parseMetadata(text);

			expect(result.id).toBe("test-123");
			expect(result.timestamp).toBe("2025-10-23T14:30:45.000Z");
			expect(result.category).toBe("work");
		});

		test("削除フラグの抽出", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z, deleted: "true", trashedAt: "2025-10-24T10:00:00.000Z" -->\n内容';

			const result = parseMetadata(text);

			expect(result.deleted).toBe(true);
			expect(result.trashedAt).toBe("2025-10-24T10:00:00.000Z");
		});

		test("ピン留めフラグの抽出", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z, pinnedAt: "2025-10-24T10:00:00.000Z" -->\n内容';

			const result = parseMetadata(text);

			expect(result.pinnedAt).toBe("2025-10-24T10:00:00.000Z");
		});

		test("コメントがない場合", () => {
			const text = "普通のテキスト";

			const result = parseMetadata(text);

			expect(result.id).toBeNull();
			expect(result.timestamp).toBeNull();
			expect(result.category).toBeNull();
		});
	});

	describe("extractContent", () => {
		test("コメントヘッダーを除いた内容を抽出", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n## 2025-10-23 14:30\nテストメモの内容';

			const result = extractContent(text);

			expect(result).not.toContain("<!--");
			expect(result).toContain("## 2025-10-23 14:30");
			expect(result).toContain("テストメモの内容");
		});

		test("添付ファイル行を除外", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n内容\n\n添付: [[file.pdf]]';

			const result = extractContent(text);

			expect(result).not.toContain("添付:");
			expect(result).toBe("内容");
		});
	});

	describe("extractAttachments", () => {
		test("添付ファイルを抽出", () => {
			const text = "内容\n\n添付: [[file1.pdf]], [[image.png]]";

			const result = extractAttachments(text);

			expect(result).toEqual(["file1.pdf", "image.png"]);
		});

		test("添付ファイルがない場合", () => {
			const text = "内容のみ";

			const result = extractAttachments(text);

			expect(result).toEqual([]);
		});

		test("単一の添付ファイル", () => {
			const text = "内容\n\n添付: [[document.docx]]";

			const result = extractAttachments(text);

			expect(result).toEqual(["document.docx"]);
		});
	});

	describe("commentOutMemo", () => {
		test("メモをコメントアウト", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n## 2025-10-23\nメモ内容';

			const result = commentOutMemo(text);

			expect(result).toContain("<!-- memo-id: test-123");
			expect(result).toContain("<!--\n## 2025-10-23\nメモ内容\n-->");
		});

		test("空の内容の場合", () => {
			const text = '<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n';

			const result = commentOutMemo(text);

			expect(result).toContain("<!-- memo-id: test-123");
			expect(result).not.toContain("<!--\n\n-->");
		});
	});

	describe("uncommentMemo", () => {
		test("コメントアウトを解除", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n<!--\n## 2025-10-23\nメモ内容\n-->';

			const result = uncommentMemo(text);

			expect(result).toContain("<!-- memo-id: test-123");
			expect(result).not.toContain("<!--\n## 2025-10-23");
			expect(result).toContain("## 2025-10-23\nメモ内容");
		});

		test("コメントアウトされていない場合", () => {
			const text = '<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\nメモ内容';

			const result = uncommentMemo(text);

			expect(result).toBe(text);
		});
	});

	describe("addFlagToHeader", () => {
		test("ヘッダーにフラグを追加", () => {
			const text = '<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n内容';

			const result = addFlagToHeader(text, "deleted", "true");

			expect(result).toContain('deleted: "true"');
			expect(result).toContain("memo-id: test-123");
		});

		test("複数のフラグを追加", () => {
			const text = '<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n内容';

			const withDeleted = addFlagToHeader(text, "deleted", "true");
			const result = addFlagToHeader(withDeleted, "trashedAt", "2025-10-24T10:00:00.000Z");

			expect(result).toContain('deleted: "true"');
			expect(result).toContain('trashedAt: "2025-10-24T10:00:00.000Z"');
		});
	});

	describe("removeFlagFromHeader", () => {
		test("ヘッダーからフラグを削除", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z, deleted: "true" -->\n内容';

			const result = removeFlagFromHeader(text, "deleted");

			expect(result).not.toContain('deleted: "true"');
			expect(result).toContain("memo-id: test-123");
		});

		test("存在しないフラグを削除しても変化なし", () => {
			const text = '<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n内容';

			const result = removeFlagFromHeader(text, "nonexistent");

			expect(result).toBe(text);
		});
	});

	describe("isDeletedMemo", () => {
		test("削除済みメモを検出", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z, deleted: "true" -->\n内容';

			expect(isDeletedMemo(text)).toBe(true);
		});

		test("削除されていないメモ", () => {
			const text = '<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n内容';

			expect(isDeletedMemo(text)).toBe(false);
		});
	});

	describe("isPinnedMemo", () => {
		test("ピン留めメモを検出", () => {
			const text =
				'<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z, pinnedAt: "2025-10-24T10:00:00.000Z" -->\n内容';

			expect(isPinnedMemo(text)).toBe(true);
		});

		test("ピン留めされていないメモ", () => {
			const text = '<!-- memo-id: test-123, timestamp: 2025-10-23T14:30:45.000Z -->\n内容';

			expect(isPinnedMemo(text)).toBe(false);
		});
	});

	describe("updateTodoStatus", () => {
		test("TODOを完了にする", () => {
			const content = "- [ ] タスクの内容";

			const result = updateTodoStatus(content, true);

			expect(result).toBe("- [x] タスクの内容");
		});

		test("TODOを未完了にする", () => {
			const content = "- [x] タスクの内容";

			const result = updateTodoStatus(content, false);

			expect(result).toBe("- [ ] タスクの内容");
		});

		test("TODOチェックボックスがない場合", () => {
			const content = "普通のテキスト";

			const result = updateTodoStatus(content, true);

			expect(result).toBe("普通のテキスト");
		});
	});
});
