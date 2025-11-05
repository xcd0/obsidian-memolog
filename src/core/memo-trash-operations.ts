import { MemoEntry } from "../types/memo"
import { isDeletedMemo } from "./memo-helpers"

// ! ゴミ箱操作の純粋関数群。
// ! I/O操作を含まず、メモテキストの変換ロジックのみを提供する。

// ! メモをゴミ箱に移動する（削除フラグ追加とコンテンツのコメントアウト）。
// ! @param memoText メモテキスト
// ! @param trashedAt ゴミ箱に移動した日時（ISO 8601形式）
// ! @returns ゴミ箱状態のメモテキスト
export function markAsDeleted(memoText: string, trashedAt: string): string {
	// ! memo-idヘッダーにdeleted: "true"とtrashedAtを追加。
	const withDeletedFlag = memoText.replace(
		/(<!-- memo-id: [^>]+) -->/,
		`$1, deleted: "true", trashedAt: "${trashedAt}" -->`,
	)

	// ! コンテンツ部分をコメントアウト。
	const lines = withDeletedFlag.split("\n")
	const headerLine = lines[0]
	const contentLines = lines.slice(1)
	const content = contentLines.join("\n").trim()
	const commentedContent = content ? `<!--\n${content}\n-->` : ""

	return headerLine + "\n" + commentedContent
}

// ! ゴミ箱からメモを復元する（削除フラグ削除とコメントアウトの解除）。
// ! @param memoText ゴミ箱状態のメモテキスト
// ! @returns 復元されたメモテキスト
export function markAsRestored(memoText: string): string {
	// ! memo-idヘッダーから削除フラグを削除。
	const restored = memoText.replace(/, deleted: "true", trashedAt: "[^"]*"/, "")

	// ! コメントアウトされたコンテンツを展開。
	const lines = restored.split("\n")
	const headerLine = lines[0]
	const contentLines = lines.slice(1)

	let content = contentLines.join("\n").trim()
	if (content.startsWith("<!--") && content.endsWith("-->")) {
		content = content.slice(4, -3).trim()
	}

	return headerLine + "\n" + content + "\n"
}

// ! メモリストから削除されたメモのみを抽出する。
// ! @param memoTexts メモテキストの配列
// ! @returns 削除されたメモテキストの配列
export function getDeletedMemos(memoTexts: string[]): string[] {
	return memoTexts.filter(text => isDeletedMemo(text))
}

// ! メモリストから削除されていないメモのみを抽出する。
// ! @param memoTexts メモテキストの配列
// ! @returns 削除されていないメモテキストの配列
export function getActiveMemos(memoTexts: string[]): string[] {
	return memoTexts.filter(text => !isDeletedMemo(text))
}

// ! メモリスト内の指定されたメモを削除状態にする。
// ! @param memoTexts メモテキストの配列
// ! @param memoId 削除対象のメモID
// ! @param trashedAt ゴミ箱に移動した日時
// ! @returns 更新後のメモテキスト配列と削除されたかどうか
export function markMemoAsDeleted(
	memoTexts: string[],
	memoId: string,
	trashedAt: string,
): { memos: string[]; marked: boolean } {
	let marked = false

	const updatedMemos = memoTexts.map(memoText => {
		if (memoText.includes(`memo-id: ${memoId}`)) {
			marked = true
			return markAsDeleted(memoText, trashedAt)
		}
		return memoText
	})

	return { memos: updatedMemos, marked }
}

// ! メモリスト内の指定されたメモを復元状態にする。
// ! @param memoTexts メモテキストの配列
// ! @param memoId 復元対象のメモID
// ! @returns 更新後のメモテキスト配列と復元されたかどうか
export function markMemoAsRestored(
	memoTexts: string[],
	memoId: string,
): { memos: string[]; restored: boolean } {
	let restored = false

	const updatedMemos = memoTexts.map(memoText => {
		if (memoText.includes(`memo-id: ${memoId}`) && isDeletedMemo(memoText)) {
			restored = true
			return markAsRestored(memoText)
		}
		return memoText
	})

	return { memos: updatedMemos, restored }
}

// ! 保持期間を過ぎたメモを完全削除する。
// ! @param memoTexts メモテキストの配列
// ! @param retentionDays 保持期間（日数）
// ! @param currentDate 現在日時（ISO 8601形式、省略時は現在時刻）
// ! @returns 完全削除後のメモテキスト配列と削除された件数
export function cleanupExpiredMemos(
	memoTexts: string[],
	retentionDays: number,
	currentDate?: string,
): { memos: string[]; deletedCount: number } {
	const now = currentDate ? new Date(currentDate) : new Date()
	const retentionMs = retentionDays * 24 * 60 * 60 * 1000

	let deletedCount = 0

	const filteredMemos = memoTexts.filter(memoText => {
		if (!isDeletedMemo(memoText)) {
			return true // ! 削除されていないメモは保持。
		}

		// ! trashedAtを抽出。
		const trashedAtMatch = memoText.match(/trashedAt: "([^"]+)"/)
		if (!trashedAtMatch) {
			return true // ! trashedAtがない場合は保持（不正データ）。
		}

		const trashedAt = new Date(trashedAtMatch[1])
		const elapsedMs = now.getTime() - trashedAt.getTime()

		if (elapsedMs >= retentionMs) {
			deletedCount++
			return false // ! 保持期間を過ぎたメモは削除。
		}

		return true // ! まだ保持期間内のメモは保持。
	})

	return { memos: filteredMemos, deletedCount }
}

// ! メモIDで削除されたメモを検索する。
// ! @param memoTexts メモテキストの配列
// ! @param memoId 検索するメモID
// ! @returns 見つかったメモテキストのインデックス、見つからない場合は-1
export function findDeletedMemoIndexById(memoTexts: string[], memoId: string): number {
	return memoTexts.findIndex(
		text => text.includes(`memo-id: ${memoId}`) && isDeletedMemo(text),
	)
}

// ! 削除マーカーを作成する（ゴミ箱OFF時に返信がある投稿を削除する場合）。
// ! v0.0.16で追加。
// ! @param memo 削除するメモ
// ! @returns 削除マーカーのテキスト
export function createDeletionMarker(memo: MemoEntry): string {
	const categoryEncoded = memo.category ? `, category: ${JSON.stringify(memo.category)}` : ""
	const parentIdEncoded = memo.parentId ? `, parent-id: ${memo.parentId}` : ""
	return `<!-- memo-id: ${memo.id}, timestamp: ${memo.timestamp}${categoryEncoded}${parentIdEncoded}, permanently-deleted: "true" -->\n[削除済み]\n`
}

// ! メモリスト内の指定されたメモを削除マーカーに置き換える。
// ! v0.0.16で追加。
// ! @param memoTexts メモテキストの配列
// ! @param memoId 削除マーカーに置き換えるメモのID
// ! @param memo 削除マーカーの元になるメモエントリ
// ! @returns 更新後のメモテキスト配列と置き換えられたかどうか
export function replaceMemoWithDeletionMarker(
	memoTexts: string[],
	memoId: string,
	memo: MemoEntry,
): { memos: string[]; replaced: boolean } {
	let replaced = false

	const updatedMemos = memoTexts.map(memoText => {
		if (memoText.includes(`memo-id: ${memoId}`)) {
			replaced = true
			return createDeletionMarker(memo)
		}
		return memoText
	})

	return { memos: updatedMemos, replaced }
}
