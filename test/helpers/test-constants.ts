//! テスト用定数。

//! 日時計算用定数。
export const MILLISECONDS_PER_SECOND = 1000;
export const MILLISECONDS_PER_MINUTE = 1000 * 60;
export const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
export const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

//! 日付範囲定数。
export const DAYS_IN_WEEK = 7;
export const DAYS_IN_MONTH_AVG = 30; //! 平均。
export const DAYS_IN_YEAR = 365; //! 平年。
export const DAYS_IN_LEAP_YEAR = 366; //! 閏年。

//! テスト用固定日時(UTC)。
export const TEST_DATE_2025_10_31 = new Date("2025-10-31T12:00:00.000Z");
export const TEST_DATE_2025_10_30 = new Date("2025-10-30T12:00:00.000Z");
export const TEST_DATE_2025_10_29 = new Date("2025-10-29T12:00:00.000Z");
export const TEST_DATE_2025_10_27 = new Date("2025-10-27T12:00:00.000Z");
export const TEST_DATE_2024_02_29 = new Date("2024-02-29T12:00:00.000Z"); //! 閏年。
export const TEST_DATE_2025_01_01 = new Date("2025-01-01T12:00:00.000Z"); //! 年始。
export const TEST_DATE_2024_12_31 = new Date("2024-12-31T12:00:00.000Z"); //! 年末。

//! テスト用デフォルト値。
export const DEFAULT_TEST_CATEGORY = "test";
export const DEFAULT_TEST_TEMPLATE = "{{content}}";
