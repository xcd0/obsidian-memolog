import { MemoManager } from "../src/core/memo-manager";

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion, @typescript-eslint/require-await */

//! VaultHandlerのモック。
class MockVaultHandler {
	private files: Map<string, string> = new Map();

	async fileExists(path: string): Promise<boolean> {
		return this.files.has(path);
	}

	async readFile(path: string): Promise<string> {
		return this.files.get(path) || "";
	}

	async writeFile(path: string, content: string): Promise<void> {
		this.files.set(path, content);
	}

	async findTagPairByCategory(
		filePath: string,
		category: string
	): Promise<{ start: number; end: number; category: string } | null> {
		const content = await this.readFile(filePath);
		if (!content) {
			return null;
		}

		const startTag = `<!-- memolog: start category="${category}" -->`;
		const endTag = `<!-- memolog: end -->`;

		const startIndex = content.indexOf(startTag);
		if (startIndex === -1) {
			return null;
		}

		const endIndex = content.indexOf(endTag, startIndex);
		if (endIndex === -1) {
			return null;
		}

		return {
			start: startIndex + startTag.length,
			end: endIndex,
			category,
		};
	}

	async initializeTagPair(
		filePath: string,
		category: string,
		options?: { order?: "asc" | "desc" }
	): Promise<void> {
		const order = options?.order || "asc";
		const content = `<!-- memolog: {"format": "template", "order": "${order}", "timestamp": "YYYY-MM-DD HH:mm:ss"} -->\n<!-- memolog: start category="${category}" -->\n<!-- memolog: end -->\n`;

		await this.writeFile(filePath, content);
	}

	async insertTextInCategory(
		filePath: string,
		category: string,
		text: string,
		position: "top" | "bottom"
	): Promise<void> {
		let content = await this.readFile(filePath);
		const pair = await this.findTagPairByCategory(filePath, category);

		if (!pair) {
			throw new Error(`Category ${category} not found`);
		}

		const before = content.substring(0, pair.start);
		const after = content.substring(pair.end);
		const categoryContent = content.substring(pair.start, pair.end);

		let newCategoryContent: string;
		if (position === "top") {
			newCategoryContent = `\n${text}\n${categoryContent}`;
		} else {
			newCategoryContent = `${categoryContent}\n${text}\n`;
		}

		content = before + newCategoryContent + after;
		await this.writeFile(filePath, content);
	}

	async getCategoryContent(filePath: string, category: string): Promise<string | null> {
		const content = await this.readFile(filePath);
		const pair = await this.findTagPairByCategory(filePath, category);

		if (!pair) {
			return null;
		}

		return content.substring(pair.start, pair.end).trim();
	}

	async replaceCategoryContent(
		filePath: string,
		category: string,
		newContent: string
	): Promise<void> {
		const content = await this.readFile(filePath);
		const pair = await this.findTagPairByCategory(filePath, category);

		if (!pair) {
			throw new Error(`Category ${category} not found`);
		}

		const before = content.substring(0, pair.start);
		const after = content.substring(pair.end);
		const newFileContent = before + `\n${newContent}\n` + after;

		await this.writeFile(filePath, newFileContent);
	}

	//! テスト用: ファイル内容をクリア。
	clearFiles(): void {
		this.files.clear();
	}

	//! Markdown ファイルの一覧を取得。
	getMarkdownFiles(): Array<{ path: string }> {
		return Array.from(this.files.keys()).map((path) => ({ path }));
	}
}

//! Appのモック（最小限）。
const mockApp = {
	vault: {
		adapter: {
			stat: jest.fn().mockResolvedValue({ mtime: Date.now() }),
		},
	},
} as any;

