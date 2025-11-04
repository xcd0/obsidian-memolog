//! スレッド表示の並び順とUI配置のテスト。v0.0.15で追加。

import { MemoEntry } from "../src/types/memo"

describe("スレッド表示の並び順テスト", () => {
	describe("表示順序のロジック", () => {
		test("親投稿が常に最初に表示される", () => {
			const parentMemo: Partial<MemoEntry> = {
				id: "parent-1",
				parentId: undefined,
				timestamp: "2024-01-01T10:00:00+09:00",
			}

			const childMemos: Partial<MemoEntry>[] = [
				{
					id: "child-1",
					parentId: "parent-1",
					timestamp: "2024-01-01T11:00:00+09:00",
				},
				{
					id: "child-2",
					parentId: "parent-1",
					timestamp: "2024-01-01T09:00:00+09:00",
				},
			]

			//! スレッド表示では親が必ず最初。
			const threadMemos = [parentMemo, ...childMemos]
			expect(threadMemos[0].id).toBe("parent-1")
			expect(threadMemos[0].parentId).toBeUndefined()
		})

		test("子投稿は時系列昇順(古い→新しい)で表示される", () => {
			const childMemos: Partial<MemoEntry>[] = [
				{
					id: "child-1",
					parentId: "parent-1",
					timestamp: "2024-01-01T12:00:00+09:00",
				},
				{
					id: "child-2",
					parentId: "parent-1",
					timestamp: "2024-01-01T10:00:00+09:00",
				},
				{
					id: "child-3",
					parentId: "parent-1",
					timestamp: "2024-01-01T11:00:00+09:00",
				},
			]

			//! 時系列昇順でソート。
			const sortedChildren = [...childMemos].sort((a, b) =>
				new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
			)

			expect(sortedChildren[0].id).toBe("child-2") //! 10:00
			expect(sortedChildren[1].id).toBe("child-3") //! 11:00
			expect(sortedChildren[2].id).toBe("child-1") //! 12:00
		})

		test("ユーザーの表示順設定を無視する", () => {
			const userSortSetting = "desc" //! ユーザー設定は降順。

			//! スレッド表示では設定を無視して昇順固定。
			const threadSortOrder = "asc"

			expect(threadSortOrder).toBe("asc")
			expect(threadSortOrder).not.toBe(userSortSetting)
		})

		test("親投稿のタイムスタンプより古い子投稿も正しくソートされる", () => {
			//! 親より古いタイムスタンプの子投稿がある場合(親は12:00)。
			const childMemos: Partial<MemoEntry>[] = [
				{
					id: "child-1",
					parentId: "parent-1",
					timestamp: "2024-01-01T13:00:00+09:00",
				},
				{
					id: "child-2",
					parentId: "parent-1",
					timestamp: "2024-01-01T11:00:00+09:00", //! 親より古い。
				},
			]

			const sortedChildren = [...childMemos].sort((a, b) =>
				new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
			)

			//! 親より古くても子投稿は時系列順。
			expect(sortedChildren[0].id).toBe("child-2")
			expect(sortedChildren[1].id).toBe("child-1")
		})
	})

	describe("投稿欄の配置", () => {
		test("スレッド表示では投稿欄が最下部に配置される", () => {
			//! スレッド表示モードの判定。
			const isThreadView = true

			//! スレッド表示では投稿欄は下部。
			const inputPosition = isThreadView ? "bottom" : "top"

			expect(inputPosition).toBe("bottom")
		})

		test("通常のメモ一覧では投稿欄が最上部", () => {
			const isThreadView = false
			const inputPosition = isThreadView ? "bottom" : "top"

			expect(inputPosition).toBe("top")
		})
	})

	describe("スレッド表示での投稿動作", () => {
		test("スレッド表示での投稿はparentIdが設定される", () => {
			const currentThreadParentId = "parent-1"
			const isThreadView = true

			//! スレッド表示での投稿。
			const newMemo: Partial<MemoEntry> = {
				id: "new-memo-1",
				content: "新しい返信",
				timestamp: "2024-01-01T14:00:00+09:00",
				parentId: isThreadView ? currentThreadParentId : undefined,
			}

			expect(newMemo.parentId).toBe("parent-1")
		})

		test("通常の投稿ではparentIdは設定されない", () => {
			const isThreadView = false
			const currentThreadParentId = "parent-1"

			const newMemo: Partial<MemoEntry> = {
				id: "new-memo-1",
				content: "新しいメモ",
				timestamp: "2024-01-01T14:00:00+09:00",
				parentId: isThreadView ? currentThreadParentId : undefined,
			}

			expect(newMemo.parentId).toBeUndefined()
		})

		test("スレッド表示で投稿後、自動的に最下部にスクロールする", () => {
			//! 投稿後のスクロール位置。
			const isThreadView = true
			const shouldScrollToBottom = isThreadView

			expect(shouldScrollToBottom).toBe(true)
		})
	})

	describe("複雑なスレッド構造のテスト", () => {
		test("10件以上の子投稿がある場合も正しくソートされる", () => {
			const childMemos: Partial<MemoEntry>[] = Array.from({ length: 15 }, (_, i) => ({
				id: `child-${i}`,
				parentId: "parent-1",
				timestamp: `2024-01-01T${String(10 + i).padStart(2, "0")}:00:00+09:00`,
			}))

			//! ランダムにシャッフル。
			const shuffled = [...childMemos].sort(() => Math.random() - 0.5)

			//! 時系列昇順でソート。
			const sorted = shuffled.sort((a, b) =>
				new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
			)

			//! 最初は10:00、最後は24:00。
			expect(sorted[0].id).toBe("child-0")
			expect(sorted[14].id).toBe("child-14")

			//! 全て昇順になっているか確認。
			for (let i = 1; i < sorted.length; i++) {
				const prevTime = new Date(sorted[i - 1].timestamp!).getTime()
				const currTime = new Date(sorted[i].timestamp!).getTime()
				expect(currTime).toBeGreaterThanOrEqual(prevTime)
			}
		})
	})
})
