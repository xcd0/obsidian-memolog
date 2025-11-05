/**
 * ゴミ箱機能 - 返信投稿対応のテスト
 *
 * v0.0.16で追加された返信投稿のゴミ箱表示・復元機能のテスト。
 */

import { parseMetadata, parseTextToMemo } from "../src/core/memo-helpers"
import { createDeletionMarker } from "../src/core/memo-trash-operations"
import { MemoEntry } from "../src/types/memo"

describe("ゴミ箱機能 - 返信投稿対応", () => {
	describe("フェーズ1: データ構造の拡張", () => {
		describe("MemoEntry型のpermanentlyDeletedフィールド", () => {
			it("MemoEntry型がpermanentlyDeletedフィールドを持つことができる", () => {
				// ! TDD: まずテストを書いて型定義が期待通りであることを確認。
				const memo: MemoEntry = {
					id: "test-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "テスト",
					permanentlyDeleted: true, // ! 新規フィールド。
				}

				expect(memo.permanentlyDeleted).toBe(true)
			})

			it("permanentlyDeletedはオプショナルである", () => {
				// ! 既存のメモにはpermanentlyDeletedがなくても良い。
				const memo: MemoEntry = {
					id: "test-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "テスト",
				}

				expect(memo.permanentlyDeleted).toBeUndefined()
			})
		})

		describe("parseMetadata()のpermanently-deleted対応", () => {
			it("permanently-deleted: trueを読み取れる", () => {
				const memoText =
					`<!-- memo-id: test-id, timestamp: 2025-10-31T12:00:00.000Z, category: "work", permanently-deleted: "true" -->
[削除済み]
`

				const metadata = parseMetadata(memoText)

				expect(metadata.permanentlyDeleted).toBe(true)
			})

			it("permanently-deleted: falseを読み取れる", () => {
				const memoText =
					`<!-- memo-id: test-id, timestamp: 2025-10-31T12:00:00.000Z, category: "work", permanently-deleted: "false" -->
テスト
`

				const metadata = parseMetadata(memoText)

				expect(metadata.permanentlyDeleted).toBe(false)
			})

			it("permanently-deletedがない場合はundefinedを返す", () => {
				const memoText = `<!-- memo-id: test-id, timestamp: 2025-10-31T12:00:00.000Z, category: "work" -->
テスト
`

				const metadata = parseMetadata(memoText)

				expect(metadata.permanentlyDeleted).toBeUndefined()
			})
		})

		describe("parseTextToMemo()のpermanentlyDeleted対応", () => {
			it("permanently-deleted: trueのメモをパースできる", () => {
				const memoText =
					`<!-- memo-id: test-id, timestamp: 2025-10-31T12:00:00.000Z, category: "work", permanently-deleted: "true" -->
[削除済み]
`

				const memo = parseTextToMemo(memoText, "work")

				expect(memo).not.toBeNull()
				expect(memo?.id).toBe("test-id")
				expect(memo?.permanentlyDeleted).toBe(true)
				expect(memo?.content).toBe("[削除済み]")
			})

			it("permanently-deletedがないメモはpermanentlyDeleted: undefinedとなる", () => {
				const memoText = `<!-- memo-id: test-id, timestamp: 2025-10-31T12:00:00.000Z, category: "work" -->
## 2025-10-31 12:00
テスト
`

				const memo = parseTextToMemo(memoText, "work")

				expect(memo).not.toBeNull()
				expect(memo?.permanentlyDeleted).toBeUndefined()
			})
		})

		describe("createDeletionMarker()関数", () => {
			it("削除マーカーのテキストを生成できる", () => {
				const memo: MemoEntry = {
					id: "test-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "元のコンテンツ",
				}

				const marker = createDeletionMarker(memo)

				// ! 期待される形式を確認。
				expect(marker).toContain("memo-id: test-id")
				expect(marker).toContain("timestamp: 2025-10-31T12:00:00.000Z")
				expect(marker).toContain("category: \"work\"")
				expect(marker).toContain("permanently-deleted: \"true\"")
				expect(marker).toContain("[削除済み]")
			})

			it("parentIdがある場合、parent-idも含める", () => {
				const memo: MemoEntry = {
					id: "test-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "返信メモ",
					parentId: "parent-id",
				}

				const marker = createDeletionMarker(memo)

				expect(marker).toContain("parent-id: parent-id")
			})

			it("生成された削除マーカーをパースすると、permanentlyDeleted: trueになる", () => {
				const memo: MemoEntry = {
					id: "test-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "元のコンテンツ",
				}

				const marker = createDeletionMarker(memo)
				const parsed = parseTextToMemo(marker, "work")

				expect(parsed).not.toBeNull()
				expect(parsed?.id).toBe("test-id")
				expect(parsed?.permanentlyDeleted).toBe(true)
				expect(parsed?.content).toBe("[削除済み]")
			})

			it("親子関係を維持したまま削除マーカーを生成できる", () => {
				const memo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "返信内容",
					parentId: "parent-id",
				}

				const marker = createDeletionMarker(memo)
				const parsed = parseTextToMemo(marker, "work")

				expect(parsed).not.toBeNull()
				expect(parsed?.id).toBe("child-id")
				expect(parsed?.parentId).toBe("parent-id")
				expect(parsed?.permanentlyDeleted).toBe(true)
			})
		})
	})
})
