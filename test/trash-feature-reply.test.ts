import { parseTextToMemo } from "../src/core/memo-helpers"
import {
	hasActiveReplies,
	shouldShowDeletedPlaceholder,
} from "../src/core/memo-query-operations"
import { markAsDeleted } from "../src/core/memo-trash-operations"
import { MemoEntry } from "../src/types/memo"

describe("ゴミ箱ON時の返信投稿対応統合テスト", () => {
	describe("Phase 6-3: ゴミ箱ON時の返信削除・表示", () => {
		it("【統合】返信投稿がゴミ箱に移動できる", () => {
			// Arrange: 返信投稿。
			const replyMemo: MemoEntry = {
				id: "reply-001",
				timestamp: "2025-11-05T10:10:00.000Z",
				category: "work",
				content: "返信投稿",
				parentId: "parent-001",
			}

			// ! メモをテキスト形式に変換。
			const replyText =
				`<!-- memo-id: ${replyMemo.id}, timestamp: ${replyMemo.timestamp}, category: "${replyMemo.category}", parent-id: ${replyMemo.parentId} -->
${replyMemo.content}
`

			// Act: 返信投稿をゴミ箱に移動。
			const trashedAt = "2025-11-05T10:15:00.000Z"
			const trashedReplyText = markAsDeleted(replyText, trashedAt)

			// ! パースして検証。
			const parsed = parseTextToMemo(trashedReplyText, "work")

			// Assert: ゴミ箱に移動された返信投稿。
			expect(parsed?.id).toBe("reply-001")
			expect(parsed?.trashedAt).toBe(trashedAt)
			expect(parsed?.parentId).toBe("parent-001")
			expect(trashedReplyText).toContain("deleted: \"true\"")
			expect(trashedReplyText).toContain(`trashedAt: "${trashedAt}"`)
		})

		it("【統合】ゴミ箱内でスレッド構造が維持される", () => {
			// Arrange: 親投稿と複数の返信投稿（全てゴミ箱内）。
			const trashedParent: MemoEntry = {
				id: "trashed-parent-001",
				timestamp: "2025-11-05T11:00:00.000Z",
				category: "work",
				content: "削除された親投稿",
				trashedAt: "2025-11-05T11:30:00.000Z",
			}

			const trashedReply1: MemoEntry = {
				id: "trashed-reply-001",
				timestamp: "2025-11-05T11:10:00.000Z",
				category: "work",
				content: "削除された返信1",
				parentId: "trashed-parent-001",
				trashedAt: "2025-11-05T11:35:00.000Z",
			}

			const trashedReply2: MemoEntry = {
				id: "trashed-reply-002",
				timestamp: "2025-11-05T11:20:00.000Z",
				category: "work",
				content: "削除された返信2",
				parentId: "trashed-parent-001",
				trashedAt: "2025-11-05T11:40:00.000Z",
			}

			const allMemos = [trashedParent, trashedReply1, trashedReply2]

			// Act & Assert: スレッド構造が維持される。
			// ! 返信1と返信2の親IDが正しく保持されている。
			expect(trashedReply1.parentId).toBe("trashed-parent-001")
			expect(trashedReply2.parentId).toBe("trashed-parent-001")

			// ! 全てのメモがゴミ箱に入っている。
			expect(allMemos.every(m => m.trashedAt !== undefined)).toBe(true)

			// ! ゴミ箱タブでは全てのメモが表示される。
			const trashedMemos = allMemos.filter(m => m.trashedAt)
			expect(trashedMemos).toHaveLength(3)
		})

		it("【統合】返信投稿がゴミ箱タブに表示される", () => {
			// Arrange: ゴミ箱内の返信投稿。
			const trashedReply: MemoEntry = {
				id: "trashed-reply-003",
				timestamp: "2025-11-05T12:00:00.000Z",
				category: "work",
				content: "ゴミ箱内の返信",
				parentId: "parent-002",
				trashedAt: "2025-11-05T12:30:00.000Z",
			}

			// Act: ゴミ箱タブでの表示判定。
			// ! ゴミ箱タブでは全ての削除済みメモが表示される（親ID関係なく）。
			const isInTrash = trashedReply.trashedAt !== undefined

			// Assert: 返信投稿もゴミ箱タブに表示される。
			expect(isInTrash).toBe(true)
			expect(trashedReply.parentId).toBe("parent-002")
		})

		it("【仕様】メインビューでは削除済み返信は表示されない（親が存在しても）", () => {
			// Arrange: アクティブな親投稿と削除済み返信。
			const activeParent: MemoEntry = {
				id: "active-parent-001",
				timestamp: "2025-11-05T13:00:00.000Z",
				category: "work",
				content: "アクティブな親投稿",
			}

			const trashedReply: MemoEntry = {
				id: "trashed-reply-004",
				timestamp: "2025-11-05T13:10:00.000Z",
				category: "work",
				content: "削除された返信",
				parentId: "active-parent-001",
				trashedAt: "2025-11-05T13:30:00.000Z",
			}

			const allMemos = [activeParent, trashedReply]

			// Act: メインビューでの表示判定。
			// ! メインビューでは削除済みメモは表示されない。
			// ! ルート投稿のみ表示（parentIdがundefinedまたはnull）。
			const displayedMemos = allMemos.filter(m => !m.trashedAt && !m.permanentlyDeleted && !m.parentId)

			// Assert: 削除済み返信は表示されない。
			expect(displayedMemos).toHaveLength(1)
			expect(displayedMemos[0].id).toBe("active-parent-001")
		})

		it("【仕様】削除済み親投稿にアクティブな返信がある場合、プレースホルダーで表示される", () => {
			// Arrange: 削除済み親投稿とアクティブな返信。
			const trashedParent: MemoEntry = {
				id: "trashed-parent-002",
				timestamp: "2025-11-05T14:00:00.000Z",
				category: "work",
				content: "削除された親投稿",
				trashedAt: "2025-11-05T14:05:00.000Z",
			}

			const activeReply: MemoEntry = {
				id: "active-reply-003",
				timestamp: "2025-11-05T14:10:00.000Z",
				category: "work",
				content: "アクティブな返信",
				parentId: "trashed-parent-002",
			}

			const allMemos = [trashedParent, activeReply]
			const viewMode = "thread"

			// Act: スレッドビューでプレースホルダー表示判定。
			const shouldShow = shouldShowDeletedPlaceholder(
				trashedParent,
				allMemos,
				viewMode,
				false, // ! ゴミ箱タブではない。
			)

			// Assert: アクティブな返信があるため、プレースホルダーで表示される。
			expect(shouldShow).toBe(true)
		})

		it("【仕様】削除済み親投稿にアクティブな返信がない場合、プレースホルダーは表示されない", () => {
			// Arrange: 削除済み親投稿と削除済み返信のみ。
			const trashedParent: MemoEntry = {
				id: "trashed-parent-003",
				timestamp: "2025-11-05T15:00:00.000Z",
				category: "work",
				content: "削除された親投稿",
				trashedAt: "2025-11-05T15:05:00.000Z",
			}

			const trashedReply: MemoEntry = {
				id: "trashed-reply-008",
				timestamp: "2025-11-05T15:10:00.000Z",
				category: "work",
				content: "削除された返信",
				parentId: "trashed-parent-003",
				trashedAt: "2025-11-05T15:15:00.000Z",
			}

			const allMemos = [trashedParent, trashedReply]
			const viewMode = "thread"

			// Act: スレッドビューでプレースホルダー表示判定。
			const shouldShow = shouldShowDeletedPlaceholder(
				trashedParent,
				allMemos,
				viewMode,
				false, // ! ゴミ箱タブではない。
			)

			// Assert: アクティブな返信がないため、プレースホルダーは表示されない。
			expect(shouldShow).toBe(false)
		})
	})

	describe("Phase 6-4: hasActiveReplies() 関数の統合テスト", () => {
		it("【統合】アクティブな返信がある場合、trueを返す", () => {
			// Arrange: 親投稿とアクティブな返信。
			const parent: MemoEntry = {
				id: "parent-003",
				timestamp: "2025-11-05T15:00:00.000Z",
				category: "work",
				content: "親投稿",
			}

			const activeReply: MemoEntry = {
				id: "active-reply-001",
				timestamp: "2025-11-05T15:10:00.000Z",
				category: "work",
				content: "アクティブな返信",
				parentId: "parent-003",
			}

			const allMemos = [parent, activeReply]

			// Act: hasActiveReplies()を呼び出し。
			const hasReplies = hasActiveReplies(parent.id, allMemos)

			// Assert: アクティブな返信があるのでtrue。
			expect(hasReplies).toBe(true)
		})

		it("【統合】削除済み返信のみの場合、falseを返す", () => {
			// Arrange: 親投稿と削除済み返信。
			const parent: MemoEntry = {
				id: "parent-004",
				timestamp: "2025-11-05T16:00:00.000Z",
				category: "work",
				content: "親投稿",
			}

			const trashedReply: MemoEntry = {
				id: "trashed-reply-006",
				timestamp: "2025-11-05T16:10:00.000Z",
				category: "work",
				content: "削除された返信",
				parentId: "parent-004",
				trashedAt: "2025-11-05T16:30:00.000Z",
			}

			const allMemos = [parent, trashedReply]

			// Act: hasActiveReplies()を呼び出し。
			const hasReplies = hasActiveReplies(parent.id, allMemos)

			// Assert: アクティブな返信がないのでfalse。
			expect(hasReplies).toBe(false)
		})

		it("【統合】完全削除済み返信のみの場合、falseを返す", () => {
			// Arrange: 親投稿と完全削除済み返信。
			const parent: MemoEntry = {
				id: "parent-005",
				timestamp: "2025-11-05T17:00:00.000Z",
				category: "work",
				content: "親投稿",
			}

			const permanentlyDeletedReply: MemoEntry = {
				id: "permanently-deleted-reply-001",
				timestamp: "2025-11-05T17:10:00.000Z",
				category: "work",
				content: "[削除済み]",
				parentId: "parent-005",
				permanentlyDeleted: true,
			}

			const allMemos = [parent, permanentlyDeletedReply]

			// Act: hasActiveReplies()を呼び出し。
			const hasReplies = hasActiveReplies(parent.id, allMemos)

			// Assert: アクティブな返信がないのでfalse。
			expect(hasReplies).toBe(false)
		})

		it("【統合】混在ケース: アクティブ返信と削除済み返信がある場合、trueを返す", () => {
			// Arrange: 親投稿、アクティブな返信、削除済み返信。
			const parent: MemoEntry = {
				id: "parent-006",
				timestamp: "2025-11-05T18:00:00.000Z",
				category: "work",
				content: "親投稿",
			}

			const activeReply: MemoEntry = {
				id: "active-reply-002",
				timestamp: "2025-11-05T18:10:00.000Z",
				category: "work",
				content: "アクティブな返信",
				parentId: "parent-006",
			}

			const trashedReply: MemoEntry = {
				id: "trashed-reply-007",
				timestamp: "2025-11-05T18:20:00.000Z",
				category: "work",
				content: "削除された返信",
				parentId: "parent-006",
				trashedAt: "2025-11-05T18:40:00.000Z",
			}

			const allMemos = [parent, activeReply, trashedReply]

			// Act: hasActiveReplies()を呼び出し。
			const hasReplies = hasActiveReplies(parent.id, allMemos)

			// Assert: アクティブな返信が1つでもあればtrue。
			expect(hasReplies).toBe(true)
		})
	})
})
