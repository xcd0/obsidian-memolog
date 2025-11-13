import { changeParentId, ThreadIndexManager, wouldIntroduceCycle } from "../src/core/thread-operations"
import { MemoEntry } from "../src/types"

describe("スレッド移動機能（親の変更）", () => {
	let threadIndexManager: ThreadIndexManager

	beforeEach(() => {
		threadIndexManager = new ThreadIndexManager()
	})

	describe("wouldIntroduceCycle() 関数", () => {
		it("自分自身を親にすることはできない", () => {
			const memos: MemoEntry[] = [
				{
					id: "memo-1",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "メモ1",
					category: "work",
				},
			]

			const threadIndex = threadIndexManager.getIndex(memos)
			const result = wouldIntroduceCycle("memo-1", "memo-1", threadIndex)

			expect(result).toBe(true)
		})

		it("自分の子を親にすることはできない", () => {
			const memos: MemoEntry[] = [
				{
					id: "parent",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "親メモ",
					category: "work",
				},
				{
					id: "child",
					timestamp: "2025-11-13T10:01:00+09:00",
					content: "子メモ",
					category: "work",
					parentId: "parent",
				},
			]

			const threadIndex = threadIndexManager.getIndex(memos)
			const result = wouldIntroduceCycle("parent", "child", threadIndex)

			expect(result).toBe(true)
		})

		it("自分の孫を親にすることはできない", () => {
			const memos: MemoEntry[] = [
				{
					id: "grandparent",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "祖父メモ",
					category: "work",
				},
				{
					id: "parent",
					timestamp: "2025-11-13T10:01:00+09:00",
					content: "親メモ",
					category: "work",
					parentId: "grandparent",
				},
				{
					id: "child",
					timestamp: "2025-11-13T10:02:00+09:00",
					content: "子メモ",
					category: "work",
					parentId: "parent",
				},
			]

			const threadIndex = threadIndexManager.getIndex(memos)
			const result = wouldIntroduceCycle("grandparent", "child", threadIndex)

			expect(result).toBe(true)
		})

		it("兄弟メモを親にすることはできる", () => {
			const memos: MemoEntry[] = [
				{
					id: "parent",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "親メモ",
					category: "work",
				},
				{
					id: "child1",
					timestamp: "2025-11-13T10:01:00+09:00",
					content: "子メモ1",
					category: "work",
					parentId: "parent",
				},
				{
					id: "child2",
					timestamp: "2025-11-13T10:02:00+09:00",
					content: "子メモ2",
					category: "work",
					parentId: "parent",
				},
			]

			const threadIndex = threadIndexManager.getIndex(memos)
			const result = wouldIntroduceCycle("child1", "child2", threadIndex)

			expect(result).toBe(false)
		})

		it("別のスレッドのメモを親にすることはできる", () => {
			const memos: MemoEntry[] = [
				{
					id: "thread1-root",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "スレッド1",
					category: "work",
				},
				{
					id: "thread2-root",
					timestamp: "2025-11-13T10:01:00+09:00",
					content: "スレッド2",
					category: "work",
				},
			]

			const threadIndex = threadIndexManager.getIndex(memos)
			const result = wouldIntroduceCycle("thread1-root", "thread2-root", threadIndex)

			expect(result).toBe(false)
		})
	})

	describe("changeParent() 関数", () => {
		it("ルートメモを別のルートメモの子にできる", () => {
			const memos: MemoEntry[] = [
				{
					id: "root1",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "ルート1",
					category: "work",
				},
				{
					id: "root2",
					timestamp: "2025-11-13T10:01:00+09:00",
					content: "ルート2",
					category: "work",
				},
			]

			// ! root2 を root1 の子にする。
			const result = changeParentId(memos[1], "root1")

			expect(result).toBe(true)
			expect(memos[1].parentId).toBe("root1")
		})

		it("子メモを別の親に移動できる", () => {
			const memos: MemoEntry[] = [
				{
					id: "parent1",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "親1",
					category: "work",
				},
				{
					id: "parent2",
					timestamp: "2025-11-13T10:01:00+09:00",
					content: "親2",
					category: "work",
				},
				{
					id: "child",
					timestamp: "2025-11-13T10:02:00+09:00",
					content: "子",
					category: "work",
					parentId: "parent1",
				},
			]

			// ! child を parent2 の子にする。
			const result = changeParentId(memos[2], "parent2")

			expect(result).toBe(true)
			expect(memos[2].parentId).toBe("parent2")
		})

		it("子メモをルートメモにできる", () => {
			const memos: MemoEntry[] = [
				{
					id: "parent",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "親",
					category: "work",
				},
				{
					id: "child",
					timestamp: "2025-11-13T10:01:00+09:00",
					content: "子",
					category: "work",
					parentId: "parent",
				},
			]

			// ! child をルートメモにする（親を null にする）。
			const result = changeParentId(memos[1], null)

			expect(result).toBe(true)
			expect(memos[1].parentId).toBeUndefined()
		})

		it("循環参照が発生する場合は失敗する", () => {
			const memos: MemoEntry[] = [
				{
					id: "parent",
					timestamp: "2025-11-13T10:00:00+09:00",
					content: "親",
					category: "work",
				},
				{
					id: "child",
					timestamp: "2025-11-13T10:01:00+09:00",
					content: "子",
					category: "work",
					parentId: "parent",
				},
			]

			const threadIndex = threadIndexManager.getIndex(memos)

			// ! parent を child の子にしようとする（循環参照）。
			const result = changeParentId(memos[0], "child", threadIndex)

			expect(result).toBe(false)
			expect(memos[0].parentId).toBeUndefined()
		})
	})
})
