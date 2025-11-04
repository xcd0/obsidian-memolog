import {
	buildThreadIndex,
	buildThreadTree,
	findOrphanMemos,
	repairOrphanMemos,
	ThreadIndexManager,
	wouldIntroduceCycle,
} from "../src/core/thread-operations"
import { MemoEntry } from "../src/types/memo"

// ! テスト用のメモを作成するヘルパー関数。
function createTestMemo(
	id: string,
	category: string,
	content: string,
	parentId?: string,
): MemoEntry {
	return {
		id,
		category,
		timestamp: new Date().toISOString(),
		content,
		parentId,
	}
}

describe("buildThreadIndex", () => {
	test("空のメモ配列でインデックスを構築", () => {
		const index = buildThreadIndex([])

		expect(index.rootIds.size).toBe(0)
		expect(index.childrenMap.size).toBe(0)
		expect(index.parentMap.size).toBe(0)
		expect(index.depthMap.size).toBe(0)
		expect(index.descendantCountMap.size).toBe(0)
	})

	test("ルートメモのみの場合", () => {
		const memos = [
			createTestMemo("root1", "work", "Root 1"),
			createTestMemo("root2", "work", "Root 2"),
			createTestMemo("root3", "work", "Root 3"),
		]

		const index = buildThreadIndex(memos)

		expect(index.rootIds.size).toBe(3)
		expect(index.rootIds.has("root1")).toBe(true)
		expect(index.rootIds.has("root2")).toBe(true)
		expect(index.rootIds.has("root3")).toBe(true)

		// ! すべてのメモが深さ0。
		expect(index.depthMap.get("root1")).toBe(0)
		expect(index.depthMap.get("root2")).toBe(0)
		expect(index.depthMap.get("root3")).toBe(0)

		// ! すべてのメモが子孫数0。
		expect(index.descendantCountMap.get("root1")).toBe(0)
		expect(index.descendantCountMap.get("root2")).toBe(0)
		expect(index.descendantCountMap.get("root3")).toBe(0)
	})

	test("単純な親子関係（1親1子）", () => {
		const memos = [
			createTestMemo("parent", "work", "Parent"),
			createTestMemo("child", "work", "Child", "parent"),
		]

		const index = buildThreadIndex(memos)

		// ! ルートはparentのみ。
		expect(index.rootIds.size).toBe(1)
		expect(index.rootIds.has("parent")).toBe(true)

		// ! 親子マッピング。
		expect(index.childrenMap.get("parent")).toEqual(["child"])
		expect(index.parentMap.get("child")).toBe("parent")

		// ! 深さ。
		expect(index.depthMap.get("parent")).toBe(0)
		expect(index.depthMap.get("child")).toBe(1)

		// ! 子孫数。
		expect(index.descendantCountMap.get("parent")).toBe(1)
		expect(index.descendantCountMap.get("child")).toBe(0)
	})

	test("複数レベルのスレッド（深さ3）", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child1", "work", "Child 1", "root"),
			createTestMemo("child2", "work", "Child 2", "root"),
			createTestMemo("grandchild1", "work", "Grandchild 1", "child1"),
			createTestMemo("grandchild2", "work", "Grandchild 2", "child2"),
		]

		const index = buildThreadIndex(memos)

		// ! ルート。
		expect(index.rootIds.size).toBe(1)
		expect(index.rootIds.has("root")).toBe(true)

		// ! 親子マッピング。
		expect(index.childrenMap.get("root")).toEqual(["child1", "child2"])
		expect(index.childrenMap.get("child1")).toEqual(["grandchild1"])
		expect(index.childrenMap.get("child2")).toEqual(["grandchild2"])

		// ! 深さ。
		expect(index.depthMap.get("root")).toBe(0)
		expect(index.depthMap.get("child1")).toBe(1)
		expect(index.depthMap.get("child2")).toBe(1)
		expect(index.depthMap.get("grandchild1")).toBe(2)
		expect(index.depthMap.get("grandchild2")).toBe(2)

		// ! 子孫数。
		expect(index.descendantCountMap.get("root")).toBe(4) // 2子 + 2孫
		expect(index.descendantCountMap.get("child1")).toBe(1)
		expect(index.descendantCountMap.get("child2")).toBe(1)
		expect(index.descendantCountMap.get("grandchild1")).toBe(0)
		expect(index.descendantCountMap.get("grandchild2")).toBe(0)
	})

	test("枝分かれのあるスレッド", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child1", "work", "Child 1", "root"),
			createTestMemo("child2", "work", "Child 2", "root"),
			createTestMemo("child3", "work", "Child 3", "root"),
			createTestMemo("grandchild1", "work", "Grandchild 1", "child1"),
			createTestMemo("grandchild2", "work", "Grandchild 2", "child1"),
		]

		const index = buildThreadIndex(memos)

		// ! rootは3つの子を持つ。
		expect(index.childrenMap.get("root")).toEqual([
			"child1",
			"child2",
			"child3",
		])

		// ! child1は2つの子を持つ。
		expect(index.childrenMap.get("child1")).toEqual([
			"grandchild1",
			"grandchild2",
		])

		// ! 子孫数。
		expect(index.descendantCountMap.get("root")).toBe(5) // 3子 + 2孫
		expect(index.descendantCountMap.get("child1")).toBe(2)
		expect(index.descendantCountMap.get("child2")).toBe(0)
		expect(index.descendantCountMap.get("child3")).toBe(0)
	})

	test("深いスレッド（深さ10以上）", () => {
		// ! 深さ15のスレッドを作成。
		const memos: MemoEntry[] = []
		for (let i = 0; i < 15; i++) {
			const parentId = i === 0 ? undefined : `memo-${i - 1}`
			memos.push(createTestMemo(`memo-${i}`, "work", `Memo ${i}`, parentId))
		}

		const index = buildThreadIndex(memos)

		// ! ルート。
		expect(index.rootIds.size).toBe(1)
		expect(index.rootIds.has("memo-0")).toBe(true)

		// ! 深さ。
		for (let i = 0; i < 15; i++) {
			expect(index.depthMap.get(`memo-${i}`)).toBe(i)
		}

		// ! 子孫数。
		expect(index.descendantCountMap.get("memo-0")).toBe(14)
		expect(index.descendantCountMap.get("memo-7")).toBe(7)
		expect(index.descendantCountMap.get("memo-14")).toBe(0)
	})

	test("複数のルートを持つスレッド", () => {
		const memos = [
			createTestMemo("root1", "work", "Root 1"),
			createTestMemo("root2", "work", "Root 2"),
			createTestMemo("child1", "work", "Child 1", "root1"),
			createTestMemo("child2", "work", "Child 2", "root2"),
		]

		const index = buildThreadIndex(memos)

		// ! 2つのルート。
		expect(index.rootIds.size).toBe(2)
		expect(index.rootIds.has("root1")).toBe(true)
		expect(index.rootIds.has("root2")).toBe(true)

		// ! それぞれの親子関係。
		expect(index.childrenMap.get("root1")).toEqual(["child1"])
		expect(index.childrenMap.get("root2")).toEqual(["child2"])
	})

	test("親が存在しないメモ（孤児メモ）は無視される", () => {
		// ! 注: buildThreadIndexは孤児メモを検出しない。
		// ! 孤児メモもインデックスに含まれるが、親が存在しないため警告が必要。
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("orphan", "work", "Orphan", "non-existent"),
		]

		const index = buildThreadIndex(memos)

		// ! rootはルート。
		expect(index.rootIds.has("root")).toBe(true)

		// ! orphanの親は存在しないが、parentMapには記録される。
		expect(index.parentMap.get("orphan")).toBe("non-existent")

		// ! non-existentのchildrenMapには登録される。
		expect(index.childrenMap.get("non-existent")).toEqual(["orphan"])

		// ! orphanはルートではない（parentIdがあるため）。
		expect(index.rootIds.has("orphan")).toBe(false)
	})
})

