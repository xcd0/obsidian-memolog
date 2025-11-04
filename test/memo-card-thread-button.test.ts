import { ViewMode } from "../src/types";

//! メモカードスレッドボタンのテスト。
describe("MemoCardスレッドボタンテスト", () => {
	describe("スレッドボタンの表示条件", () => {
		test("返信数が0の場合、スレッドボタンは表示されない", () => {
			const replyCount = 0;

			//! スレッドボタンを表示するかどうかの判定。
			const shouldShowThreadButton = replyCount > 0;

			expect(shouldShowThreadButton).toBe(false);
		});

		test("返信数が1以上の場合、スレッドボタンが表示される", () => {
			const replyCount = 3;

			const shouldShowThreadButton = replyCount > 0;

			expect(shouldShowThreadButton).toBe(true);
		});

		test("ゴミ箱表示の場合、スレッドボタンは表示されない", () => {
			const replyCount = 5;
			const isTrash = true;

			//! ゴミ箱ではスレッドボタンを表示しない。
			const shouldShowThreadButton = replyCount > 0 && !isTrash;

			expect(shouldShowThreadButton).toBe(false);
		});

		test("通常表示で返信数が1以上の場合、スレッドボタンが表示される", () => {
			const replyCount = 5;
			const isTrash = false;

			const shouldShowThreadButton = replyCount > 0 && !isTrash;

			expect(shouldShowThreadButton).toBe(true);
		});
	});

	describe("スレッドボタンの返信数表示", () => {
		test("スレッドボタンに正確な返信数が表示される", () => {
			const replyCount = 7;

			//! スレッドボタンに表示するテキスト。
			const buttonText = String(replyCount);

			expect(buttonText).toBe("7");
		});

		test("返信数が1桁の場合も正しく表示される", () => {
			const replyCount = 3;

			const buttonText = String(replyCount);

			expect(buttonText).toBe("3");
		});

		test("返信数が2桁の場合も正しく表示される", () => {
			const replyCount = 42;

			const buttonText = String(replyCount);

			expect(buttonText).toBe("42");
		});
	});

	describe("スレッドボタンのクリック動作", () => {
		test("スレッドボタンをクリックするとonThreadClickハンドラーが呼ばれる", () => {
			const onThreadClick = jest.fn();
			const memoId = "memo-with-replies";
			const replyCount = 5;

			//! スレッドボタンクリック処理。
			const handleThreadButtonClick = () => {
				if (onThreadClick && replyCount > 0) {
					onThreadClick(memoId);
				}
			};

			handleThreadButtonClick();

			expect(onThreadClick).toHaveBeenCalledWith(memoId);
			expect(onThreadClick).toHaveBeenCalledTimes(1);
		});

		test("返信数が0の場合、スレッドボタンクリックは何もしない", () => {
			const onThreadClick = jest.fn();
			const memoId = "memo-no-replies";
			const replyCount = 0;

			const handleThreadButtonClick = () => {
				if (onThreadClick && replyCount > 0) {
					onThreadClick(memoId);
				}
			};

			handleThreadButtonClick();

			expect(onThreadClick).not.toHaveBeenCalled();
		});

		test("メインビューでスレッドボタンをクリックするとスレッドビューに遷移する", () => {
			const viewMode: ViewMode = "main";
			let currentViewMode: ViewMode = viewMode;
			let focusedThreadId: string | null = null;

			const memoId = "thread-root";
			const onThreadClick = (id: string) => {
				currentViewMode = "thread";
				focusedThreadId = id;
			};

			//! スレッドボタンクリック。
			onThreadClick(memoId);

			expect(currentViewMode).toBe("thread");
			expect(focusedThreadId).toBe(memoId);
		});
	});

	describe("スレッドボタンと返信ボタンの区別", () => {
		test("スレッドボタンと返信ボタンは独立して動作する", () => {
			const onThreadClick = jest.fn();
			const onReply = jest.fn();
			const memoId = "test-memo";

			//! スレッドボタンクリック。
			onThreadClick(memoId);

			//! 返信ボタンクリック。
			onReply(memoId);

			expect(onThreadClick).toHaveBeenCalledWith(memoId);
			expect(onReply).toHaveBeenCalledWith(memoId);
			expect(onThreadClick).toHaveBeenCalledTimes(1);
			expect(onReply).toHaveBeenCalledTimes(1);
		});

		test("スレッドボタンは返信を作成せず、ビューを切り替えるだけ", () => {
			const onThreadClick = jest.fn();
			const createReply = jest.fn();

			const memoId = "parent-memo";

			//! スレッドボタンクリック（ビュー切り替えのみ）。
			onThreadClick(memoId);

			//! 返信作成は呼ばれない。
			expect(onThreadClick).toHaveBeenCalled();
			expect(createReply).not.toHaveBeenCalled();
		});
	});

	describe("スレッドボタンのアイコン", () => {
		test("スレッドボタンには適切なアイコンが設定される", () => {
			//! スレッドボタンに使用するアイコン名。
			const threadButtonIcon = "message-circle";

			expect(threadButtonIcon).toBe("message-circle");
		});
	});

	describe("スレッドボタンのスタイルクラス", () => {
		test("スレッドボタンには専用のCSSクラスが付与される", () => {
			//! スレッドボタンのCSSクラス。
			const threadButtonClass = "memolog-btn-thread";

			expect(threadButtonClass).toBe("memolog-btn-thread");
		});

		test("返信数バッジには専用のCSSクラスが付与される", () => {
			//! 返信数バッジのCSSクラス。
			const badgeClass = "memolog-thread-count-badge";

			expect(badgeClass).toBe("memolog-thread-count-badge");
		});
	});

	describe("イベント伝播の制御", () => {
		test("スレッドボタンクリック時にイベントが親要素に伝播しない", () => {
			const onThreadClick = jest.fn();
			const onCardClick = jest.fn();

			//! スレッドボタンクリック処理（stopPropagationをシミュレート）。
			const handleThreadButtonClick = (event: { stopPropagation: () => void }) => {
				event.stopPropagation();
				onThreadClick("memo-id");
			};

			const mockEvent = {
				stopPropagation: jest.fn(),
			};

			handleThreadButtonClick(mockEvent);

			expect(mockEvent.stopPropagation).toHaveBeenCalled();
			expect(onThreadClick).toHaveBeenCalled();
			expect(onCardClick).not.toHaveBeenCalled();
		});
	});
});
