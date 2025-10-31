import { MemoEntry } from "../types/memo";
import { v7 as uuidv7 } from "uuid";

//! メモCRUD操作の純粋関数群。
//! I/O操作を含まず、ビジネスロジックのみを提供する。

//! ローカルタイムゾーンオフセット付きのISO 8601形式の日時文字列を生成する。
//! @param date 変換するDateオブジェクト(省略時は現在時刻)
//! @returns ISO 8601形式の文字列 (例: "2025-10-31T14:30:00.000+09:00")
export function toLocalISOString(date: Date = new Date()): string {
	//! タイムゾーンオフセットを取得 (分単位)。
	//! getTimezoneOffset()は「UTC-ローカル」なので、符号を反転する。
	const offsetMinutes = -date.getTimezoneOffset();
	const offsetHours = Math.floor(offsetMinutes / 60);
	const offsetMins = Math.abs(offsetMinutes % 60);

	//! オフセット文字列を作成 (+09:00 形式)。
	const offsetStr = `${offsetHours >= 0 ? "+" : ""}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;

	//! ローカル時刻の各要素を取得。
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	const milliseconds = String(date.getMilliseconds()).padStart(3, "0");

	//! ISO 8601形式で組み立て。
	return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${offsetStr}`;
}

//! 新しいメモエントリを作成する。
export function createMemoEntry(
	category: string,
	content: string,
	existingId?: string,
	existingTimestamp?: string,
	attachments?: string[],
	template?: string
): MemoEntry {
	return {
		id: existingId || uuidv7(),
		category,
		timestamp: existingTimestamp || toLocalISOString(),
		content,
		attachments,
		template,
	};
}

//! 既存のメモリストに新しいメモを挿入する。
//! @param memoText 新しいメモのテキスト
//! @param existingMemos 既存のメモテキストの配列
//! @param insertAtTop trueの場合は先頭に、falseの場合は末尾に追加
//! @returns 結合されたメモテキスト
export function insertMemoIntoList(
	memoText: string,
	existingMemos: string[],
	insertAtTop: boolean
): string {
	if (insertAtTop) {
		return [memoText, ...existingMemos].join("");
	} else {
		return [...existingMemos, memoText].join("");
	}
}

//! ファイル内容からメモテキストのリストに分割する。
//! @param fileContent ファイルの内容
//! @returns メモテキストの配列
export function splitFileIntoMemos(fileContent: string): string[] {
	if (!fileContent || !fileContent.trim()) {
		return [];
	}
	return fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());
}

//! メモIDでメモを検索する。
//! @param memoTexts メモテキストの配列
//! @param memoId 検索するメモID
//! @returns 見つかったメモテキストのインデックス、見つからない場合は-1
export function findMemoIndexById(memoTexts: string[], memoId: string): number {
	return memoTexts.findIndex((text) => text.includes(`memo-id: ${memoId}`));
}

//! メモリストから指定されたメモを削除する。
//! @param memoTexts メモテキストの配列
//! @param memoId 削除するメモID
//! @returns 削除後のメモテキスト配列と削除されたかどうか
export function removeMemoFromList(
	memoTexts: string[],
	memoId: string
): { memos: string[]; removed: boolean } {
	const index = findMemoIndexById(memoTexts, memoId);

	if (index === -1) {
		return { memos: memoTexts, removed: false };
	}

	const newMemos = [...memoTexts];
	newMemos.splice(index, 1);

	return { memos: newMemos, removed: true };
}

//! メモリスト内の指定されたメモを更新する。
//! @param memoTexts メモテキストの配列
//! @param memoId 更新するメモID
//! @param newMemoText 新しいメモテキスト
//! @returns 更新後のメモテキスト配列と更新されたかどうか
export function updateMemoInList(
	memoTexts: string[],
	memoId: string,
	newMemoText: string
): { memos: string[]; updated: boolean } {
	const index = findMemoIndexById(memoTexts, memoId);

	if (index === -1) {
		return { memos: memoTexts, updated: false };
	}

	const newMemos = [...memoTexts];
	newMemos[index] = newMemoText;

	return { memos: newMemos, updated: true };
}

//! メモテキストの配列をファイル内容に結合する。
//! @param memoTexts メモテキストの配列
//! @returns 結合されたファイル内容
export function joinMemosToFileContent(memoTexts: string[]): string {
	return memoTexts.join("");
}

//! キャッシュキーを生成する。
//! @param filePath ファイルパス
//! @param category カテゴリ
//! @returns キャッシュキー
export function generateCacheKey(filePath: string, category: string): string {
	return `${filePath}::${category}`;
}
