import { MemoEntry, SortOrder } from "../types/memo"

// ! メモクエリ操作の純粋関数群。
// ! I/O操作を含まず、メモエントリのフィルタリング・ソート・検索ロジックのみを提供する。

// ! メモをカテゴリでフィルタリングする。
// ! @param memos メモエントリの配列
// ! @param category フィルタするカテゴリ（空文字の場合は全メモを返す）
// ! @returns フィルタされたメモエントリの配列
export function filterMemosByCategory(memos: MemoEntry[], category: string): MemoEntry[] {
	if (!category) {
		return memos // ! 空文字の場合は全メモを返す。
	}
	return memos.filter(memo => memo.category === category)
}

// ! メモを日付範囲でフィルタリングする。
// ! @param memos メモエントリの配列
// ! @param startDate 開始日時（ISO 8601形式、この日時以降のメモを含む）
// ! @param endDate 終了日時（ISO 8601形式、この日時以前のメモを含む）
// ! @returns フィルタされたメモエントリの配列
export function filterMemosByDateRange(
	memos: MemoEntry[],
	startDate: string,
	endDate: string,
): MemoEntry[] {
	const start = new Date(startDate).getTime()
	const end = new Date(endDate).getTime()

	return memos.filter(memo => {
		const timestamp = new Date(memo.timestamp).getTime()
		return timestamp >= start && timestamp <= end
	})
}

// ! メモをタイムスタンプでソートする。
// ! @param memos メモエントリの配列
// ! @param order ソート順（"asc": 昇順、"desc": 降順）
// ! @returns ソートされたメモエントリの配列（元の配列は変更しない）
export function sortMemosByTimestamp(memos: MemoEntry[], order: SortOrder): MemoEntry[] {
	const sorted = [...memos] // ! 元の配列を変更しないようにコピー。

	sorted.sort((a, b) => {
		const aTime = new Date(a.timestamp).getTime()
		const bTime = new Date(b.timestamp).getTime()

		if (order === "asc") {
			return aTime - bTime
		} else {
			return bTime - aTime
		}
	})

	return sorted
}

// ! メモをコンテンツで検索する（部分一致）。
// ! @param memos メモエントリの配列
// ! @param query 検索クエリ
// ! @param caseSensitive 大文字小文字を区別するか（デフォルト: false）
// ! @returns マッチしたメモエントリの配列
export function searchMemosByContent(
	memos: MemoEntry[],
	query: string,
	caseSensitive = false,
): MemoEntry[] {
	if (!query) {
		return memos // ! クエリが空の場合は全メモを返す。
	}

	const searchQuery = caseSensitive ? query : query.toLowerCase()

	return memos.filter(memo => {
		const content = caseSensitive ? memo.content : memo.content.toLowerCase()
		return content.includes(searchQuery)
	})
}

// ! ピン留めされたメモのみを抽出する。
// ! @param memos メモエントリの配列
// ! @returns ピン留めされたメモエントリの配列
export function getPinnedMemos(memos: MemoEntry[]): MemoEntry[] {
	return memos.filter(memo => memo.pinnedAt !== undefined && memo.pinnedAt !== null)
}

// ! ピン留めされていないメモのみを抽出する。
// ! @param memos メモエントリの配列
// ! @returns ピン留めされていないメモエントリの配列
export function getUnpinnedMemos(memos: MemoEntry[]): MemoEntry[] {
	return memos.filter(memo => memo.pinnedAt === undefined || memo.pinnedAt === null)
}

// ! 削除されていないメモのみを抽出する（ゴミ箱に入っていないメモ）。
// ! @param memos メモエントリの配列
// ! @returns 削除されていないメモエントリの配列
export function getActiveMemos(memos: MemoEntry[]): MemoEntry[] {
	return memos.filter(memo => !memo.trashedAt)
}

// ! 削除されたメモのみを抽出する（ゴミ箱に入っているメモ）。
// ! @param memos メモエントリの配列
// ! @returns 削除されたメモエントリの配列
export function getDeletedMemos(memos: MemoEntry[]): MemoEntry[] {
	return memos.filter(memo => memo.trashedAt !== undefined && memo.trashedAt !== null)
}

// ! 複数の条件を組み合わせてメモをフィルタリングする。
// ! @param memos メモエントリの配列
// ! @param options フィルタオプション
// ! @returns フィルタされたメモエントリの配列
export function filterMemos(
	memos: MemoEntry[],
	options: {
		category?: string
		startDate?: string
		endDate?: string
		searchQuery?: string
		caseSensitive?: boolean
		includeDeleted?: boolean
		onlyPinned?: boolean
	},
): MemoEntry[] {
	let filtered = memos

	// ! 削除されたメモのフィルタリング。
	if (!options.includeDeleted) {
		filtered = getActiveMemos(filtered)
	}

	// ! カテゴリでフィルタリング。
	if (options.category) {
		filtered = filterMemosByCategory(filtered, options.category)
	}

	// ! 日付範囲でフィルタリング。
	if (options.startDate && options.endDate) {
		filtered = filterMemosByDateRange(filtered, options.startDate, options.endDate)
	}

	// ! 検索クエリでフィルタリング。
	if (options.searchQuery) {
		filtered = searchMemosByContent(filtered, options.searchQuery, options.caseSensitive)
	}

	// ! ピン留めでフィルタリング。
	if (options.onlyPinned) {
		filtered = getPinnedMemos(filtered)
	}

	return filtered
}

// ! ピン留めされたメモを先頭に、それ以外をタイムスタンプでソートする。
// ! @param memos メモエントリの配列
// ! @param order ピン留めされていないメモのソート順
// ! @returns ソートされたメモエントリの配列
export function sortMemosWithPinnedFirst(memos: MemoEntry[], order: SortOrder): MemoEntry[] {
	const pinned = getPinnedMemos(memos)
	const unpinned = getUnpinnedMemos(memos)

	// ! ピン留めされたメモをピン留め日時でソート（新しい順）。
	const sortedPinned = [...pinned].sort((a, b) => {
		const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
		const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
		return bTime - aTime // ! 降順（新しいピン留めが先頭）。
	})

	// ! ピン留めされていないメモをタイムスタンプでソート。
	const sortedUnpinned = sortMemosByTimestamp(unpinned, order)

	// ! ピン留めを先頭に、それ以外を後ろに。
	return [...sortedPinned, ...sortedUnpinned]
}

// ! メモIDでメモを検索する。
// ! @param memos メモエントリの配列
// ! @param memoId 検索するメモID
// ! @returns 見つかったメモエントリ、見つからない場合はnull
export function findMemoById(memos: MemoEntry[], memoId: string): MemoEntry | null {
	return memos.find(memo => memo.id === memoId) || null
}

// ! 添付ファイルを持つメモのみを抽出する。
// ! @param memos メモエントリの配列
// ! @returns 添付ファイルを持つメモエントリの配列
export function getMemosWithAttachments(memos: MemoEntry[]): MemoEntry[] {
	return memos.filter(memo => memo.attachments && memo.attachments.length > 0)
}

// ! テンプレートを持つメモのみを抽出する。
// ! @param memos メモエントリの配列
// ! @returns テンプレートを持つメモエントリの配列
export function getMemosWithTemplate(memos: MemoEntry[]): MemoEntry[] {
	return memos.filter(memo => memo.template !== undefined && memo.template !== null)
}
