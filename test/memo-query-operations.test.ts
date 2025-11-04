import {
	filterMemos,
	filterMemosByCategory,
	filterMemosByDateRange,
	findMemoById,
	getActiveMemos,
	getDeletedMemos,
	getMemosWithAttachments,
	getMemosWithTemplate,
	getPinnedMemos,
	getUnpinnedMemos,
	searchMemosByContent,
	sortMemosByTimestamp,
	sortMemosWithPinnedFirst,
} from "../src/core/memo-query-operations"
import { MemoEntry } from "../src/types/memo"

// ! memo-query-operationsのテスト。
describe("memo-query-operations", () => {
	// ! テスト用のサンプルメモデータ。
	const sampleMemos: MemoEntry[] = [
		{
			id: "memo-1",
			category: "work",
			timestamp: "2025-10-30T10:00:00.000Z",
			content: "仕事のメモ1",
		},
		{
			id: "memo-2",
			category: "personal",
			timestamp: "2025-10-30T12:00:00.000Z",
			content: "個人的なメモ2",
		},
		{
			id: "memo-3",
			category: "work",
			timestamp: "2025-10-30T14:00:00.000Z",
			content: "仕事のメモ3",
			pinnedAt: "2025-10-31T10:00:00.000Z",
		},
		{
			id: "memo-4",
			category: "study",
			timestamp: "2025-10-31T09:00:00.000Z",
			content: "勉強のメモ4",
			attachments: ["file1.pdf", "image.png"],
		},
		{
			id: "memo-5",
			category: "work",
			timestamp: "2025-10-31T11:00:00.000Z",
			content: "仕事のメモ5",
			trashedAt: "2025-10-31T15:00:00.000Z",
		},
		{
			id: "memo-6",
			category: "personal",
			timestamp: "2025-11-01T10:00:00.000Z",
			content: "個人的なメモ6",
			template: "## %Y-%m-%d\n{{content}}",
		},
	]

	describe("filterMemosByCategory", () => {
		test("特定のカテゴリでフィルタリング", () => {
			const result = filterMemosByCategory(sampleMemos, "work")

			expect(result).toHaveLength(3)
			expect(result.every(m => m.category === "work")).toBe(true)
		})

		test("空文字の場合は全メモを返す", () => {
			const result = filterMemosByCategory(sampleMemos, "")

			expect(result).toEqual(sampleMemos)
		})

		test("存在しないカテゴリの場合は空配列", () => {
			const result = filterMemosByCategory(sampleMemos, "nonexistent")

			expect(result).toEqual([])
		})

		test("空のメモ配列をフィルタリング", () => {
			const result = filterMemosByCategory([], "work")

			expect(result).toEqual([])
		})
	})

	describe("filterMemosByDateRange", () => {
		test("日付範囲内のメモをフィルタリング", () => {
			const result = filterMemosByDateRange(
				sampleMemos,
				"2025-10-30T00:00:00.000Z",
				"2025-10-30T23:59:59.999Z",
			)

			expect(result).toHaveLength(3)
			expect(result[0].id).toBe("memo-1")
			expect(result[1].id).toBe("memo-2")
			expect(result[2].id).toBe("memo-3")
		})

		test("境界値を含む", () => {
			const result = filterMemosByDateRange(
				sampleMemos,
				"2025-10-30T10:00:00.000Z",
				"2025-10-31T09:00:00.000Z",
			)

			expect(result).toHaveLength(4)
		})

		test("範囲外のメモは含まない", () => {
			const result = filterMemosByDateRange(
				sampleMemos,
				"2025-11-02T00:00:00.000Z",
				"2025-11-03T00:00:00.000Z",
			)

			expect(result).toEqual([])
		})

		test("空のメモ配列をフィルタリング", () => {
			const result = filterMemosByDateRange(
				[],
				"2025-10-30T00:00:00.000Z",
				"2025-10-31T00:00:00.000Z",
			)

			expect(result).toEqual([])
		})
	})

	describe("sortMemosByTimestamp", () => {
		test("昇順でソート", () => {
			const result = sortMemosByTimestamp(sampleMemos, "asc")

			expect(result[0].id).toBe("memo-1")
			expect(result[1].id).toBe("memo-2")
			expect(result[2].id).toBe("memo-3")
			expect(result[3].id).toBe("memo-4")
			expect(result[4].id).toBe("memo-5")
			expect(result[5].id).toBe("memo-6")
		})

		test("降順でソート", () => {
			const result = sortMemosByTimestamp(sampleMemos, "desc")

			expect(result[0].id).toBe("memo-6")
			expect(result[1].id).toBe("memo-5")
			expect(result[2].id).toBe("memo-4")
			expect(result[3].id).toBe("memo-3")
			expect(result[4].id).toBe("memo-2")
			expect(result[5].id).toBe("memo-1")
		})

		test("元の配列を変更しない", () => {
			const original = [...sampleMemos]
			sortMemosByTimestamp(sampleMemos, "asc")

			expect(sampleMemos).toEqual(original)
		})

		test("空の配列をソート", () => {
			const result = sortMemosByTimestamp([], "asc")

			expect(result).toEqual([])
		})
	})

	describe("searchMemosByContent", () => {
		test("部分一致で検索", () => {
			const result = searchMemosByContent(sampleMemos, "仕事")

			expect(result).toHaveLength(3)
			expect(result.every(m => m.content.includes("仕事"))).toBe(true)
		})

		test("大文字小文字を区別しない（デフォルト）", () => {
			const memos: MemoEntry[] = [
				{
					id: "test-1",
					category: "test",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "Hello World",
				},
			]

			const result = searchMemosByContent(memos, "hello")

			expect(result).toHaveLength(1)
		})

		test("大文字小文字を区別する", () => {
			const memos: MemoEntry[] = [
				{
					id: "test-1",
					category: "test",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "Hello World",
				},
			]

			const result = searchMemosByContent(memos, "hello", true)

			expect(result).toHaveLength(0)
		})

		test("空のクエリの場合は全メモを返す", () => {
			const result = searchMemosByContent(sampleMemos, "")

			expect(result).toEqual(sampleMemos)
		})

		test("マッチしない場合は空配列", () => {
			const result = searchMemosByContent(sampleMemos, "存在しないキーワード")

			expect(result).toEqual([])
		})
	})

	describe("getPinnedMemos", () => {
		test("ピン留めされたメモのみを抽出", () => {
			const result = getPinnedMemos(sampleMemos)

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("memo-3")
		})

		test("ピン留めされたメモがない場合は空配列", () => {
			const unpinned = sampleMemos.filter(m => !m.pinnedAt)
			const result = getPinnedMemos(unpinned)

			expect(result).toEqual([])
		})
	})

	describe("getUnpinnedMemos", () => {
		test("ピン留めされていないメモのみを抽出", () => {
			const result = getUnpinnedMemos(sampleMemos)

			expect(result).toHaveLength(5)
			expect(result.every(m => !m.pinnedAt)).toBe(true)
		})

		test("全てピン留めされている場合は空配列", () => {
			const allPinned = sampleMemos.map(m => ({
				...m,
				pinnedAt: "2025-10-31T10:00:00.000Z",
			}))
			const result = getUnpinnedMemos(allPinned)

			expect(result).toEqual([])
		})
	})

	describe("getActiveMemos", () => {
		test("削除されていないメモのみを抽出", () => {
			const result = getActiveMemos(sampleMemos)

			expect(result).toHaveLength(5)
			expect(result.every(m => !m.trashedAt)).toBe(true)
		})

		test("全て削除されている場合は空配列", () => {
			const allDeleted = sampleMemos.map(m => ({
				...m,
				trashedAt: "2025-10-31T15:00:00.000Z",
			}))
			const result = getActiveMemos(allDeleted)

			expect(result).toEqual([])
		})
	})

	describe("getDeletedMemos", () => {
		test("削除されたメモのみを抽出", () => {
			const result = getDeletedMemos(sampleMemos)

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("memo-5")
		})

		test("削除されたメモがない場合は空配列", () => {
			const active = sampleMemos.filter(m => !m.trashedAt)
			const result = getDeletedMemos(active)

			expect(result).toEqual([])
		})
	})

	describe("filterMemos", () => {
		test("カテゴリでフィルタリング", () => {
			const result = filterMemos(sampleMemos, { category: "work" })

			expect(result).toHaveLength(2) // ! memo-5は削除済みなので除外される。
		})

		test("日付範囲でフィルタリング", () => {
			const result = filterMemos(sampleMemos, {
				startDate: "2025-10-30T00:00:00.000Z",
				endDate: "2025-10-30T23:59:59.999Z",
			})

			expect(result).toHaveLength(3)
		})

		test("検索クエリでフィルタリング", () => {
			const result = filterMemos(sampleMemos, { searchQuery: "仕事" })

			expect(result).toHaveLength(2) // ! memo-5は削除済みなので除外される。
		})

		test("削除されたメモを含める", () => {
			const result = filterMemos(sampleMemos, {
				category: "work",
				includeDeleted: true,
			})

			expect(result).toHaveLength(3) // ! memo-5も含まれる。
		})

		test("ピン留めされたメモのみ", () => {
			const result = filterMemos(sampleMemos, { onlyPinned: true })

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("memo-3")
		})

		test("複数条件を組み合わせる", () => {
			const result = filterMemos(sampleMemos, {
				category: "work",
				searchQuery: "メモ1",
				startDate: "2025-10-30T00:00:00.000Z",
				endDate: "2025-10-30T23:59:59.999Z",
			})

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("memo-1")
		})

		test("条件なしの場合は削除されていないメモのみ", () => {
			const result = filterMemos(sampleMemos, {})

			expect(result).toHaveLength(5)
		})
	})

	describe("sortMemosWithPinnedFirst", () => {
		test("ピン留めを先頭に、残りを昇順でソート", () => {
			const result = sortMemosWithPinnedFirst(sampleMemos, "asc")

			expect(result[0].id).toBe("memo-3") // ! ピン留め。
			expect(result[1].id).toBe("memo-1")
			expect(result[2].id).toBe("memo-2")
			expect(result[3].id).toBe("memo-4")
			expect(result[4].id).toBe("memo-5")
			expect(result[5].id).toBe("memo-6")
		})

		test("ピン留めを先頭に、残りを降順でソート", () => {
			const result = sortMemosWithPinnedFirst(sampleMemos, "desc")

			expect(result[0].id).toBe("memo-3") // ! ピン留め。
			expect(result[1].id).toBe("memo-6")
			expect(result[2].id).toBe("memo-5")
			expect(result[3].id).toBe("memo-4")
			expect(result[4].id).toBe("memo-2")
			expect(result[5].id).toBe("memo-1")
		})

		test("複数のピン留めは新しい順に並ぶ", () => {
			const memos: MemoEntry[] = [
				{
					id: "pin-1",
					category: "test",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "test1",
					pinnedAt: "2025-10-31T10:00:00.000Z",
				},
				{
					id: "pin-2",
					category: "test",
					timestamp: "2025-10-30T11:00:00.000Z",
					content: "test2",
					pinnedAt: "2025-10-31T12:00:00.000Z",
				},
				{
					id: "normal",
					category: "test",
					timestamp: "2025-10-30T12:00:00.000Z",
					content: "test3",
				},
			]

			const result = sortMemosWithPinnedFirst(memos, "asc")

			expect(result[0].id).toBe("pin-2") // ! 新しいピン留め。
			expect(result[1].id).toBe("pin-1")
			expect(result[2].id).toBe("normal")
		})

		test("ピン留めがない場合は通常のソートと同じ", () => {
			const unpinned = sampleMemos.filter(m => !m.pinnedAt)
			const result = sortMemosWithPinnedFirst(unpinned, "asc")

			expect(result).toEqual(sortMemosByTimestamp(unpinned, "asc"))
		})
	})

	describe("findMemoById", () => {
		test("IDでメモを検索", () => {
			const result = findMemoById(sampleMemos, "memo-3")

			expect(result).not.toBeNull()
			expect(result?.id).toBe("memo-3")
		})

		test("存在しないIDの場合はnull", () => {
			const result = findMemoById(sampleMemos, "nonexistent")

			expect(result).toBeNull()
		})

		test("空の配列から検索", () => {
			const result = findMemoById([], "memo-1")

			expect(result).toBeNull()
		})
	})

	describe("getMemosWithAttachments", () => {
		test("添付ファイルを持つメモのみを抽出", () => {
			const result = getMemosWithAttachments(sampleMemos)

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("memo-4")
		})

		test("添付ファイルを持つメモがない場合は空配列", () => {
			const noAttachments = sampleMemos.filter(m => !m.attachments)
			const result = getMemosWithAttachments(noAttachments)

			expect(result).toEqual([])
		})

		test("空の添付ファイル配列は除外", () => {
			const memos: MemoEntry[] = [
				{
					id: "test-1",
					category: "test",
					timestamp: "2025-10-30T10:00:00.000Z",
					content: "test",
					attachments: [],
				},
			]

			const result = getMemosWithAttachments(memos)

			expect(result).toEqual([])
		})
	})

	describe("getMemosWithTemplate", () => {
		test("テンプレートを持つメモのみを抽出", () => {
			const result = getMemosWithTemplate(sampleMemos)

			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("memo-6")
		})

		test("テンプレートを持つメモがない場合は空配列", () => {
			const noTemplate = sampleMemos.filter(m => !m.template)
			const result = getMemosWithTemplate(noTemplate)

			expect(result).toEqual([])
		})
	})
})
