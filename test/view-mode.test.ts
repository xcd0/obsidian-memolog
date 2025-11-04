import { ViewMode } from "../src/types";

describe("ViewMode型定義テスト", () => {
	test("ViewModeは'main'または'thread'を受け入れる", () => {
		const mainMode: ViewMode = "main";
		const threadMode: ViewMode = "thread";

		expect(mainMode).toBe("main");
		expect(threadMode).toBe("thread");
	});

	test("ViewMode型の値を変数に代入できる", () => {
		let mode: ViewMode;

		mode = "main";
		expect(mode).toBe("main");

		mode = "thread";
		expect(mode).toBe("thread");
	});

	test("関数の引数としてViewMode型を使用できる", () => {
		const setViewMode = (mode: ViewMode): ViewMode => {
			return mode;
		};

		expect(setViewMode("main")).toBe("main");
		expect(setViewMode("thread")).toBe("thread");
	});
});
