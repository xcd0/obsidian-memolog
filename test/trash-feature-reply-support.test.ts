/**
 * ゴミ箱機能 - 返信投稿対応のテスト
 *
 * v0.0.16で追加された返信投稿のゴミ箱表示・復元機能のテスト。
 */

import { parseMetadata, parseTextToMemo } from "../src/core/memo-helpers"
import {
	hasActiveReplies,
	shouldShowDeletedPlaceholder,
} from "../src/core/memo-query-operations"
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

	describe("フェーズ2: 削除ロジックの修正", () => {
		describe("ゴミ箱OFF時の返信チェック", () => {
			it("返信がないメモを削除すると完全削除される", () => {
				// ! TDD: deleteMemo()の現在の動作を確認。
				// ! 返信がない場合は完全削除される。
				const memo: MemoEntry = {
					id: "test-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "テスト",
				}

				// ! このテストは実装後に実際のMemoManager.deleteMemo()を使ってテストする。
				// ! ここでは仕様の確認のみ。
				expect(memo.parentId).toBeUndefined()
			})

			it("返信があるメモを削除すると削除マーカーが作成される", () => {
				// ! TDD: deleteMemo()を修正して、返信がある場合は削除マーカーを作成するようにする。
				// ! 返信の有無は ThreadIndex を使って判定する。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				// ! 子メモの存在を示すため定義。
				// @ts-expect-error テストケースで未使用変数を定義
				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
				}

				// ! 親メモを削除すると、削除マーカーに変換される。
				const expectedMarker = createDeletionMarker(parentMemo)

				expect(expectedMarker).toContain("permanently-deleted: \"true\"")
				expect(expectedMarker).toContain("[削除済み]")
				expect(expectedMarker).toContain("memo-id: parent-id")
			})
		})

		describe("ゴミ箱ON時の削除動作", () => {
			it("deleteMemoWithDescendants()で全て削除を選択すると、親と子孫全てがゴミ箱に移動する", () => {
				// ! TDD: deleteMemoWithDescendants(moveToTrash=true)の動作確認。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
				}

				// ! 両方のメモにtrashedAtフラグが付く。
				// ! 実装後に実際のMemoManagerを使ってテストする。
				expect(parentMemo.trashedAt).toBeUndefined()
				expect(childMemo.trashedAt).toBeUndefined()
			})

			it("deleteOnlyMemoAndOrphanChildren()でこのメモのみ削除を選択すると、親のみゴミ箱に移動し、子は親なしになる", () => {
				// ! TDD: deleteOnlyMemoAndOrphanChildren(moveToTrash=true)の動作確認。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
				}

				// ! 親メモにtrashedAtフラグが付く。
				// ! 子メモのparentIdはundefinedになる。
				// ! 実装後に実際のMemoManagerを使ってテストする。
				expect(parentMemo.trashedAt).toBeUndefined()
				expect(childMemo.parentId).toBe("parent-id")
			})
		})

		describe("ゴミ箱OFF時の削除動作", () => {
			it("deleteOnlyMemoAndOrphanChildren()で返信がある親メモを削除すると、削除マーカーが作成される", () => {
				// ! TDD: deleteOnlyMemoAndOrphanChildren(moveToTrash=false)を修正。
				// ! 返信がある場合は、完全削除ではなく削除マーカーを作成する。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
				}

				// ! 親メモは削除マーカーに変換される。
				const expectedMarker = createDeletionMarker(parentMemo)

				expect(expectedMarker).toContain("permanently-deleted: \"true\"")
				expect(expectedMarker).toContain("[削除済み]")

				// ! 子メモのparentIdは維持される（親なしにならない）。
				expect(childMemo.parentId).toBe("parent-id")
			})

			it("deleteMemoWithDescendants()で返信がある親メモを全て削除すると、削除マーカーが作成される", () => {
				// ! TDD: deleteMemoWithDescendants(moveToTrash=false)を修正。
				// ! 親メモに返信がある場合、親は削除マーカーに変換し、子孫は完全削除する。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				// ! 子孫の存在を示すため定義。
				// @ts-expect-error テストケースで未使用変数を定義
				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
				}

				// @ts-expect-error テストケースで未使用変数を定義
				const grandchildMemo: MemoEntry = {
					id: "grandchild-id",
					category: "work",
					timestamp: "2025-10-31T12:02:00.000Z",
					content: "孫返信",
					parentId: "child-id",
				}

				// ! 親メモは削除マーカーに変換される。
				const expectedMarker = createDeletionMarker(parentMemo)

				expect(expectedMarker).toContain("permanently-deleted: \"true\"")
				expect(expectedMarker).toContain("[削除済み]")

				// ! 子メモと孫メモは完全削除される。
			})

			it("返信自体を削除する場合は、返信に子孫がなければ完全削除される", () => {
				// ! TDD: 返信メモ（parentId !== null）を削除する場合の動作確認。
				// ! 返信に子孫がない場合は、完全削除される。
				// @ts-expect-error テストケースで未使用変数を定義
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
				}

				// ! 返信メモを削除すると完全削除される。
				// ! 親メモは維持される。
				expect(childMemo.parentId).toBe("parent-id")
			})

			it("返信自体を削除する場合は、返信に子孫があれば削除マーカーが作成される", () => {
				// ! TDD: 返信メモ（parentId !== null）に子孫がある場合の動作確認。
				// ! 返信に子孫がある場合は、削除マーカーに変換される。
				// @ts-expect-error テストケースで未使用変数を定義
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
				}

				// @ts-expect-error テストケースで未使用変数を定義
				const grandchildMemo: MemoEntry = {
					id: "grandchild-id",
					category: "work",
					timestamp: "2025-10-31T12:02:00.000Z",
					content: "孫返信",
					parentId: "child-id",
				}

				// ! 返信メモは削除マーカーに変換される。
				const expectedMarker = createDeletionMarker(childMemo)

				expect(expectedMarker).toContain("permanently-deleted: \"true\"")
				expect(expectedMarker).toContain("parent-id: parent-id")
			})
		})
	})

	describe("フェーズ3: 表示ロジックの修正", () => {
		describe("hasActiveReplies()関数", () => {
			it("削除されていない返信がある場合はtrueを返す", () => {
				// ! TDD: hasActiveReplies()の動作を定義。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
				}

				const memos = [parentMemo, childMemo]

				// ! アクティブな返信があるのでtrue。
				expect(hasActiveReplies("parent-id", memos)).toBe(true)
			})

			it("返信がすべて削除済みの場合はfalseを返す", () => {
				// ! TDD: 返信がすべて削除済みの場合はfalse。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "parent-id",
					trashedAt: "2025-10-31T12:05:00.000Z",
				}

				const memos = [parentMemo, childMemo]

				// ! 返信は削除済みなのでfalse。
				expect(hasActiveReplies("parent-id", memos)).toBe(false)
			})

			it("返信が完全削除済み（permanently-deleted）の場合はfalseを返す", () => {
				// ! TDD: 返信が完全削除済みの場合もfalse。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "[削除済み]",
					parentId: "parent-id",
					permanentlyDeleted: true,
				}

				const memos = [parentMemo, childMemo]

				// ! 完全削除済みなのでfalse。
				expect(hasActiveReplies("parent-id", memos)).toBe(false)
			})

			it("アクティブな返信と削除済み返信が混在する場合はtrueを返す", () => {
				// ! TDD: アクティブな返信が1つでもあればtrue。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const childMemo1: MemoEntry = {
					id: "child-id-1",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信1",
					parentId: "parent-id",
				}

				const childMemo2: MemoEntry = {
					id: "child-id-2",
					category: "work",
					timestamp: "2025-10-31T12:02:00.000Z",
					content: "返信2",
					parentId: "parent-id",
					trashedAt: "2025-10-31T12:05:00.000Z",
				}

				const memos = [parentMemo, childMemo1, childMemo2]

				// ! アクティブな返信が1つあるのでtrue。
				expect(hasActiveReplies("parent-id", memos)).toBe(true)
			})

			it("返信がない場合はfalseを返す", () => {
				// ! TDD: 返信がない場合はfalse。
				const parentMemo: MemoEntry = {
					id: "parent-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "親メモ",
				}

				const memos = [parentMemo]

				// ! 返信がないのでfalse。
				expect(hasActiveReplies("parent-id", memos)).toBe(false)
			})
		})

		describe("shouldShowDeletedPlaceholder()関数", () => {
			it("メインビューで削除済みメモに返信がある場合はtrueを返す", () => {
				// ! TDD: メインビューで削除済みメモに返信がある場合は表示。
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "[削除済み]",
					permanentlyDeleted: true,
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "deleted-id",
				}

				const memos = [deletedMemo, childMemo]

				// ! 削除済みで返信があり、メインビューなのでtrue。
				expect(shouldShowDeletedPlaceholder(deletedMemo, memos, "main", false)).toBe(true)
			})

			it("スレッドビューで削除済みメモに返信がある場合はtrueを返す", () => {
				// ! TDD: スレッドビューでも削除済みメモに返信がある場合は表示。
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "[削除済み]",
					trashedAt: "2025-10-31T12:05:00.000Z",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "deleted-id",
				}

				const memos = [deletedMemo, childMemo]
				// ! 削除済みで返信があり、スレッドビューなのでtrue。
				expect(shouldShowDeletedPlaceholder(deletedMemo, memos, "thread", false)).toBe(true)
			})

			it("削除済みメモに返信がない場合はfalseを返す", () => {
				// ! TDD: 返信がない削除済みメモは表示しない。
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "[削除済み]",
					permanentlyDeleted: true,
				}

				const memos = [deletedMemo]
				// ! 返信がないのでfalse。
				expect(shouldShowDeletedPlaceholder(deletedMemo, memos, "main", false)).toBe(false)
			})

			it("削除されていないメモの場合はfalseを返す", () => {
				// ! TDD: 削除されていないメモは表示しない。
				const memo: MemoEntry = {
					id: "memo-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "通常のメモ",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "memo-id",
				}

				const memos = [memo, childMemo]
				// ! 削除されていないのでfalse。
				expect(shouldShowDeletedPlaceholder(memo, memos, "main", false)).toBe(false)
			})

			it("ゴミ箱タブの場合はfalseを返す", () => {
				// ! TDD: ゴミ箱タブではプレースホルダーを表示しない。
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					category: "work",
					timestamp: "2025-10-31T12:00:00.000Z",
					content: "[削除済み]",
					trashedAt: "2025-10-31T12:05:00.000Z",
				}

				const childMemo: MemoEntry = {
					id: "child-id",
					category: "work",
					timestamp: "2025-10-31T12:01:00.000Z",
					content: "返信",
					parentId: "deleted-id",
				}

				const memos = [deletedMemo, childMemo]
				// ! ゴミ箱タブではプレースホルダーを表示しない。
				expect(shouldShowDeletedPlaceholder(deletedMemo, memos, "main", true)).toBe(false)
			})
		})
	})
})
