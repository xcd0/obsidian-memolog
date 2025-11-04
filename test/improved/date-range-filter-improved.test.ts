import { MemoEntry } from "../../src/types"
import {
	createTodayDateRange,
	createWeekDateRange,
	DateRange,
	getDaysAgo,
	getDaysLater,
	getEndOfDay,
	getStartOfDay,
	isInDateRange,
} from "../helpers/date-test-helpers"
import {
	createMemosAcrossDays,
	createMemosInDateRange,
	createTestMemo,
	createTestMemos,
} from "../helpers/memo-test-helpers"
import {
	DAYS_IN_WEEK,
	TEST_DATE_2024_02_29,
	TEST_DATE_2025_01_01,
	TEST_DATE_2025_10_31,
} from "../helpers/test-constants"

/**
 * 日付範囲フィルター - 改善版
 *
 * このテストは、TDD方針書に基づいて作成された改善版テストである。
 *
 * 改善点:
 * - AAA(Arrange-Act-Assert)パターンを明確に適用。
 * - 1つのテストで1つのことだけをテストする。
 * - マジックナンバーを定数化。
 * - ヘルパー関数を活用してテストデータ生成を共通化。
 * - テスト名を振る舞いベースに変更。
 * - コンソールログを削除。
 */

// ! メモをフィルタリングする関数(テスト対象のロジックを再現)。
function filterMemosByDateRange(memos: MemoEntry[], range: DateRange): MemoEntry[] {
	return memos.filter(memo => {
		const memoDate = new Date(memo.timestamp)
		return isInDateRange(memoDate, range)
	})
}

