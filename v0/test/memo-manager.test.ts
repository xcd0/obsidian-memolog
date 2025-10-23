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
}

//! Appのモック（最小限）。
const mockApp = {} as any;

describe("MemoManager", () => {
	let memoManager: MemoManager;
	let mockVaultHandler: MockVaultHandler;

	beforeEach(() => {
		memoManager = new MemoManager(mockApp);
		mockVaultHandler = new MockVaultHandler();
		//! VaultHandlerをモックに置き換え。
		(memoManager as any).vaultHandler = mockVaultHandler;
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
			const content = await mockVaultHandler.getCategoryContent(filePath, category);
			expect(content).toContain("テストメモ");
		});

		it("既存ファイルにメモを追加（昇順: bottom）", async () => {
			//! 最初のメモを追加。
			await memoManager.addMemo(filePath, category, "メモ1", "asc");

			//! 2番目のメモを追加。
			await memoManager.addMemo(filePath, category, "メモ2", "asc");

			const content = await mockVaultHandler.getCategoryContent(filePath, category);
			expect(content).toBeDefined();

			//! メモ1が先、メモ2が後（昇順なのでbottomに追加）。
			const memo1Index = content!.indexOf("メモ1");
			const memo2Index = content!.indexOf("メモ2");
			expect(memo1Index).toBeLessThan(memo2Index);
		});

		it("既存ファイルにメモを追加（降順: top）", async () => {
			//! 最初のメモを追加（降順）。
			await memoManager.addMemo(filePath, category, "メモA", "desc");

			//! 2番目のメモを追加（降順）。
			await memoManager.addMemo(filePath, category, "メモB", "desc");

			const content = await mockVaultHandler.getCategoryContent(filePath, category);
			expect(content).toBeDefined();

			//! メモBが先、メモAが後（降順なのでtopに追加）。
			const memoAIndex = content!.indexOf("メモA");
			const memoBIndex = content!.indexOf("メモB");
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

			const content = await mockVaultHandler.getCategoryContent(filePath, category);
			expect(content).toContain("[[image1.png]]");
			expect(content).toContain("[[image2.jpg]]");
		});
	});

	describe("getMemos", () => {
		const filePath = "test.md";
		const category = "work";

		it("空のファイルから空配列を取得", async () => {
			//! ファイルを初期化。
			await mockVaultHandler.initializeTagPair(filePath, category);

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

			const content = await mockVaultHandler.getCategoryContent(filePath, category);
			expect(content).toMatch(/### \d{4}年\d{2}月\d{2}日 \d{2}時\d{2}分/);
		});

		it("デフォルトテンプレートでメモを追加", async () => {
			await memoManager.addMemo(filePath, category, "デフォルト形式", "asc");

			const content = await mockVaultHandler.getCategoryContent(filePath, category);
			expect(content).toMatch(/## \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
		});
	});
});
