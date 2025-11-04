import { ViewMode } from "../src/types"

describe("Sidebarビューモード状態管理テスト", () => {
	describe("ビューモード状態", () => {
		test("Sidebarはデフォルトでメインビューモードである", () => {
			// ! Sidebarのモック。
			const sidebar = {
				viewMode: "main" as ViewMode,
				focusedThreadId: null as string | null,
			}

			expect(sidebar.viewMode).toBe("main")
			expect(sidebar.focusedThreadId).toBeNull()
		})

		test("ビューモードをスレッドモードに変更できる", () => {
			const sidebar = {
				viewMode: "main" as ViewMode,
				focusedThreadId: null as string | null,
			}

			// ! スレッドビューに切り替え。
			sidebar.viewMode = "thread"
			sidebar.focusedThreadId = "test-memo-id"

			expect(sidebar.viewMode).toBe("thread")
			expect(sidebar.focusedThreadId).toBe("test-memo-id")
		})

		test("メインビューに戻るとfocusedThreadIdがnullになる", () => {
			const sidebar = {
				viewMode: "thread" as ViewMode,
				focusedThreadId: "test-memo-id" as string | null,
			}

			// ! メインビューに戻る。
			sidebar.viewMode = "main"
			sidebar.focusedThreadId = null

			expect(sidebar.viewMode).toBe("main")
			expect(sidebar.focusedThreadId).toBeNull()
		})

		test("スレッドビューで別のメモにフォーカスを変更できる", () => {
			const sidebar = {
				viewMode: "thread" as ViewMode,
				focusedThreadId: "memo-1" as string | null,
			}

			// ! 別のメモにフォーカスを変更。
			sidebar.focusedThreadId = "memo-2"

			expect(sidebar.viewMode).toBe("thread")
			expect(sidebar.focusedThreadId).toBe("memo-2")
		})
	})

	describe("ビューモード遷移", () => {
		test("showThreadView()でスレッドビューに遷移する", () => {
			// ! シンプルな状態管理のモック。
			const state = {
				viewMode: "main" as ViewMode,
				focusedThreadId: null as string | null,
			}

			const showThreadView = (memoId: string) => {
				state.viewMode = "thread"
				state.focusedThreadId = memoId
			}

			showThreadView("target-memo")

			expect(state.viewMode).toBe("thread")
			expect(state.focusedThreadId).toBe("target-memo")
		})

		test("showMainView()でメインビューに遷移する", () => {
			const state = {
				viewMode: "thread" as ViewMode,
				focusedThreadId: "some-memo" as string | null,
			}

			const showMainView = () => {
				state.viewMode = "main"
				state.focusedThreadId = null
			}

			showMainView()

			expect(state.viewMode).toBe("main")
			expect(state.focusedThreadId).toBeNull()
		})
	})
})
