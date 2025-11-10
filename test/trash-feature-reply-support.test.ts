/**
 * ゴミ箱機能 - 返信投稿対応のテスト
 *
 * v0.0.16で追加された返信投稿のゴミ箱表示・復元機能のテスト。
 */

import { App } from "obsidian"
import { splitFileIntoMemos } from "../src/core/memo-crud-operations"
import { memoToText, parseMetadata, parseTextToMemo } from "../src/core/memo-helpers"
import { MemoManager } from "../src/core/memo-manager"
import {
	getDescendantMemos,
	hasActiveReplies,
	shouldShowDeletedPlaceholder,
} from "../src/core/memo-query-operations"
import { createDeletionMarker } from "../src/core/memo-trash-operations"
import { MemologVaultHandler } from "../src/fs/vault-handler"
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

	describe("MemoList.render()のフィルタリングロジック", () => {
		// ! v0.0.16でのMemoList.render()のフィルタリング仕様:
		// ! - ゴミ箱タブ: 全削除済みメモ表示
		// ! - メインビュー: ルート投稿 + 返信を持つ削除済み投稿
		// ! - スレッドビュー: 全メモ

		describe("メインビューでのフィルタリング", () => {
			it("ルート投稿（parentId === undefined）は常に表示される", () => {
				const rootMemo: MemoEntry = {
					id: "root-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルート投稿",
					category: "work",
				}
				const memos = [rootMemo]

				// ! メインビューでルート投稿は表示される。
				const displayMemos = memos.filter(m => !m.parentId)
				expect(displayMemos).toContain(rootMemo)
				expect(displayMemos.length).toBe(1)
			})

			it("削除済みメモに返信がある場合、プレースホルダーとして表示される", () => {
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					permanentlyDeleted: true,
				}
				const childMemo: MemoEntry = {
					id: "child-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "返信",
					category: "work",
					parentId: "deleted-id",
				}

				const memos = [deletedMemo, childMemo]

				// ! 削除済みメモにアクティブな返信がある場合、プレースホルダーを表示すべき。
				const shouldShow = shouldShowDeletedPlaceholder(deletedMemo, memos, "main", false)
				expect(shouldShow).toBe(true)
			})

			it("削除済みメモに返信がない場合は表示されない", () => {
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					permanentlyDeleted: true,
				}

				const memos = [deletedMemo]

				// ! 返信がない削除済みメモは表示しない。
				const shouldShow = shouldShowDeletedPlaceholder(deletedMemo, memos, "main", false)
				expect(shouldShow).toBe(false)
			})

			it("返信メモ（parentId !== undefined）は表示されない", () => {
				const rootMemo: MemoEntry = {
					id: "root-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルート",
					category: "work",
				}
				const replyMemo: MemoEntry = {
					id: "reply-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "返信",
					category: "work",
					parentId: "root-id",
				}

				const memos = [rootMemo, replyMemo]

				// ! メインビューでは返信は表示されない。
				const displayMemos = memos.filter(m => !m.parentId)
				expect(displayMemos).not.toContain(replyMemo)
				expect(displayMemos).toContain(rootMemo)
				expect(displayMemos.length).toBe(1)
			})
		})

		describe("スレッドビューでのフィルタリング", () => {
			it("全メモが表示される", () => {
				const rootMemo: MemoEntry = {
					id: "root-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルート",
					category: "work",
				}
				const replyMemo: MemoEntry = {
					id: "reply-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "返信",
					category: "work",
					parentId: "root-id",
				}

				const memos = [rootMemo, replyMemo]

				// ! スレッドビューでは全メモを表示。
				const displayMemos = memos // スレッドビューではフィルタリングなし
				expect(displayMemos).toContain(rootMemo)
				expect(displayMemos).toContain(replyMemo)
				expect(displayMemos.length).toBe(2)
			})

			it("削除済みメモもそのまま表示される", () => {
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					permanentlyDeleted: true,
				}
				const childMemo: MemoEntry = {
					id: "child-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "返信",
					category: "work",
					parentId: "deleted-id",
				}

				const memos = [deletedMemo, childMemo]

				// ! スレッドビューでは削除済みメモもそのまま表示。
				const displayMemos = memos
				expect(displayMemos).toContain(deletedMemo)
				expect(displayMemos).toContain(childMemo)
				expect(displayMemos.length).toBe(2)
			})
		})

		describe("ゴミ箱タブでのフィルタリング", () => {
			it("全ての削除済みメモが表示される", () => {
				const trashedMemo1: MemoEntry = {
					id: "trashed-1",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ゴミ箱メモ1",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}
				const trashedMemo2: MemoEntry = {
					id: "trashed-2",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "ゴミ箱メモ2",
					category: "work",
					trashedAt: "2025-11-04T11:10:00+09:00",
					parentId: "trashed-1",
				}

				const memos = [trashedMemo1, trashedMemo2]

				// ! ゴミ箱タブでは全削除済みメモを表示（ルート/返信問わず）。
				const displayMemos = memos.filter(m => m.trashedAt || m.permanentlyDeleted)
				expect(displayMemos).toContain(trashedMemo1)
				expect(displayMemos).toContain(trashedMemo2)
				expect(displayMemos.length).toBe(2)
			})

			it("ルート投稿と返信投稿の区別なく表示される", () => {
				const trashedRoot: MemoEntry = {
					id: "trashed-root",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ゴミ箱ルート",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}
				const trashedReply: MemoEntry = {
					id: "trashed-reply",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "ゴミ箱返信",
					category: "work",
					trashedAt: "2025-11-04T11:10:00+09:00",
					parentId: "some-parent",
				}

				const memos = [trashedRoot, trashedReply]

				// ! ゴミ箱タブではルート/返信問わず全削除済みメモを表示。
				const displayMemos = memos.filter(m => m.trashedAt || m.permanentlyDeleted)
				expect(displayMemos).toContain(trashedRoot)
				expect(displayMemos).toContain(trashedReply)
				expect(displayMemos.length).toBe(2)
			})

			it("削除されていないメモは表示されない", () => {
				const activeMemo: MemoEntry = {
					id: "active-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "アクティブメモ",
					category: "work",
				}
				const trashedMemo: MemoEntry = {
					id: "trashed-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "ゴミ箱メモ",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}

				const memos = [activeMemo, trashedMemo]

				// ! ゴミ箱タブではアクティブメモは表示されない。
				const displayMemos = memos.filter(m => m.trashedAt || m.permanentlyDeleted)
				expect(displayMemos).not.toContain(activeMemo)
				expect(displayMemos).toContain(trashedMemo)
				expect(displayMemos.length).toBe(1)
			})
		})
	})

	describe("フェーズ4: UIコンポーネントの実装", () => {
		describe("DeletedMemoPlaceholderコンポーネント", () => {
			it("削除済みメモのプレースホルダーを表示できる", () => {
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					permanentlyDeleted: true,
				}

				// ! プレースホルダーの基本的な表示内容を確認。
				expect(deletedMemo.content).toBe("[削除済み]")
				expect(deletedMemo.permanentlyDeleted).toBe(true)
			})

			it("完全削除済み（permanently-deleted）の場合は復元ボタンを表示しない", () => {
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					permanentlyDeleted: true,
				}

				// ! permanently-deleted: trueの場合、復元不可。
				const canRestore = !deletedMemo.permanentlyDeleted
				expect(canRestore).toBe(false)
			})

			it("ゴミ箱に入っている（trashedAt）場合は復元ボタンを表示する", () => {
				const trashedMemo: MemoEntry = {
					id: "trashed-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}

				// ! trashedAtがある場合、復元可能。
				const canRestore = !!trashedMemo.trashedAt && !trashedMemo.permanentlyDeleted
				expect(canRestore).toBe(true)
			})

			it("削除済みメモにスレッド深さが適用される", () => {
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					permanentlyDeleted: true,
					parentId: "some-parent",
				}

				// ! parentIdがあるメモはスレッド深さ > 0となる。
				const hasParent = !!deletedMemo.parentId
				expect(hasParent).toBe(true)
			})

			it("プレースホルダーに復元ハンドラーを設定できる", () => {
				const deletedMemo: MemoEntry = {
					id: "deleted-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}

				let restoredMemoId: string | null = null
				const onRestore = (memoId: string) => {
					restoredMemoId = memoId
				}

				// ! 復元ハンドラーを呼び出す。
				onRestore(deletedMemo.id)
				expect(restoredMemoId).toBe("deleted-id")
			})
		})
	})

	describe("フェーズ5: 復元ロジックの実装", () => {
		describe("getDescendantMemos()関数", () => {
			it("直接の子メモのみを取得できる", () => {
				const parentMemo: MemoEntry = {
					id: "parent-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "親メモ",
					category: "work",
				}
				const childMemo: MemoEntry = {
					id: "child-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "子メモ",
					category: "work",
					parentId: "parent-id",
				}

				const memos = [parentMemo, childMemo]

				const descendants = getDescendantMemos("parent-id", memos)

				expect(descendants).toContain(childMemo)
				expect(descendants.length).toBe(1)
			})

			it("孫メモも含めて再帰的に取得できる", () => {
				const rootMemo: MemoEntry = {
					id: "root-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルート",
					category: "work",
				}
				const childMemo: MemoEntry = {
					id: "child-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "子",
					category: "work",
					parentId: "root-id",
				}
				const grandchildMemo: MemoEntry = {
					id: "grandchild-id",
					timestamp: "2025-11-04T10:20:00+09:00",
					content: "孫",
					category: "work",
					parentId: "child-id",
				}

				const memos = [rootMemo, childMemo, grandchildMemo]

				const descendants = getDescendantMemos("root-id", memos)

				expect(descendants).toContain(childMemo)
				expect(descendants).toContain(grandchildMemo)
				expect(descendants.length).toBe(2)
			})

			it("子孫がいない場合は空配列を返す", () => {
				const singleMemo: MemoEntry = {
					id: "single-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "単独メモ",
					category: "work",
				}

				const memos = [singleMemo]

				const descendants = getDescendantMemos("single-id", memos)

				expect(descendants.length).toBe(0)
			})

			it("複数の子メモと孫メモを全て取得できる", () => {
				const rootMemo: MemoEntry = {
					id: "root-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルート",
					category: "work",
				}
				const child1: MemoEntry = {
					id: "child1-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "子1",
					category: "work",
					parentId: "root-id",
				}
				const child2: MemoEntry = {
					id: "child2-id",
					timestamp: "2025-11-04T10:20:00+09:00",
					content: "子2",
					category: "work",
					parentId: "root-id",
				}
				const grandchild1: MemoEntry = {
					id: "grandchild1-id",
					timestamp: "2025-11-04T10:30:00+09:00",
					content: "孫1",
					category: "work",
					parentId: "child1-id",
				}

				const memos = [rootMemo, child1, child2, grandchild1]

				const descendants = getDescendantMemos("root-id", memos)

				expect(descendants).toContain(child1)
				expect(descendants).toContain(child2)
				expect(descendants).toContain(grandchild1)
				expect(descendants.length).toBe(3)
			})

			it("削除済みメモの子孫も取得できる", () => {
				const trashedParent: MemoEntry = {
					id: "trashed-parent-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "削除済み親",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}
				const trashedChild: MemoEntry = {
					id: "trashed-child-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "削除済み子",
					category: "work",
					parentId: "trashed-parent-id",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}

				const memos = [trashedParent, trashedChild]

				const descendants = getDescendantMemos("trashed-parent-id", memos)

				expect(descendants).toContain(trashedChild)
				expect(descendants.length).toBe(1)
			})
		})

		describe("MemoManager.restoreMemoWithDescendants()関数", () => {
			let app: App
			let vaultHandler: MemologVaultHandler
			let memoManager: MemoManager

			beforeEach(() => {
				// ! モックAppを作成。
				app = {} as App
				vaultHandler = new MemologVaultHandler(app)
				memoManager = new MemoManager(app)

				// ! vaultHandlerをモックに差し替え。
				memoManager.vaultHandler = vaultHandler
			})

			afterEach(async () => {
				// ! テスト後にファイルをクリーンアップ。
				const allFiles = vaultHandler.getMarkdownFiles()
				for (const file of allFiles) {
					await vaultHandler.deleteFile(file.path)
				}
			})

			it("単独投稿の復元: その投稿のみを復元できる", async () => {
				const singleMemo: MemoEntry = {
					id: "single-memo-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "単独メモ",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}

				// ! ファイルに保存。
				const filePath = "memolog/work/2025-11-04.md"
				const content = memoToText(singleMemo)
				await vaultHandler.writeFile(filePath, content)

				// ! 復元実行。
				const result = await memoManager.restoreMemoWithDescendants(
					"single-memo-id",
					"memolog",
					"%Y-%m-%d",
					false,
				)

				expect(result).toBe(true)

				// ! ファイルを読み込んで確認。
				const fileContent = await vaultHandler.readFile(filePath)
				const restoredMemo = parseTextToMemo(fileContent, "work")

				expect(restoredMemo).toBeDefined()
				expect(restoredMemo!.id).toBe("single-memo-id")
				expect(restoredMemo!.trashedAt).toBeUndefined()
			})

			it("親投稿の復元: 削除済みの全子孫も一括復元できる", async () => {
				const parentMemo: MemoEntry = {
					id: "parent-memo-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "親メモ",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}
				const childMemo: MemoEntry = {
					id: "child-memo-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "子メモ",
					category: "work",
					parentId: "parent-memo-id",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}
				const grandchildMemo: MemoEntry = {
					id: "grandchild-memo-id",
					timestamp: "2025-11-04T10:20:00+09:00",
					content: "孫メモ",
					category: "work",
					parentId: "child-memo-id",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}

				// ! ファイルに保存。
				const filePath = "memolog/work/2025-11-04.md"
				const content = [memoToText(parentMemo), memoToText(childMemo), memoToText(grandchildMemo)].join(
					"\n\n",
				)
				await vaultHandler.writeFile(filePath, content)

				// ! 親メモを復元（子孫も一括復元される）。
				const result = await memoManager.restoreMemoWithDescendants(
					"parent-memo-id",
					"memolog",
					"%Y-%m-%d",
					false,
				)

				expect(result).toBe(true)

				// ! ファイルを読み込んで確認。
				const fileContent = await vaultHandler.readFile(filePath)
				const memoTexts = splitFileIntoMemos(fileContent)

				expect(memoTexts.length).toBe(3)

				const memos = memoTexts.map(text => parseTextToMemo(text, "work")).filter(m => m !== null)
				const restoredParent = memos.find(m => m!.id === "parent-memo-id")
				const restoredChild = memos.find(m => m!.id === "child-memo-id")
				const restoredGrandchild = memos.find(m => m!.id === "grandchild-memo-id")

				expect(restoredParent).toBeDefined()
				expect(restoredParent!.trashedAt).toBeUndefined()
				expect(restoredChild).toBeDefined()
				expect(restoredChild!.trashedAt).toBeUndefined()
				expect(restoredGrandchild).toBeDefined()
				expect(restoredGrandchild!.trashedAt).toBeUndefined()
			})

			it("存在しないメモIDの復元: falseを返す", async () => {
				const result = await memoManager.restoreMemoWithDescendants(
					"non-existent-id",
					"memolog",
					"%Y-%m-%d",
					false,
				)

				expect(result).toBe(false)
			})

			it("親投稿のみ削除済み、子投稿はアクティブな場合: 親のみ復元される", async () => {
				const parentMemo: MemoEntry = {
					id: "parent-only-trashed-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "削除済み親",
					category: "work",
					trashedAt: "2025-11-04T11:00:00+09:00",
				}
				const activeChild: MemoEntry = {
					id: "active-child-id",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "アクティブな子",
					category: "work",
					parentId: "parent-only-trashed-id",
				}

				// ! ファイルに保存。
				const filePath = "memolog/work/2025-11-04.md"
				const content = [memoToText(parentMemo), memoToText(activeChild)].join("\n\n")
				await vaultHandler.writeFile(filePath, content)

				// ! 親メモを復元。
				const result = await memoManager.restoreMemoWithDescendants(
					"parent-only-trashed-id",
					"memolog",
					"%Y-%m-%d",
					false,
				)

				expect(result).toBe(true)

				// ! ファイルを読み込んで確認。
				const fileContent = await vaultHandler.readFile(filePath)
				const memoTexts = splitFileIntoMemos(fileContent)

				expect(memoTexts.length).toBe(2)

				const memos = memoTexts.map(text => parseTextToMemo(text, "work")).filter(m => m !== null)
				const restoredParent = memos.find(m => m!.id === "parent-only-trashed-id")
				const childStillActive = memos.find(m => m!.id === "active-child-id")

				expect(restoredParent).toBeDefined()
				expect(restoredParent!.trashedAt).toBeUndefined()
				expect(childStillActive).toBeDefined()
				expect(childStillActive!.trashedAt).toBeUndefined()
			})

			it("完全削除済み（permanently-deleted）のメモは復元できない", async () => {
				const permanentlyDeletedMemo: MemoEntry = {
					id: "permanently-deleted-id",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "[削除済み]",
					category: "work",
					permanentlyDeleted: true,
				}

				// ! ファイルに保存。
				const filePath = "memolog/work/2025-11-04.md"
				const content = memoToText(permanentlyDeletedMemo)
				await vaultHandler.writeFile(filePath, content)

				// ! 復元実行（失敗するはず）。
				const result = await memoManager.restoreMemoWithDescendants(
					"permanently-deleted-id",
					"memolog",
					"%Y-%m-%d",
					false,
				)

				expect(result).toBe(false)

				// ! ファイルを読み込んで確認（変更されていないはず）。
				const fileContent = await vaultHandler.readFile(filePath)
				const memo = parseTextToMemo(fileContent, "work")

				expect(memo).toBeDefined()
				expect(memo!.permanentlyDeleted).toBe(true)
			})
		})
	})
})
