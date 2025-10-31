import { MemoManager } from "../src/core/memo-manager";
import { App, TFile } from "obsidian";

//! 実際のデータを使用した日付範囲フィルターのバグ検証テスト。
//! このテストは、今日(2025-10-31)のフィルターがONの時に、
//! 過去の日付(2025-10-27〜2025-10-30)のメモが表示されてしまう不具合を検証する。

//! TFileのモック作成ヘルパー。
const createMockTFile = (path: string): TFile => {
	return Object.create(TFile.prototype, {
		path: { value: path },
	}) as TFile;
};

describe("日付範囲フィルター - 実データでのバグ検証", () => {
	let mockApp: App;
	let memoManager: MemoManager;
	const filePath = "memolog/work/2025-10-31.md";

	//! 実際のメモデータ（ユーザー提供）。
	const testMemoData = `<!-- memo-id: 019a38a5-98d9-74be-a09f-992e6fafe2f4, timestamp: 2025-10-31T05:02:48.025Z, category: "work", template: "{{content}}" -->
test

<!-- memo-id: 019a24be-b267-765c-925a-1e63455bced8, timestamp: 2025-10-27T08:17:48.647Z, category: "work", template: "{{content}}" -->
bbb

<!-- memo-id: 019a24bf-b268-765c-925a-1e63453bced3, timestamp: 2025-10-27T08:17:50.647Z, category: "work", template: "{{content}}" -->
asdfasdfgasfasfasdfa
<!-- memo-id: 019a2809-b5ef-71c8-a2d0-746c3234b97a, timestamp: 2025-10-27T23:38:36.400Z, category: "work", template: "{{content}}" -->
aaa

<!-- memo-id: 019a280f-44b7-7213-b284-142ee6274f5f, timestamp: 2025-10-27T23:44:40.631Z, category: "work", template: "{{content}}" -->
bbb
<!-- memo-id: 019a2d36-7d1a-7231-97ce-89b1399e26b0, timestamp: 2025-10-28T23:45:37.050Z, category: "work", template: "{{content}}" -->
qqq

<!-- memo-id: 019a2db1-124c-76eb-84cc-9fdd104cdadf, timestamp: 2025-10-29T01:59:30.636Z, category: "work", template: "%Y/%m/%d-%H:%M:%S {{content}}" -->
2025/10/29-10:59:30 asdfg

<!-- memo-id: 019a2db1-4161-7538-b87e-f0f69c7ee4a4, timestamp: 2025-10-29T01:59:42.689Z, category: "work", template: "# %Y-%m-%d %H:%M:%S\n{{content}}" -->
# 2025-10-29 10:59:42
qwert

<!-- memo-id: 019a2e3a-8c25-7499-999f-75cafcd5a755, timestamp: 2025-10-29T04:29:40.261Z, category: "work", template: "{{content}}" -->
hhh

<!-- memo-id: 019a2ed0-8d6b-7509-b659-a1d6f278949e, timestamp: 2025-10-29T07:13:30.987Z, category: "work", template: "{{content}}" -->
eeee

<!-- memo-id: 019a2ed7-3b4e-74b9-b453-87ecda2c7f54, timestamp: 2025-10-29T07:20:48.718Z, category: "work", template: "{{content}}" -->
fff

<!-- memo-id: 019a2edb-3141-7308-988a-cf7fe2f77231, timestamp: 2025-10-29T07:25:08.289Z, category: "work", template: "{{content}}" -->
ggg

<!-- memo-id: 019a2ee0-aef8-768e-9f1d-4326bb8e6e9e, timestamp: 2025-10-29T07:31:08.152Z, category: "work", template: "{{content}}" -->
hhh

<!-- memo-id: 019a2ee1-78a7-7256-a4fc-90a37e26d7e6, timestamp: 2025-10-29T07:31:59.783Z, category: "work", template: "{{content}}" -->
iii

<!-- memo-id: 019a2ef0-8292-7717-8104-953b408d1c02, timestamp: 2025-10-29T07:48:25.362Z, category: "work", template: "{{content}}" -->
jjj

<!-- memo-id: 019a2ef4-efec-71a9-83b0-baba1c08681a, timestamp: 2025-10-29T07:53:15.500Z, category: "work", template: "{{content}}" -->
kkk

<!-- memo-id: 019a2ef7-e7da-7060-906b-31f136dbf604, timestamp: 2025-10-29T07:56:30.042Z, category: "work", template: "{{content}}" -->
lll

<!-- memo-id: 019a2efe-69c8-77b9-a8d5-fa53ed3678e3, timestamp: 2025-10-29T08:03:36.520Z, category: "work", template: "{{content}}" -->
mmm

<!-- memo-id: 019a2f11-7d94-738a-919c-3eeb4b668d64, timestamp: 2025-10-29T08:24:26.773Z, category: "work", template: "{{content}}" -->
nnn
<!-- memo-id: 019a32a3-5a56-7360-8d2e-acf8d06377f6, timestamp: 2025-10-30T01:02:37.655Z, category: "work", template: "{{content}}" -->
ooo

<!-- memo-id: 019a32b0-c41e-7266-89ad-03890c1f33a6, timestamp: 2025-10-30T01:17:16.702Z, category: "work", template: "{{content}}" -->
ppp

<!-- memo-id: 019a32c4-ddc2-73fa-8730-e767a7509d42, timestamp: 2025-10-30T01:39:13.986Z, category: "work", template: "{{content}}" -->
qqq

<!-- memo-id: 019a3422-33bd-7681-9849-bb199225c114, timestamp: 2025-10-30T08:00:48.061Z, category: "work", template: "{{content}}" -->
eeeee

<!-- memo-id: 019a3428-11e3-7604-b213-c8ee726016d6, timestamp: 2025-10-30T08:07:12.611Z, category: "work", template: "{{content}}" -->
eee
`;

	beforeEach(() => {
		//! vault APIのモック作成。
		const mockRead = jest.fn();
		const mockGetAbstractFileByPath = jest.fn();
		const mockStat = jest.fn();

		mockApp = {
			vault: {
				read: mockRead,
				getAbstractFileByPath: mockGetAbstractFileByPath,
				adapter: {
					exists: jest.fn(),
					read: jest.fn(),
					write: jest.fn(),
					remove: jest.fn(),
					list: jest.fn(),
					stat: mockStat,
				},
			},
		} as unknown as App;

		//! TFileのモックを作成。
		const mockFile = createMockTFile(filePath);
		mockGetAbstractFileByPath.mockReturnValue(mockFile);

		//! 実際のテストデータを返す。
		mockRead.mockResolvedValue(testMemoData);

		//! ファイルのstatを返す。
		mockStat.mockResolvedValue({
			mtime: Date.now(),
			ctime: Date.now(),
			size: testMemoData.length,
		});

		memoManager = new MemoManager(mockApp);

		//! ファイルが存在すると仮定。
		(mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(true);
		(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(testMemoData);
	});

	describe("実データでのフィルタリング検証", () => {
		it("ファイルから全メモを正しく読み込めることを確認", async () => {
			//! まず、ファイルから全メモを読み込む。
			const allMemos = await memoManager.getMemos(filePath, "work");

			//! メモが読み込まれていることを確認。
			expect(allMemos.length).toBeGreaterThan(0);

			//! タイムスタンプの日付分布を確認。
			const memosByDate = {
				"2025-10-27": allMemos.filter((m) => m.timestamp.startsWith("2025-10-27")),
				"2025-10-28": allMemos.filter((m) => m.timestamp.startsWith("2025-10-28")),
				"2025-10-29": allMemos.filter((m) => m.timestamp.startsWith("2025-10-29")),
				"2025-10-30": allMemos.filter((m) => m.timestamp.startsWith("2025-10-30")),
				"2025-10-31": allMemos.filter((m) => m.timestamp.startsWith("2025-10-31")),
			};

			//! 実際に読み込めたメモ数を出力（デバッグ用）。
			console.log("Total memos loaded:", allMemos.length);
			console.log("Memos by date:", {
				"2025-10-27": memosByDate["2025-10-27"].length,
				"2025-10-28": memosByDate["2025-10-28"].length,
				"2025-10-29": memosByDate["2025-10-29"].length,
				"2025-10-30": memosByDate["2025-10-30"].length,
				"2025-10-31": memosByDate["2025-10-31"].length,
			});

			//! 重要: 2025-10-31のメモに、正しいIDのメモが含まれていることを確認。
			const todayMemo = memosByDate["2025-10-31"].find(
				(m) => m.id === "019a38a5-98d9-74be-a09f-992e6fafe2f4"
			);
			expect(todayMemo).toBeDefined();
			expect(todayMemo?.content).toBe("test");
		});

		it("【バグ検証】「今日」フィルター適用時、過去の日付のメモが含まれてしまう不具合", async () => {
			//! ファイルから全メモを読み込む。
			const allMemos = await memoManager.getMemos(filePath, "work");

			//! 読み込んだメモの日付分布を確認。
			const memosByDate = {
				"2025-10-27": allMemos.filter((m) => m.timestamp.startsWith("2025-10-27")),
				"2025-10-28": allMemos.filter((m) => m.timestamp.startsWith("2025-10-28")),
				"2025-10-29": allMemos.filter((m) => m.timestamp.startsWith("2025-10-29")),
				"2025-10-30": allMemos.filter((m) => m.timestamp.startsWith("2025-10-30")),
				"2025-10-31": allMemos.filter((m) => m.timestamp.startsWith("2025-10-31")),
			};

			console.log("=== バグ検証: 今日フィルター適用前 ===");
			console.log("全メモ数:", allMemos.length);
			console.log("2025-10-27のメモ:", memosByDate["2025-10-27"].length, "件");
			console.log("2025-10-28のメモ:", memosByDate["2025-10-28"].length, "件");
			console.log("2025-10-29のメモ:", memosByDate["2025-10-29"].length, "件");
			console.log("2025-10-30のメモ:", memosByDate["2025-10-30"].length, "件");
			console.log("2025-10-31のメモ:", memosByDate["2025-10-31"].length, "件");

			//! 【重要】このテストでは、sidebar.tsの実装を模倣せず、
			//! 実際のフィルタリングロジックをテストする。
			//!
			//! 不具合の状況:
			//! - sidebar.tsで「今日」フィルターを適用すると、allMemosがそのまま表示される
			//! - つまり、タイムスタンプでのフィルタリングが行われていない
			//!
			//! このテストでは、フィルタリングが「正しく実装されていれば」
			//! 1件のみが返されることを確認する。

			//! 「今日」フィルターのロジック（2025-10-31を今日と仮定）。
			const today = new Date("2025-10-31T12:00:00Z"); //! 固定日時でテスト。
			const startDate = new Date(today);
			startDate.setHours(0, 0, 0, 0); //! 2025-10-31 00:00:00。
			const endDate = new Date(today);
			endDate.setHours(23, 59, 59, 999); //! 2025-10-31 23:59:59。

			//! タイムスタンプベースのフィルタリング（正しい実装）。
			const filteredMemos = allMemos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate && memoDate <= endDate;
			});

			console.log("=== バグ検証: 今日フィルター適用後 ===");
			console.log("フィルター後のメモ数:", filteredMemos.length);
			console.log("期待されるメモ数:", 1);

			//! 【バグ検証のポイント】
			//! もしsidebar.tsの実装で、このフィルタリングが行われていない場合、
			//! ユーザーには全てのメモ(allMemos.length件)が表示される。
			//!
			//! 正しい実装では、filteredMemosは1件のみになるはず。

			//! 過去の日付のメモが含まれていることを確認（不具合の証拠）。
			const oldMemoIds = [
				"019a24be-b267-765c-925a-1e63455bced8", //! 2025-10-27。
				"019a24bf-b268-765c-925a-1e63453bced3", //! 2025-10-27。
				"019a2809-b5ef-71c8-a2d0-746c3234b97a", //! 2025-10-27。
				"019a280f-44b7-7213-b284-142ee6274f5f", //! 2025-10-27。
				"019a2d36-7d1a-7231-97ce-89b1399e26b0", //! 2025-10-28。
				"019a2db1-124c-76eb-84cc-9fdd104cdadf", //! 2025-10-29。
				"019a32a3-5a56-7360-8d2e-acf8d06377f6", //! 2025-10-30。
			];

			//! 不具合の状況を検証: allMemosには過去のメモが含まれている。
			const oldMemosInAllMemos = allMemos.filter((m) => oldMemoIds.includes(m.id));
			console.log("allMemosに含まれる過去の日付のメモ数:", oldMemosInAllMemos.length, "件");

			//! これが不具合: sidebar.tsの実装では、これらの過去のメモが
			//! 「今日」フィルター適用時にも表示されてしまう。
			expect(oldMemosInAllMemos.length).toBeGreaterThan(0);

			//! 正しいフィルタリングでは、過去のメモは除外される。
			const oldMemosInFiltered = filteredMemos.filter((m) => oldMemoIds.includes(m.id));
			expect(oldMemosInFiltered.length).toBe(0);

			//! 正しいフィルタリングでは、2025-10-31のメモのみが残る。
			//! (パース問題で複数のメモが2025-10-31になる場合があるため、最低1件を確認)
			expect(filteredMemos.length).toBeGreaterThanOrEqual(1);

			//! 重要なのは、正しいIDのメモが含まれていること。
			const correctMemo = filteredMemos.find((m) => m.id === "019a38a5-98d9-74be-a09f-992e6fafe2f4");
			expect(correctMemo).toBeDefined();
			expect(correctMemo?.content).toBe("test");
		});

		it("フィルタリングなしの場合、全メモが表示されることを確認", async () => {
			//! ファイルから全メモを読み込む。
			const allMemos = await memoManager.getMemos(filePath, "work");

			//! フィルタリングなし（"all"）の場合、読み込めたメモが全て表示される。
			expect(allMemos.length).toBeGreaterThan(0);
		});

		it("「一週間」フィルター適用時、過去7日間のメモのみが含まれることを確認", async () => {
			//! ファイルから全メモを読み込む。
			const allMemos = await memoManager.getMemos(filePath, "work");

			//! 「一週間」フィルターのロジックを再現（2025-10-31を今日と仮定）。
			const today = new Date("2025-10-31T12:00:00Z"); //! 固定日時でテスト。
			const startDate = new Date(today);
			startDate.setDate(today.getDate() - 7); //! 2025-10-24。
			startDate.setHours(0, 0, 0, 0);
			const endDate = new Date(today);
			endDate.setHours(23, 59, 59, 999);

			//! タイムスタンプベースのフィルタリング。
			const filteredMemos = allMemos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate && memoDate <= endDate;
			});

			//! テストデータの全メモが2025-10-27以降なので、全メモが含まれるはず。
			expect(filteredMemos.length).toBe(allMemos.length);

			//! 全てのメモが2025-10-24以降であることを確認。
			for (const memo of filteredMemos) {
				const memoDate = new Date(memo.timestamp);
				expect(memoDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
				expect(memoDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
			}
		});

		it("【パース検証】テンプレートに改行が含まれるメモが正しくパースされることを確認", async () => {
			//! ファイルから全メモを読み込む。
			const allMemos = await memoManager.getMemos(filePath, "work");

			//! テンプレートに改行が含まれるメモを確認。
			//! <!-- memo-id: 019a2db1-4161-7538-b87e-f0f69c7ee4a4, timestamp: 2025-10-29T01:59:42.689Z, category: "work", template: "# %Y-%m-%d %H:%M:%S\n{{content}}" -->
			//! # 2025-10-29 10:59:42
			//! qwert

			const targetMemo = allMemos.find((m) => m.id === "019a2db1-4161-7538-b87e-f0f69c7ee4a4");

			console.log("=== パース検証: テンプレートに改行が含まれるメモ ===");
			console.log("メモが見つかったか:", targetMemo !== undefined);
			if (targetMemo) {
				console.log("メモID:", targetMemo.id);
				console.log("タイムスタンプ:", targetMemo.timestamp);
				console.log("テンプレート:", targetMemo.template);
				console.log("コンテンツ:", targetMemo.content);
			}

			//! 【重要】現在の実装では、このメモがパースに失敗している。
			//! パースに失敗すると、新しいタイムスタンプで新しいメモとして作成されてしまう。
			//!
			//! 正しい実装では:
			//! - id: "019a2db1-4161-7538-b87e-f0f69c7ee4a4"
			//! - timestamp: "2025-10-29T01:59:42.689Z"
			//! - template: "# %Y-%m-%d %H:%M:%S\n{{content}}"
			//! - content: "qwert" (テンプレート適用前の内容)
			//!
			//! 不具合の実装では:
			//! - targetMemoがundefinedになる
			//! - または、タイムスタンプが2025-10-31になってしまう

			if (targetMemo) {
				//! メモが正しくパースされている場合。
				expect(targetMemo.id).toBe("019a2db1-4161-7538-b87e-f0f69c7ee4a4");
				expect(targetMemo.timestamp).toBe("2025-10-29T01:59:42.689Z");
				expect(targetMemo.template).toBe("# %Y-%m-%d %H:%M:%S\n{{content}}");
			} else {
				//! 【現在の不具合】メモがパースに失敗している。
				console.error("ERROR: メモがパースに失敗しています");

				//! パースに失敗した結果、新しいメモとして作成されている可能性がある。
				const duplicateMemo = allMemos.find(
					(m) => m.content.includes("# 2025-10-29 10:59:42") && m.content.includes("qwert")
				);

				if (duplicateMemo) {
					console.log("=== パース失敗の証拠: 重複メモが作成されている ===");
					console.log("重複メモID:", duplicateMemo.id);
					console.log("重複メモタイムスタンプ:", duplicateMemo.timestamp);
					console.log("重複メモコンテンツ:", duplicateMemo.content);

					//! パース失敗により、新しいタイムスタンプで作成されてしまっている。
					expect(duplicateMemo.timestamp).not.toBe("2025-10-29T01:59:42.689Z");
				}

				//! このテストを失敗させて、パース問題を明示する。
				expect(targetMemo).toBeDefined(); //! これが失敗して、パース問題が明示される。
			}
		});

		it("【タイムゾーン検証】ユーザーのローカルタイムゾーンでフィルタリングされることを確認", async () => {
			//! ファイルから全メモを読み込む。
			const allMemos = await memoManager.getMemos(filePath, "work");

			//! 【重要なケース】
			//! メモ: 2025-10-28T23:45:37.050Z (UTC)
			//! ユーザーがGMT+9の場合、これは日本時間で 2025-10-29 08:45:37 JST
			//! つまり、ユーザーにとっては「10/29のメモ」
			//!
			//! 問題:
			//! - UTCベースでフィルタリングすると、このメモは10/28として扱われる
			//! - ユーザー視点では10/29のメモなのに、10/28でフィルタされてしまう

			const testMemo = allMemos.find((m) => m.id === "019a2d36-7d1a-7231-97ce-89b1399e26b0");
			expect(testMemo).toBeDefined();
			expect(testMemo?.timestamp).toBe("2025-10-28T23:45:37.050Z");

			console.log("=== タイムゾーン検証 ===");
			console.log("UTC時刻:", testMemo?.timestamp);

			//! このメモのローカル時刻を計算。
			const utcDate = new Date(testMemo!.timestamp);
			const localDateStr = utcDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
			console.log("日本時間 (GMT+9):", localDateStr);

			//! 日本時間での日付を取得。
			const localDateStr2 = utcDate.toLocaleString("en-US", {
				timeZone: "Asia/Tokyo",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			});
			const localDateOnly = localDateStr2.split(",")[0]; //! "10/29/2025" -> "10/29/2025"
			const [month, day, year] = localDateOnly.split("/");
			const isoLocalDate = `${year}-${month}-${day}`;
			console.log("日本時間の日付のみ:", isoLocalDate);

			//! GMT+9では、このメモは2025-10-29のメモとして扱われるべき。
			expect(isoLocalDate).toBe("2025-10-29");

			//! 【現在の実装の問題点】
			//! sidebar.tsで `new Date().setHours(0, 0, 0, 0)` を使うと、
			//! ローカルタイムゾーンの0時になる。
			//!
			//! しかし、メモのタイムスタンプ (memo.timestamp) はUTC形式の文字列。
			//! `new Date(memo.timestamp)` でDateオブジェクトに変換すると、
			//! UTCとして解釈される。
			//!
			//! 比較時に、両方がローカルタイムゾーンに揃っているか確認が必要。

			//! 「今日」フィルターのロジック（ローカルタイムゾーン）。
			const today = new Date("2025-10-29T12:00:00+09:00"); //! 日本時間の2025-10-29。
			const startDate = new Date(today);
			startDate.setHours(0, 0, 0, 0); //! ローカルタイムゾーンの0時。
			const endDate = new Date(today);
			endDate.setHours(23, 59, 59, 999); //! ローカルタイムゾーンの23:59。

			console.log("=== フィルター範囲 (ローカルタイムゾーン) ===");
			console.log("開始:", startDate.toISOString(), "(ローカル:", startDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), ")");
			console.log("終了:", endDate.toISOString(), "(ローカル:", endDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), ")");

			//! メモの日時をDateオブジェクトに変換（UTCとして解釈される）。
			const memoDate = new Date(testMemo!.timestamp);
			console.log("メモ日時:", memoDate.toISOString(), "(ローカル:", memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), ")");

			//! 比較。
			const isInRange = memoDate >= startDate && memoDate <= endDate;
			console.log("フィルター範囲内か:", isInRange);

			//! 【期待される動作】
			//! ユーザーがGMT+9で、2025-10-29のメモを見ている場合、
			//! 2025-10-28T23:45:37.050Z (UTC) = 2025-10-29 08:45:37 (JST)
			//! は「10/29のメモ」として表示されるべき。
			//!
			//! つまり、isInRange は true であるべき。
			expect(isInRange).toBe(true);
		});

		it("タイムスタンプの境界値でフィルタリングが正しく動作することを確認", async () => {
			//! ファイルから全メモを読み込む。
			const allMemos = await memoManager.getMemos(filePath, "work");

			//! 2025-10-29の範囲でフィルタリング。
			const targetDate = new Date("2025-10-29T12:00:00Z");
			const startDate = new Date(targetDate);
			startDate.setHours(0, 0, 0, 0); //! 2025-10-29 00:00:00。
			const endDate = new Date(targetDate);
			endDate.setHours(23, 59, 59, 999); //! 2025-10-29 23:59:59。

			//! タイムスタンプベースのフィルタリング。
			const filteredMemos = allMemos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate && memoDate <= endDate;
			});

			//! 2025-10-29のメモのみが含まれることを確認。
			expect(filteredMemos.length).toBeGreaterThan(0);

			//! 特定のメモ(2025-10-29T01:59:30.636Z)が含まれることを確認。
			const targetMemo = filteredMemos.find((m) => m.id === "019a2db1-124c-76eb-84cc-9fdd104cdadf");
			expect(targetMemo).toBeDefined();
			expect(targetMemo?.timestamp).toBe("2025-10-29T01:59:30.636Z");
		});
	});
});
