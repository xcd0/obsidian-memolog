import {
	cleanupExpiredMemos,
	findDeletedMemoIndexById,
	getActiveMemos,
	getDeletedMemos,
	markAsDeleted,
	markAsRestored,
	markMemoAsDeleted,
	markMemoAsRestored,
} from "../src/core/memo-trash-operations"

// ! memo-trash-operationsのテスト。
describe("memo-trash-operations", () => {
	describe("markAsDeleted", () => {
		test("メモを削除状態にする", () => {
			const memoText = `<!-- memo-id: memo-1, timestamp: 2025-10-30T14:30:00.000Z, category: "work" -->
## 2025-10-30 14:30
メモの内容
`
			const trashedAt = "2025-10-31T10:00:00.000Z"

			const result = markAsDeleted(memoText, trashedAt)

			expect(result).toContain("deleted: \"true\"")
			expect(result).toContain(`trashedAt: "${trashedAt}"`)
			expect(result).toContain("<!--\n## 2025-10-30 14:30\nメモの内容\n-->")
		})

		test("空のコンテンツのメモを削除状態にする", () => {
			const memoText = `<!-- memo-id: memo-1, timestamp: 2025-10-30T14:30:00.000Z -->
`
			const trashedAt = "2025-10-31T10:00:00.000Z"

			const result = markAsDeleted(memoText, trashedAt)

			expect(result).toContain("deleted: \"true\"")
			expect(result).toContain(`trashedAt: "${trashedAt}"`)
			expect(result.trim().endsWith("-->")).toBe(true)
		})

		test("複数行のメモを削除状態にする", () => {
			const memoText = `<!-- memo-id: memo-1, timestamp: 2025-10-30T14:30:00.000Z -->
## タイトル
段落1

段落2
`
			const trashedAt = "2025-10-31T10:00:00.000Z"

			const result = markAsDeleted(memoText, trashedAt)

			expect(result).toContain("<!--\n## タイトル\n段落1\n\n段落2\n-->")
		})
	})

	describe("markAsRestored", () => {
		test("削除されたメモを復元する", () => {
			const deletedMemo =
				`<!-- memo-id: memo-1, timestamp: 2025-10-30T14:30:00.000Z, category: "work", deleted: "true", trashedAt: "2025-10-31T10:00:00.000Z" -->
<!--
## 2025-10-30 14:30
メモの内容
-->`

			const result = markAsRestored(deletedMemo)

			expect(result).not.toContain("deleted: \"true\"")
			expect(result).not.toContain("trashedAt:")
			expect(result).toContain("## 2025-10-30 14:30")
			expect(result).toContain("メモの内容")
			expect(result).not.toContain("<!--\n## 2025-10-30")
		})

		test("空のコンテンツのメモを復元する", () => {
			const deletedMemo = `<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-10-31T10:00:00.000Z" -->
`

			const result = markAsRestored(deletedMemo)

			expect(result).not.toContain("deleted: \"true\"")
			expect(result).toBe("<!-- memo-id: memo-1 -->\n\n")
		})

		test("コメントアウトされていないメモを復元する（エッジケース）", () => {
			const deletedMemo = `<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-10-31T10:00:00.000Z" -->
通常のテキスト`

			const result = markAsRestored(deletedMemo)

			expect(result).not.toContain("deleted: \"true\"")
			expect(result).toContain("通常のテキスト")
		})
	})

	describe("getDeletedMemos", () => {
		const memos = [
			`<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-10-31T10:00:00.000Z" -->
<!--内容1-->`,
			`<!-- memo-id: memo-2, category: "work" -->
内容2`,
			`<!-- memo-id: memo-3, deleted: "true", trashedAt: "2025-10-31T11:00:00.000Z" -->
<!--内容3-->`,
			`<!-- memo-id: memo-4 -->
内容4`,
		]

		test("削除されたメモのみを抽出", () => {
			const result = getDeletedMemos(memos)

			expect(result).toHaveLength(2)
			expect(result[0]).toContain("memo-1")
			expect(result[1]).toContain("memo-3")
		})

		test("削除されたメモがない場合は空配列", () => {
			const activeMemos = memos.filter(m => !m.includes("deleted: \"true\""))
			const result = getDeletedMemos(activeMemos)

			expect(result).toEqual([])
		})

		test("全て削除されたメモの場合", () => {
			const allDeleted = memos.filter(m => m.includes("deleted: \"true\""))
			const result = getDeletedMemos(allDeleted)

			expect(result).toHaveLength(2)
		})
	})

	describe("getActiveMemos", () => {
		const memos = [
			`<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-10-31T10:00:00.000Z" -->
<!--内容1-->`,
			`<!-- memo-id: memo-2, category: "work" -->
内容2`,
			`<!-- memo-id: memo-3, deleted: "true", trashedAt: "2025-10-31T11:00:00.000Z" -->
<!--内容3-->`,
			`<!-- memo-id: memo-4 -->
内容4`,
		]

		test("削除されていないメモのみを抽出", () => {
			const result = getActiveMemos(memos)

			expect(result).toHaveLength(2)
			expect(result[0]).toContain("memo-2")
			expect(result[1]).toContain("memo-4")
		})

		test("全て削除されている場合は空配列", () => {
			const allDeleted = memos.filter(m => m.includes("deleted: \"true\""))
			const result = getActiveMemos(allDeleted)

			expect(result).toEqual([])
		})

		test("全て有効なメモの場合", () => {
			const allActive = memos.filter(m => !m.includes("deleted: \"true\""))
			const result = getActiveMemos(allActive)

			expect(result).toHaveLength(2)
		})
	})

	describe("markMemoAsDeleted", () => {
		const memos = [
			`<!-- memo-id: memo-1, timestamp: 2025-10-30T14:30:00.000Z -->
内容1
`,
			`<!-- memo-id: memo-2, timestamp: 2025-10-30T15:00:00.000Z -->
内容2
`,
			`<!-- memo-id: memo-3, timestamp: 2025-10-30T16:00:00.000Z -->
内容3
`,
		]

		test("最初のメモを削除状態にする", () => {
			const trashedAt = "2025-10-31T10:00:00.000Z"
			const result = markMemoAsDeleted(memos, "memo-1", trashedAt)

			expect(result.marked).toBe(true)
			expect(result.memos).toHaveLength(3)
			expect(result.memos[0]).toContain("deleted: \"true\"")
			expect(result.memos[0]).toContain(`trashedAt: "${trashedAt}"`)
			expect(result.memos[1]).not.toContain("deleted: \"true\"")
			expect(result.memos[2]).not.toContain("deleted: \"true\"")
		})

		test("中間のメモを削除状態にする", () => {
			const trashedAt = "2025-10-31T10:00:00.000Z"
			const result = markMemoAsDeleted(memos, "memo-2", trashedAt)

			expect(result.marked).toBe(true)
			expect(result.memos).toHaveLength(3)
			expect(result.memos[0]).not.toContain("deleted: \"true\"")
			expect(result.memos[1]).toContain("deleted: \"true\"")
			expect(result.memos[2]).not.toContain("deleted: \"true\"")
		})

		test("存在しないメモを削除しようとした場合", () => {
			const trashedAt = "2025-10-31T10:00:00.000Z"
			const result = markMemoAsDeleted(memos, "memo-999", trashedAt)

			expect(result.marked).toBe(false)
			expect(result.memos).toEqual(memos)
		})

		test("空のリストで削除しようとした場合", () => {
			const trashedAt = "2025-10-31T10:00:00.000Z"
			const result = markMemoAsDeleted([], "memo-1", trashedAt)

			expect(result.marked).toBe(false)
			expect(result.memos).toEqual([])
		})
	})

	describe("markMemoAsRestored", () => {
		const memos = [
			`<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-10-31T10:00:00.000Z" -->
<!--内容1-->`,
			`<!-- memo-id: memo-2 -->
内容2`,
			`<!-- memo-id: memo-3, deleted: "true", trashedAt: "2025-10-31T11:00:00.000Z" -->
<!--内容3-->`,
		]

		test("最初の削除されたメモを復元する", () => {
			const result = markMemoAsRestored(memos, "memo-1")

			expect(result.restored).toBe(true)
			expect(result.memos).toHaveLength(3)
			expect(result.memos[0]).not.toContain("deleted: \"true\"")
			expect(result.memos[0]).toContain("内容1")
			expect(result.memos[1]).toBe(memos[1])
			expect(result.memos[2]).toBe(memos[2])
		})

		test("削除されていないメモを復元しようとした場合", () => {
			const result = markMemoAsRestored(memos, "memo-2")

			expect(result.restored).toBe(false)
			expect(result.memos).toEqual(memos)
		})

		test("存在しないメモを復元しようとした場合", () => {
			const result = markMemoAsRestored(memos, "memo-999")

			expect(result.restored).toBe(false)
			expect(result.memos).toEqual(memos)
		})

		test("空のリストで復元しようとした場合", () => {
			const result = markMemoAsRestored([], "memo-1")

			expect(result.restored).toBe(false)
			expect(result.memos).toEqual([])
		})
	})

	describe("cleanupExpiredMemos", () => {
		const currentDate = "2025-11-30T10:00:00.000Z"

		test("保持期間を過ぎたメモを削除", () => {
			const memos = [
				`<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-10-01T10:00:00.000Z" -->
<!--古いメモ-->`,
				`<!-- memo-id: memo-2, deleted: "true", trashedAt: "2025-11-29T10:00:00.000Z" -->
<!--最近のメモ-->`,
				`<!-- memo-id: memo-3 -->
通常のメモ`,
			]

			const result = cleanupExpiredMemos(memos, 30, currentDate)

			expect(result.deletedCount).toBe(1)
			expect(result.memos).toHaveLength(2)
			expect(result.memos[0]).toContain("memo-2")
			expect(result.memos[1]).toContain("memo-3")
		})

		test("保持期間内のメモは削除しない", () => {
			const memos = [
				`<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-11-20T10:00:00.000Z" -->
<!--最近削除-->`,
				`<!-- memo-id: memo-2, deleted: "true", trashedAt: "2025-11-25T10:00:00.000Z" -->
<!--最近削除2-->`,
			]

			const result = cleanupExpiredMemos(memos, 30, currentDate)

			expect(result.deletedCount).toBe(0)
			expect(result.memos).toHaveLength(2)
		})

		test("削除されていないメモは保持期間に関係なく保持", () => {
			const memos = [
				`<!-- memo-id: memo-1 -->
通常のメモ1`,
				`<!-- memo-id: memo-2 -->
通常のメモ2`,
			]

			const result = cleanupExpiredMemos(memos, 1, currentDate)

			expect(result.deletedCount).toBe(0)
			expect(result.memos).toHaveLength(2)
		})

		test("trashedAtがないメモは削除しない（不正データ）", () => {
			const memos = [
				`<!-- memo-id: memo-1, deleted: "true" -->
<!--trashedAtなし-->`,
			]

			const result = cleanupExpiredMemos(memos, 30, currentDate)

			expect(result.deletedCount).toBe(0)
			expect(result.memos).toHaveLength(1)
		})

		test("空のリストで実行", () => {
			const result = cleanupExpiredMemos([], 30, currentDate)

			expect(result.deletedCount).toBe(0)
			expect(result.memos).toEqual([])
		})

		test("現在日時を省略した場合（デフォルト動作）", () => {
			const memos = [
				`<!-- memo-id: memo-1, deleted: "true", trashedAt: "2020-01-01T10:00:00.000Z" -->
<!--古すぎるメモ-->`,
			]

			const result = cleanupExpiredMemos(memos, 30)

			expect(result.deletedCount).toBe(1)
			expect(result.memos).toHaveLength(0)
		})

		test("保持期間0日（即座に削除）", () => {
			const memos = [
				`<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-11-30T09:59:59.000Z" -->
<!--1秒前に削除-->`,
			]

			const result = cleanupExpiredMemos(memos, 0, currentDate)

			expect(result.deletedCount).toBe(1)
			expect(result.memos).toHaveLength(0)
		})

		test("複数のメモが混在する場合", () => {
			const memos = [
				`<!-- memo-id: memo-1, deleted: "true", trashedAt: "2025-10-01T10:00:00.000Z" -->
<!--期限切れ-->`,
				`<!-- memo-id: memo-2 -->
通常`,
				`<!-- memo-id: memo-3, deleted: "true", trashedAt: "2025-11-29T10:00:00.000Z" -->
<!--保持期間内-->`,
				`<!-- memo-id: memo-4, deleted: "true", trashedAt: "2025-09-01T10:00:00.000Z" -->
<!--期限切れ-->`,
				`<!-- memo-id: memo-5 -->
通常2`,
			]

			const result = cleanupExpiredMemos(memos, 30, currentDate)

			expect(result.deletedCount).toBe(2)
			expect(result.memos).toHaveLength(3)
			expect(result.memos[0]).toContain("memo-2")
			expect(result.memos[1]).toContain("memo-3")
			expect(result.memos[2]).toContain("memo-5")
		})
	})

	describe("findDeletedMemoIndexById", () => {
		const memos = [
			`<!-- memo-id: memo-1 -->
通常`,
			`<!-- memo-id: memo-2, deleted: "true", trashedAt: "2025-10-31T10:00:00.000Z" -->
<!--削除済み-->`,
			`<!-- memo-id: memo-3, deleted: "true", trashedAt: "2025-10-31T11:00:00.000Z" -->
<!--削除済み-->`,
			`<!-- memo-id: memo-4 -->
通常`,
		]

		test("削除されたメモを検索", () => {
			const index = findDeletedMemoIndexById(memos, "memo-2")

			expect(index).toBe(1)
		})

		test("削除されていないメモを検索した場合は-1", () => {
			const index = findDeletedMemoIndexById(memos, "memo-1")

			expect(index).toBe(-1)
		})

		test("存在しないメモを検索した場合は-1", () => {
			const index = findDeletedMemoIndexById(memos, "memo-999")

			expect(index).toBe(-1)
		})

		test("空のリストで検索した場合は-1", () => {
			const index = findDeletedMemoIndexById([], "memo-1")

			expect(index).toBe(-1)
		})

		test("最後の削除されたメモを検索", () => {
			const index = findDeletedMemoIndexById(memos, "memo-3")

			expect(index).toBe(2)
		})
	})
})
