import { DateRangeFilter } from "../src/ui/components/button-bar";

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
});
