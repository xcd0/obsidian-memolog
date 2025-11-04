import { MemoManager } from "../src/core/memo-manager";
import { ThreadIndexManager } from "../src/core/thread-operations";
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

describe("MemoManager - ThreadIndexManager統合", () => {
	let app: MockApp;
	let memoManager: MemoManager;

	beforeEach(() => {
		app = createMockApp();
		memoManager = new MemoManager(app as never);
	});

	test("MemoManagerがThreadIndexManagerインスタンスを持つ", () => {
		expect(memoManager.threadIndexManager).toBeDefined();
		expect(memoManager.threadIndexManager).toBeInstanceOf(ThreadIndexManager);
	});

	test("getThreadIndex()でスレッドインデックスを取得できる", async () => {
		//! テスト用のメモファイルを準備。
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Root memo

<!-- memo-id: child, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:30
Child memo
`;
		app.vault.read.mockResolvedValue(fileContent);

		const index = await memoManager.getThreadIndex("test.md", "work");

		expect(index.rootIds.size).toBe(1);
		expect(index.rootIds.has("root")).toBe(true);
		expect(index.childrenMap.get("root")).toEqual(["child"]);
		expect(index.parentMap.get("child")).toBe("root");
	});

	test("getThreadTree()で特定のルートメモからツリーを取得できる", async () => {
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Root memo

<!-- memo-id: child1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:30
Child 1

<!-- memo-id: child2, timestamp: 2025-11-04T10:45:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:45
Child 2
`;
		app.vault.read.mockResolvedValue(fileContent);

		const tree = await memoManager.getThreadTree("test.md", "work", "root");

		expect(tree.rootId).toBe("root");
		expect(tree.totalCount).toBe(3);
		expect(tree.maxDepth).toBe(1);
		expect(tree.nodes.size).toBe(3);
		expect(tree.nodes.get("root")?.childIds).toEqual(["child1", "child2"]);
	});

	test("メモ追加後にスレッドインデックスが無効化される", async () => {
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Root memo
`;
		app.vault.read.mockResolvedValue(fileContent);

		//! 初回のインデックス取得。
		const index1 = await memoManager.getThreadIndex("test.md", "work");
		expect(index1.rootIds.size).toBe(1);

		//! メモを追加（スレッドインデックスが無効化されるべき）。
		const newFileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Root memo

<!-- memo-id: new-memo, timestamp: 2025-11-04T11:00:00+09:00, category: "work" -->
## 2025-11-04 11:00
New memo
`;

		//! addMemoは内部でファイルを読む→書くを行う。
		//! その後のgetThreadIndexでは更新されたファイルを読む。
		app.vault.read
			.mockResolvedValueOnce(fileContent) // addMemo内での読み込み
			.mockResolvedValue(newFileContent); // getThreadIndex での読み込み

		//! addMemoを呼ぶと内部でキャッシュが無効化される。
		await memoManager.addMemo("test.md", "work", "New memo");

		//! 再度インデックスを取得すると、新しいメモが反映される。
		const index2 = await memoManager.getThreadIndex("test.md", "work");
		expect(index2.rootIds.size).toBe(2);
	});

	test("getThreadChildren()で子メモIDリストを取得できる", async () => {
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Root memo

<!-- memo-id: child1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:30
Child 1

<!-- memo-id: child2, timestamp: 2025-11-04T10:45:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:45
Child 2
`;
		app.vault.read.mockResolvedValue(fileContent);

		const children = await memoManager.getThreadChildren(
			"test.md",
			"work",
			"root"
		);

		expect(children).toEqual(["child1", "child2"]);
	});

	test("getThreadParent()で親メモIDを取得できる", async () => {
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Root memo

<!-- memo-id: child, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:30
Child memo
`;
		app.vault.read.mockResolvedValue(fileContent);

		const parent = await memoManager.getThreadParent("test.md", "work", "child");

		expect(parent).toBe("root");
	});

	test("getThreadDepth()でメモの深さを取得できる", async () => {
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Root memo

<!-- memo-id: child, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:30
Child memo

<!-- memo-id: grandchild, timestamp: 2025-11-04T11:00:00+09:00, category: "work", parent-id: child -->
## 2025-11-04 11:00
Grandchild memo
`;
		app.vault.read.mockResolvedValue(fileContent);

		const depthRoot = await memoManager.getThreadDepth("test.md", "work", "root");
		const depthChild = await memoManager.getThreadDepth(
			"test.md",
			"work",
			"child"
		);
		const depthGrandchild = await memoManager.getThreadDepth(
			"test.md",
			"work",
			"grandchild"
		);

		expect(depthRoot).toBe(0);
		expect(depthChild).toBe(1);
		expect(depthGrandchild).toBe(2);
	});

	test("getThreadDescendantCount()で子孫数を取得できる", async () => {
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Root memo

<!-- memo-id: child1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:30
Child 1

<!-- memo-id: child2, timestamp: 2025-11-04T10:45:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:45
Child 2

<!-- memo-id: grandchild, timestamp: 2025-11-04T11:00:00+09:00, category: "work", parent-id: child1 -->
## 2025-11-04 11:00
Grandchild
`;
		app.vault.read.mockResolvedValue(fileContent);

		const countRoot = await memoManager.getThreadDescendantCount(
			"test.md",
			"work",
			"root"
		);
		const countChild1 = await memoManager.getThreadDescendantCount(
			"test.md",
			"work",
			"child1"
		);
		const countChild2 = await memoManager.getThreadDescendantCount(
			"test.md",
			"work",
			"child2"
		);

		expect(countRoot).toBe(3); // child1, child2, grandchild
		expect(countChild1).toBe(1); // grandchild
		expect(countChild2).toBe(0);
	});

	test("複数カテゴリのスレッドインデックスが独立して管理される", async () => {
		const fileContent = `<!-- memo-id: work-root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
Work root

<!-- memo-id: personal-root, timestamp: 2025-11-04T10:30:00+09:00, category: "personal" -->
## 2025-11-04 10:30
Personal root
`;
		app.vault.read.mockResolvedValue(fileContent);

		const workIndex = await memoManager.getThreadIndex("test.md", "work");
		const personalIndex = await memoManager.getThreadIndex("test.md", "personal");

		expect(workIndex.rootIds.has("work-root")).toBe(true);
		expect(workIndex.rootIds.has("personal-root")).toBe(false);

		expect(personalIndex.rootIds.has("personal-root")).toBe(true);
		expect(personalIndex.rootIds.has("work-root")).toBe(false);
	});
});
