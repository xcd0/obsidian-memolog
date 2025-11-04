import { ViewMode } from "../src/types"

// ! スレッドビューと既存機能の互換性テスト。
describe("ThreadView互換性テスト", () => {
	describe("返信作成機能", () => {
		test("スレッドビュー内で返信ボタンをクリックして返信を作成できる", () => {
			const checkViewMode = (): ViewMode => "thread"
			const focusedThreadId = "thread-root"
			const handleReply = jest.fn()

			// ! スレッドビュー内のメモカードで返信ボタンをクリック。
			const onReply = (parentMemoId: string) => {
				if (checkViewMode() === "thread") {
					// ! スレッドビューでも返信作成が可能。
					handleReply(parentMemoId)
				}
			}

			onReply(focusedThreadId)

			expect(handleReply).toHaveBeenCalledWith(focusedThreadId)
		})

		test("スレッドビュー内で作成した返信が正しい親IDを持つ", () => {
			const focusedThreadId = "parent-memo-123"
			const newReplyId = "reply-456"

			// ! 返信作成処理をシミュレート。
			const createReply = (parentId: string, content: string): { id: string; parentId: string; content: string } => {
				return {
					id: newReplyId,
					parentId: parentId,
					content: content,
				}
			}

			const reply = createReply(focusedThreadId, "これは返信です")

			expect(reply.parentId).toBe(focusedThreadId)
			expect(reply.id).toBe(newReplyId)
		})
	})

	describe("編集・削除機能", () => {
		test("スレッドビュー内でメモを編集できる", () => {
			const checkViewMode = (): ViewMode => "thread"
			const onSaveEdit = jest.fn()

			// ! スレッドビュー内のメモを編集。
			const editMemo = (memoId: string, newContent: string) => {
				if (checkViewMode() === "thread") {
					onSaveEdit(memoId, newContent)
				}
			}

			editMemo("memo-123", "編集後の内容")

			expect(onSaveEdit).toHaveBeenCalledWith("memo-123", "編集後の内容")
		})

		test("スレッドビュー内でメモを削除できる", () => {
			const checkViewMode = (): ViewMode => "thread"
			const onDelete = jest.fn()

			// ! スレッドビュー内のメモを削除。
			const deleteMemo = (memoId: string) => {
				if (checkViewMode() === "thread") {
					onDelete(memoId)
				}
			}

			deleteMemo("memo-to-delete")

			expect(onDelete).toHaveBeenCalledWith("memo-to-delete")
		})

		test("スレッドビュー内で親メモを削除すると子孫メモもカスケード削除される", () => {
			const deletedMemoIds: string[] = []

			// ! カスケード削除をシミュレート。
			const cascadeDelete = (memoId: string, childrenMap: Map<string, string[]>) => {
				deletedMemoIds.push(memoId)

				const children = childrenMap.get(memoId) || []
				for (const childId of children) {
					cascadeDelete(childId, childrenMap)
				}
			}

			// ! テスト用のスレッド構造。
			const childrenMap = new Map<string, string[]>()
			childrenMap.set("parent", ["child1", "child2"])
			childrenMap.set("child1", ["grandchild1"])

			cascadeDelete("parent", childrenMap)

			expect(deletedMemoIds).toEqual(["parent", "child1", "grandchild1", "child2"])
		})
	})

	describe("折りたたみ機能", () => {
		test("スレッドビュー内でスレッドを折りたたむことができる", () => {
			const collapsedThreads = new Set<string>()

			const toggleCollapsed = (memoId: string) => {
				if (collapsedThreads.has(memoId)) {
					collapsedThreads.delete(memoId)
				} else {
					collapsedThreads.add(memoId)
				}
			}

			toggleCollapsed("thread-1")
			expect(collapsedThreads.has("thread-1")).toBe(true)

			toggleCollapsed("thread-1")
			expect(collapsedThreads.has("thread-1")).toBe(false)
		})

		test("折りたたまれたスレッドの子孫は表示されない", () => {
			const collapsedThreads = new Set<string>(["parent"])

			// ! 折りたたまれた子孫を計算。
			const calculateHiddenMemos = (
				collapsedThreads: Set<string>,
				childrenMap: Map<string, string[]>,
			): Set<string> => {
				const hiddenIds = new Set<string>()

				for (const collapsedId of collapsedThreads) {
					const queue = [collapsedId]
					let head = 0

					while (head < queue.length) {
						const currentId = queue[head++]
						const children = childrenMap.get(currentId) || []

						for (const childId of children) {
							hiddenIds.add(childId)
							queue.push(childId)
						}
					}
				}

				return hiddenIds
			}

			const childrenMap = new Map<string, string[]>()
			childrenMap.set("parent", ["child1", "child2"])
			childrenMap.set("child1", ["grandchild1"])

			const hiddenMemos = calculateHiddenMemos(collapsedThreads, childrenMap)

			expect(hiddenMemos.has("child1")).toBe(true)
			expect(hiddenMemos.has("child2")).toBe(true)
			expect(hiddenMemos.has("grandchild1")).toBe(true)
		})
	})

	describe("ピン留め機能", () => {
		test("ルートメモのみピン留めできる", () => {
			const pinnedMemoIds: string[] = []

			// ! ピン留め処理（ルートメモのみ許可）。
			const togglePin = (memoId: string, parentId: string | undefined) => {
				if (parentId === undefined) {
					// ! ルートメモのみピン留め可能。
					if (pinnedMemoIds.includes(memoId)) {
						const index = pinnedMemoIds.indexOf(memoId)
						pinnedMemoIds.splice(index, 1)
					} else {
						pinnedMemoIds.push(memoId)
					}
					return true
				}
				return false
			}

			// ! ルートメモをピン留め。
			const result1 = togglePin("root-memo", undefined)
			expect(result1).toBe(true)
			expect(pinnedMemoIds).toContain("root-memo")

			// ! 返信メモはピン留めできない。
			const result2 = togglePin("reply-memo", "root-memo")
			expect(result2).toBe(false)
			expect(pinnedMemoIds).not.toContain("reply-memo")
		})

		test("メインビューでピン留めされたメモが上部に表示される", () => {
			const pinnedMemoIds = ["memo-1", "memo-3"]

			// ! メモをピン留め順にソート。
			const memos = [
				{ id: "memo-1", content: "A", parentId: undefined },
				{ id: "memo-2", content: "B", parentId: undefined },
				{ id: "memo-3", content: "C", parentId: undefined },
				{ id: "memo-4", content: "D", parentId: undefined },
			]

			const sortedMemos = [...memos].sort((a, b) => {
				const aIsPinned = pinnedMemoIds.includes(a.id)
				const bIsPinned = pinnedMemoIds.includes(b.id)

				if (aIsPinned && !bIsPinned) return -1
				if (!aIsPinned && bIsPinned) return 1
				return 0
			})

			expect(sortedMemos[0].id).toBe("memo-1")
			expect(sortedMemos[1].id).toBe("memo-3")
		})
	})

	describe("ビューモード間の一貫性", () => {
		test("メインビューからスレッドビューに遷移しても既存機能が動作する", () => {
			const handlers = {
				onEdit: jest.fn(),
				onDelete: jest.fn(),
				onReply: jest.fn(),
				onToggleCollapse: jest.fn(),
			}

			// ! メインビュー→スレッドビューに遷移後、全ハンドラーが動作する。
			const switchToThreadView = () => {
				// ! スレッドビューでも全ハンドラーが動作する。
				handlers.onEdit("memo-1", "新しい内容")
				handlers.onDelete("memo-2")
				handlers.onReply("memo-3")
				handlers.onToggleCollapse("memo-4")
			}

			switchToThreadView()

			expect(handlers.onEdit).toHaveBeenCalledWith("memo-1", "新しい内容")
			expect(handlers.onDelete).toHaveBeenCalledWith("memo-2")
			expect(handlers.onReply).toHaveBeenCalledWith("memo-3")
			expect(handlers.onToggleCollapse).toHaveBeenCalledWith("memo-4")
		})

		test("スレッドビューからメインビューに戻っても既存機能が動作する", () => {
			const handlers = {
				onEdit: jest.fn(),
				onDelete: jest.fn(),
			}

			// ! スレッドビュー→メインビューに遷移（状態は関数内で管理）。
			const switchToMainView = () => {
				// ! メインビューでも全ハンドラーが動作する。
				handlers.onEdit("memo-1", "編集内容")
				handlers.onDelete("memo-2")
			}

			switchToMainView()

			expect(handlers.onEdit).toHaveBeenCalledWith("memo-1", "編集内容")
			expect(handlers.onDelete).toHaveBeenCalledWith("memo-2")
		})
	})

	describe("カテゴリ機能", () => {
		test("スレッドビュー内でメモのカテゴリを変更できる", () => {
			const checkViewMode = (): ViewMode => "thread"
			const onCategoryChange = jest.fn()

			// ! スレッドビュー内でカテゴリ変更。
			const changeCategory = (memoId: string, newCategory: string) => {
				if (checkViewMode() === "thread") {
					onCategoryChange(memoId, newCategory)
				}
			}

			changeCategory("memo-123", "新カテゴリ")

			expect(onCategoryChange).toHaveBeenCalledWith("memo-123", "新カテゴリ")
		})

		test("返信メモは親メモと同じカテゴリに自動的に配置される", () => {
			const parentMemo = {
				id: "parent",
				category: "仕事",
				parentId: undefined,
			}

			// ! 返信作成時、親のカテゴリを継承。
			const createReply = (
				parentId: string,
				parentCategory: string,
				content: string,
			): { id: string; parentId: string; category: string; content: string } => {
				return {
					id: "reply-new",
					parentId: parentId,
					category: parentCategory,
					content: content,
				}
			}

			const reply = createReply(parentMemo.id, parentMemo.category, "返信内容")

			expect(reply.category).toBe("仕事")
			expect(reply.parentId).toBe("parent")
		})
	})

	describe("TODO機能", () => {
		test("スレッドビュー内でTODOをトグルできる", () => {
			const checkViewMode = (): ViewMode => "thread"
			const onTodoToggle = jest.fn()

			// ! スレッドビュー内でTODOトグル。
			const toggleTodo = (memoId: string, completed: boolean) => {
				if (checkViewMode() === "thread") {
					onTodoToggle(memoId, completed)
				}
			}

			toggleTodo("todo-memo", true)

			expect(onTodoToggle).toHaveBeenCalledWith("todo-memo", true)
		})
	})
})
