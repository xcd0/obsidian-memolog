# テスト改善計画

## 概要

本ドキュメントは、テスト方針書とギャップ分析に基づき、具体的な改善計画を定める。現状のテストを残したまま、新規にテスト方針に沿ったテストを作成する。

## 改善の基本方針

### 1. 既存テストの保持

- 現状のテストファイルはそのまま残す。
- テストが通っている状態を維持する。
- 既存テストは回帰テストとして機能し続ける。

### 2. 改善版テストの作成

- 新規に改善版テストファイルを作成する。
- ファイル名に `-improved` サフィックスを付ける。
- 同じ機能を、テスト方針に沿った形で再実装する。

### 3. 段階的な移行

- 改善版テストが安定したら、既存テストとの比較を行う。
- 両方のテストがCI/CDで実行されることを確認する。
- 最終的には、改善版テストに統一する(既存テストは削除または非推奨化)。

## フェーズ1: サンプル改善版テストの作成

### 対象ファイル

最初に改善する対象として、以下のファイルを選定する:

1. `date-range-filter.test.ts` → `date-range-filter-improved.test.ts`
2. `settings.test.ts` → `settings-improved.test.ts`

### 選定理由

- `date-range-filter.test.ts`: 多くの改善ポイント(AAA不明確、複数検証、マジックナンバー)が含まれている。
- `settings.test.ts`: 比較的シンプルで、AAAパターンの適用が分かりやすい。

### 改善版テストの要件

#### 1. AAAパターンの明確化

```typescript
describe("日付範囲フィルター", () => {
	it("今日のメモのみをフィルタリングする", () => {
		// Arrange: テストデータの準備。
		const today = new Date("2025-10-31T12:00:00Z")
		const yesterday = new Date("2025-10-30T12:00:00Z")
		const testMemos = [
			createTestMemo("memo-1", yesterday.toISOString(), "昨日のメモ"),
			createTestMemo("memo-2", today.toISOString(), "今日のメモ"),
		]
		const filter = createTodayFilter(today)

		// Act: フィルタリング実行。
		const result = applyDateFilter(testMemos, filter)

		// Assert: 今日のメモのみが含まれることを検証。
		expect(result).toHaveLength(1)
		expect(result[0].id).toBe("memo-2")
	})
})
```

#### 2. ヘルパー関数の作成

```typescript
// test/helpers/memo-test-helpers.ts

// ! テストメモ作成ヘルパー。
export function createTestMemo(
	id: string,
	timestamp: string,
	content: string,
	category = "test",
): MemoEntry {
	return { id, timestamp, content, category }
}

// ! 日付フィルター作成ヘルパー。
export function createTodayFilter(baseDate: Date): DateFilter {
	const start = new Date(baseDate)
	start.setHours(0, 0, 0, 0)
	const end = new Date(baseDate)
	end.setHours(23, 59, 59, 999)
	return { start, end }
}

// ! 一週間フィルター作成ヘルパー。
export function createWeekFilter(baseDate: Date): DateFilter {
	const start = new Date(baseDate)
	start.setDate(baseDate.getDate() - 6)
	start.setHours(0, 0, 0, 0)
	const end = new Date(baseDate)
	end.setHours(23, 59, 59, 999)
	return { start, end }
}
```

#### 3. 定数の定義

```typescript
// test/helpers/test-constants.ts

// ! 日時計算用定数。
export const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24
export const MILLISECONDS_PER_HOUR = 1000 * 60 * 60
export const MILLISECONDS_PER_MINUTE = 1000 * 60

// ! 日付範囲定数。
export const DAYS_IN_WEEK = 7
export const DAYS_IN_MONTH = 30 // ! 平均。
export const DAYS_IN_YEAR = 365 // ! 平年。
export const DAYS_IN_LEAP_YEAR = 366 // ! 閏年。

// ! テスト用固定日時。
export const TEST_DATE_2025_10_31 = new Date("2025-10-31T12:00:00Z")
export const TEST_DATE_2024_02_29 = new Date("2024-02-29T12:00:00Z") // ! 閏年。
```

#### 4. 1つのテストで1つのことだけをテストする

修正前(複数の検証):

```typescript
it("日付フィルタリングが正しく動作する", () => {
	// ... 準備 ...
	expect(filtered).toHaveLength(2)
	expect(filtered[0].id).toBe("memo-1")
	expect(filtered.map(m => m.id)).toEqual(["memo-1", "memo-2"])
	expect(oldMemos.length).toBe(0)
})
```