describe("buildThreadTree", () => {
	test("単純なスレッドのツリーを構築", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child1", "work", "Child 1", "root"),
			createTestMemo("child2", "work", "Child 2", "root"),
		]

		const memoMap = new Map(memos.map(m => [m.id, m]))
		const index = buildThreadIndex(memos)
		const tree = buildThreadTree("root", index, memoMap)

		// ! ツリー統計。
		expect(tree.rootId).toBe("root")
		expect(tree.totalCount).toBe(3)
		expect(tree.maxDepth).toBe(1)

		// ! ノード。
		expect(tree.nodes.size).toBe(3)
		expect(tree.nodes.get("root")?.childIds).toEqual(["child1", "child2"])
		expect(tree.nodes.get("child1")?.childIds).toEqual([])
		expect(tree.nodes.get("child2")?.childIds).toEqual([])

		// ! 深さ。
		expect(tree.nodes.get("root")?.depth).toBe(0)
		expect(tree.nodes.get("child1")?.depth).toBe(1)
		expect(tree.nodes.get("child2")?.depth).toBe(1)

		// ! 子孫数。
		expect(tree.nodes.get("root")?.descendantCount).toBe(2)
		expect(tree.nodes.get("child1")?.descendantCount).toBe(0)
		expect(tree.nodes.get("child2")?.descendantCount).toBe(0)
	})

	test("深いツリーを構築（深さ10）", () => {
		const memos: MemoEntry[] = []
		for (let i = 0; i < 10; i++) {
			const parentId = i === 0 ? undefined : `memo-${i - 1}`
			memos.push(createTestMemo(`memo-${i}`, "work", `Memo ${i}`, parentId))
		}

		const memoMap = new Map(memos.map(m => [m.id, m]))
		const index = buildThreadIndex(memos)
		const tree = buildThreadTree("memo-0", index, memoMap)

		expect(tree.rootId).toBe("memo-0")
		expect(tree.totalCount).toBe(10)
		expect(tree.maxDepth).toBe(9)

		// ! 各ノードの深さ。
		for (let i = 0; i < 10; i++) {
			expect(tree.nodes.get(`memo-${i}`)?.depth).toBe(i)
		}
	})

	test("lastUpdatedが最新のタイムスタンプになる", () => {
		const memos = [
			{
				...createTestMemo("root", "work", "Root"),
				timestamp: "2025-11-01T10:00:00Z",
			},
			{
				...createTestMemo("child1", "work", "Child 1", "root"),
				timestamp: "2025-11-01T10:30:00Z",
			},
			{
				...createTestMemo("child2", "work", "Child 2", "root"),
				timestamp: "2025-11-01T11:00:00Z", // 最新
			},
		]

		const memoMap = new Map(memos.map(m => [m.id, m]))
		const index = buildThreadIndex(memos)
		const tree = buildThreadTree("root", index, memoMap)

		expect(tree.lastUpdated).toBe("2025-11-01T11:00:00Z")
	})
})

