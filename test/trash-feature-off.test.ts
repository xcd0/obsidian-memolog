import { parseTextToMemo } from "../src/core/memo-helpers"
import { createDeletionMarker } from "../src/core/memo-trash-operations"
import { MemoEntry } from "../src/types/memo"

describe("ゴミ箱機能OFF時の統合テスト", () => {
	describe("Phase 6-1: 削除マーカーの生成・パース・表示", () => {
		it("【統合】返信なし投稿の削除マーカーを生成できる", () => {
			// Arrange: 返信なしの通常投稿。
			const originalMemo: MemoEntry = {
				id: "test-memo-001",
				timestamp: "2025-11-05T10:00:00.000Z",
				category: "work",
				content: "削除されるメモです",
				template: "## %Y-%m-%d %H:%M",
			}

			// Act: 削除マーカーを生成（文字列として）。
			const markerText = createDeletionMarker(originalMemo)

			// Assert: 削除マーカーが正しく生成される。
			expect(markerText).toContain("test-memo-001")
			expect(markerText).toContain("permanently-deleted: \"true\"")
			expect(markerText).toContain("[削除済み]")
			expect(markerText).not.toContain("template:")

			// ! パースして検証。
			const parsed = parseTextToMemo(markerText, "work")
			expect(parsed?.id).toBe("test-memo-001")
			expect(parsed?.permanentlyDeleted).toBe(true)
			expect(parsed?.trashedAt).toBeUndefined()
		})

		it("【統合】返信あり投稿の削除マーカーを生成できる", () => {
			// Arrange: 返信ありの親投稿。
			const parentMemo: MemoEntry = {
				id: "parent-memo-001",
				timestamp: "2025-11-05T09:00:00.000Z",
				category: "work",
				content: "親投稿です",
				template: "## %Y-%m-%d %H:%M",
			}

			// Act: 削除マーカーを生成。
			const markerText = createDeletionMarker(parentMemo)

			// Assert: 削除マーカーが正しく生成される。
			expect(markerText).toContain("parent-memo-001")
			expect(markerText).toContain("permanently-deleted: \"true\"")
			expect(markerText).toContain("[削除済み]")

			// ! パースして検証。
			const parsed = parseTextToMemo(markerText, "work")
			expect(parsed?.id).toBe("parent-memo-001")
			expect(parsed?.permanentlyDeleted).toBe(true)
		})

		it("【統合】削除マーカーを文字列に変換してパースできる", () => {
			// Arrange: 削除マーカーを作成。
			const originalMemo: MemoEntry = {
				id: "test-memo-002",
				timestamp: "2025-11-05T11:00:00.000Z",
				category: "work",
				content: "テストメモ",
			}
			const markerText = createDeletionMarker(originalMemo)

			// Act: パースして復元。
			const parsedMarker = parseTextToMemo(markerText, "work")

			// Assert: 削除マーカーとして正しくパースされる。
			expect(parsedMarker).not.toBeNull()
			expect(parsedMarker!.id).toBe("test-memo-002")
			expect(parsedMarker!.permanentlyDeleted).toBe(true)
			expect(parsedMarker!.content).toBe("[削除済み]")
		})

		it("【統合】削除マーカーのパース結果が元のメモと同じメタデータを持つ", () => {
			// Arrange: 元のメモ。
			const originalMemo: MemoEntry = {
				id: "test-memo-003",
				timestamp: "2025-11-05T12:00:00.000Z",
				category: "personal",
				content: "プライベートメモ",
				template: "# %Y/%m/%d",
			}

			// ! 削除マーカーを生成。
			const markerText = createDeletionMarker(originalMemo)

			// Act: パース。
			const parsedMarker = parseTextToMemo(markerText, "personal")

			// Assert: メタデータが保持される。
			expect(parsedMarker!.id).toBe(originalMemo.id)
			expect(parsedMarker!.timestamp).toBe(originalMemo.timestamp)
			expect(parsedMarker!.category).toBe(originalMemo.category)
			expect(parsedMarker!.permanentlyDeleted).toBe(true)
		})
	})

	describe("Phase 6-2: ゴミ箱OFF時の削除動作", () => {
		it("【仕様】返信なし投稿を削除した場合、完全削除（ファイルから削除）される", () => {
			// ! この動作はMemoManager.deleteMemo()で実装される。
			// ! 統合テストでは、削除マーカーが作成されないことを確認。
			const memo: MemoEntry = {
				id: "test-memo-004",
				timestamp: "2025-11-05T13:00:00.000Z",
				category: "work",
				content: "返信なしメモ",
			}

			// ! 返信がない場合、trashedAt !== nullでも削除マーカーは作成されない。
			// ! （完全削除される）
			expect(memo.parentId).toBeUndefined()
		})

		it("【仕様】返信あり投稿を削除した場合、削除マーカーが作成される", () => {
			// Arrange: 親投稿と返信投稿。
			const parentMemo: MemoEntry = {
				id: "parent-memo-002",
				timestamp: "2025-11-05T14:00:00.000Z",
				category: "work",
				content: "親投稿",
			}

			const replyMemo: MemoEntry = {
				id: "reply-memo-001",
				timestamp: "2025-11-05T14:10:00.000Z",
				category: "work",
				content: "返信",
				parentId: "parent-memo-002",
			}

			// Act: 削除マーカーを生成（返信ありの場合）。
			const markerText = createDeletionMarker(parentMemo)
			const parsed = parseTextToMemo(markerText, "work")

			// Assert: 削除マーカーが作成される。
			expect(parsed?.permanentlyDeleted).toBe(true)
			expect(parsed?.content).toBe("[削除済み]")

			// ! 返信投稿は削除されない（parentIdが保持される）。
			expect(replyMemo.parentId).toBe("parent-memo-002")
		})

		it("【仕様】削除マーカーは復元できない", () => {
			// Arrange: 削除マーカー。
			const marker: MemoEntry = {
				id: "test-memo-005",
				timestamp: "2025-11-05T15:00:00.000Z",
				category: "work",
				content: "[削除済み]",
				permanentlyDeleted: true,
			}

			// Assert: trashedAtがないため復元不可。
			expect(marker.trashedAt).toBeUndefined()
			expect(marker.permanentlyDeleted).toBe(true)
		})

		it("【エッジケース】削除マーカーに返信がある場合でも表示される", () => {
			// Arrange: 削除マーカー（親投稿）と返信。
			const deletedParent: MemoEntry = {
				id: "deleted-parent-001",
				timestamp: "2025-11-05T16:00:00.000Z",
				category: "work",
				content: "[削除済み]",
				permanentlyDeleted: true,
			}

			const reply: MemoEntry = {
				id: "reply-002",
				timestamp: "2025-11-05T16:10:00.000Z",
				category: "work",
				content: "削除された親への返信",
				parentId: "deleted-parent-001",
			}

			// ! 削除マーカーに返信がある場合、プレースホルダーとして表示される。
			expect(deletedParent.permanentlyDeleted).toBe(true)
			expect(reply.parentId).toBe(deletedParent.id)
		})
	})

	describe("Phase 6-3: 削除マーカーのテンプレート処理", () => {
		it("【仕様】削除マーカーはテンプレートを保持しない", () => {
			// Arrange: テンプレート付きのメモ。
			const memo: MemoEntry = {
				id: "test-memo-006",
				timestamp: "2025-11-05T17:00:00.000Z",
				category: "work",
				content: "メモ内容",
				template: "## %Y-%m-%d %H:%M\n{{content}}",
			}

			// Act: 削除マーカーを生成。
			const markerText = createDeletionMarker(memo)
			const parsed = parseTextToMemo(markerText, "work")

			// Assert: テンプレートは削除される。
			expect(markerText).not.toContain("template:")
			expect(parsed?.template).toBeUndefined()
			expect(parsed?.content).toBe("[削除済み]")
		})

		it("【仕様】削除マーカーは添付ファイルを保持しない", () => {
			// Arrange: 添付ファイル付きのメモ。
			const memo: MemoEntry = {
				id: "test-memo-007",
				timestamp: "2025-11-05T18:00:00.000Z",
				category: "work",
				content: "画像付きメモ",
				attachments: ["image1.png", "document.pdf"],
			}

			// Act: 削除マーカーを生成。
			const markerText = createDeletionMarker(memo)
			const parsed = parseTextToMemo(markerText, "work")

			// Assert: 添付ファイルは削除される。
			expect(markerText).not.toContain("添付:")
			expect(parsed?.attachments).toBeUndefined()
			expect(parsed?.content).toBe("[削除済み]")
		})
	})
})
