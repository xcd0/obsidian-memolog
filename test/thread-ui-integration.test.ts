import { MemoManager } from "../src/core/memo-manager";
import { TFile } from "obsidian";

//! モックApp型定義。
interface MockApp {
	vault: {
		adapter: {
			stat: jest.Mock;
			exists: jest.Mock;
			read: jest.Mock;
			write: jest.Mock;
		};
		getAbstractFileByPath: jest.Mock;
		read: jest.Mock;
		create: jest.Mock;
		modify: jest.Mock;
	};
}

//! MemoManagerのモックセットアップ用ヘルパー。
function createMockApp(): MockApp {
	const mockFile = Object.create(TFile.prototype) as TFile;
	mockFile.path = "test.md";
	mockFile.basename = "test";
	mockFile.extension = "md";

	return {
		vault: {
			adapter: {
				stat: jest.fn().mockResolvedValue({ mtime: Date.now() }),
				exists: jest.fn().mockResolvedValue(true),
				read: jest.fn().mockResolvedValue(""),
				write: jest.fn().mockResolvedValue(undefined),
			},
			getAbstractFileByPath: jest.fn().mockReturnValue(mockFile),
			read: jest.fn().mockResolvedValue(""),
			create: jest.fn().mockResolvedValue(mockFile),
			modify: jest.fn().mockResolvedValue(undefined),
		},
	};
}

