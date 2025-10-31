import { MemoEntry } from "../../src/types";
import { DEFAULT_TEST_CATEGORY, DEFAULT_TEST_TEMPLATE } from "./test-constants";

//! テストメモ作成ヘルパー。
export function createTestMemo(
	id: string,
	timestamp: string | Date,
	content: string,
	category: string = DEFAULT_TEST_CATEGORY,
	template: string = DEFAULT_TEST_TEMPLATE
): MemoEntry {
	const timestampStr = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
	return {
		id,
		timestamp: timestampStr,
		content,
		category,
		template,
	};
}

//! 複数のテストメモ作成ヘルパー。
export function createTestMemos(
	count: number,
	baseDate: Date,
	category: string = DEFAULT_TEST_CATEGORY
): MemoEntry[] {
	return Array.from({ length: count }, (_, i) => {
		const timestamp = new Date(baseDate.getTime() + i * 1000).toISOString();
		return createTestMemo(`memo-${i + 1}`, timestamp, `メモ${i + 1}`, category);
	});
}

//! 特定日付範囲のメモ作成ヘルパー。
export function createMemosInDateRange(
	startDate: Date,
	endDate: Date,
	count: number,
	category: string = DEFAULT_TEST_CATEGORY
): MemoEntry[] {
	const memos: MemoEntry[] = [];
	const timeSpan = endDate.getTime() - startDate.getTime();
	const interval = timeSpan / (count - 1);

	for (let i = 0; i < count; i++) {
		const timestamp = new Date(startDate.getTime() + i * interval).toISOString();
		memos.push(createTestMemo(`memo-${i + 1}`, timestamp, `メモ${i + 1}`, category));
	}

	return memos;
}

//! 複数の日付にまたがるメモを作成。
export function createMemosAcrossDays(
	dates: Date[],
	memosPerDay: number,
	category: string = DEFAULT_TEST_CATEGORY
): MemoEntry[] {
	const memos: MemoEntry[] = [];
	let memoCounter = 1;

	for (const date of dates) {
		for (let i = 0; i < memosPerDay; i++) {
			const timestamp = new Date(date.getTime() + i * 1000).toISOString();
			memos.push(createTestMemo(`memo-${memoCounter}`, timestamp, `メモ${memoCounter}`, category));
			memoCounter++;
		}
	}

	return memos;
}

//! メモコンテンツからメモIDを抽出(パーステスト用)。
export function createMemoMarkdown(memo: MemoEntry): string {
	return `<!-- memo-id: ${memo.id}, timestamp: ${memo.timestamp}, category: "${memo.category}", template: "${memo.template}" -->\n${memo.content}\n`;
}

//! 複数のメモをMarkdown形式で結合。
export function createMemosMarkdown(memos: MemoEntry[]): string {
	return memos.map((memo) => createMemoMarkdown(memo)).join("\n");
}
