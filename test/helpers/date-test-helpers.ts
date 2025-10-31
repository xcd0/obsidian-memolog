import { MILLISECONDS_PER_DAY, MILLISECONDS_PER_HOUR } from "./test-constants";

//! 日付の開始時刻を取得(00:00:00.000)。
export function getStartOfDay(date: Date): Date {
	const result = new Date(date);
	result.setHours(0, 0, 0, 0);
	return result;
}

//! 日付の終了時刻を取得(23:59:59.999)。
export function getEndOfDay(date: Date): Date {
	const result = new Date(date);
	result.setHours(23, 59, 59, 999);
	return result;
}

//! N日前の日付を取得。
export function getDaysAgo(baseDate: Date, days: number): Date {
	return new Date(baseDate.getTime() - days * MILLISECONDS_PER_DAY);
}

//! N日後の日付を取得。
export function getDaysLater(baseDate: Date, days: number): Date {
	return new Date(baseDate.getTime() + days * MILLISECONDS_PER_DAY);
}

//! N時間前の日付を取得。
export function getHoursAgo(baseDate: Date, hours: number): Date {
	return new Date(baseDate.getTime() - hours * MILLISECONDS_PER_HOUR);
}

//! N時間後の日付を取得。
export function getHoursLater(baseDate: Date, hours: number): Date {
	return new Date(baseDate.getTime() + hours * MILLISECONDS_PER_HOUR);
}

//! 2つの日付の日数差を取得。
export function getDaysDifference(date1: Date, date2: Date): number {
	const diff = Math.abs(date2.getTime() - date1.getTime());
	return Math.floor(diff / MILLISECONDS_PER_DAY);
}

//! 2つの日付が同じ日かどうかを判定。
export function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	);
}

//! 日付をYYYY-MM-DD形式の文字列に変換(UTC)。
export function formatDateUTC(date: Date): string {
	return date.toISOString().split("T")[0];
}

//! 日付をYYYY-MM-DD形式の文字列に変換(ローカル)。
export function formatDateLocal(date: Date): string {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	return `${year}-${month}-${day}`;
}

//! 日付範囲を作成(今日フィルター用)。
export interface DateRange {
	start: Date;
	end: Date;
}

export function createTodayDateRange(baseDate: Date): DateRange {
	return {
		start: getStartOfDay(baseDate),
		end: getEndOfDay(baseDate),
	};
}

//! 日付範囲を作成(一週間フィルター用、今日を含む過去7日間)。
export function createWeekDateRange(baseDate: Date): DateRange {
	return {
		start: getStartOfDay(getDaysAgo(baseDate, 6)),
		end: getEndOfDay(baseDate),
	};
}

//! 日付が範囲内かどうかを判定。
export function isInDateRange(date: Date, range: DateRange): boolean {
	return date >= range.start && date <= range.end;
}

//! ローカル日付ベースで日付範囲を作成(タイムゾーンを考慮)。
//! baseDateのローカル日付(年月日)を基準に、その日の00:00〜23:59をUTC時刻で返す。
export function createLocalDateRange(baseDate: Date | string): DateRange {
	const date = typeof baseDate === "string" ? new Date(baseDate) : baseDate;

	//! ローカル日付の年月日を取得。
	const year = date.getFullYear();
	const month = date.getMonth();
	const day = date.getDate();

	//! ローカル日付の00:00と23:59:59.999を作成。
	const start = new Date(year, month, day, 0, 0, 0, 0);
	const end = new Date(year, month, day, 23, 59, 59, 999);

	return { start, end };
}