修正後(1つの検証に分割):

```typescript
it("フィルタリング後のメモ数が正しい", () => {
	// Arrange
	const testMemos = createTestMemosForToday()
	const filter = createTodayFilter(TEST_DATE_2025_10_31)

	// Act
	const result = applyDateFilter(testMemos, filter)

	// Assert
	expect(result).toHaveLength(EXPECTED_MEMO_COUNT)
})

it("フィルタリング結果に今日のメモのみが含まれる", () => {
	// Arrange
	const testMemos = createTestMemosForToday()
	const filter = createTodayFilter(TEST_DATE_2025_10_31)

	// Act
	const result = applyDateFilter(testMemos, filter)

	// Assert
	const resultIds = result.map(m => m.id)
	expect(resultIds).toEqual(["memo-today-1", "memo-today-2"])
})

it("フィルタリング結果に過去のメモが含まれない", () => {
	// Arrange
	const testMemos = createTestMemosWithOldData()
	const filter = createTodayFilter(TEST_DATE_2025_10_31)

	// Act
	const result = applyDateFilter(testMemos, filter)

	// Assert
	const hasOldMemos = result.some(m => isOldMemo(m))
	expect(hasOldMemos).toBe(false)
})
```

#### 5. テスト名を振る舞いベースにする

修正前(実装詳細):

```typescript
it("toISOString().split('T')[0]はUTC日付を返す", () => { ... });
```

修正後(振る舞い):

```typescript
it("日付文字列がUTC基準で生成される", () => { ... });
```

#### 6. コンソールログの削除

修正前:

```typescript
it("フィルタリングのテスト", () => {
	console.log("=== テスト開始 ===")
	// ...
	console.log("結果:", result)
})
```

修正後:

```typescript
it("フィルタリングのテスト", () => {
	// コンソールログは削除。
	// 必要な場合は、環境変数で制御。
	if (process.env.DEBUG_TEST) {
		console.log("=== テスト開始 ===")
	}
	// ...
})
```

## フェーズ2: 共通テストユーティリティの作成

### ファイル構成

```
test/
├── helpers/
│   ├── memo-test-helpers.ts      # メモ関連のテストヘルパー。
│   ├── date-test-helpers.ts      # 日付関連のテストヘルパー。
│   ├── mock-helpers.ts           # モック作成ヘルパー。
│   └── test-constants.ts         # テスト用定数。
├── fixtures/
│   ├── memo-fixtures.ts          # メモのテストデータ。
│   └── date-fixtures.ts          # 日付のテストデータ。
└── improved/
	├── date-range-filter-improved.test.ts
	└── settings-improved.test.ts
```

### ヘルパー関数の例

#### memo-test-helpers.ts

```typescript
import { MemoEntry } from "../../src/types"

// ! テストメモ作成ヘルパー。
export function createTestMemo(
	id: string,
	timestamp: string,
	content: string,
	category = "test",
): MemoEntry {
	return { id, timestamp, content, category }
}

// ! 複数のテストメモ作成ヘルパー。
export function createTestMemos(count: number, baseDate: Date): MemoEntry[] {
	return Array.from({ length: count }, (_, i) => {
		const timestamp = new Date(baseDate.getTime() + i * 1000).toISOString()
		return createTestMemo(`memo-${i}`, timestamp, `メモ${i}`)
	})
}

// ! 特定日付範囲のメモ作成ヘルパー。
export function createMemosInDateRange(
	startDate: Date,
	endDate: Date,
	count: number,
): MemoEntry[] {
	const memos: MemoEntry[] = []
	const timeSpan = endDate.getTime() - startDate.getTime()
	const interval = timeSpan / count

	for (let i = 0; i < count; i++) {
		const timestamp = new Date(startDate.getTime() + i * interval).toISOString()
		memos.push(createTestMemo(`memo-${i}`, timestamp, `メモ${i}`))
	}

	return memos
}
```

#### date-test-helpers.ts

