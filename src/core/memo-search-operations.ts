import { splitFileIntoMemos } from "./memo-crud-operations";

//! メモ検索操作の純粋関数群。
//! I/O操作を含まず、メモ検索ロジックのみを提供する。

//! ファイルリストから指定されたメモIDを含むファイルとインデックスを検索する。
//! @param fileContents ファイルパスとコンテンツのマップ
//! @param memoId 検索するメモID
//! @returns 見つかった場合は { filePath, memoIndex, allMemos }、見つからない場合はnull
export function findMemoInFiles(
	fileContents: Map<string, string>,
	memoId: string
): { filePath: string; memoIndex: number; allMemos: string[] } | null {
	for (const [filePath, content] of fileContents) {
		const memos = splitFileIntoMemos(content);

		for (let i = 0; i < memos.length; i++) {
			if (memos[i].includes(`memo-id: ${memoId}`)) {
				return {
					filePath,
					memoIndex: i,
					allMemos: memos,
				};
			}
		}
	}

	return null;
}

//! ファイルリストから削除フラグ付きの指定メモIDを検索する。
//! @param fileContents ファイルパスとコンテンツのマップ
//! @param memoId 検索するメモID
//! @returns 見つかった場合は { filePath, memoIndex, allMemos }、見つからない場合はnull
export function findDeletedMemoInFiles(
	fileContents: Map<string, string>,
	memoId: string
): { filePath: string; memoIndex: number; allMemos: string[] } | null {
	for (const [filePath, content] of fileContents) {
		const memos = splitFileIntoMemos(content);

		for (let i = 0; i < memos.length; i++) {
			if (memos[i].includes(`memo-id: ${memoId}`) && memos[i].includes('deleted: "true"')) {
				return {
					filePath,
					memoIndex: i,
					allMemos: memos,
				};
			}
		}
	}

	return null;
}

//! メモテキストからカテゴリ名を抽出する。
//! @param memoText メモのテキスト
//! @returns カテゴリ名、見つからない場合はnull
export function extractCategoryFromMemo(memoText: string): string | null {
	const categoryMatch = memoText.match(/category: "([^"]+)"/);
	return categoryMatch ? categoryMatch[1] : null;
}

//! メモテキストからメモIDを抽出する。
//! @param memoText メモのテキスト
//! @returns メモID、見つからない場合はnull
export function extractMemoIdFromText(memoText: string): string | null {
	const idMatch = memoText.match(/memo-id: ([^,\s]+)/);
	return idMatch ? idMatch[1].trim() : null;
}

//! 複数のメモテキストから特定のメモIDのインデックスを検索する。
//! @param memos メモテキストの配列
//! @param memoId 検索するメモID
//! @returns インデックス、見つからない場合は-1
export function findMemoIndexById(memos: string[], memoId: string): number {
	return memos.findIndex((text) => text.includes(`memo-id: ${memoId}`));
}

//! メモテキストがピン留めされているか判定する。
//! @param memoText メモのテキスト
//! @returns ピン留めされている場合はtrue
export function isMemoPinned(memoText: string): boolean {
	return /pinnedAt: "/.test(memoText);
}

//! メモテキストが削除されているか判定する。
//! @param memoText メモのテキスト
//! @returns 削除されている場合はtrue
export function isMemoDeleted(memoText: string): boolean {
	return memoText.includes('deleted: "true"');
}

//! ファイルコンテンツマップからmemolog配下のファイルのみをフィルタリングする。
//! @param fileContents ファイルパスとコンテンツのマップ
//! @param rootDirectory memologのルートディレクトリ
//! @returns フィルタリングされたマップ
export function filterMemologFiles(
	fileContents: Map<string, string>,
	rootDirectory: string
): Map<string, string> {
	const filtered = new Map<string, string>();
	const prefix = rootDirectory + "/";

	for (const [filePath, content] of fileContents) {
		if (filePath.startsWith(prefix)) {
			filtered.set(filePath, content);
		}
	}

	return filtered;
}

//! メモリストから指定されたメモIDを持つメモテキストを検索する。
//! @param memos メモテキストの配列
//! @param memoId 検索するメモID
//! @returns 見つかったメモテキスト、見つからない場合はnull
export function findMemoTextById(memos: string[], memoId: string): string | null {
	const memo = memos.find((text) => text.includes(`memo-id: ${memoId}`));
	return memo || null;
}

//! メモテキストのリストから削除されていないメモのみを抽出する。
//! @param memos メモテキストの配列
//! @returns 削除されていないメモテキストの配列
export function filterActiveMemos(memos: string[]): string[] {
	return memos.filter((text) => !isMemoDeleted(text));
}

//! メモテキストのリストから削除されたメモのみを抽出する。
//! @param memos メモテキストの配列
//! @returns 削除されたメモテキストの配列
export function filterDeletedMemos(memos: string[]): string[] {
	return memos.filter((text) => isMemoDeleted(text));
}

//! メモテキストのリストからピン留めされたメモのみを抽出する。
//! @param memos メモテキストの配列
//! @returns ピン留めされたメモテキストの配列
export function filterPinnedMemos(memos: string[]): string[] {
	return memos.filter((text) => isMemoPinned(text));
}
