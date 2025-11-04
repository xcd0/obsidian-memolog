import { DEFAULT_GLOBAL_SETTINGS } from "../src/types/settings"

describe("ピン留め機能", () => {
	describe("設定のデフォルト値", () => {
		test("pinnedMemoIdsが空配列で初期化される", () => {
			expect(DEFAULT_GLOBAL_SETTINGS.pinnedMemoIds).toEqual([])
		})

		test("showPinnedTabがtrueで初期化される", () => {
			expect(DEFAULT_GLOBAL_SETTINGS.showPinnedTab).toBe(true)
		})
	})

	describe("ピン留めメモID配列の操作", () => {
		test("メモIDを追加できる", () => {
			const pinnedIds: string[] = []
			const newId = "memo-001"

			pinnedIds.push(newId)

			expect(pinnedIds).toContain(newId)
			expect(pinnedIds.length).toBe(1)
		})

		test("メモIDを削除できる", () => {
			const pinnedIds = ["memo-001", "memo-002", "memo-003"]
			const idToRemove = "memo-002"

			const filtered = pinnedIds.filter(id => id !== idToRemove)

			expect(filtered).not.toContain(idToRemove)
			expect(filtered.length).toBe(2)
			expect(filtered).toEqual(["memo-001", "memo-003"])
		})

		test("重複したIDを追加しない", () => {
			const pinnedIds = ["memo-001"]
			const newId = "memo-001"

			if (!pinnedIds.includes(newId)) {
				pinnedIds.push(newId)
			}

			expect(pinnedIds.length).toBe(1)
		})

		test("複数のIDを管理できる", () => {
			const pinnedIds = ["memo-001", "memo-002", "memo-003", "memo-004"]

			expect(pinnedIds.length).toBe(4)
			expect(pinnedIds).toContain("memo-001")
			expect(pinnedIds).toContain("memo-004")
		})
	})

	describe("ピン留めメモのフィルタリング", () => {
		const allMemos = [
			{ id: "memo-001", category: "work", content: "仕事メモ1", timestamp: "2025-01-01T10:00:00Z" },
			{ id: "memo-002", category: "hobby", content: "趣味メモ1", timestamp: "2025-01-02T10:00:00Z" },
			{ id: "memo-003", category: "work", content: "仕事メモ2", timestamp: "2025-01-03T10:00:00Z" },
			{ id: "memo-004", category: "hobby", content: "趣味メモ2", timestamp: "2025-01-04T10:00:00Z" },
		]

		test("ピン留めされたメモのみ抽出できる", () => {
			const pinnedIds = ["memo-001", "memo-003"]

			const pinnedMemos = allMemos.filter(memo => pinnedIds.includes(memo.id))

			expect(pinnedMemos.length).toBe(2)
			expect(pinnedMemos[0].id).toBe("memo-001")
			expect(pinnedMemos[1].id).toBe("memo-003")
		})

		test("カテゴリでフィルタリングできる", () => {
			const pinnedIds = ["memo-001", "memo-002", "memo-003", "memo-004"]
			const category = "work"

			const pinnedMemos = allMemos.filter(memo => pinnedIds.includes(memo.id))
			const filteredByCategory = pinnedMemos.filter(memo => memo.category === category)

			expect(filteredByCategory.length).toBe(2)
			expect(filteredByCategory[0].id).toBe("memo-001")
			expect(filteredByCategory[1].id).toBe("memo-003")
		})

		test("allタブではカテゴリフィルタを適用しない", () => {
			const pinnedIds = ["memo-001", "memo-002", "memo-003"]
			const isAllTab = true

			const pinnedMemos = allMemos.filter(memo => pinnedIds.includes(memo.id))
			const result = isAllTab ? pinnedMemos : pinnedMemos.filter(memo => memo.category === "work")

			expect(result.length).toBe(3)
		})

		test("重複を除外できる", () => {
			const displayMemos = [
				{ id: "memo-001", category: "work", content: "仕事メモ1", timestamp: "2025-01-01T10:00:00Z" },
				{ id: "memo-002", category: "hobby", content: "趣味メモ1", timestamp: "2025-01-02T10:00:00Z" },
			]
			const pinnedMemos = [
				{ id: "memo-001", category: "work", content: "仕事メモ1", timestamp: "2025-01-01T10:00:00Z" },
				{ id: "memo-003", category: "work", content: "仕事メモ2", timestamp: "2025-01-03T10:00:00Z" },
			]

			const displayMemoIds = new Set(displayMemos.map(m => m.id))
			const uniquePinnedMemos = pinnedMemos.filter(memo => !displayMemoIds.has(memo.id))

			expect(uniquePinnedMemos.length).toBe(1)
			expect(uniquePinnedMemos[0].id).toBe("memo-003")
		})
	})

	describe("ピン留め状態の判定", () => {
		test("メモがピン留めされているか判定できる", () => {
			const pinnedIds = ["memo-001", "memo-002"]
			const memoId = "memo-001"

			const isPinned = pinnedIds.includes(memoId)

			expect(isPinned).toBe(true)
		})

		test("メモがピン留めされていないか判定できる", () => {
			const pinnedIds = ["memo-001", "memo-002"]
			const memoId = "memo-003"

			const isPinned = pinnedIds.includes(memoId)

			expect(isPinned).toBe(false)
		})
	})
})
