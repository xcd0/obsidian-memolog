import { LinkManager } from "../src/core/link-manager";
import { MemoEntry } from "../src/types";

describe("LinkManager", () => {
	const sampleMemos: MemoEntry[] = [
		{
			id: "memo-1",
			category: "work",
			timestamp: "2025-01-20T10:00:00Z",
			content: "これは[[memo-2]]へのリンクです。",
		},
		{
			id: "memo-2",
			category: "work",
			timestamp: "2025-01-21T14:30:00Z",
			content: "[[memo-1|メモ1]]と[[memo-3]]を参照。",
		},
		{
			id: "memo-3",
			category: "hobby",
			timestamp: "2025-01-22T18:00:00Z",
			content: "リンクなしのメモ。",
		},
		{
			id: "memo-4",
			category: "hobby",
			timestamp: "2025-01-23T09:00:00Z",
			content: "孤立したメモ。",
		},
		{
			id: "memo-5",
			category: "work",
			timestamp: "2025-01-24T12:00:00Z",
			content: "壊れたリンク[[nonexistent]]を含む。",
		},
	];

	describe("リンク抽出", () => {
		test("基本的なリンクを抽出できる", () => {
			const links = LinkManager.extractLinks(sampleMemos[0]);
			expect(links).toHaveLength(1);
			expect(links[0].targetId).toBe("memo-2");
			expect(links[0].sourceId).toBe("memo-1");
		});

		test("名前付きリンクを抽出できる", () => {
			const links = LinkManager.extractLinks(sampleMemos[1]);
			expect(links).toHaveLength(2);
			expect(links[0].targetId).toBe("memo-1");
			expect(links[0].text).toBe("メモ1");
		});

		test("リンクがないメモは空配列を返す", () => {
			const links = LinkManager.extractLinks(sampleMemos[2]);
			expect(links).toHaveLength(0);
		});
	});

	describe("バックリンク取得", () => {
		test("バックリンクを取得できる", () => {
			const backlinks = LinkManager.getBacklinks("memo-2", sampleMemos);
			expect(backlinks).toHaveLength(1);
			expect(backlinks[0].memoId).toBe("memo-1");
		});

		test("複数のバックリンクを取得できる", () => {
			const backlinks = LinkManager.getBacklinks("memo-1", sampleMemos);
			expect(backlinks).toHaveLength(1);
			expect(backlinks[0].memoId).toBe("memo-2");
		});

		test("バックリンクがない場合は空配列", () => {
			const backlinks = LinkManager.getBacklinks("memo-4", sampleMemos);
			expect(backlinks).toHaveLength(0);
		});

		test("バックリンクにプレビューテキストが含まれる", () => {
			const backlinks = LinkManager.getBacklinks("memo-2", sampleMemos);
			expect(backlinks[0].preview).toContain("memo-2");
		});
	});

	describe("プレビューテキスト生成", () => {
		test("リンク周辺のテキストを取得できる", () => {
			const content = "これは長いテキストです。[[memo-2]]へのリンクがあります。";
			const preview = LinkManager.getPreviewText(content, "memo-2", 20);
			expect(preview).toContain("memo-2");
		});

		test("先頭のテキストには省略記号がない", () => {
			const content = "[[memo-1]]は先頭にあります。";
			const preview = LinkManager.getPreviewText(content, "memo-1", 10);
			expect(preview).not.toMatch(/^\.\.\./)
;
		});

		test("末尾のテキストには省略記号がない", () => {
			const content = "最後に[[memo-1]]があります。";
			const preview = LinkManager.getPreviewText(content, "memo-1", 50);
			expect(preview).not.toMatch(/\.\.\.$/);
		});
	});

	describe("リンク作成", () => {
		test("基本的なリンクを作成できる", () => {
			const link = LinkManager.createLink("memo-1");
			expect(link).toBe("[[memo-1]]");
		});

		test("表示テキスト付きリンクを作成できる", () => {
			const link = LinkManager.createLink("memo-1", "メモ1");
			expect(link).toBe("[[memo-1|メモ1]]");
		});
	});

	describe("リンクハイライト", () => {
		test("リンクをHTMLに変換できる", () => {
			const content = "これは[[memo-1]]へのリンクです。";
			const highlighted = LinkManager.highlightLinks(content);
			expect(highlighted).toContain('<a href="#"');
			expect(highlighted).toContain('data-memo-id="memo-1"');
			expect(highlighted).toContain('class="memolog-link"');
		});

		test("名前付きリンクをHTMLに変換できる", () => {
			const content = "[[memo-1|メモ1]]を参照。";
			const highlighted = LinkManager.highlightLinks(content);
			expect(highlighted).toContain('data-memo-id="memo-1"');
			expect(highlighted).toContain(">メモ1</a>");
		});
	});

	describe("リンクグラフ構築", () => {
		test("リンクグラフを構築できる", () => {
			const graph = LinkManager.buildLinkGraph(sampleMemos);
			expect(graph.size).toBe(5);
			expect(graph.get("memo-1")).toEqual(["memo-2"]);
			expect(graph.get("memo-2")).toEqual(["memo-1", "memo-3"]);
		});
	});

	describe("孤立メモ検出", () => {
		test("孤立したメモを検出できる", () => {
			const orphaned = LinkManager.findOrphanedMemos(sampleMemos);
			expect(orphaned).toHaveLength(1);
			expect(orphaned[0].id).toBe("memo-4");
		});
	});

	describe("リンク切れ検出", () => {
		test("リンク切れを検出できる", () => {
			const broken = LinkManager.findBrokenLinks(sampleMemos);
			expect(broken).toHaveLength(1);
			expect(broken[0].targetId).toBe("nonexistent");
			expect(broken[0].sourceId).toBe("memo-5");
		});

		test("全てのリンクが有効な場合は空配列", () => {
			const validMemos = sampleMemos.slice(0, 3);
			const broken = LinkManager.findBrokenLinks(validMemos);
			expect(broken).toHaveLength(0);
		});
	});

	describe("メモIDバリデーション", () => {
		test("有効なメモIDを検証できる", () => {
			expect(LinkManager.isValidMemoId("memo-1")).toBe(true);
			expect(LinkManager.isValidMemoId("memo-123")).toBe(true);
			expect(LinkManager.isValidMemoId("MEMO-ABC")).toBe(true);
		});

		test("無効なメモIDを検出できる", () => {
			expect(LinkManager.isValidMemoId("memo 1")).toBe(false);
			expect(LinkManager.isValidMemoId("memo@1")).toBe(false);
			expect(LinkManager.isValidMemoId("メモ-1")).toBe(false);
		});
	});

	describe("メモID抽出", () => {
		test("リンクテキストからメモIDを抽出できる", () => {
			const id1 = LinkManager.extractMemoId("[[memo-1]]");
			expect(id1).toBe("memo-1");

			const id2 = LinkManager.extractMemoId("[[memo-2|メモ2]]");
			expect(id2).toBe("memo-2");
		});

		test("無効なリンクテキストはnullを返す", () => {
			const id = LinkManager.extractMemoId("memo-1");
			expect(id).toBeNull();
		});
	});
});
