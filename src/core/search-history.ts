// ! 検索履歴管理機能。

import { SearchQuery } from "./search-engine"

// ! 検索履歴エントリ。
export interface SearchHistoryEntry {
	// ! 検索クエリ。
	query: SearchQuery

	// ! 検索実行日時。
	timestamp: string

	// ! 検索結果数。
	resultCount: number

	// ! 検索ID。
	id: string
}

// ! 検索履歴マネージャー。
export class SearchHistory {
	private history: SearchHistoryEntry[] = []
	private maxHistorySize: number

	// ! コンストラクタ。
	constructor(maxHistorySize = 50) {
		this.maxHistorySize = maxHistorySize
	}

	// ! 検索履歴に追加する。
	addEntry(query: SearchQuery, resultCount: number): void {
		const entry: SearchHistoryEntry = {
			query: { ...query },
			timestamp: new Date().toISOString(),
			resultCount,
			id: this.generateId(),
		}

		// ! 同じクエリが既に存在する場合は削除してから追加（最新を保つ）。
		this.history = this.history.filter(e => !this.isSameQuery(e.query, query))

		// ! 先頭に追加（最新が先頭）。
		this.history.unshift(entry)

		// ! 最大サイズを超えたら古いものを削除。
		if (this.history.length > this.maxHistorySize) {
			this.history = this.history.slice(0, this.maxHistorySize)
		}
	}

	// ! 検索履歴を取得する。
	getHistory(limit?: number): SearchHistoryEntry[] {
		if (limit !== undefined) {
			return this.history.slice(0, limit)
		}
		return [...this.history]
	}

	// ! 特定のエントリを取得する。
	getEntry(id: string): SearchHistoryEntry | null {
		return this.history.find(e => e.id === id) || null
	}

	// ! 検索履歴をクリアする。
	clear(): void {
		this.history = []
	}

	// ! 特定のエントリを削除する。
	removeEntry(id: string): boolean {
		const initialLength = this.history.length
		this.history = this.history.filter(e => e.id !== id)
		return this.history.length < initialLength
	}

	// ! 頻繁に使用される検索クエリを取得する（結果数順）。
	getFrequentQueries(limit = 10): SearchHistoryEntry[] {
		// ! クエリをグループ化してカウント。
		const queryMap = new Map<string, { entry: SearchHistoryEntry; count: number }>()

		for (const entry of this.history) {
			const key = this.queryToKey(entry.query)
			const existing = queryMap.get(key)

			if (existing) {
				existing.count++
			} else {
				queryMap.set(key, { entry, count: 1 })
			}
		}

		// ! カウント順にソートして返す。
		return Array.from(queryMap.values())
			.sort((a, b) => b.count - a.count)
			.slice(0, limit)
			.map(item => item.entry)
	}

	// ! 最近の検索クエリを取得する。
	getRecentQueries(limit = 10): SearchHistoryEntry[] {
		return this.history.slice(0, limit)
	}

	// ! 検索履歴をJSON形式でエクスポートする。
	export(): string {
		return JSON.stringify(this.history, null, 2)
	}

	// ! JSON形式の検索履歴をインポートする。
	import(json: string): boolean {
		try {
			const imported = JSON.parse(json) as SearchHistoryEntry[]

			// ! バリデーション。
			if (!Array.isArray(imported)) {
				return false
			}

			for (const entry of imported) {
				if (!entry.query || !entry.timestamp || !entry.id) {
					return false
				}
			}

			this.history = imported.slice(0, this.maxHistorySize)
			return true
		} catch {
			return false
		}
	}

	// ! 統計情報を取得する。
	getStatistics(): {
		totalSearches: number
		uniqueQueries: number
		averageResults: number
		mostFrequentQuery: SearchHistoryEntry | null
	} {
		const totalSearches = this.history.length
		const uniqueQueries = new Set(this.history.map(e => this.queryToKey(e.query))).size
		const averageResults = totalSearches > 0
			? this.history.reduce((sum, e) => sum + e.resultCount, 0) / totalSearches
			: 0

		const frequent = this.getFrequentQueries(1)
		const mostFrequentQuery = frequent.length > 0 ? frequent[0] : null

		return {
			totalSearches,
			uniqueQueries,
			averageResults: Math.round(averageResults * 10) / 10,
			mostFrequentQuery,
		}
	}

	// ! 2つの検索クエリが同じかチェックする。
	private isSameQuery(q1: SearchQuery, q2: SearchQuery): boolean {
		return this.queryToKey(q1) === this.queryToKey(q2)
	}

	// ! 検索クエリをキー文字列に変換する。
	private queryToKey(query: SearchQuery): string {
		return JSON.stringify({
			text: query.text || "",
			startDate: query.startDate || "",
			endDate: query.endDate || "",
			categories: (query.categories || []).sort(),
			caseSensitive: query.caseSensitive || false,
		})
	}

	// ! ユニークなIDを生成する。
	private generateId(): string {
		return `search-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
	}

	// ! 検索履歴のサイズを取得する。
	get size(): number {
		return this.history.length
	}

	// ! 最大履歴サイズを取得する。
	get maxSize(): number {
		return this.maxHistorySize
	}

	// ! 最大履歴サイズを設定する。
	setMaxSize(size: number): void {
		if (size < 1) {
			throw new Error("Max size must be at least 1")
		}

		this.maxHistorySize = size

		// ! 既存の履歴が新しい最大サイズを超えている場合は切り詰める。
		if (this.history.length > size) {
			this.history = this.history.slice(0, size)
		}
	}
}
