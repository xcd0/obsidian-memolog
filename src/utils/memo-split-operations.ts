import { MemoEntry } from "../types/memo"

// ! メモ分割操作の純粋関数群。
// ! I/O操作を含まず、メモ分割ロジックのみを提供する。

// ! メモをカテゴリごとにグループ化する。
// ! @param memos メモエントリの配列
// ! @param defaultCategory デフォルトカテゴリ名
// ! @returns カテゴリ名をキーとするメモ配列のMap
export function groupMemosByCategory(
	memos: MemoEntry[],
	defaultCategory: string,
): Map<string, MemoEntry[]> {
	const categoryGroups = new Map<string, MemoEntry[]>()

	for (const memo of memos) {
		const category = memo.category || defaultCategory
		if (!categoryGroups.has(category)) {
			categoryGroups.set(category, [])
		}
		const group = categoryGroups.get(category)
		if (group !== undefined) {
			group.push(memo)
		}
	}

	return categoryGroups
}

// ! カテゴリグループ内のメモをタイムスタンプ順にソートする。
// ! @param categoryGroups カテゴリ名をキーとするメモ配列のMap
// ! @returns ソート済みのMap（元のMapは変更しない）
export function sortCategoryGroupsByTimestamp(
	categoryGroups: Map<string, MemoEntry[]>,
): Map<string, MemoEntry[]> {
	const sorted = new Map<string, MemoEntry[]>()

	for (const [category, memos] of categoryGroups) {
		const sortedMemos = [...memos].sort((a, b) => {
			return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
		})
		sorted.set(category, sortedMemos)
	}

	return sorted
}

// ! カテゴリグループから新しいファイルパスとメモのマッピングを生成する。
// ! @param categoryGroups カテゴリ名をキーとするメモ配列のMap
// ! @param pathGenerator パス生成関数（category, date を受け取り、パスを返す）
// ! @returns 新しいパスをキーとするメモ配列のMap
export function generatePathMappingsFromGroups(
	categoryGroups: Map<string, MemoEntry[]>,
	pathGenerator: (category: string, date: Date) => string,
): Map<string, MemoEntry[]> {
	const newPathToMemos = new Map<string, MemoEntry[]>()

	for (const [category, memos] of categoryGroups) {
		if (memos.length === 0) {
			continue
		}

		// ! 最初のメモのタイムスタンプから日付情報を取得。
		const firstMemoDate = new Date(memos[0].timestamp)
		const newPath = pathGenerator(category, firstMemoDate)

		newPathToMemos.set(newPath, memos)
	}

	return newPathToMemos
}

// ! ファイルパスが特別なファイル（除外対象）かどうかを判定する。
// ! @param relativePath rootディレクトリからの相対パス
// ! @returns 特別なファイルの場合はtrue
export function isSpecialFileForSplit(relativePath: string): boolean {
	// ! rootディレクトリ直下のファイルのみチェック。
	if (!relativePath.includes("/")) {
		// ! index.mdを除外。
		if (relativePath === "index.md") {
			return true
		}

		// ! _trash.md（またはその他のゴミ箱ファイル名）を除外。
		// ! ゴミ箱ファイルは通常 "_*.md" の形式を想定。
		if (relativePath.startsWith("_") && relativePath.endsWith(".md")) {
			return true
		}
	}

	return false
}

// ! メモ分割マイグレーションの完全な計画を作成する（純粋関数版）。
// ! @param memos メモエントリの配列
// ! @param defaultCategory デフォルトカテゴリ名
// ! @param pathGenerator パス生成関数
// ! @returns 新しいパスをキーとするメモ配列のMap
export function planMemoSplit(
	memos: MemoEntry[],
	defaultCategory: string,
	pathGenerator: (category: string, date: Date) => string,
): Map<string, MemoEntry[]> {
	// ! カテゴリごとにグループ化。
	const categoryGroups = groupMemosByCategory(memos, defaultCategory)

	// ! タイムスタンプ順にソート。
	const sortedGroups = sortCategoryGroupsByTimestamp(categoryGroups)

	// ! 新しいパスマッピングを生成。
	return generatePathMappingsFromGroups(sortedGroups, pathGenerator)
}