describe("日付範囲フィルター - 改善版", () => {
	describe("今日フィルター", () => {
		it("今日のメモのみを返す", () => {
			// Arrange: テストデータの準備。
			const today = TEST_DATE_2025_10_31
			const yesterday = getDaysAgo(today, 1)
			const tomorrow = getDaysLater(today, 1)
			const testMemos = [
				createTestMemo("memo-yesterday", yesterday, "昨日のメモ"),
				createTestMemo("memo-today", today, "今日のメモ"),
				createTestMemo("memo-tomorrow", tomorrow, "明日のメモ"),
			]
			const dateRange = createTodayDateRange(today)

			// Act: フィルタリング実行。
			const result = filterMemosByDateRange(testMemos, dateRange)

			// Assert: 今日のメモのみが含まれることを検証。
			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("memo-today")
		})

		it("同じ日の複数のメモを全て返す", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const testMemos = createTestMemos(5, today)
			const dateRange = createTodayDateRange(today)

			// Act
			const result = filterMemosByDateRange(testMemos, dateRange)

			// Assert
			expect(result).toHaveLength(5)
		})

		it("過去のメモは除外される", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const yesterday = getDaysAgo(today, 1)
			const testMemos = [
				createTestMemo("memo-yesterday", yesterday, "昨日"),
				createTestMemo("memo-today", today, "今日"),
			]
			const dateRange = createTodayDateRange(today)

			// Act
			const result = filterMemosByDateRange(testMemos, dateRange)

			// Assert
			const hasOldMemo = result.some(m => m.id === "memo-yesterday")
			expect(hasOldMemo).toBe(false)
		})

		it("未来のメモは除外される", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const tomorrow = getDaysLater(today, 1)
			const testMemos = [
				createTestMemo("memo-today", today, "今日"),
				createTestMemo("memo-tomorrow", tomorrow, "明日"),
			]
			const dateRange = createTodayDateRange(today)

			// Act
			const result = filterMemosByDateRange(testMemos, dateRange)

			// Assert
			const hasFutureMemo = result.some(m => m.id === "memo-tomorrow")
			expect(hasFutureMemo).toBe(false)
		})
	})

	describe("一週間フィルター", () => {
		it("過去7日間のメモを返す", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const sevenDaysAgo = getDaysAgo(today, DAYS_IN_WEEK - 1)
			const testMemos = createMemosInDateRange(sevenDaysAgo, today, 10)
			const dateRange = createWeekDateRange(today)

			// Act
			const result = filterMemosByDateRange(testMemos, dateRange)

			// Assert: 全てのメモが範囲内に含まれることを検証。
			expect(result).toHaveLength(10)
		})

		it("7日より古いメモは除外される", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const eightDaysAgo = getDaysAgo(today, 8)
			const sixDaysAgo = getDaysAgo(today, 6)
			const testMemos = [
				createTestMemo("memo-old", eightDaysAgo, "8日前"),
				createTestMemo("memo-recent", sixDaysAgo, "6日前"),
				createTestMemo("memo-today", today, "今日"),
			]
			const dateRange = createWeekDateRange(today)

			// Act
			const result = filterMemosByDateRange(testMemos, dateRange)

			// Assert
			expect(result).toHaveLength(2)
			const hasOldMemo = result.some(m => m.id === "memo-old")
			expect(hasOldMemo).toBe(false)
		})

		it("今日のメモも範囲に含まれる", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const testMemos = [createTestMemo("memo-today", today, "今日")]
			const dateRange = createWeekDateRange(today)

			// Act
			const result = filterMemosByDateRange(testMemos, dateRange)

			// Assert
			expect(result).toHaveLength(1)
			expect(result[0].id).toBe("memo-today")
		})
	})

	describe("境界値テスト - 時刻", () => {
		it("日付境界の開始時刻(00:00:00)のメモが含まれる", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const startOfDay = getStartOfDay(today)
			const testMemo = createTestMemo("memo-start", startOfDay, "開始時刻")
			const dateRange = createTodayDateRange(today)

			// Act
			const memoDate = new Date(testMemo.timestamp)
			const isInRange = isInDateRange(memoDate, dateRange)

			// Assert
			expect(isInRange).toBe(true)
		})

		it("日付境界の終了時刻(23:59:59)のメモが含まれる", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const endOfDay = getEndOfDay(today)
			const testMemo = createTestMemo("memo-end", endOfDay, "終了時刻")
			const dateRange = createTodayDateRange(today)

			// Act
			const memoDate = new Date(testMemo.timestamp)
			const isInRange = isInDateRange(memoDate, dateRange)

			// Assert
			expect(isInRange).toBe(true)
		})

		it("開始時刻の1ミリ秒前のメモは除外される", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const startOfDay = getStartOfDay(today)
			const oneMillisecondBefore = new Date(startOfDay.getTime() - 1)
			const testMemo = createTestMemo("memo-before", oneMillisecondBefore, "直前")
			const dateRange = createTodayDateRange(today)

			// Act
			const memoDate = new Date(testMemo.timestamp)
			const isInRange = isInDateRange(memoDate, dateRange)

			// Assert
			expect(isInRange).toBe(false)
		})

		it("終了時刻の1ミリ秒後のメモは除外される", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const endOfDay = getEndOfDay(today)
			const oneMillisecondAfter = new Date(endOfDay.getTime() + 1)
			const testMemo = createTestMemo("memo-after", oneMillisecondAfter, "直後")
			const dateRange = createTodayDateRange(today)

			// Act
			const memoDate = new Date(testMemo.timestamp)
			const isInRange = isInDateRange(memoDate, dateRange)

			// Assert
			expect(isInRange).toBe(false)
		})
	})

	describe("境界値テスト - 日付", () => {
		it("月をまたぐ一週間フィルターが正しく動作する", () => {
			// Arrange: 2025年11月30日から遡ると11月24日からの範囲になる。
			const today = new Date("2025-11-30T12:00:00.000Z")
			const dateRange = createWeekDateRange(today)

			// Act: 開始日の月と日を確認。
			const startMonth = dateRange.start.getMonth()
			const startDate = dateRange.start.getDate()

			// Assert: 11月24日から11月30日までの範囲であることを確認。
			expect(startMonth).toBe(10) // ! 11月 = 10(0-indexed)
			expect(startDate).toBe(24)
		})

		it("年をまたぐ一週間フィルターが正しく動作する", () => {
			// Arrange: 2025年1月3日から遡ると2024年にまたがる。
			const today = TEST_DATE_2025_01_01
			const dateRange = createWeekDateRange(today)

			// Act: 開始日を確認(検証のため変数に格納)。
			const startDate = dateRange.start

			// Assert: 2024年12月26日になることを確認。
			expect(startDate.getFullYear()).toBe(2024)
			expect(startDate.getMonth()).toBe(11) // ! 12月 = 11(0-indexed)
			expect(startDate.getDate()).toBe(26)
		})

		it("閏年の2月29日から一週間フィルターが正しく動作する", () => {
			// Arrange
			const today = TEST_DATE_2024_02_29
			const dateRange = createWeekDateRange(today)

			// Act: 開始日を確認。
			const expectedStartDate = 23 // ! 2024年2月23日。

			// Assert
			expect(dateRange.start.getMonth()).toBe(1) // ! 2月 = 1(0-indexed)
			expect(dateRange.start.getDate()).toBe(expectedStartDate)
		})
	})

	describe("空データのテスト", () => {
		it("空配列をフィルタリングすると空配列を返す", () => {
			// Arrange
			const emptyMemos: MemoEntry[] = []
			const dateRange = createTodayDateRange(TEST_DATE_2025_10_31)

			// Act
			const result = filterMemosByDateRange(emptyMemos, dateRange)

			// Assert
			expect(result).toEqual([])
		})
	})

	describe("大量データのテスト", () => {
		it("大量のメモから正しくフィルタリングできる", () => {
			// Arrange: 30日分のメモ(各日10件)を作成。
			const today = TEST_DATE_2025_10_31
			const thirtyDaysAgo = getDaysAgo(today, 30)
			const dates = Array.from({ length: 31 }, (_, i) => getDaysLater(thirtyDaysAgo, i))
			const testMemos = createMemosAcrossDays(dates, 10)
			const dateRange = createWeekDateRange(today)

			// Act
			const result = filterMemosByDateRange(testMemos, dateRange)

			// Assert: 過去7日分(70件)のみが含まれることを確認。
			const expectedCount = DAYS_IN_WEEK * 10
			expect(result).toHaveLength(expectedCount)
		})
	})
})
