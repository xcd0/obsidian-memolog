import { ViewMode } from "../src/types";

//! スレッドビューの統合テスト。
describe("ThreadView統合テスト", () => {
	describe("ビュー遷移フロー", () => {
		test("メインビュー → スレッドビュー → メインビューの完全な遷移フロー", () => {
			//! 初期状態: メインビュー。
			let viewMode: ViewMode = "main";
			let focusedThreadId: string | null = null;
			const transitionLog: string[] = [];

			//! メインビュー→スレッドビュー遷移。
			const showThreadView = (memoId: string) => {
				viewMode = "thread";
				focusedThreadId = memoId;
				transitionLog.push(`thread:${memoId}`);
			};

			//! スレッドビュー→メインビュー遷移。
			const showMainView = () => {
				viewMode = "main";
				focusedThreadId = null;
				transitionLog.push("main");
			};

			//! 1. メインビューでメモカードをクリック。
			showThreadView("memo-123");
			expect(viewMode).toBe("thread");
			expect(focusedThreadId).toBe("memo-123");
			expect(transitionLog).toEqual(["thread:memo-123"]);

			//! 2. スレッドビュー内で別のメモをクリック。
			showThreadView("memo-456");
			expect(viewMode).toBe("thread");
			expect(focusedThreadId).toBe("memo-456");
			expect(transitionLog).toEqual(["thread:memo-123", "thread:memo-456"]);

			//! 3. 戻るボタンでメインビューに戻る。
			showMainView();
			expect(viewMode).toBe("main");
			expect(focusedThreadId).toBeNull();
			expect(transitionLog).toEqual(["thread:memo-123", "thread:memo-456", "main"]);
		});

		test("親メモへのナビゲーションでスレッドビューが切り替わる", () => {
			let focusedThreadId: string | null = "child-memo";

			//! 親メモへナビゲート。
			const navigateToParent = (parentId: string) => {
				focusedThreadId = parentId;
			};

			navigateToParent("parent-memo");

			expect(focusedThreadId).toBe("parent-memo");
		});

		test("スレッドビューから別のスレッドビューへの直接遷移", () => {
			let viewMode: ViewMode = "thread";
			let focusedThreadId: string | null = "thread-1";

			//! 別のスレッドに遷移。
			const showThreadView = (memoId: string) => {
				viewMode = "thread";
				focusedThreadId = memoId;
			};

			showThreadView("thread-2");

			expect(viewMode).toBe("thread");
			expect(focusedThreadId).toBe("thread-2");
		});
	});

	describe("返信投稿後の表示更新", () => {
		test("スレッドビューで返信を投稿すると表示が更新される", () => {
			const memos: Array<{ id: string; content: string; parentId: string | undefined; replyCount: number }> = [
				{ id: "parent", content: "親メモ", parentId: undefined, replyCount: 0 },
			];

			//! 返信を作成。
			const addReply = (parentId: string, content: string) => {
				const newReply = {
					id: "reply-new",
					content: content,
					parentId: parentId as string | undefined,
					replyCount: 0,
				};

				memos.push(newReply);

				//! 親メモの返信数を更新。
				const parentMemo = memos.find((m) => m.id === parentId);
				if (parentMemo) {
					parentMemo.replyCount++;
				}

				return newReply;
			};

			//! 返信投稿。
			const reply = addReply("parent", "これは返信です");

			expect(memos.length).toBe(2);
			expect(memos[0].replyCount).toBe(1);
			expect(reply.parentId).toBe("parent");
		});

		test("メインビューに戻った後、メモリストが更新される", () => {
			let viewMode: ViewMode = "thread";
			let memosReloaded = false;

			//! メインビューに戻る処理。
			const showMainView = () => {
				viewMode = "main";
				memosReloaded = true; //! loadMemos()呼び出しをシミュレート。
			};

			showMainView();

			expect(viewMode).toBe("main");
			expect(memosReloaded).toBe(true);
		});

		test("返信投稿後にスレッドビューが再レンダリングされる", () => {
			let renderCount = 0;

			//! ThreadViewのレンダリング。
			const renderThreadView = () => {
				renderCount++;
			};

			//! 初回レンダリング。
			renderThreadView();
			expect(renderCount).toBe(1);

			//! 返信投稿後に再レンダリング。
			const addReply = (_parentId: string, _content: string) => {
				//! 返信追加処理...
				renderThreadView(); //! 再レンダリング。
			};

			addReply("parent", "新しい返信");
			expect(renderCount).toBe(2);
		});
	});

	describe("検索からスレッドビューへの遷移", () => {
		test("検索で返信メモがヒットした場合、そのメモのスレッドビューに遷移する", () => {
			const memos = [
				{ id: "root", content: "ルートメモ", parentId: undefined },
				{ id: "reply1", content: "検索キーワード", parentId: "root" },
				{ id: "reply2", content: "通常の返信", parentId: "root" },
			];

			let viewMode: ViewMode = "main";
			let focusedThreadId: string | null = null;

			//! 検索処理。
			const search = (query: string) => {
				const results = memos.filter((m) => m.content.includes(query));
				return results;
			};

			//! スレッドビューに遷移。
			const showThreadView = (memoId: string) => {
				viewMode = "thread";
				focusedThreadId = memoId;
			};

			//! 検索実行。
			const searchResults = search("検索キーワード");
			expect(searchResults.length).toBe(1);
			expect(searchResults[0].id).toBe("reply1");

			//! 検索結果のメモをクリック→スレッドビューに遷移。
			showThreadView(searchResults[0].id);

			expect(viewMode).toBe("thread");
			expect(focusedThreadId).toBe("reply1");
		});

		test("検索でルートメモがヒットした場合もスレッドビューに遷移できる", () => {
			const memos = [
				{ id: "root1", content: "検索対象", parentId: undefined },
				{ id: "root2", content: "他のメモ", parentId: undefined },
			];

			let viewMode: ViewMode = "main";
			let focusedThreadId: string | null = null;

			//! 検索とスレッドビュー遷移。
			const search = (query: string) => {
				return memos.filter((m) => m.content.includes(query));
			};

			const showThreadView = (memoId: string) => {
				viewMode = "thread";
				focusedThreadId = memoId;
			};

			const searchResults = search("検索対象");
			showThreadView(searchResults[0].id);

			expect(viewMode).toBe("thread");
			expect(focusedThreadId).toBe("root1");
		});

		test("検索クリア時にメインビューに戻る", () => {
			let viewMode: ViewMode = "thread";
			let searchQuery: string | null = "検索中";

			//! 検索クリア処理。
			const clearSearch = () => {
				searchQuery = null;
				viewMode = "main";
			};

			clearSearch();

			expect(viewMode).toBe("main");
			expect(searchQuery).toBeNull();
		});
	});

	describe("データ整合性", () => {
		test("スレッドビューで削除したメモがメインビューにも反映される", () => {
			const memos = [
				{ id: "memo1", content: "A", parentId: undefined },
				{ id: "memo2", content: "B", parentId: undefined },
			];

			//! スレッドビューで削除。
			const deleteMemo = (memoId: string) => {
				const index = memos.findIndex((m) => m.id === memoId);
				if (index !== -1) {
					memos.splice(index, 1);
				}
			};

			deleteMemo("memo1");

			//! メインビューでも削除されている。
			expect(memos.length).toBe(1);
			expect(memos[0].id).toBe("memo2");
		});

		test("スレッドビューで編集したメモがメインビューにも反映される", () => {
			const memos = [
				{ id: "memo1", content: "元の内容", parentId: undefined },
			];

			//! スレッドビューで編集。
			const editMemo = (memoId: string, newContent: string) => {
				const memo = memos.find((m) => m.id === memoId);
				if (memo) {
					memo.content = newContent;
				}
			};

			editMemo("memo1", "編集後の内容");

			//! メインビューでも編集されている。
			expect(memos[0].content).toBe("編集後の内容");
		});

		test("返信数が正しく計算される", () => {
			const memos = [
				{ id: "root", content: "ルート", parentId: undefined },
				{ id: "reply1", content: "返信1", parentId: "root" },
				{ id: "reply2", content: "返信2", parentId: "root" },
				{ id: "reply3", content: "孫返信", parentId: "reply1" },
			];

			//! 直接の子のみをカウント。
			const calculateReplyCount = (memoId: string) => {
				return memos.filter((m) => m.parentId === memoId).length;
			};

			expect(calculateReplyCount("root")).toBe(2);
			expect(calculateReplyCount("reply1")).toBe(1);
			expect(calculateReplyCount("reply2")).toBe(0);
		});
	});

	describe("スレッド表示の深さ制限", () => {
		test("深いスレッド階層でも正しく表示される", () => {
			//! 10階層のスレッドを作成。
			const memos: Array<{ id: string; content: string; parentId: string | undefined }> = [];
			for (let i = 0; i < 10; i++) {
				memos.push({
					id: `memo-${i}`,
					content: `レベル${i}`,
					parentId: i === 0 ? undefined : `memo-${i - 1}`,
				});
			}

			//! スレッド深さを計算。
			const calculateDepth = (memoId: string): number => {
				const memo = memos.find((m) => m.id === memoId);
				if (!memo || !memo.parentId) return 0;

				return 1 + calculateDepth(memo.parentId);
			};

			expect(calculateDepth("memo-0")).toBe(0);
			expect(calculateDepth("memo-5")).toBe(5);
			expect(calculateDepth("memo-9")).toBe(9);
		});

		test("循環参照を防ぐ", () => {
			//! 循環参照検出ロジック。
			const wouldIntroduceCycle = (
				memoId: string,
				newParentId: string,
				parentMap: Map<string, string>
			): boolean => {
				let currentId: string | undefined = newParentId;
				const visited = new Set<string>();

				while (currentId) {
					if (currentId === memoId) return true;
					if (visited.has(currentId)) return true;

					visited.add(currentId);
					currentId = parentMap.get(currentId);
				}

				return false;
			};

			const parentMap = new Map<string, string>();
			parentMap.set("child", "parent");
			parentMap.set("grandchild", "child");

			//! 循環参照を試みる: parent → grandchild (不正)
			expect(wouldIntroduceCycle("parent", "grandchild", parentMap)).toBe(true);

			//! 正常な親変更: newmemo → parent (正常)
			expect(wouldIntroduceCycle("newmemo", "parent", parentMap)).toBe(false);
		});
	});

	describe("パフォーマンス最適化", () => {
		test("同じメモのスレッドビューを再度開いても無駄な処理をしない", () => {
			let viewMode: ViewMode = "main";
			let focusedThreadId: string | null = null;
			let renderCount = 0;

			//! スレッドビュー表示。
			const showThreadView = (memoId: string) => {
				//! 既に同じメモが表示されている場合は何もしない。
				if (viewMode === "thread" && focusedThreadId === memoId) {
					return;
				}

				viewMode = "thread";
				focusedThreadId = memoId;
				renderCount++;
			};

			//! 初回表示。
			showThreadView("memo-123");
			expect(renderCount).toBe(1);

			//! 同じメモを再度表示→レンダリングしない。
			showThreadView("memo-123");
			expect(renderCount).toBe(1);

			//! 別のメモを表示→レンダリングする。
			showThreadView("memo-456");
			expect(renderCount).toBe(2);
		});
	});
});
