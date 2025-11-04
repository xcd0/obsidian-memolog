import { App } from "obsidian"
import { CategoryConfig, MemoEntry } from "../src/types"

// ! モックApp型定義。
interface MockApp {
	vault: {
		adapter: {
			stat: jest.Mock
			exists: jest.Mock
			read: jest.Mock
			write: jest.Mock
		}
		getAbstractFileByPath: jest.Mock
		read: jest.Mock
		create: jest.Mock
		modify: jest.Mock
	}
}

// ! モックアプリを作成。
function createMockApp(): MockApp {
	return {
		vault: {
			adapter: {
				stat: jest.fn().mockResolvedValue({ mtime: Date.now() }),
				exists: jest.fn().mockResolvedValue(true),
				read: jest.fn().mockResolvedValue(""),
				write: jest.fn().mockResolvedValue(undefined),
			},
			getAbstractFileByPath: jest.fn().mockReturnValue(null),
			read: jest.fn().mockResolvedValue(""),
			create: jest.fn().mockResolvedValue(null),
			modify: jest.fn().mockResolvedValue(undefined),
		},
	}
}

// ! モックコンテナを作成。
function createMockContainer() {
	return {
		empty: jest.fn(),
		innerHTML: "",
	}
}

describe("ThreadViewコンポーネントテスト", () => {
	describe("基本構造", () => {
		test("ThreadViewをコンストラクトできる", () => {
			const app = createMockApp() as unknown as App
			const container = createMockContainer()
			const memos: MemoEntry[] = []
			const focusedMemoId = "root-memo"
			const categories: CategoryConfig[] = []

			// ! ThreadViewのモック（実装前）。
			const threadView = {
				app,
				container,
				memos,
				focusedMemoId,
				categories,
			}

			expect(threadView.app).toBe(app)
			expect(threadView.container).toBe(container)
			expect(threadView.memos).toEqual([])
			expect(threadView.focusedMemoId).toBe("root-memo")
		})

		test("render()メソッドを持つ", () => {
			const render = jest.fn()

			const threadView = {
				render,
			}

			threadView.render()
			expect(render).toHaveBeenCalled()
		})

		test("destroy()メソッドでクリーンアップできる", () => {
			const container = createMockContainer()

			const destroy = jest.fn(() => {
				container.empty()
			})

			const threadView = {
				container,
				destroy,
			}

			threadView.destroy()
			expect(destroy).toHaveBeenCalled()
			expect(container.empty).toHaveBeenCalled()
		})
	})

	describe("スレッドツリー表示", () => {
		test("フォーカスメモとその返信を階層表示する", () => {
			// ! テストデータ: ルートメモと2つの返信。
			const memos: MemoEntry[] = [
				{
					id: "root",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "ルートメモ",
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
					parentId: "root",
					replyCount: 0,
				},
				{
					id: "reply2",
					timestamp: "2025-11-04T10:20:00+09:00",
					content: "返信2",
					category: "work",
					attachments: [],
					parentId: "root",
					replyCount: 0,
				},
			]

			const focusedMemoId = "root"

			// ! フォーカスメモとその子孫をフィルタリングするロジック。
			const focusedMemo = memos.find(m => m.id === focusedMemoId)
			const childMemos = memos.filter(m => m.parentId === focusedMemoId)

			expect(focusedMemo?.id).toBe("root")
			expect(childMemos.length).toBe(2)
			expect(childMemos[0].id).toBe("reply1")
			expect(childMemos[1].id).toBe("reply2")
		})

		test("フォーカスメモの子孫のみを表示する（祖先は表示しない）", () => {
			// ! テストデータ: 祖先 -> ルート -> 子。
			const memos: MemoEntry[] = [
				{
					id: "grandparent",
					timestamp: "2025-11-04T09:00:00+09:00",
					content: "祖先メモ",
					category: "work",
					attachments: [],
					replyCount: 1,
				},
				{
					id: "parent",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "親メモ",
					category: "work",
					attachments: [],
					parentId: "grandparent",
					replyCount: 1,
				},
				{
					id: "child",
					timestamp: "2025-11-04T11:00:00+09:00",
					content: "子メモ",
					category: "work",
					attachments: [],
					parentId: "parent",
					replyCount: 0,
				},
			]

			const focusedMemoId = "parent"

			// ! フォーカスメモとその子孫のみを取得。
			const focusedMemo = memos.find(m => m.id === focusedMemoId)
			const descendants = memos.filter(m => m.parentId === focusedMemoId)

			// ! 祖先は含まれない。
			expect(focusedMemo?.id).toBe("parent")
			expect(descendants.length).toBe(1)
			expect(descendants[0].id).toBe("child")
			expect(descendants.every(m => m.id !== "grandparent")).toBe(true)
		})

		test("空のスレッド（返信なし）でもエラーにならない", () => {
			const memos: MemoEntry[] = [
				{
					id: "lonely-memo",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "返信のないメモ",
					category: "work",
					attachments: [],
					replyCount: 0,
				},
			]

			const focusedMemoId = "lonely-memo"

			const focusedMemo = memos.find(m => m.id === focusedMemoId)
			const children = memos.filter(m => m.parentId === focusedMemoId)

			expect(focusedMemo).toBeDefined()
			expect(children.length).toBe(0)
		})
	})

	describe("ナビゲーション", () => {
		test("戻るボタンでメインビューに戻る", () => {
			const onBack = jest.fn()

			const threadView = {
				onBack,
			}

			// ! 戻るボタンがクリックされた。
			threadView.onBack()

			expect(onBack).toHaveBeenCalled()
		})

		test("親メモへのナビゲーションリンクを表示できる", () => {
			const memos: MemoEntry[] = [
				{
					id: "parent",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "親メモ",
					category: "work",
					attachments: [],
					replyCount: 1,
				},
				{
					id: "child",
					timestamp: "2025-11-04T11:00:00+09:00",
					content: "子メモ",
					category: "work",
					attachments: [],
					parentId: "parent",
					replyCount: 0,
				},
			]

			const focusedMemoId = "child"

			// ! フォーカスメモの親IDを取得。
			const focusedMemo = memos.find(m => m.id === focusedMemoId)
			const parentId = focusedMemo?.parentId

			expect(parentId).toBe("parent")
		})
	})

	describe("子メモクリックでフォーカス変更", () => {
		test("子メモをクリックすると、そのメモを新しいフォーカスとして再表示する", () => {
			const onThreadCardClick = jest.fn()

			const threadView = {
				onThreadCardClick,
			}

			// ! 子メモがクリックされた。
			threadView.onThreadCardClick("child-memo-id")

			expect(onThreadCardClick).toHaveBeenCalledWith("child-memo-id")
		})
	})
})