```typescript
import { MILLISECONDS_PER_DAY } from "./test-constants"

// ! 日付の開始時刻を取得(00:00:00.000)。
export function getStartOfDay(date: Date): Date {
	const result = new Date(date)
	result.setHours(0, 0, 0, 0)
	return result
}

// ! 日付の終了時刻を取得(23:59:59.999)。
export function getEndOfDay(date: Date): Date {
	const result = new Date(date)
	result.setHours(23, 59, 59, 999)
	return result
}

// ! N日前の日付を取得。
export function getDaysAgo(baseDate: Date, days: number): Date {
	return new Date(baseDate.getTime() - days * MILLISECONDS_PER_DAY)
}

// ! N日後の日付を取得。
export function getDaysLater(baseDate: Date, days: number): Date {
	return new Date(baseDate.getTime() + days * MILLISECONDS_PER_DAY)
}

// ! 2つの日付の日数差を取得。
export function getDaysDifference(date1: Date, date2: Date): number {
	const diff = Math.abs(date2.getTime() - date1.getTime())
	return Math.floor(diff / MILLISECONDS_PER_DAY)
}
```

#### mock-helpers.ts

```typescript
import { App, TFile, TFolder } from "obsidian"

// ! TFileのモック作成ヘルパー。
export function createMockTFile(path: string): TFile {
	const name = path.split("/").pop() || ""
	return Object.create(TFile.prototype, {
		path: { value: path },
		name: { value: name },
	}) as TFile
}

// ! TFolderのモック作成ヘルパー。
export function createMockTFolder(path: string): TFolder {
	return Object.create(TFolder.prototype, {
		path: { value: path },
	}) as TFolder
}

// ! Appのモック作成ヘルパー。
export function createMockApp(overrides?: Partial<App>): App {
	return {
		vault: {
			read: jest.fn(),
			create: jest.fn(),
			modify: jest.fn(),
			getAbstractFileByPath: jest.fn(),
			createFolder: jest.fn(),
			delete: jest.fn(),
			getFiles: jest.fn(),
			adapter: {
				exists: jest.fn(),
				read: jest.fn(),
				write: jest.fn(),
				remove: jest.fn(),
				list: jest.fn(),
				stat: jest.fn(),
			},
		},
		...overrides,
	} as unknown as App
}
```

## フェーズ3: 改善版テストの実装

### 対象ファイル1: date-range-filter-improved.test.ts

#### 実装方針

1. **テストの分類**
   - 正常系: 基本的なフィルタリング動作。
   - 境界値: 日をまたぐ、月をまたぐ、年をまたぐ。
   - 異常系: 不正な日付、nullフィルター。

2. **テストの構成**
   - describe: 機能単位でグループ化。
   - it: 1つの振る舞いのみを検証。
   - AAA: Arrange-Act-Assertを明確に分離。

3. **ヘルパー関数の活用**
   - createTestMemo: テストメモの作成。
   - createTodayFilter: 今日フィルターの作成。
   - createWeekFilter: 一週間フィルターの作成。

#### サンプルコード構成

```typescript
import { getDaysAgo, getEndOfDay, getStartOfDay } from "../helpers/date-test-helpers"
import { createMemosInDateRange, createTestMemo } from "../helpers/memo-test-helpers"
import { DAYS_IN_WEEK, TEST_DATE_2025_10_31 } from "../helpers/test-constants"

describe("日付範囲フィルター - 改善版", () => {
	describe("今日フィルター", () => {
		it("今日のメモのみを返す", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const yesterday = getDaysAgo(today, 1)
			const testMemos = [
				createTestMemo("memo-1", yesterday.toISOString(), "昨日"),
				createTestMemo("memo-2", today.toISOString(), "今日"),
			]
			const startDate = getStartOfDay(today)
			const endDate = getEndOfDay(today)

			// Act
			const filtered = testMemos.filter(memo => {
				const memoDate = new Date(memo.timestamp)
				return memoDate >= startDate && memoDate <= endDate
			})

			// Assert
			expect(filtered).toHaveLength(1)
			expect(filtered[0].id).toBe("memo-2")
		})

		// 他のテストケース...
	})

	describe("一週間フィルター", () => {
		it("過去7日間のメモを返す", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const startDate = getStartOfDay(getDaysAgo(today, DAYS_IN_WEEK - 1))
			const endDate = getEndOfDay(today)
			const testMemos = createMemosInDateRange(
				getDaysAgo(today, 10),
				today,
				15,
			)

			// Act
			const filtered = testMemos.filter(memo => {
				const memoDate = new Date(memo.timestamp)
				return memoDate >= startDate && memoDate <= endDate
			})

			// Assert
			expect(filtered.length).toBeGreaterThan(0)
			filtered.forEach(memo => {
				const memoDate = new Date(memo.timestamp)
				expect(memoDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime())
				expect(memoDate.getTime()).toBeLessThanOrEqual(endDate.getTime())
			})
		})

		// 他のテストケース...
	})

	describe("境界値テスト", () => {
		it("日付境界(00:00:00)のメモが含まれる", () => {
			// Arrange
			const today = TEST_DATE_2025_10_31
			const startOfDay = getStartOfDay(today)
			const testMemo = createTestMemo("memo-1", startOfDay.toISOString(), "境界")
			const startDate = getStartOfDay(today)
			const endDate = getEndOfDay(today)

			// Act
			const memoDate = new Date(testMemo.timestamp)
			const isInRange = memoDate >= startDate && memoDate <= endDate

			// Assert
			expect(isInRange).toBe(true)
		})

		// 他のテストケース...
	})
})
```