describe("wouldIntroduceCycle", () => {
	test("自己参照は循環", () => {
		const memos = [createTestMemo("memo1", "work", "Memo 1")]
		const index = buildThreadIndex(memos)

		const result = wouldIntroduceCycle("memo1", "memo1", index)
		expect(result).toBe(true)
	})

	test("親子関係の逆転は循環", () => {
		const memos = [
			createTestMemo("parent", "work", "Parent"),
			createTestMemo("child", "work", "Child", "parent"),
		]
		const index = buildThreadIndex(memos)

		// ! childの親をparentに変更しようとすると、parentの親がchildになる（循環）。
		const result = wouldIntroduceCycle("parent", "child", index)
		expect(result).toBe(true)
	})

	test("孫が祖父母の親になる場合は循環", () => {
		const memos = [
			createTestMemo("grandparent", "work", "Grandparent"),
			createTestMemo("parent", "work", "Parent", "grandparent"),
			createTestMemo("child", "work", "Child", "parent"),
		]
		const index = buildThreadIndex(memos)

		// ! grandparentの親をchildにしようとすると循環。
		const result = wouldIntroduceCycle("grandparent", "child", index)
		expect(result).toBe(true)
	})

	test("無関係なメモ間では循環しない", () => {
		const memos = [
			createTestMemo("memo1", "work", "Memo 1"),
			createTestMemo("memo2", "work", "Memo 2"),
		]
		const index = buildThreadIndex(memos)

		const result = wouldIntroduceCycle("memo1", "memo2", index)
		expect(result).toBe(false)
	})

	test("兄弟メモ間では循環しない", () => {
		const memos = [
			createTestMemo("parent", "work", "Parent"),
			createTestMemo("child1", "work", "Child 1", "parent"),
			createTestMemo("child2", "work", "Child 2", "parent"),
		]
		const index = buildThreadIndex(memos)

		// ! child1の親をchild2にする（兄弟関係）。
		const result = wouldIntroduceCycle("child1", "child2", index)
		expect(result).toBe(false)
	})

	test("深い階層でも循環を検出", () => {
		const memos: MemoEntry[] = []
		for (let i = 0; i < 10; i++) {
			const parentId = i === 0 ? undefined : `memo-${i - 1}`
			memos.push(createTestMemo(`memo-${i}`, "work", `Memo ${i}`, parentId))
		}
		const index = buildThreadIndex(memos)

		// ! memo-0の親をmemo-9にしようとすると循環。
		const result = wouldIntroduceCycle("memo-0", "memo-9", index)
		expect(result).toBe(true)
	})
})

