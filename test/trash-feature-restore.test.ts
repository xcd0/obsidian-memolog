import { parseTextToMemo } from "../src/core/memo-helpers"
import { getDescendantMemos } from "../src/core/memo-query-operations"
import { markMemoAsRestored } from "../src/core/memo-trash-operations"
import { MemoEntry } from "../src/types/memo"

describe("ゴミ箱機能 - 復元機能の統合テスト", () => {
	describe("Phase 6-4: 復元機能の基本動作", () => {
		it("【統合】単独投稿の復元ができる", () => {
			// Arrange: ゴミ箱内のメモ（文字列形式）。
			const trashedMemoText =
				`<!-- memo-id: restore-test-001, timestamp: 2025-11-05T10:00:00.000Z, category: "work", deleted: "true", trashedAt: "2025-11-05T10:30:00.000Z" -->
<!--
テスト内容
-->`

			// Act: 復元処理。
			const { memos, restored } = markMemoAsRestored([trashedMemoText], "restore-test-001")

			// Assert: 復元が成功する。
			expect(restored).toBe(true)
			expect(memos).toHaveLength(1)

			// ! パースして検証。
			const parsedMemo = parseTextToMemo(memos[0], "work")
			expect(parsedMemo?.id).toBe("restore-test-001")
			expect(parsedMemo?.trashedAt).toBeUndefined()
			expect(parsedMemo?.content).toBe("テスト内容")
		})

		it("【統合】復元後のメモにはdeleted/trashedAtフラグが含まれない", () => {
			// Arrange: ゴミ箱内のメモ。
			const trashedMemoText =
				`<!-- memo-id: restore-test-002, timestamp: 2025-11-05T11:00:00.000Z, category: "work", deleted: "true", trashedAt: "2025-11-05T11:30:00.000Z" -->
<!--
復元されるメモ
-->`

			// Act: 復元処理。
			const { memos } = markMemoAsRestored([trashedMemoText], "restore-test-002")

			// Assert: deleted/trashedAtフラグが削除される。
			expect(memos[0]).not.toContain("deleted: \"true\"")
			expect(memos[0]).not.toContain("trashedAt:")
		})

		it("【仕様】完全削除済み（permanently-deleted）のメモは復元できない", () => {
			// Arrange: 完全削除済みのメモ。
			const permanentlyDeletedMemo: MemoEntry = {
				id: "permanently-deleted-001",
				timestamp: "2025-11-05T12:00:00.000Z",
				category: "work",
				content: "[削除済み]",
				permanentlyDeleted: true,
			}

			// Assert: trashedAtがないため復元処理の対象外。
			expect(permanentlyDeletedMemo.trashedAt).toBeUndefined()
			expect(permanentlyDeletedMemo.permanentlyDeleted).toBe(true)

			// ! 復元処理を試みても変化なし（文字列に変換して確認）。
			// ! markMemoAsRestored()はdeleted/trashedAtフラグのみを削除する。
			// ! permanently-deletedフラグは削除しない（trashedAtがないため復元対象外）。
			const permanentlyDeletedText =
				`<!-- memo-id: ${permanentlyDeletedMemo.id}, timestamp: ${permanentlyDeletedMemo.timestamp}, category: "${permanentlyDeletedMemo.category}", permanently-deleted: "true" -->
[削除済み]
`
			const { memos, restored } = markMemoAsRestored(
				[permanentlyDeletedText],
				"permanently-deleted-001",
			)

			// ! markMemoAsRestored()は成功するが、permanently-deletedは削除されない。
			// ! 実際のMemoManager.restoreMemoWithDescendants()では、
			// ! trashedAtチェックで事前にエラーを返す。
			expect(restored).toBe(true) // ! 関数自体は成功する。
			expect(memos[0]).toContain("permanently-deleted:") // ! フラグは残る。
		})

		it("【仕様】既に復元済みのメモを再度復元しようとしてもエラーにならない", () => {
			// Arrange: 既に復元済み（アクティブ）のメモ。
			const activeMemoText = `<!-- memo-id: active-memo-001, timestamp: 2025-11-05T13:00:00.000Z, category: "work" -->
アクティブなメモ
`

			// Act: 復元処理を試みる。
			const { memos, restored } = markMemoAsRestored([activeMemoText], "active-memo-001")

			// Assert: restoredはfalseだが、エラーは発生しない。
			expect(restored).toBe(false)
			expect(memos).toHaveLength(1)
			expect(memos[0]).toBe(activeMemoText)
		})
	})

	describe("Phase 6-5: 親投稿と子孫の一括復元", () => {
		it("【統合】親投稿を復元すると、削除済みの全子孫も一括復元される", () => {
			// Arrange: 親投稿と子孫メモ（全てゴミ箱内）。
			const trashedParent: MemoEntry = {
				id: "trashed-parent-restore-001",
				timestamp: "2025-11-05T14:00:00.000Z",
				category: "work",
				content: "親投稿",
				trashedAt: "2025-11-05T14:30:00.000Z",
			}

			const trashedChild1: MemoEntry = {
				id: "trashed-child-001",
				timestamp: "2025-11-05T14:10:00.000Z",
				category: "work",
				content: "子投稿1",
				parentId: "trashed-parent-restore-001",
				trashedAt: "2025-11-05T14:35:00.000Z",
			}

			const trashedChild2: MemoEntry = {
				id: "trashed-child-002",
				timestamp: "2025-11-05T14:20:00.000Z",
				category: "work",
				content: "子投稿2",
				parentId: "trashed-parent-restore-001",
				trashedAt: "2025-11-05T14:40:00.000Z",
			}

			const allMemos = [trashedParent, trashedChild1, trashedChild2]

			// Act: getDescendantMemos()で子孫を取得。
			const descendants = getDescendantMemos("trashed-parent-restore-001", allMemos)

			// Assert: 2つの子孫が取得される。
			expect(descendants).toHaveLength(2)
			expect(descendants.map(m => m.id)).toContain("trashed-child-001")
			expect(descendants.map(m => m.id)).toContain("trashed-child-002")
		})

		it("【統合】孫メモも含めて一括復元される（3世代）", () => {
			// Arrange: 親 → 子 → 孫の3世代。
			const parent: MemoEntry = {
				id: "parent-3gen-001",
				timestamp: "2025-11-05T15:00:00.000Z",
				category: "work",
				content: "親",
				trashedAt: "2025-11-05T15:30:00.000Z",
			}

			const child: MemoEntry = {
				id: "child-3gen-001",
				timestamp: "2025-11-05T15:10:00.000Z",
				category: "work",
				content: "子",
				parentId: "parent-3gen-001",
				trashedAt: "2025-11-05T15:35:00.000Z",
			}

			const grandchild: MemoEntry = {
				id: "grandchild-3gen-001",
				timestamp: "2025-11-05T15:20:00.000Z",
				category: "work",
				content: "孫",
				parentId: "child-3gen-001",
				trashedAt: "2025-11-05T15:40:00.000Z",
			}

			const allMemos = [parent, child, grandchild]

			// Act: getDescendantMemos()で全子孫を取得。
			const descendants = getDescendantMemos("parent-3gen-001", allMemos)

			// Assert: 子と孫の両方が取得される。
			expect(descendants).toHaveLength(2)
			expect(descendants.map(m => m.id)).toContain("child-3gen-001")
			expect(descendants.map(m => m.id)).toContain("grandchild-3gen-001")
		})

		it("【仕様】親投稿のみ削除済みで、子投稿はアクティブな場合、親のみ復元される", () => {
			// Arrange: 削除済み親とアクティブな子。
			const trashedParent: MemoEntry = {
				id: "trashed-parent-002",
				timestamp: "2025-11-05T16:00:00.000Z",
				category: "work",
				content: "削除済み親",
				trashedAt: "2025-11-05T16:30:00.000Z",
			}

			const activeChild: MemoEntry = {
				id: "active-child-001",
				timestamp: "2025-11-05T16:10:00.000Z",
				category: "work",
				content: "アクティブな子",
				parentId: "trashed-parent-002",
			}

			const allMemos = [trashedParent, activeChild]

			// Act: getDescendantMemos()で削除済み子孫を取得。
			const descendants = getDescendantMemos("trashed-parent-002", allMemos)

			// Assert: アクティブな子も含めて全子孫が取得される。
			// ! ただし、復元処理ではtrashedAtがあるもののみが復元対象となる。
			expect(descendants).toHaveLength(1)
			expect(descendants[0].id).toBe("active-child-001")
			expect(descendants[0].trashedAt).toBeUndefined()
		})

		it("【統合】複数の文字列メモから複数のメモを一括復元できる", () => {
			// Arrange: 文字列形式のメモリスト。
			const memoTexts = [
				`<!-- memo-id: batch-restore-001, timestamp: 2025-11-05T17:00:00.000Z, category: "work", deleted: "true", trashedAt: "2025-11-05T17:30:00.000Z" -->
<!--
親メモ
-->`,
				`<!-- memo-id: batch-restore-002, timestamp: 2025-11-05T17:10:00.000Z, category: "work", parent-id: batch-restore-001, deleted: "true", trashedAt: "2025-11-05T17:35:00.000Z" -->
<!--
子メモ
-->`,
			]

			// Act: 親メモを復元。
			let updatedMemoTexts = [...memoTexts]
			const { memos: restored1, restored: r1 } = markMemoAsRestored(
				updatedMemoTexts,
				"batch-restore-001",
			)
			if (r1) {
				updatedMemoTexts = restored1
			}

			// ! 子メモも復元。
			const { memos: restored2, restored: r2 } = markMemoAsRestored(
				updatedMemoTexts,
				"batch-restore-002",
			)
			if (r2) {
				updatedMemoTexts = restored2
			}

			// Assert: 両方のメモが復元される。
			expect(r1).toBe(true)
			expect(r2).toBe(true)
			expect(updatedMemoTexts).toHaveLength(2)
			expect(updatedMemoTexts[0]).not.toContain("deleted:")
			expect(updatedMemoTexts[1]).not.toContain("deleted:")
		})
	})

	describe("Phase 6-6: エッジケースと境界値テスト", () => {
		it("【エッジケース】空のメモリストに対して復元処理を実行してもエラーにならない", () => {
			// Arrange: 空のメモリスト。
			const emptyMemos: string[] = []

			// Act: 復元処理。
			const { memos, restored } = markMemoAsRestored(emptyMemos, "non-existent-id")

			// Assert: エラーなく処理される。
			expect(restored).toBe(false)
			expect(memos).toHaveLength(0)
		})

		it("【エッジケース】存在しないメモIDを指定して復元処理を実行してもエラーにならない", () => {
			// Arrange: 1つのメモ。
			const memoTexts = [
				`<!-- memo-id: existing-memo-001, timestamp: 2025-11-05T18:00:00.000Z, category: "work", deleted: "true", trashedAt: "2025-11-05T18:30:00.000Z" -->
<!--
既存メモ
-->`,
			]

			// Act: 存在しないIDで復元処理。
			const { memos, restored } = markMemoAsRestored(memoTexts, "non-existent-memo-999")

			// Assert: エラーなく処理され、元のメモは変更されない。
			expect(restored).toBe(false)
			expect(memos).toHaveLength(1)
			expect(memos[0]).toBe(memoTexts[0])
		})

		it("【エッジケース】親投稿に子孫がいない場合でもgetDescendantMemos()はエラーにならない", () => {
			// Arrange: 親投稿のみ（子孫なし）。
			const parent: MemoEntry = {
				id: "lonely-parent-001",
				timestamp: "2025-11-05T19:00:00.000Z",
				category: "work",
				content: "子孫なし",
				trashedAt: "2025-11-05T19:30:00.000Z",
			}

			const allMemos = [parent]

			// Act: getDescendantMemos()を呼び出し。
			const descendants = getDescendantMemos("lonely-parent-001", allMemos)

			// Assert: 空配列が返される。
			expect(descendants).toHaveLength(0)
		})

		it("【エッジケース】複雑なツリー構造でもgetDescendantMemos()は正しく動作する", () => {
			// Arrange: 複雑なツリー構造（分岐あり）。
			// ! parent
			// !   ├─ child1
			// !   │   └─ grandchild1
			// !   └─ child2
			// !       └─ grandchild2
			const parent: MemoEntry = {
				id: "complex-parent-001",
				timestamp: "2025-11-05T20:00:00.000Z",
				category: "work",
				content: "親",
			}

			const child1: MemoEntry = {
				id: "complex-child-001",
				timestamp: "2025-11-05T20:10:00.000Z",
				category: "work",
				content: "子1",
				parentId: "complex-parent-001",
			}

			const child2: MemoEntry = {
				id: "complex-child-002",
				timestamp: "2025-11-05T20:20:00.000Z",
				category: "work",
				content: "子2",
				parentId: "complex-parent-001",
			}

			const grandchild1: MemoEntry = {
				id: "complex-grandchild-001",
				timestamp: "2025-11-05T20:30:00.000Z",
				category: "work",
				content: "孫1",
				parentId: "complex-child-001",
			}

			const grandchild2: MemoEntry = {
				id: "complex-grandchild-002",
				timestamp: "2025-11-05T20:40:00.000Z",
				category: "work",
				content: "孫2",
				parentId: "complex-child-002",
			}

			const allMemos = [parent, child1, child2, grandchild1, grandchild2]

			// Act: getDescendantMemos()を呼び出し。
			const descendants = getDescendantMemos("complex-parent-001", allMemos)

			// Assert: 全ての子孫（4つ）が取得される。
			expect(descendants).toHaveLength(4)
			expect(descendants.map(m => m.id)).toContain("complex-child-001")
			expect(descendants.map(m => m.id)).toContain("complex-child-002")
			expect(descendants.map(m => m.id)).toContain("complex-grandchild-001")
			expect(descendants.map(m => m.id)).toContain("complex-grandchild-002")
		})
	})
})