describe("スレッドUI統合テスト", () => {
	let app: MockApp;
	let memoManager: MemoManager;

	beforeEach(() => {
		app = createMockApp();
		memoManager = new MemoManager(app as never);
	});

	describe("返信投稿フロー", () => {
		test("親メモへの返信が正しく作成され、スレッド構造が構築される", async () => {
			//! 初期状態: 親メモのみ。
			const initialContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`;
			app.vault.read.mockResolvedValue(initialContent);

			//! 返信を追加。
			await memoManager.addReply("test.md", "work", "parent", "返信メモ1", "asc");

			//! 書き込まれた内容を確認。
			const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string;

			//! 親メモと返信メモの両方が含まれている。
			expect(writtenContent).toContain("memo-id: parent");
			expect(writtenContent).toContain("親メモ");
			expect(writtenContent).toContain("返信メモ1");

			//! 返信メモにparent-id属性が付与されている。
			expect(writtenContent).toContain('parent-id: parent');

			//! ThreadIndexを取得して構造を確認。
			app.vault.read.mockResolvedValue(writtenContent);
			const threadIndex = await memoManager.getThreadIndex("test.md", "work");

			//! parentの子として返信メモが登録されている。
			const children = threadIndex.childrenMap.get("parent");
			expect(children).toBeDefined();
			expect(children?.length).toBe(1);
		});

		test("複数の返信がある場合、正しくスレッドツリーが構築される", async () => {
			//! 初期状態: 親メモのみ。
			const initialContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`;
			app.vault.read.mockResolvedValueOnce(initialContent);

			//! 1つ目の返信。
			await memoManager.addReply("test.md", "work", "parent", "返信1", "asc");
			const content1 = (app.vault.modify.mock.calls[0] as unknown[])[1] as string;

			//! 2つ目の返信。
			app.vault.read.mockResolvedValueOnce(content1);
			await memoManager.addReply("test.md", "work", "parent", "返信2", "asc");
			const content2 = (app.vault.modify.mock.calls[1] as unknown[])[1] as string;

			//! 3つのメモがすべて含まれている。
			expect(content2).toContain("親メモ");
			expect(content2).toContain("返信1");
			expect(content2).toContain("返信2");

			//! ThreadIndexを確認。
			app.vault.read.mockResolvedValue(content2);
			const threadIndex = await memoManager.getThreadIndex("test.md", "work");

			//! parentの子が2つ。
			const children = threadIndex.childrenMap.get("parent");
			expect(children?.length).toBe(2);
		});

		test("返信への返信（ネストされたスレッド）が正しく構築される", async () => {
			//! 初期状態: 親メモと返信1。
			const initialContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ

<!-- memo-id: reply1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
返信1
`;
			app.vault.read.mockResolvedValue(initialContent);

			//! 返信1への返信を追加。
			await memoManager.addReply("test.md", "work", "reply1", "返信1への返信", "asc");

			const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string;

			//! 3つのメモがすべて含まれている。
			expect(writtenContent).toContain("親メモ");
			expect(writtenContent).toContain("返信1");
			expect(writtenContent).toContain("返信1への返信");

			//! ThreadIndexを確認。
			app.vault.read.mockResolvedValue(writtenContent);
			const threadIndex = await memoManager.getThreadIndex("test.md", "work");

			//! reply1の子として新しい返信が登録されている。
			const children = threadIndex.childrenMap.get("reply1");
			expect(children?.length).toBe(1);

			//! 深さを確認。
			const newReplyId = children?.[0];
			if (newReplyId) {
				const depth = threadIndex.depthMap.get(newReplyId);
				expect(depth).toBe(2); //! parent -> reply1 -> 新しい返信 = 深さ2。
			}
		});
	});

	describe("カスケード削除フロー", () => {
		test("親メモを削除すると子孫メモも一緒に削除される", async () => {
			//! 初期状態: 親メモと返信2つ。
			const fileContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ

<!-- memo-id: reply1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
返信1

<!-- memo-id: reply2, timestamp: 2025-11-04T10:45:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:45
返信2
`;
			app.vault.read.mockResolvedValue(fileContent);

			//! 親メモを削除。
			await memoManager.deleteMemoWithDescendants("test.md", "work", "parent");

			const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string;

			//! すべてのメモが削除されている。
			expect(writtenContent).not.toContain("親メモ");
			expect(writtenContent).not.toContain("返信1");
			expect(writtenContent).not.toContain("返信2");
		});

		test("子メモだけを削除しても親メモは残る", async () => {
			const fileContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ

<!-- memo-id: reply1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
返信1
`;
			app.vault.read.mockResolvedValue(fileContent);

			//! 子メモを削除。
			await memoManager.deleteMemoWithDescendants("test.md", "work", "reply1");

			const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string;

			//! 親メモは残っている。
			expect(writtenContent).toContain("親メモ");
			//! 子メモは削除されている。
			expect(writtenContent).not.toContain("返信1");
		});
	});

	describe("スレッド表示ロジック", () => {
		test("ThreadIndexからスレッド深さが正しく計算される", async () => {
			//! 3階層のスレッド構造。
			const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
ルート

<!-- memo-id: child1, timestamp: 2025-11-04T10:10:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:10
子1

<!-- memo-id: grandchild1, timestamp: 2025-11-04T10:20:00+09:00, category: "work", parent-id: child1 -->
## 2025-11-04 10:20
孫1
`;
			app.vault.read.mockResolvedValue(fileContent);

			const threadIndex = await memoManager.getThreadIndex("test.md", "work");

			//! 各メモの深さを確認。
			expect(threadIndex.depthMap.get("root")).toBe(0);
			expect(threadIndex.depthMap.get("child1")).toBe(1);
			expect(threadIndex.depthMap.get("grandchild1")).toBe(2);
		});

		test("子孫カウントが正しく計算される", async () => {
			//! 複雑なツリー構造。
			const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
ルート

<!-- memo-id: child1, timestamp: 2025-11-04T10:10:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:10
子1

<!-- memo-id: child2, timestamp: 2025-11-04T10:20:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:20
子2

<!-- memo-id: grandchild1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: child1 -->
## 2025-11-04 10:30
孫1
`;
			app.vault.read.mockResolvedValue(fileContent);

			const threadIndex = await memoManager.getThreadIndex("test.md", "work");

			//! rootは3つの子孫を持つ（child1, child2, grandchild1）。
			expect(threadIndex.descendantCountMap.get("root")).toBe(3);
			//! child1は1つの子孫を持つ（grandchild1）。
			expect(threadIndex.descendantCountMap.get("child1")).toBe(1);
			//! child2は子孫を持たない。
			expect(threadIndex.descendantCountMap.get("child2")).toBe(0);
		});

		test("replyCountが正しく計算される", async () => {
			const fileContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ

<!-- memo-id: reply1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
返信1

<!-- memo-id: reply2, timestamp: 2025-11-04T10:45:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:45
返信2
`;
			app.vault.read.mockResolvedValue(fileContent);

			//! ThreadIndexを取得してreplyCountを確認。
			const threadIndex = await memoManager.getThreadIndex("test.md", "work");

			//! parentの子が2つ。
			const parentChildren = threadIndex.childrenMap.get("parent");
			expect(parentChildren?.length).toBe(2);

			//! reply1とreply2は子を持たない。
			const reply1Children = threadIndex.childrenMap.get("reply1");
			const reply2Children = threadIndex.childrenMap.get("reply2");
			expect(reply1Children).toBeUndefined();
			expect(reply2Children).toBeUndefined();
		});
	});

	describe("ThreadIndexキャッシュ管理", () => {
		test("メモ追加後にThreadIndexが無効化される", async () => {
			const initialContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`;
			app.vault.read.mockResolvedValue(initialContent);

			//! ThreadIndexManagerのclearメソッドをスパイ。
			const clearSpy = jest.spyOn(memoManager.threadIndexManager, "clear");

			//! メモを追加。
			await memoManager.addMemo("test.md", "work", "新しいメモ", "asc");

			//! clearが呼ばれた。
			expect(clearSpy).toHaveBeenCalled();
		});

		test("返信追加後にThreadIndexが無効化される", async () => {
			const initialContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`;
			app.vault.read.mockResolvedValue(initialContent);

			const clearSpy = jest.spyOn(memoManager.threadIndexManager, "clear");

			//! 返信を追加。
			await memoManager.addReply("test.md", "work", "parent", "返信", "asc");

			//! clearが呼ばれた。
			expect(clearSpy).toHaveBeenCalled();
		});

		test("カスケード削除後にThreadIndexが無効化される", async () => {
			const fileContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ

<!-- memo-id: reply1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
返信1
`;
			app.vault.read.mockResolvedValue(fileContent);

			const clearSpy = jest.spyOn(memoManager.threadIndexManager, "clear");

			//! カスケード削除。
			await memoManager.deleteMemoWithDescendants("test.md", "work", "parent");

			//! clearが呼ばれた。
			expect(clearSpy).toHaveBeenCalled();
		});
	});
});
