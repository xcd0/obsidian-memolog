//! メモ検索エンジン。

import { MemoEntry } from "../types";

//! 検索条件。
export interface SearchQuery {
	//! 検索テキスト (全文検索)。
	text?: string;

	//! 日付範囲検索 (開始日)。
	startDate?: string;

	//! 日付範囲検索 (終了日)。
	endDate?: string;

	//! カテゴリフィルタ。
	categories?: string[];

	//! 大文字小文字を区別するか。
	caseSensitive?: boolean;
}

//! 検索結果。
export interface SearchResult {
	//! 検索にマッチしたメモ。
	matches: MemoEntry[];

	//! 検索にかかった時間 (ミリ秒)。
	duration: number;

	//! 総検索対象数。
	totalSearched: number;
}

//! 検索エンジンクラス。
export class SearchEngine {
	//! メモを検索する。
	static search(memos: MemoEntry[], query: SearchQuery): SearchResult {
		const startTime = performance.now();

		let results = [...memos];

		//! テキスト検索。
		if (query.text && query.text.trim()) {
			const searchText = query.caseSensitive ? query.text : query.text.toLowerCase();

			results = results.filter((memo) => {
				const content = query.caseSensitive ? memo.content : memo.content.toLowerCase();
				return content.includes(searchText);
			});
		}

		//! 日付範囲検索。
		if (query.startDate) {
			const startDate = new Date(query.startDate);
			results = results.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate;
			});
		}

		if (query.endDate) {
			//! 終了日の23:59:59まで含める（UTC）。
			const endDate = new Date(query.endDate + "T23:59:59.999Z");

			results = results.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate <= endDate;
			});
		}

		//! カテゴリフィルタ。
		if (query.categories && query.categories.length > 0) {
			const categories = query.categories;
			results = results.filter((memo) => categories.includes(memo.category));
		}

		const endTime = performance.now();

		return {
			matches: results,
			duration: endTime - startTime,
			totalSearched: memos.length,
		};
	}

	//! 複数ファイルのメモを検索する。
	static searchMultiple(
		memosByFile: Map<string, MemoEntry[]>,
		query: SearchQuery
	): SearchResult {
		const startTime = performance.now();

		//! 全ファイルのメモを統合。
		const allMemos: MemoEntry[] = [];
		for (const memos of memosByFile.values()) {
			allMemos.push(...memos);
		}

		//! 統合したメモを検索。
		const result = SearchEngine.search(allMemos, query);

		const endTime = performance.now();

		return {
			matches: result.matches,
			duration: endTime - startTime,
			totalSearched: allMemos.length,
		};
	}

	//! ハイライト用のマッチ位置を取得する。
	static getMatchPositions(
		content: string,
		searchText: string,
		caseSensitive = false
	): Array<{ start: number; end: number }> {
		if (!searchText.trim()) {
			return [];
		}

		const positions: Array<{ start: number; end: number }> = [];
		const text = caseSensitive ? content : content.toLowerCase();
		const search = caseSensitive ? searchText : searchText.toLowerCase();

		let index = 0;
		while ((index = text.indexOf(search, index)) !== -1) {
			positions.push({
				start: index,
				end: index + search.length,
			});
			index += search.length;
		}

		return positions;
	}

	//! コンテンツにハイライトマークを挿入する。
	static highlightMatches(
		content: string,
		searchText: string,
		caseSensitive = false
	): string {
		const positions = SearchEngine.getMatchPositions(content, searchText, caseSensitive);

		if (positions.length === 0) {
			return content;
		}

		//! 後ろから挿入することで位置がずれないようにする。
		let result = content;
		for (let i = positions.length - 1; i >= 0; i--) {
			const pos = positions[i];
			result =
				result.substring(0, pos.start) +
				`<mark>${result.substring(pos.start, pos.end)}</mark>` +
				result.substring(pos.end);
		}

		return result;
	}

	//! 日付をYYYY-MM-DD形式の文字列に変換（タイムゾーン非依存）。
	private static formatLocalDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	//! 日付範囲のプリセット。
	static getDateRangePreset(preset: "today" | "week" | "month" | "year"): {
		startDate: string;
		endDate: string;
	} {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

		let startDate: Date;
		const endDate = new Date(today);

		switch (preset) {
			case "today":
				startDate = new Date(today);
				break;
			case "week":
				startDate = new Date(today);
				startDate.setDate(today.getDate() - 6);
				break;
			case "month":
				startDate = new Date(today);
				startDate.setMonth(today.getMonth() - 1);
				break;
			case "year":
				startDate = new Date(today);
				startDate.setFullYear(today.getFullYear() - 1);
				break;
		}

		return {
			startDate: this.formatLocalDate(startDate),
			endDate: this.formatLocalDate(endDate),
		};
	}
}
