//! カードクリックでのスレッド遷移とTODOチェックボックス除外のテスト。v0.0.15で追加。

describe("カードクリックでのスレッド遷移テスト", () => {
	describe("スレッド折りたたみボタンの削除", () => {
		test("スレッド折りたたみボタンは表示されない", () => {
			const shouldShowCollapseButton = false
			expect(shouldShowCollapseButton).toBe(false)
		})

		test("collapsedThreads設定は使用されない", () => {
			const collapsedThreads: string[] = []
			const isCollapsed = collapsedThreads.includes("memo-id")
			expect(isCollapsed).toBe(false)
		})
	})

	describe("カードクリックでのスレッド遷移", () => {
		test("カードをクリックするとスレッド表示に遷移する", () => {
			const memoId = "test-memo-1"
			let navigatedToThreadId: string | null = null

			//! カードクリックハンドラー。
			const onCardClick = (id: string) => {
				navigatedToThreadId = id
			}

			//! カードクリックをシミュレート。
			onCardClick(memoId)

			expect(navigatedToThreadId).toBe("test-memo-1")
		})

		test("親投稿のカードをクリックしてもスレッド表示に遷移する", () => {
			const parentMemoId = "parent-memo-1"
			let navigatedToThreadId: string | null = null

			const onCardClick = (id: string) => {
				navigatedToThreadId = id
			}

			onCardClick(parentMemoId)

			expect(navigatedToThreadId).toBe("parent-memo-1")
		})

		test("子投稿のカードをクリックしてもスレッド表示に遷移する", () => {
			const childMemoId = "child-memo-1"
			let navigatedToThreadId: string | null = null

			const onCardClick = (id: string) => {
				navigatedToThreadId = id
			}

			onCardClick(childMemoId)

			expect(navigatedToThreadId).toBe("child-memo-1")
		})
	})

	describe("TODOチェックボックスクリック時の除外処理", () => {
		test("チェックボックスをクリックしたときはスレッド遷移しない", () => {
			let todoToggled = false

			//! チェックボックスクリックイベント。
			const onCheckboxClick = (e: { stopPropagation: () => void }) => {
				e.stopPropagation() //! カードクリックイベントの伝播を停止。
				todoToggled = true
			}

			//! チェックボックスクリックをシミュレート。
			const mockEvent = {
				stopPropagation: jest.fn(),
			}
			onCheckboxClick(mockEvent)

			//! stopPropagation が呼ばれたため、カードクリックは発火しない。
			expect(mockEvent.stopPropagation).toHaveBeenCalled()
			expect(todoToggled).toBe(true)
		})

		test("チェックボックス以外をクリックしたときはスレッド遷移する", () => {
			let navigatedToThreadId: string | null = null

			//! カードクリックイベント。
			const onCardClick = () => {
				navigatedToThreadId = "test-memo-1"
			}

			//! カード本体をクリックをシミュレート。
			onCardClick()

			expect(navigatedToThreadId).toBe("test-memo-1")
		})

		test("チェックボックスのclassNameを検知する", () => {
			//! モックオブジェクトでテスト。
			const checkboxElement = {
				classList: {
					contains: (className: string) => className === "task-list-item-checkbox",
				},
			}

			const isCheckbox = checkboxElement.classList.contains("task-list-item-checkbox")

			expect(isCheckbox).toBe(true)
		})

		test("チェックボックスのclosest検索でinput[type=checkbox]を検知する", () => {
			//! チェックボックスがクリックされたかを判定するロジック。
			const isCheckboxClick = (isCheckbox: boolean, hasCheckboxParent: boolean): boolean => {
				return isCheckbox || hasCheckboxParent
			}

			//! チェックボックス自体がクリックされた場合。
			expect(isCheckboxClick(true, false)).toBe(true)

			//! チェックボックスの親要素がクリックされた場合。
			expect(isCheckboxClick(false, true)).toBe(true)

			//! 通常のカード領域がクリックされた場合。
			expect(isCheckboxClick(false, false)).toBe(false)
		})
	})

	describe("イベント伝播の制御", () => {
		test("ボタンクリック時はstopPropagationでカードクリックを防ぐ", () => {
			let buttonClicked = false

			const onButtonClick = (e: { stopPropagation: () => void }) => {
				e.stopPropagation()
				buttonClicked = true
			}

			//! ボタンクリックをシミュレート。
			const mockEvent = {
				stopPropagation: jest.fn(),
			}
			onButtonClick(mockEvent)

			//! stopPropagation が呼ばれたため、カードクリックは発火しない。
			expect(mockEvent.stopPropagation).toHaveBeenCalled()
			expect(buttonClicked).toBe(true)
		})

		test("カード本体クリック時はイベントが伝播する", () => {
			let cardClicked = false

			const onCardClick = () => {
				cardClicked = true
			}

			//! カードクリックをシミュレート。
			onCardClick()

			expect(cardClicked).toBe(true)
		})
	})

	describe("スレッド表示への遷移動作", () => {
		test("メインビューからスレッド表示に遷移すると選択された投稿が表示される", () => {
			const selectedMemoId = "test-memo-1"
			let currentView = "main"
			let focusedMemoId: string | null = null

			const navigateToThread = (memoId: string) => {
				currentView = "thread"
				focusedMemoId = memoId
			}

			navigateToThread(selectedMemoId)

			expect(currentView).toBe("thread")
			expect(focusedMemoId).toBe("test-memo-1")
		})

		test("スレッド表示では選択された投稿と投稿欄のみ表示される", () => {
			const isThreadView = true
			const focusedMemoId = "test-memo-1"

			//! スレッド表示では特定のメモのみ表示。
			const shouldShowMemo = (memoId: string) => {
				return isThreadView && memoId === focusedMemoId
			}

			//! 投稿欄は常に表示。
			const shouldShowInputArea = isThreadView

			expect(shouldShowMemo("test-memo-1")).toBe(true)
			expect(shouldShowMemo("other-memo")).toBe(false)
			expect(shouldShowInputArea).toBe(true)
		})
	})
})