describe("findOrphanMemos", () => {
	test("孤児メモがない場合", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
		]

		const orphans = findOrphanMemos(memos)
		expect(orphans).toEqual([])
	})

	test("孤児メモを検出", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("orphan", "work", "Orphan", "non-existent"),
		]

		const orphans = findOrphanMemos(memos)
		expect(orphans.length).toBe(1)
		expect(orphans[0].id).toBe("orphan")
	})

	test("複数の孤児メモを検出", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("orphan1", "work", "Orphan 1", "non-existent1"),
			createTestMemo("orphan2", "work", "Orphan 2", "non-existent2"),
		]

		const orphans = findOrphanMemos(memos)
		expect(orphans.length).toBe(2)
		expect(orphans.map(m => m.id)).toContain("orphan1")
		expect(orphans.map(m => m.id)).toContain("orphan2")
	})

	test("parentIdがundefinedのメモは孤児ではない", () => {
		const memos = [createTestMemo("root", "work", "Root")]

		const orphans = findOrphanMemos(memos)
		expect(orphans).toEqual([])
	})
})

describe("repairOrphanMemos", () => {
	test("孤児メモのparentIdをundefinedにする", () => {
		const orphan1 = createTestMemo("orphan1", "work", "Orphan 1", "non-existent")
		const orphan2 = createTestMemo("orphan2", "work", "Orphan 2", "non-existent")
		const orphans = [orphan1, orphan2]

		// ! コンソール警告をキャプチャ。
		const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()

		repairOrphanMemos(orphans)

		expect(orphan1.parentId).toBeUndefined()
		expect(orphan2.parentId).toBeUndefined()

		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"Orphan memo orphan1 promoted to root",
		)
		expect(consoleWarnSpy).toHaveBeenCalledWith(
			"Orphan memo orphan2 promoted to root",
		)

		consoleWarnSpy.mockRestore()
	})
})

