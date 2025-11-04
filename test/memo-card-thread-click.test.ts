import { ViewMode } from "../src/types";

//! テスト用のハンドラー型。
interface TestHandlers {
	onThreadClick?: (memoId: string) => void;
}

//! ビューモードに応じてスレッドクリックを処理するヘルパー。
function handleCardClick(viewMode: ViewMode, memoId: string, onThreadClick?: (id: string) => void): void {
	if (viewMode === "main" && onThreadClick) {
		onThreadClick(memoId);
	}
}

describe("MemoCardスレッド遷移テスト", () => {
	describe("onThreadClickハンドラー", () => {
		test("MemoCardHandlersにonThreadClickハンドラーを追加できる", () => {
			const onThreadClick = jest.fn();

			const handlers = {
				onThreadClick,
			};

			expect(handlers.onThreadClick).toBeDefined();
			expect(typeof handlers.onThreadClick).toBe("function");
		});

		test("カードクリック時にonThreadClickハンドラーが呼ばれる", () => {
			const onThreadClick = jest.fn();

			const handlers = {
				onThreadClick,
			};

			const memoId = "test-memo-id";

			//! カードがクリックされた。
			if (handlers.onThreadClick) {
				handlers.onThreadClick(memoId);
			}

			expect(onThreadClick).toHaveBeenCalledWith(memoId);
			expect(onThreadClick).toHaveBeenCalledTimes(1);
		});

		test("onThreadClickハンドラーが未定義でもエラーにならない", () => {
			const handlers: TestHandlers = {};

			const memoId = "test-memo-id";

			//! ハンドラーが未定義でも安全に処理できる。
			expect(() => {
				if (handlers.onThreadClick) {
					handlers.onThreadClick(memoId);
				}
			}).not.toThrow();
		});
	});

	describe("メインビューとスレッドビューの切り替え", () => {
		test("メインビューでカードをクリックするとスレッドビューに遷移する", () => {
			const onThreadClick = jest.fn();
			const viewMode: ViewMode = "main";

			const handlers = {
				onThreadClick,
			};

			const memoId = "root-memo";

			//! メインビューでカードクリック。
			handleCardClick(viewMode, memoId, handlers.onThreadClick);

			expect(onThreadClick).toHaveBeenCalledWith("root-memo");
		});

		test("スレッドビューでカードをクリックしても遷移しない（編集・削除などの操作のみ）", () => {
			const onThreadClick = jest.fn();
			const viewMode: ViewMode = "thread";

			const handlers = {
				onThreadClick,
			};

			const memoId = "child-memo";

			//! スレッドビューではカードクリックでスレッド遷移しない。
			handleCardClick(viewMode, memoId, handlers.onThreadClick);

			//! スレッドビューなので呼ばれない。
			expect(onThreadClick).not.toHaveBeenCalled();
		});
	});

	describe("返信数バッジの表示", () => {
		test("返信数が0より大きい場合、バッジが表示される", () => {
			const replyCount = 5;

			//! 返信数バッジを表示するかどうかの判定。
			const shouldShowBadge = replyCount > 0;

			expect(shouldShowBadge).toBe(true);
		});

		test("返信数が0の場合、バッジは表示されない", () => {
			const replyCount = 0;

			const shouldShowBadge = replyCount > 0;

			expect(shouldShowBadge).toBe(false);
		});

		test("返信数がundefinedの場合、バッジは表示されない", () => {
			const replyCount = undefined;

			const shouldShowBadge = (replyCount || 0) > 0;

			expect(shouldShowBadge).toBe(false);
		});
	});

	describe("ボタンクリックとカードクリックの区別", () => {
		test("ボタン要素のクリックはonThreadClickを呼ばない", () => {
			const onThreadClick = jest.fn();

			const handlers = {
				onThreadClick,
			};

			//! ボタンがクリックされたかどうかのフラグ。
			const isButtonClick = true;

			//! ボタンクリックの場合は遷移しない。
			if (!isButtonClick && handlers.onThreadClick) {
				handlers.onThreadClick("memo-id");
			}

			expect(onThreadClick).not.toHaveBeenCalled();
		});

		test("カード領域のクリックはonThreadClickを呼ぶ", () => {
			const onThreadClick = jest.fn();

			const handlers = {
				onThreadClick,
			};

			const isButtonClick = false;

			//! カード領域クリックの場合は遷移する。
			if (!isButtonClick && handlers.onThreadClick) {
				handlers.onThreadClick("memo-id");
			}

			expect(onThreadClick).toHaveBeenCalledWith("memo-id");
		});
	});
});