### 対象ファイル2: settings-improved.test.ts

#### 実装方針

1. **モックの分離**
   - モック作成ロジックをmock-helpers.tsに移動。
   - テストコード内ではモックの使用のみに集中。

2. **AAAパターンの徹底**
   - 各テストでArrange-Act-Assertを明確に分離。
   - 空行で視覚的に区切る。

3. **テスト名の改善**
   - 「〜できる」形式で統一。
   - 期待される振る舞いが明確に分かる名前。

## フェーズ4: CI/CDへの統合

### テスト実行の設定

#### package.jsonの更新

```json
{
	"scripts": {
		"test": "jest",
		"test:improved": "jest --testPathPattern=improved",
		"test:original": "jest --testPathPattern=test --testPathIgnorePatterns=improved",
		"test:all": "jest --verbose",
		"test:coverage": "jest --coverage"
	}
}
```

#### GitHub Actionsの更新

```yaml
# .github/workflows/test.yml

name: Test

on: [push, pull_request]

jobs:
	test:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v2
			- uses: actions/setup-node@v2
				with:
					node-version: '18'
			- run: npm install
			- run: npm run test:all
			- name: Upload coverage
				uses: codecov/codecov-action@v2
				with:
					files: ./coverage/coverage-final.json
```

## フェーズ5: 評価と改善

### 評価基準

1. **テストの可読性**
   - AAA パターンが明確か。
   - テスト名が振る舞いを表しているか。
   - コメントがなくても意図が分かるか。

2. **テストの保守性**
   - ヘルパー関数が効果的に使われているか。
   - マジックナンバーが排除されているか。
   - テストデータの重複がないか。

3. **テストの実行速度**
   - 単体テストが高速に実行されるか(1テスト1秒以内)。
   - テスト全体の実行時間が許容範囲か。

4. **テストカバレッジ**
   - 主要な機能がカバーされているか。
   - 境界値がテストされているか。
   - 異常系がテストされているか。

### 改善のサイクル

1. **週次レビュー**
   - 新規作成した改善版テストをレビューする。
   - 問題点を洗い出し、修正する。

2. **月次評価**
   - テストカバレッジを確認する。
   - テスト実行時間を測定する。
   - テスト方針書の見直しを行う。

3. **四半期ごとの振り返り**
   - 改善版テストの効果を評価する。
   - 既存テストとの比較を行う。
   - 次の改善計画を策定する。

## まとめ

### 改善計画の要点

1. **既存テストは残す**: 回帰テストとして機能し続ける。
2. **改善版テストを新規作成**: テスト方針に沿った高品質なテストを作成。
3. **段階的な移行**: 改善版テストが安定したら、既存テストを置き換える。
4. **継続的な改善**: 定期的なレビューと評価を行い、テストの品質を維持・向上させる。

### 期待される効果

1. **テストの可読性向上**: AAAパターンにより、テストの意図が明確になる。
2. **テストの保守性向上**: ヘルパー関数により、テストコードの重複が減少する。
3. **テストの信頼性向上**: 1つのテストで1つのことだけをテストすることで、テストの精度が向上する。
4. **開発速度の向上**: 高品質なテストにより、リファクタリングや機能追加が安心して行える。

### 次のステップ

1. フェーズ1: `date-range-filter-improved.test.ts` の実装。
2. フェーズ2: 共通テストユーティリティの作成。
3. フェーズ3: `settings-improved.test.ts` の実装。
4. フェーズ4: CI/CDへの統合。
5. フェーズ5: 評価と改善。