describe("ThreadIndexManager", () => {
	let manager: ThreadIndexManager

	beforeEach(() => {
		manager = new ThreadIndexManager()
	})

	test("初回呼び出しでインデックスを構築", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
		]

		const index = manager.getIndex(memos)

		expect(index.rootIds.size).toBe(1)
		expect(index.rootIds.has("root")).toBe(true)
	})

	test("同じメモで再度呼び出すとキャッシュを返す", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
		]

		const index1 = manager.getIndex(memos)
		const index2 = manager.getIndex(memos)

		// ! 同じオブジェクトが返される。
		expect(index1).toBe(index2)
	})

	test("メモが追加されたら再構築", () => {
		const memos1 = [createTestMemo("root", "work", "Root")]
		const index1 = manager.getIndex(memos1)

		const memos2 = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
		]
		const index2 = manager.getIndex(memos2)

		// ! 異なるオブジェクトが返される。
		expect(index1).not.toBe(index2)
		expect(index2.rootIds.size).toBe(1)
		expect(index2.childrenMap.get("root")).toEqual(["child"])
	})

	test("メモが削除されたら再構築", () => {
		const memos1 = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
		]
		const index1 = manager.getIndex(memos1)

		const memos2 = [createTestMemo("root", "work", "Root")]
		const index2 = manager.getIndex(memos2)

		expect(index1).not.toBe(index2)
		expect(index2.childrenMap.get("root")).toBeUndefined()
	})

	test("getThreadTreeがキャッシュを返す", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
		]
		const memoMap = new Map(memos.map(m => [m.id, m]))
		const index = manager.getIndex(memos)

		const tree1 = manager.getThreadTree("root", index, memoMap)
		const tree2 = manager.getThreadTree("root", index, memoMap)

		// ! 同じオブジェクトが返される。
		expect(tree1).toBe(tree2)
	})

	test("rebuild()で強制的に再構築", () => {
		const memos = [createTestMemo("root", "work", "Root")]
		const index1 = manager.getIndex(memos)

		manager.rebuild(memos)
		const index2 = manager.getIndex(memos)

		// ! 異なるオブジェクトが返される。
		expect(index1).not.toBe(index2)
	})

	test("invalidateTree()で特定のツリーキャッシュを削除", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
		]
		const memoMap = new Map(memos.map(m => [m.id, m]))
		const index = manager.getIndex(memos)

		const tree1 = manager.getThreadTree("root", index, memoMap)
		manager.invalidateTree("root")
		const tree2 = manager.getThreadTree("root", index, memoMap)

		// ! 異なるオブジェクトが返される。
		expect(tree1).not.toBe(tree2)
	})

	test("clear()で全キャッシュをクリア", () => {
		const memos = [createTestMemo("root", "work", "Root")]
		const index1 = manager.getIndex(memos)

		manager.clear()
		const index2 = manager.getIndex(memos)

		// ! 異なるオブジェクトが返される。
		expect(index1).not.toBe(index2)
	})

	test("getChildren()でO(1)で子を取得", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child1", "work", "Child 1", "root"),
			createTestMemo("child2", "work", "Child 2", "root"),
		]
		const index = manager.getIndex(memos)

		const children = manager.getChildren("root", index)
		expect(children).toEqual(["child1", "child2"])
	})

	test("getParent()でO(1)で親を取得", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
		]
		const index = manager.getIndex(memos)

		const parent = manager.getParent("child", index)
		expect(parent).toBe("root")
	})

	test("getDepth()でO(1)で深さを取得", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child", "work", "Child", "root"),
			createTestMemo("grandchild", "work", "Grandchild", "child"),
		]
		const index = manager.getIndex(memos)

		expect(manager.getDepth("root", index)).toBe(0)
		expect(manager.getDepth("child", index)).toBe(1)
		expect(manager.getDepth("grandchild", index)).toBe(2)
	})

	test("getDescendantCount()でO(1)で子孫数を取得", () => {
		const memos = [
			createTestMemo("root", "work", "Root"),
			createTestMemo("child1", "work", "Child 1", "root"),
			createTestMemo("child2", "work", "Child 2", "root"),
			createTestMemo("grandchild", "work", "Grandchild", "child1"),
		]
		const index = manager.getIndex(memos)

		expect(manager.getDescendantCount("root", index)).toBe(3)
		expect(manager.getDescendantCount("child1", index)).toBe(1)
		expect(manager.getDescendantCount("child2", index)).toBe(0)
	})
})
