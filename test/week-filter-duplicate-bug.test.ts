import { MemoManager } from "../src/core/memo-manager";
import { App, TFile } from "obsidian";

//! 一週間ボタンで同じ投稿が複数のカードに表示される問題を検証するテスト。
//!
//! 問題の状況:
//! - 一週間ボタンをONにすると、同じメモが複数回表示される
//! - 詳細検索の「過去7日」は正しく動作する
//!
//! 原因の仮説:
//! 1. 一週間ボタンは「7日前から」（8日分）を読み込む
//! 2. 詳細検索は「6日前から」（7日分、今日を含む）を読み込む
//! 3. ファイル読み込みロジックで同じメモが複数のファイルに含まれていた場合、重複する

//! TFileのモック作成ヘルパー。
const createMockTFile = (path: string): TFile => {
	return Object.create(TFile.prototype, {
		path: { value: path },
	}) as TFile;
};

describe("一週間フィルターの重複バグ検証", () => {
	let mockApp: App;
	let memoManager: MemoManager;

	//! テストメモデータ: 同じメモが複数のファイルに含まれているケースを再現。
	//! 実際のユーザーデータでは、メモが複数の日付のファイルに含まれることがある。
	const file1Path = "memolog/work/2025-10-25.md";
	const file2Path = "memolog/work/2025-10-30.md";
	const file3Path = "memolog/work/2025-10-31.md";

	//! 同じメモID(重複)を持つメモ。
	const duplicateMemo = `<!-- memo-id: duplicate-memo-id, timestamp: 2025-10-30T05:00:00.000Z, category: "work", template: "{{content}}" -->
重複メモ
`;

	//! ファイル1（2025-10-25）: 古いメモ。
	const file1Content = `<!-- memo-id: memo-2025-10-25, timestamp: 2025-10-25T05:00:00.000Z, category: "work", template: "{{content}}" -->
10/25のメモ
`;

	//! ファイル2（2025-10-30）: 重複メモを含む。
	const file2Content = duplicateMemo + `
<!-- memo-id: memo-2025-10-30, timestamp: 2025-10-30T05:00:00.000Z, category: "work", template: "{{content}}" -->
10/30のメモ
`;

	//! ファイル3（2025-10-31）: 重複メモを含む。
	const file3Content = duplicateMemo + `
<!-- memo-id: memo-2025-10-31, timestamp: 2025-10-31T05:00:00.000Z, category: "work", template: "{{content}}" -->
10/31のメモ
`;

	beforeEach(() => {
		//! vault APIのモック作成。
		const mockRead = jest.fn();
		const mockWrite = jest.fn();
		const mockModify = jest.fn();
		const mockGetAbstractFileByPath = jest.fn();
		const mockStat = jest.fn();
		const mockFileExists = jest.fn();
		const mockAdapterRead = jest.fn();

		mockApp = {
			vault: {
				read: mockRead,
				modify: mockModify,
				getAbstractFileByPath: mockGetAbstractFileByPath,
				adapter: {
					exists: mockFileExists,
					read: mockAdapterRead,
					write: mockWrite,
					remove: jest.fn(),
					list: jest.fn(),
					stat: mockStat,
				},
			},
		} as unknown as App;

		//! ファイルの存在チェックとstatのモック。
		mockFileExists.mockImplementation((path: string) => {
			return Promise.resolve([file1Path, file2Path, file3Path].includes(path));
		});

		mockStat.mockResolvedValue({
			mtime: Date.now(),
			ctime: Date.now(),
			size: 1000,
		});

		//! ファイル読み込みのモック(vault.readとadapter.read両方)。
		const readImplementation = (file: TFile | string) => {
			const path = typeof file === "string" ? file : file.path;
			if (path === file1Path) return Promise.resolve(file1Content);
			if (path === file2Path) return Promise.resolve(file2Content);
			if (path === file3Path) return Promise.resolve(file3Content);
			return Promise.resolve("");
		};

		mockRead.mockImplementation(readImplementation);
		mockAdapterRead.mockImplementation(readImplementation);

		//! TFileのモックを作成。
		mockGetAbstractFileByPath.mockImplementation((path: string) => {
			if ([file1Path, file2Path, file3Path].includes(path)) {
				return createMockTFile(path);
			}
			return null;
		});

		memoManager = new MemoManager(mockApp);
	});

	it("【問題再現】複数のファイルから同じメモを読み込むと重複する", async () => {
		console.log("=== 複数ファイルから読み込み ===");

		//! ファイル2とファイル3から全メモを読み込む。
		const memosFile2 = await memoManager.getMemos(file2Path, "work");
		const memosFile3 = await memoManager.getMemos(file3Path, "work");

		console.log("ファイル2のメモ数:", memosFile2.length);
		console.log("ファイル3のメモ数:", memosFile3.length);

		//! 両方のファイルを結合（sidebar.tsの allMemos.push(...memos) と同じ）。
		const allMemos = [...memosFile2, ...memosFile3];
		console.log("結合後の全メモ数:", allMemos.length);

		//! 重複メモIDのカウント。
		const duplicateMemoCount = allMemos.filter((m) => m.id === "duplicate-memo-id").length;
		console.log("重複メモIDのカウント:", duplicateMemoCount);

		//! 【問題の再現】同じメモIDが複数回含まれる。
		expect(duplicateMemoCount).toBeGreaterThan(1);
		expect(allMemos.length).toBe(4); //! 重複を含む全メモ数。

		//! ユニークなメモID数。
		const uniqueMemoIds = new Set(allMemos.map((m) => m.id));
		console.log("ユニークなメモID数:", uniqueMemoIds.size);
		expect(uniqueMemoIds.size).toBe(3); //! 実際は3つのユニークなメモのみ。
	});

	it("【解決策】メモIDで重複を除外する", async () => {
		console.log("=== 重複除外ロジック ===");

		//! ファイル2とファイル3から全メモを読み込む。
		const memosFile2 = await memoManager.getMemos(file2Path, "work");
		const memosFile3 = await memoManager.getMemos(file3Path, "work");

		//! 両方のファイルを結合。
		const allMemos = [...memosFile2, ...memosFile3];
		console.log("結合前の全メモ数:", allMemos.length);

		//! 【解決策】メモIDで重複を除外。
		const uniqueMemos = allMemos.filter(
			(memo, index, self) => self.findIndex((m) => m.id === memo.id) === index
		);

		console.log("重複除外後のメモ数:", uniqueMemos.length);
		console.log("重複除外後のメモID:", uniqueMemos.map((m) => m.id));

		//! 重複が除外されることを確認。
		expect(uniqueMemos.length).toBe(3);
		expect(uniqueMemos.map((m) => m.id)).toEqual([
			"duplicate-memo-id",
			"memo-2025-10-30",
			"memo-2025-10-31",
		]);
	});

	it("【一週間ボタンのシミュレーション】日付範囲の違いを確認", () => {
		console.log("=== 日付範囲の計算 ===");

		//! 今日を2025-10-31と仮定。
		const today = new Date("2025-10-31T12:00:00Z");

		//! 【一週間ボタン】sidebar.ts 537-540行の実装(修正後)。
		const endDate1 = new Date(today);
		endDate1.setHours(23, 59, 59, 999);
		const startDate1 = new Date(today);
		startDate1.setDate(endDate1.getDate() - 6); //! 6日前(今日を含めて7日間)。
		startDate1.setHours(0, 0, 0, 0);

		console.log("一週間ボタンの範囲:");
		console.log("  開始:", startDate1.toISOString());
		console.log("  終了:", endDate1.toISOString());

		//! 【詳細検索】search-engine.ts 187-189行の実装。
		//! search-engine.tsはローカル日付オブジェクトを使用(タイムゾーンオフセットなし)。
		const today2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const startDate2 = new Date(today2);
		startDate2.setDate(today2.getDate() - 6); //! 6日前（過去7日間）。
		const endDate2 = new Date(today2);

		console.log("詳細検索の範囲:");
		console.log("  開始:", startDate2.toISOString());
		console.log("  終了:", endDate2.toISOString());

		//! 日数の差を計算(ローカル日付を使用するため、時刻を00:00:00にリセット)。
		const days1Start = new Date(startDate1);
		days1Start.setHours(0, 0, 0, 0);
		const days1End = new Date(endDate1);
		days1End.setHours(0, 0, 0, 0);
		const days1 = Math.round((days1End.getTime() - days1Start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

		const days2Start = new Date(startDate2);
		days2Start.setHours(0, 0, 0, 0);
		const days2End = new Date(endDate2);
		days2End.setHours(0, 0, 0, 0);
		const days2 = Math.round((days2End.getTime() - days2Start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

		console.log("一週間ボタンの日数:", days1);
		console.log("詳細検索の日数:", days2);

		//! 【修正後】一週間ボタンと詳細検索は両方とも7日分。
		expect(days1).toBe(7);
		expect(days2).toBe(7);
	});
});