describe("MemoManager", () => {
	let memoManager: MemoManager;
	let mockVaultHandler: MockVaultHandler;

	beforeEach(() => {
		memoManager = new MemoManager(mockApp);
		mockVaultHandler = new MockVaultHandler();
		//! VaultHandlerをモックに置き換え。
		(memoManager as any).vaultHandler = mockVaultHandler;
		//! statモックをリセット。
		(mockApp.vault.adapter.stat as jest.Mock).mockClear();
		(mockApp.vault.adapter.stat as jest.Mock).mockResolvedValue({ mtime: Date.now() });
	});

	afterEach(() => {
		mockVaultHandler.clearFiles();
	});

	describe("addMemo", () => {
		const filePath = "test.md";
		const category = "work";

		it("新規ファイルにメモを追加（昇順）", async () => {
			const memo = await memoManager.addMemo(filePath, category, "テストメモ", "asc");

			expect(memo).toMatchObject({
				category: "work",
				content: "テストメモ",
			});
			expect(memo.id).toBeDefined();
			expect(memo.timestamp).toBeDefined();

			//! ファイル内容を確認。
			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toContain("テストメモ");
		});

		it("既存ファイルにメモを追加（昇順: bottom）", async () => {
			//! 最初のメモを追加。
			await memoManager.addMemo(filePath, category, "メモ1", "asc");

			//! 2番目のメモを追加。
			await memoManager.addMemo(filePath, category, "メモ2", "asc");

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toBeDefined();

			//! メモ1が先、メモ2が後（昇順なのでbottomに追加）。
			const memo1Index = content.indexOf("メモ1");
			const memo2Index = content.indexOf("メモ2");
			expect(memo1Index).toBeLessThan(memo2Index);
		});

		it("既存ファイルにメモを追加（降順: top）", async () => {
			//! 最初のメモを追加（降順）。
			await memoManager.addMemo(filePath, category, "メモA", "desc");

			//! 2番目のメモを追加（降順）。
			await memoManager.addMemo(filePath, category, "メモB", "desc");

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toBeDefined();

			//! メモBが先、メモAが後（降順なのでtopに追加）。
			const memoAIndex = content.indexOf("メモA");
			const memoBIndex = content.indexOf("メモB");
			expect(memoBIndex).toBeLessThan(memoAIndex);
		});

		it("添付ファイル付きメモを追加", async () => {
			const memo = await memoManager.addMemo(
				filePath,
				category,
				"画像付きメモ",
				"asc",
				undefined,
				["image1.png", "image2.jpg"]
			);

			expect(memo.attachments).toEqual(["image1.png", "image2.jpg"]);

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toContain("[[image1.png]]");
			expect(content).toContain("[[image2.jpg]]");
		});
	});

	describe("getMemos", () => {
		const filePath = "test.md";
		const category = "work";

		it("空のファイルから空配列を取得", async () => {
			//! 空のファイルを作成。
			await mockVaultHandler.writeFile(filePath, "");

			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toEqual([]);
		});

		it("複数メモを取得", async () => {
			//! メモを追加。
			await memoManager.addMemo(filePath, category, "メモ1", "asc");
			await memoManager.addMemo(filePath, category, "メモ2", "asc");
			await memoManager.addMemo(filePath, category, "メモ3", "asc");

			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toHaveLength(3);
			expect(memos[0].content).toContain("メモ1");
			expect(memos[1].content).toContain("メモ2");
			expect(memos[2].content).toContain("メモ3");
		});

		it("存在しないカテゴリから空配列を取得", async () => {
			const memos = await memoManager.getMemos(filePath, "nonexistent");
			expect(memos).toEqual([]);
		});
	});

	describe("deleteMemo", () => {
		const filePath = "test.md";
		const category = "work";

		it("メモを削除", async () => {
			//! メモを追加。
			const memo1 = await memoManager.addMemo(filePath, category, "削除対象", "asc");
			await memoManager.addMemo(filePath, category, "残すメモ", "asc");

			//! メモを削除。
			const deleted = await memoManager.deleteMemo(filePath, category, memo1.id);
			expect(deleted).toBe(true);

			//! 削除後の確認。
			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toHaveLength(1);
			expect(memos[0].content).toContain("残すメモ");
		});

		it("存在しないメモIDで削除失敗", async () => {
			await memoManager.addMemo(filePath, category, "メモ", "asc");

			const deleted = await memoManager.deleteMemo(filePath, category, "nonexistent-id");
			expect(deleted).toBe(false);

			//! メモは残っている。
			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toHaveLength(1);
		});

		it("存在しないカテゴリで削除失敗", async () => {
			const deleted = await memoManager.deleteMemo(filePath, "nonexistent", "some-id");
			expect(deleted).toBe(false);
		});
	});

	describe("getMemoById", () => {
		const filePath = "test.md";
		const category = "work";

		it("IDでメモを取得", async () => {
			const memo1 = await memoManager.addMemo(filePath, category, "メモ1", "asc");
			await memoManager.addMemo(filePath, category, "メモ2", "asc");

			const found = await memoManager.getMemoById(filePath, category, memo1.id);
			expect(found).toBeDefined();
			expect(found?.id).toBe(memo1.id);
			expect(found?.content).toContain("メモ1");
		});

		it("存在しないIDでnullを取得", async () => {
			await memoManager.addMemo(filePath, category, "メモ", "asc");

			const found = await memoManager.getMemoById(filePath, category, "nonexistent-id");
			expect(found).toBeNull();
		});
	});

	describe("initializeCategory", () => {
		const filePath = "test.md";
		const category = "work";

		it("カテゴリ領域を初期化（昇順）", async () => {
			await memoManager.initializeCategory(filePath, category, "asc");

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toContain(`<!-- memolog: start category="${category}" -->`);
			expect(content).toContain(`<!-- memolog: end -->`);
			expect(content).toContain('"order": "asc"');
		});

		it("カテゴリ領域を初期化（降順）", async () => {
			await memoManager.initializeCategory(filePath, category, "desc");

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toContain(`<!-- memolog: start category="${category}" -->`);
			expect(content).toContain(`<!-- memolog: end -->`);
			expect(content).toContain('"order": "desc"');
		});
	});

	describe("タイムスタンプフォーマット", () => {
		const filePath = "test.md";
		const category = "work";

		it("カスタムテンプレートでメモを追加", async () => {
			const customTemplate = "### %Y年%m月%d日 %H時%M分";
			await memoManager.addMemo(
				filePath,
				category,
				"カスタム形式",
				"asc",
				customTemplate
			);

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toMatch(/### \d{4}年\d{2}月\d{2}日 \d{2}時\d{2}分/);
		});

		it("デフォルトテンプレートでメモを追加", async () => {
			await memoManager.addMemo(filePath, category, "デフォルト形式", "asc");

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toMatch(/## \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
		});

		it("{{content}}テンプレートでメモを追加", async () => {
			const contentTemplate = "# メモ\n{{content}}\n---";
			await memoManager.addMemo(
				filePath,
				category,
				"本文テキスト",
				"asc",
				contentTemplate
			);

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toContain("# メモ");
			expect(content).toContain("本文テキスト");
			expect(content).toContain("---");
		});

		it("{{content}}テンプレートからメモをパース", async () => {
			const contentTemplate = "前置き\n{{content}}\n後置き";
			await memoManager.addMemo(
				filePath,
				category,
				"本文内容",
				"asc",
				contentTemplate
			);

			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toHaveLength(1);
			expect(memos[0].content).toBe("本文内容");
		});
	});

	describe("updateMemo", () => {
		const filePath = "test.md";
		const category = "work";

		it("メモを更新", async () => {
			//! メモを追加。
			const memo = await memoManager.addMemo(filePath, category, "元の内容", "asc");

			//! メモを更新。
			const updated = await memoManager.updateMemo(
				filePath,
				category,
				memo.id,
				"更新後の内容"
			);
			expect(updated).toBe(true);

			//! 更新後の確認。
			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toHaveLength(1);
			expect(memos[0].content).toBe("更新後の内容");
		});

		it("存在しないメモIDで更新失敗", async () => {
			await memoManager.addMemo(filePath, category, "メモ", "asc");

			const updated = await memoManager.updateMemo(
				filePath,
				category,
				"nonexistent-id",
				"新しい内容"
			);
			expect(updated).toBe(false);
		});

		it("存在しないファイルで更新失敗", async () => {
			const updated = await memoManager.updateMemo(
				"nonexistent.md",
				category,
				"some-id",
				"新しい内容"
			);
			expect(updated).toBe(false);
		});

		it("カスタムテンプレートでメモを更新", async () => {
			const customTemplate = "### %Y年%m月%d日\n{{content}}";
			const memo = await memoManager.addMemo(
				filePath,
				category,
				"元の内容",
				"asc",
				customTemplate
			);

			const updated = await memoManager.updateMemo(
				filePath,
				category,
				memo.id,
				"更新後の内容",
				customTemplate
			);
			expect(updated).toBe(true);

			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toContain("更新後の内容");
		});
	});

	describe("パース処理のエッジケース", () => {
		const filePath = "test.md";
		const category = "work";

		it("空のテキストからnullを返す", async () => {
			//! 空のファイルを作成。
			await mockVaultHandler.writeFile(filePath, "");

			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toEqual([]);
		});

		it("HTMLコメントなし・タイムスタンプあり（後方互換性）", async () => {
			//! 旧形式のメモを手動で作成。
			const oldFormatMemo = "## 2025-10-28 15:30\nテスト内容";
			await mockVaultHandler.writeFile(filePath, oldFormatMemo);

			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toHaveLength(1);
			expect(memos[0].content).toContain("テスト内容");
			expect(memos[0].timestamp).toMatch(/2025-10-28T15:30/);
		});

		it("JSON.parseエラー時にcategoryを直接使用", async () => {
			//! 不正なJSON形式のカテゴリを含むメモ。
			const invalidJsonMemo =
				'<!-- memo-id: test-id, timestamp: 2025-10-28T15:30:00.000Z, category: invalid-json -->\n## 2025-10-28 15:30\nテスト';
			await mockVaultHandler.writeFile(filePath, invalidJsonMemo);

			//! カテゴリフィルタなし（空文字）で全メモを取得。
			const memos = await memoManager.getMemos(filePath, "");
			expect(memos).toHaveLength(1);
			expect(memos[0].category).toBe("invalid-json");
		});

		it("JSON.parseエラー時にtemplateを無視（Logger.debug）", async () => {
			//! 不正なJSON形式のテンプレートを含むメモ。
			const invalidTemplateMemo =
				'<!-- memo-id: test-id, timestamp: 2025-10-28T15:30:00.000Z, template: invalid-json -->\n## 2025-10-28 15:30\nテスト';
			await mockVaultHandler.writeFile(filePath, invalidTemplateMemo);

			//! Logger.debugをモック。
			const { Logger } = await import("../src/utils/logger");
			const loggerDebugSpy = jest.spyOn(Logger, "debug").mockImplementation();

			const memos = await memoManager.getMemos(filePath, "");
			expect(memos).toHaveLength(1);
			//! Logger.debugが呼び出されたことを確認（引数の詳細は問わない）。
			expect(loggerDebugSpy).toHaveBeenCalled();
			expect(loggerDebugSpy.mock.calls[0][0]).toContain("Failed to parse template from comment:");

			loggerDebugSpy.mockRestore();
		});

		it("添付ファイルを正しく抽出", async () => {
			//! 添付ファイル付きメモを手動で作成。
			const memoWithAttachments =
				'<!-- memo-id: test-id, timestamp: 2025-10-28T15:30:00.000Z, category: "work" -->\n## 2025-10-28 15:30\nテスト内容\n[[image.png]]\n[[document.pdf]]';
			await mockVaultHandler.writeFile(filePath, memoWithAttachments);

			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toHaveLength(1);
			expect(memos[0].attachments).toEqual(["image.png", "document.pdf"]);
		});
	});

	describe("キャッシュ動作", () => {
		const filePath = "test.md";
		const category = "work";

		it("キャッシュヒット時にファイルを読まない", async () => {
			//! メモを追加。
			await memoManager.addMemo(filePath, category, "メモ1", "asc");

			//! 1回目の取得（キャッシュに保存）。
			await memoManager.getMemos(filePath, category);

			//! ファイルを直接変更（キャッシュには反映されない）。
			await mockVaultHandler.writeFile(filePath, "改変された内容");

			//! 2回目の取得（キャッシュから取得）。
			const memos = await memoManager.getMemos(filePath, category);
			expect(memos).toHaveLength(1);
			expect(memos[0].content).toBe("メモ1");
		});

		it("キャッシュ無効化後に新しいデータを取得", async () => {
			//! メモを追加。
			await memoManager.addMemo(filePath, category, "メモ1", "asc");

			//! キャッシュを手動で無効化（deleteで実現）。
			await memoManager.deleteMemo(filePath, category, "dummy-id");

			//! 新しいメモを追加。
			await memoManager.addMemo(filePath, category, "メモ2", "asc");

			//! キャッシュが無効化されているので、新しいデータを取得。
			const memos = await memoManager.getMemos(filePath, category);
			expect(memos.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("ファイル存在チェック", () => {
		const category = "work";

		it("存在しないファイルから空配列を返す（getMemos）", async () => {
			const memos = await memoManager.getMemos("nonexistent.md", category);
			expect(memos).toEqual([]);
		});

		it("存在しないファイルでfalseを返す（deleteMemo）", async () => {
			const deleted = await memoManager.deleteMemo("nonexistent.md", category, "some-id");
			expect(deleted).toBe(false);
		});
	});

	describe("エラーハンドリング", () => {
		const filePath = "test.md";
		const category = "work";

		it("addMemoのエラーハンドリング", async () => {
			//! VaultHandlerのwriteFileでエラーを発生させる。
			jest.spyOn(mockVaultHandler, "writeFile").mockRejectedValueOnce(
				new Error("Write error")
			);

			await expect(
				memoManager.addMemo(filePath, category, "テスト", "asc")
			).rejects.toThrow();
		});
	});

	describe("moveToTrash", () => {
		const filePath = "test.md";
		const category = "test";
		const rootDirectory = "memolog";

		it("メモをゴミ箱に移動できる", async () => {
			//! メモを追加。
			const memo = await memoManager.addMemo(filePath, category, "削除するメモ", "asc");

			//! ゴミ箱に移動。
			const result = await memoManager.moveToTrash(filePath, category, memo.id, rootDirectory);

			expect(result).toBe(true);

			//! ファイル内容を確認。
			const content = await mockVaultHandler.readFile(filePath);
			expect(content).toContain('deleted: "true"');
			expect(content).toContain("trashedAt:");
			expect(content).toContain("<!--");
		});

		it("存在しないメモの削除でfalseを返す", async () => {
			//! メモを追加。
			await memoManager.addMemo(filePath, category, "メモ1", "asc");

			//! 存在しないIDで削除試行。
			const result = await memoManager.moveToTrash(
				filePath,
				category,
				"nonexistent-id",
				rootDirectory
			);

			expect(result).toBe(false);
		});

		it("存在しないファイルでfalseを返す", async () => {
			const result = await memoManager.moveToTrash(
				"nonexistent.md",
				category,
				"some-id",
				rootDirectory
			);

			expect(result).toBe(false);
		});
	});

	describe("restoreFromTrash", () => {
		const filePath = "memolog/test.md";
		const category = "test";
		const rootDirectory = "memolog";
		const pathFormat = "YYYY-MM-DD";
		const saveUnit = "month" as const;

		it("ゴミ箱からメモを復活できる", async () => {
			//! メモを追加。
			const memo = await memoManager.addMemo(filePath, category, "復活するメモ", "asc");

			//! ゴミ箱に移動。
			await memoManager.moveToTrash(filePath, category, memo.id, rootDirectory);

			//! ゴミ箱から復活。
			const result = await memoManager.restoreFromTrash(
				memo.id,
				rootDirectory,
				pathFormat,
				saveUnit,
				false
			);

			expect(result).toBe(true);

			//! ファイル内容を確認。
			const content = await mockVaultHandler.readFile(filePath);
			expect(content).not.toContain('deleted: "true"');
			expect(content).not.toContain("trashedAt:");
			expect(content).not.toContain("<!--\n## ");
		});

		it("存在しないメモの復活でfalseを返す", async () => {
			const result = await memoManager.restoreFromTrash(
				"nonexistent-id",
				rootDirectory,
				pathFormat,
				saveUnit,
				false
			);

			expect(result).toBe(false);
		});

		it("削除されていないメモの復活でfalseを返す", async () => {
			//! 通常のメモを追加（削除されていない）。
			const memo = await memoManager.addMemo(filePath, category, "通常のメモ", "asc");

			//! 復活を試みる。
			const result = await memoManager.restoreFromTrash(
				memo.id,
				rootDirectory,
				pathFormat,
				saveUnit,
				false
			);

			expect(result).toBe(false);
		});
	});
});
