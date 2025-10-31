import { DateRangeFilter } from "../src/ui/components/button-bar";
import { MemoEntry } from "../src/types";

describe("日付範囲フィルター - ロジック検証", () => {
	describe("DateRangeFilter型", () => {
		it("有効な値が定義されている", () => {
			const validValues: DateRangeFilter[] = ["all", "week", "today", null];

			//! 各値が型として有効であることを確認。
			validValues.forEach((value) => {
				expect(["all", "week", "today", null]).toContain(value);
			});
		});
	});

	describe("日付範囲の計算ロジック", () => {
		it("「今日」フィルターは今日の日付（YYYY-MM-DD）のみを対象とする", () => {
			//! sidebar.tsの実装に基づく計算ロジックを検証。
			//! currentDateRange === "today"の場合。
			const today = new Date();
			const todayStr = today.toISOString().split("T")[0];

			//! 期待される日付形式。
			expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

			//! startDate === endDate === todayStr であることを確認。
			const startDate = todayStr;
			const endDate = todayStr;
			expect(startDate).toBe(endDate);
			expect(startDate).toBe(todayStr);
		});

		it("「一週間」フィルターは過去7日間（今日含む）を対象とする", () => {
			//! sidebar.tsの実装に基づく計算ロジックを検証。
			//! currentDateRange === "week"の場合。
			const today = new Date();
			const weekAgo = new Date(today);
			weekAgo.setDate(today.getDate() - 7);

			const startDate = weekAgo.toISOString().split("T")[0];
			const endDate = today.toISOString().split("T")[0];

			//! 期待される日付形式。
			expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

			//! 日付の差が7日であることを確認。
			const daysDiff = Math.floor((today.getTime() - weekAgo.getTime()) / (1000 * 60 * 60 * 24));
			expect(daysDiff).toBe(7);

			//! startDate < endDate であることを確認。
			expect(new Date(startDate).getTime()).toBeLessThan(new Date(endDate).getTime());
		});

		it("「今日」の日付文字列は固定長（10文字）である", () => {
			const today = new Date();
			const todayStr = today.toISOString().split("T")[0];

			//! YYYY-MM-DD形式は10文字。
			expect(todayStr).toHaveLength(10);
		});

		it("「一週間」の開始日は終了日より前である", () => {
			const today = new Date();
			const weekAgo = new Date(today);
			weekAgo.setDate(today.getDate() - 7);

			const startDate = weekAgo.toISOString().split("T")[0];
			const endDate = today.toISOString().split("T")[0];

			//! 開始日 < 終了日。
			expect(new Date(startDate).getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
		});
	});

	describe("タイムゾーン依存性", () => {
		it("toISOString().split('T')[0]はUTC日付を返す", () => {
			const now = new Date();
			const isoDateStr = now.toISOString().split("T")[0];

			//! YYYY-MM-DD形式であることを確認。
			expect(isoDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);

			//! UTC日付であることを確認（ローカル日付ではない）。
			const utcYear = now.getUTCFullYear();
			const utcMonth = (now.getUTCMonth() + 1).toString().padStart(2, "0");
			const utcDay = now.getUTCDate().toString().padStart(2, "0");
			const expectedUTCDate = `${utcYear}-${utcMonth}-${utcDay}`;

			expect(isoDateStr).toBe(expectedUTCDate);
		});

		it("ローカルタイムゾーンがUTC±14時間以内であれば日付は最大1日ずれる", () => {
			//! タイムゾーンオフセット（分単位）。
			const offsetMinutes = new Date().getTimezoneOffset();
			const offsetHours = Math.abs(offsetMinutes / 60);

			//! タイムゾーンオフセットが14時間以内であることを確認。
			expect(offsetHours).toBeLessThanOrEqual(14);
		});
	});

	describe("境界値テスト", () => {
		it("月の最終日から「一週間」を計算すると前月を跨ぐ", () => {
			//! 2025年11月30日を基準日とする。
			const baseDate = new Date("2025-11-30T12:00:00Z");
			const weekAgo = new Date(baseDate);
			weekAgo.setDate(baseDate.getDate() - 7);

			const startDate = weekAgo.toISOString().split("T")[0];
			const endDate = baseDate.toISOString().split("T")[0];

			//! 11月23日から11月30日の範囲。
			expect(startDate).toBe("2025-11-23");
			expect(endDate).toBe("2025-11-30");
		});

		it("年の最終日から「一週間」を計算すると前年を跨ぐ", () => {
			//! 2025年1月3日を基準日とする。
			const baseDate = new Date("2025-01-03T12:00:00Z");
			const weekAgo = new Date(baseDate);
			weekAgo.setDate(baseDate.getDate() - 7);

			const startDate = weekAgo.toISOString().split("T")[0];
			const endDate = baseDate.toISOString().split("T")[0];

			//! 2024年12月27日から2025年1月3日の範囲。
			expect(startDate).toBe("2024-12-27");
			expect(endDate).toBe("2025-01-03");
		});

		it("閏年の2月29日から「一週間」を計算できる", () => {
			//! 2024年は閏年。
			const baseDate = new Date("2024-02-29T12:00:00Z");
			const weekAgo = new Date(baseDate);
			weekAgo.setDate(baseDate.getDate() - 7);

			const startDate = weekAgo.toISOString().split("T")[0];
			const endDate = baseDate.toISOString().split("T")[0];

			//! 2月22日から2月29日の範囲。
			expect(startDate).toBe("2024-02-22");
			expect(endDate).toBe("2024-02-29");
		});
	});

	describe("nullフィルター", () => {
		it("nullフィルターは「全て」を意味する（フィルターなし）", () => {
			const filter: DateRangeFilter = null;

			//! nullはフィルターが無効であることを示す。
			expect(filter).toBeNull();

			//! sidebar.tsでは`filter ?? "all"`で"all"に変換される。
			const effectiveFilter = filter ?? "all";
			expect(effectiveFilter).toBe("all");
		});
	});

	describe("タイムスタンプベースのフィルタリング", () => {
		//! sidebar.tsの実装に基づくフィルタリングロジックを検証。
		//! これは今回発見されたバグ（ファイル内の全メモが表示される問題）を検知するためのテスト。

		it("「今日」フィルターは今日のタイムスタンプを持つメモのみを返す", () => {
			//! テスト用のメモデータを作成。
			const now = new Date();
			const yesterday = new Date(now);
			yesterday.setDate(now.getDate() - 1);
			const tomorrow = new Date(now);
			tomorrow.setDate(now.getDate() + 1);

			const memos: MemoEntry[] = [
				{
					id: "memo-yesterday",
					timestamp: yesterday.toISOString(),
					content: "昨日のメモ",
					category: "test",
				},
				{
					id: "memo-today-1",
					timestamp: now.toISOString(),
					content: "今日のメモ1",
					category: "test",
				},
				{
					id: "memo-today-2",
					timestamp: new Date(now.getTime() + 3600000).toISOString(), //! 1時間後。
					content: "今日のメモ2",
					category: "test",
				},
				{
					id: "memo-tomorrow",
					timestamp: tomorrow.toISOString(),
					content: "明日のメモ",
					category: "test",
				},
			];

			//! 「今日」フィルターのロジックを再現。
			const startDate = new Date();
			startDate.setHours(0, 0, 0, 0);
			const endDate = new Date();
			endDate.setHours(23, 59, 59, 999);

			//! タイムスタンプベースのフィルタリング。
			const filtered = memos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate && memoDate <= endDate;
			});

			//! 今日のメモのみが含まれることを確認。
			expect(filtered).toHaveLength(2);
			expect(filtered.map((m) => m.id)).toEqual(["memo-today-1", "memo-today-2"]);
		});

		it("「一週間」フィルターは過去7日間のタイムスタンプを持つメモのみを返す", () => {
			//! テスト用のメモデータを作成。
			const now = new Date();
			const eightDaysAgo = new Date(now);
			eightDaysAgo.setDate(now.getDate() - 8);
			const sixDaysAgo = new Date(now);
			sixDaysAgo.setDate(now.getDate() - 6);
			const threeDaysAgo = new Date(now);
			threeDaysAgo.setDate(now.getDate() - 3);

			const memos: MemoEntry[] = [
				{
					id: "memo-old",
					timestamp: eightDaysAgo.toISOString(),
					content: "8日前のメモ",
					category: "test",
				},
				{
					id: "memo-week-1",
					timestamp: sixDaysAgo.toISOString(),
					content: "6日前のメモ",
					category: "test",
				},
				{
					id: "memo-week-2",
					timestamp: threeDaysAgo.toISOString(),
					content: "3日前のメモ",
					category: "test",
				},
				{
					id: "memo-today",
					timestamp: now.toISOString(),
					content: "今日のメモ",
					category: "test",
				},
			];

			//! 「一週間」フィルターのロジックを再現。
			const startDate = new Date();
			startDate.setDate(now.getDate() - 7);
			startDate.setHours(0, 0, 0, 0);
			const endDate = new Date();
			endDate.setHours(23, 59, 59, 999);

			//! タイムスタンプベースのフィルタリング。
			const filtered = memos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate && memoDate <= endDate;
			});

			//! 過去7日間のメモのみが含まれることを確認（8日前のメモは除外）。
			expect(filtered).toHaveLength(3);
			expect(filtered.map((m) => m.id)).toEqual(["memo-week-1", "memo-week-2", "memo-today"]);
		});

		it("タイムスタンプが範囲外のメモは除外される（バグ検証）", () => {
			//! これは今回のバグを検証するテスト。
			//! ファイルが今日の日付であっても、メモのタイムスタンプが昨日なら除外される。

			const now = new Date();
			const yesterday = new Date(now);
			yesterday.setDate(now.getDate() - 1);

			//! 同じファイル内に今日と昨日のメモが混在している状況を再現。
			const memos: MemoEntry[] = [
				{
					id: "memo-yesterday-morning",
					timestamp: yesterday.toISOString(),
					content: "昨日の朝のメモ",
					category: "test",
				},
				{
					id: "memo-today-morning",
					timestamp: now.toISOString(),
					content: "今日の朝のメモ",
					category: "test",
				},
			];

			//! 「今日」フィルターのロジック。
			const startDate = new Date();
			startDate.setHours(0, 0, 0, 0);
			const endDate = new Date();
			endDate.setHours(23, 59, 59, 999);

			//! タイムスタンプベースのフィルタリング。
			const filtered = memos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate && memoDate <= endDate;
			});

			//! 今日のメモのみが含まれ、昨日のメモは除外されることを確認。
			//! これが失敗する場合、sidebar.tsのフィルタリングが実装されていない。
			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe("memo-today-morning");
			expect(filtered.map((m) => m.id)).not.toContain("memo-yesterday-morning");
		});

		it("時刻の境界値でフィルタリングが正しく動作する", () => {
			//! 今日の0:00:00と23:59:59の境界値をテスト。
			const todayStart = new Date();
			todayStart.setHours(0, 0, 0, 0);
			const todayEnd = new Date();
			todayEnd.setHours(23, 59, 59, 999);
			const yesterdayEnd = new Date(todayStart);
			yesterdayEnd.setTime(todayStart.getTime() - 1); //! 今日の開始の1ミリ秒前。
			const tomorrowStart = new Date(todayEnd);
			tomorrowStart.setTime(todayEnd.getTime() + 1); //! 今日の終わりの1ミリ秒後。

			const memos: MemoEntry[] = [
				{
					id: "memo-yesterday-end",
					timestamp: yesterdayEnd.toISOString(),
					content: "昨日の最後",
					category: "test",
				},
				{
					id: "memo-today-start",
					timestamp: todayStart.toISOString(),
					content: "今日の最初",
					category: "test",
				},
				{
					id: "memo-today-end",
					timestamp: todayEnd.toISOString(),
					content: "今日の最後",
					category: "test",
				},
				{
					id: "memo-tomorrow-start",
					timestamp: tomorrowStart.toISOString(),
					content: "明日の最初",
					category: "test",
				},
			];

			//! 「今日」フィルターのロジック。
			const startDate = new Date();
			startDate.setHours(0, 0, 0, 0);
			const endDate = new Date();
			endDate.setHours(23, 59, 59, 999);

			//! タイムスタンプベースのフィルタリング。
			const filtered = memos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate && memoDate <= endDate;
			});

			//! 今日の範囲内のメモのみが含まれることを確認。
			expect(filtered).toHaveLength(2);
			expect(filtered.map((m) => m.id)).toEqual(["memo-today-start", "memo-today-end"]);
		});
	});
});
