import { MemoEntry, ViewMode } from "../src/types"

// ! ビューモードに応じてメモをフィルタリングするヘルパー関数。
function filterMemosByViewMode(memos: MemoEntry[], viewMode: ViewMode): MemoEntry[] {
	return viewMode === "main" ? memos.filter(m => !m.parentId) : memos
}

describe("MemoListルートメモフィルタリングテスト", () => {
	describe("ルートメモのフィルタリング", () => {
		test("メインビューモードではルートメモ（parentId === undefined）のみを表示する", () => {
			// ! テストデータ: ルートメモと返信メモ。
			const memos: MemoEntry[] = [
				{
					id: "root1",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルートメモ1",
					category: "work",
					attachments: [],
					replyCount: 2,
				},
				{
					id: "reply1",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "返信1",
					category: "work",
					attachments: [],
					parentId: "root1",
					replyCount: 0,
				},
				{
					id: "root2",
					timestamp: "2025-11-04T10:20:00+09:00",
					content: "ルートメモ2",
					category: "work",
					attachments: [],
					replyCount: 0,
				},
				{
					id: "reply2",
					timestamp: "2025-11-04T10:30:00+09:00",
					content: "返信2",
					category: "work",
					attachments: [],
					parentId: "root1",
					replyCount: 0,
				},
			]

			const viewMode: ViewMode = "main"

			// ! メインビューモードの場合、ルートメモのみをフィルタリング。
			const filteredMemos = filterMemosByViewMode(memos, viewMode)

			expect(filteredMemos.length).toBe(2)
			expect(filteredMemos[0].id).toBe("root1")
			expect(filteredMemos[1].id).toBe("root2")
			expect(filteredMemos.every(m => !m.parentId)).toBe(true)
		})

		test("スレッドビューモードでは全メモを表示する", () => {
			const memos: MemoEntry[] = [
				{
					id: "root",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルート",
					category: "work",
					attachments: [],
					replyCount: 1,
				},
				{
					id: "reply",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "返信",
					category: "work",
					attachments: [],
					parentId: "root",
					replyCount: 0,
				},
			]

			const viewMode: ViewMode = "thread"

			// ! スレッドビューモードでは全メモを表示。
			const filteredMemos = filterMemosByViewMode(memos, viewMode)

			expect(filteredMemos.length).toBe(2)
			expect(filteredMemos.some(m => m.parentId)).toBe(true)
		})

		test("ルートメモがない場合は空配列を返す", () => {
			const memos: MemoEntry[] = [
				{
					id: "reply1",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "返信1",
					category: "work",
					attachments: [],
					parentId: "missing-parent",
					replyCount: 0,
				},
				{
					id: "reply2",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "返信2",
					category: "work",
					attachments: [],
					parentId: "missing-parent",
					replyCount: 0,
				},
			]

			const viewMode: ViewMode = "main"

			const filteredMemos = filterMemosByViewMode(memos, viewMode)

			expect(filteredMemos.length).toBe(0)
		})

		test("全メモがルートメモの場合は全て表示する", () => {
			const memos: MemoEntry[] = [
				{
					id: "root1",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルート1",
					category: "work",
					attachments: [],
					replyCount: 0,
				},
				{
					id: "root2",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "ルート2",
					category: "work",
					attachments: [],
					replyCount: 0,
				},
				{
					id: "root3",
					timestamp: "2025-11-04T10:20:00+09:00",
					content: "ルート3",
					category: "work",
					attachments: [],
					replyCount: 0,
				},
			]

			const viewMode: ViewMode = "main"

			const filteredMemos = filterMemosByViewMode(memos, viewMode)

			expect(filteredMemos.length).toBe(3)
		})
	})

	describe("検索結果のフィルタリング", () => {
		test("検索で返信メモがヒットした場合でも、メインビューではルートメモのみ表示", () => {
			// ! 検索結果: 返信メモを含む。
			const searchResults: MemoEntry[] = [
				{
					id: "root",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルートメモ",
					category: "work",
					attachments: [],
					replyCount: 1,
				},
				{
					id: "reply",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "検索キーワードを含む返信",
					category: "work",
					attachments: [],
					parentId: "root",
					replyCount: 0,
				},
			]

			const viewMode: ViewMode = "main"

			// ! メインビューではルートメモのみを表示。
			const filteredResults = filterMemosByViewMode(searchResults, viewMode)

			expect(filteredResults.length).toBe(1)
			expect(filteredResults[0].id).toBe("root")
		})

		test("検索で返信メモのみがヒットした場合、メインビューでは何も表示されない", () => {
			const searchResults: MemoEntry[] = [
				{
					id: "reply1",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "検索キーワードを含む返信1",
					category: "work",
					attachments: [],
					parentId: "root",
					replyCount: 0,
				},
				{
					id: "reply2",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "検索キーワードを含む返信2",
					category: "work",
					attachments: [],
					parentId: "root",
					replyCount: 0,
				},
			]

			const viewMode: ViewMode = "main"

			const filteredResults = filterMemosByViewMode(searchResults, viewMode)

			// ! 返信のみなので、メインビューでは空。
			expect(filteredResults.length).toBe(0)
		})
	})
})
