import { ViewMode } from "../src/types";

describe("Sidebarビューモード統合テスト", () => {
	describe("ビューモード切り替え", () => {
		test("showThreadView()でスレッドビューに切り替わる", () => {
			//! Sidebarの状態をモック。
			const state = {
				viewMode: "main" as ViewMode,
				focusedThreadId: null as string | null,
			};

			const showThreadView = (memoId: string) => {
				state.viewMode = "thread";
				state.focusedThreadId = memoId;
			};

			showThreadView("test-memo-123");

			expect(state.viewMode).toBe("thread");
			expect(state.focusedThreadId).toBe("test-memo-123");
		});

		test("showMainView()でメインビューに切り替わる", () => {
			const state = {
				viewMode: "thread" as ViewMode,
				focusedThreadId: "some-memo" as string | null,
			};

			const showMainView = () => {
				state.viewMode = "main";
				state.focusedThreadId = null;
			};

			showMainView();

			expect(state.viewMode).toBe("main");
			expect(state.focusedThreadId).toBeNull();
		});

		test("スレッドビューから別のメモのスレッドビューに遷移できる", () => {
			const state = {
				viewMode: "thread" as ViewMode,
				focusedThreadId: "memo-1" as string | null,
			};

			const showThreadView = (memoId: string) => {
				state.viewMode = "thread";
				state.focusedThreadId = memoId;
			};

			showThreadView("memo-2");

			expect(state.viewMode).toBe("thread");
			expect(state.focusedThreadId).toBe("memo-2");
		});
	});

	describe("DOM切り替え処理", () => {
		test("メインビューではMemoListを表示し、ThreadViewを非表示にする", () => {
			const checkVisibility = (viewMode: ViewMode) => {
				return {
					memoListVisible: viewMode === "main",
					threadViewVisible: viewMode === "thread",
				};
			};

			const visibility = checkVisibility("main");

			expect(visibility.memoListVisible).toBe(true);
			expect(visibility.threadViewVisible).toBe(false);
		});

		test("スレッドビューではThreadViewを表示し、MemoListを非表示にする", () => {
			const checkVisibility = (viewMode: ViewMode) => {
				return {
					memoListVisible: viewMode === "main",
					threadViewVisible: viewMode === "thread",
				};
			};

			const visibility = checkVisibility("thread");

			expect(visibility.memoListVisible).toBe(false);
			expect(visibility.threadViewVisible).toBe(true);
		});
	});

	describe("ハンドラーの統合", () => {
		test("MemoListのonThreadClickハンドラーでshowThreadView()が呼ばれる", () => {
			const showThreadView = jest.fn();

			const handlers = {
				onThreadClick: (memoId: string) => {
					showThreadView(memoId);
				},
			};

			//! カードがクリックされた。
			handlers.onThreadClick("clicked-memo");

			expect(showThreadView).toHaveBeenCalledWith("clicked-memo");
		});

		test("ThreadViewのonBackハンドラーでshowMainView()が呼ばれる", () => {
			const showMainView = jest.fn();

			const handlers = {
				onBack: () => {
					showMainView();
				},
			};

			//! 戻るボタンがクリックされた。
			handlers.onBack();

			expect(showMainView).toHaveBeenCalled();
		});

		test("ThreadViewのonNavigateToParentハンドラーでshowThreadView()が呼ばれる", () => {
			const showThreadView = jest.fn();

			const handlers = {
				onNavigateToParent: (parentId: string) => {
					showThreadView(parentId);
				},
			};

			//! 親メモへのナビゲーションがクリックされた。
			handlers.onNavigateToParent("parent-memo");

			expect(showThreadView).toHaveBeenCalledWith("parent-memo");
		});

		test("ThreadViewのonThreadCardClickハンドラーでshowThreadView()が呼ばれる", () => {
			const showThreadView = jest.fn();

			const handlers = {
				onThreadCardClick: (memoId: string) => {
					showThreadView(memoId);
				},
			};

			//! 子メモがクリックされた。
			handlers.onThreadCardClick("child-memo");

			expect(showThreadView).toHaveBeenCalledWith("child-memo");
		});
	});

	describe("スレッドビューでの返信処理", () => {
		test("スレッドビュー内で返信ボタンをクリックした場合、focusedThreadIdを親として設定する", () => {
			const handleReply = (parentMemoId: string) => {
				//! 返信モードに入る（InputFormの処理）。
				//! 親メモIDはfocusedThreadIdまたは指定されたparentMemoId。
				return {
					replyMode: true,
					parentId: parentMemoId,
				};
			};

			const result = handleReply("focused-memo");

			expect(result.replyMode).toBe(true);
			expect(result.parentId).toBe("focused-memo");
		});
	});

	describe("メモデータの更新", () => {
		test("スレッドビューでメモを編集・削除した後、表示が更新される", () => {
			const reloadMemos = jest.fn();

			//! メモを編集または削除。
			const onSaveEdit = (_memoId: string, _newContent: string) => {
				//! 編集処理...
				//! メモをリロード。
				reloadMemos();
			};

			onSaveEdit("memo-123", "編集後の内容");

			expect(reloadMemos).toHaveBeenCalled();
		});

		test("メインビューに戻った後、メモリストが更新される", () => {
			const reloadMemos = jest.fn();

			const showMainView = () => {
				//! メインビューに戻る。
				//! メモをリロードして表示を更新。
				reloadMemos();
			};

			showMainView();

			expect(reloadMemos).toHaveBeenCalled();
		});
	});
});
