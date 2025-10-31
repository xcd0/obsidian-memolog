import { App } from "obsidian";
import { MemoEntry, SortOrder, SaveUnit } from "../types";
import { MemologVaultHandler } from "../fs/vault-handler";
import { CacheManager } from "./cache-manager";
import { getErrorHandler, FileIOError } from "./error-handler";
import { notify } from "../utils/notification-manager";
import { memoToText, parseTextToMemo } from "./memo-helpers";
import {
	createMemoEntry,
	insertMemoIntoList,
	splitFileIntoMemos,
	generateCacheKey,
	removeMemoFromList,
	updateMemoInList,
	joinMemosToFileContent,
	toLocalISOString,
} from "./memo-crud-operations";
import { markMemoAsDeleted, markMemoAsRestored } from "./memo-trash-operations";
import {
	findDeletedMemoInFiles,
	extractCategoryFromMemo,
	filterMemologFiles,
	findMemoIndexById,
} from "./memo-search-operations";

//! メモを管理するクラス。
export class MemoManager {
	//! VaultHandlerインスタンス（publicアクセス可能）。
	public vaultHandler: MemologVaultHandler;

	//! CacheManagerインスタンス。
	private cacheManager: CacheManager;

	//! ErrorHandlerインスタンス。
	private errorHandler = getErrorHandler();

	constructor(app: App) {
		this.vaultHandler = new MemologVaultHandler(app);
		this.cacheManager = new CacheManager(app);
	}

	//! メモを追加する。
	async addMemo(
		filePath: string,
		category: string,
		content: string,
		order: SortOrder = "asc",
		template?: string,
		attachments?: string[],
		existingId?: string,
		existingTimestamp?: string,
		useTodoList = false
	): Promise<MemoEntry> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! メモエントリを作成。
				const memo = createMemoEntry(
					category,
					content,
					existingId,
					existingTimestamp,
					attachments,
					template
				);

				//! メモをテキスト形式に変換。
				const memoText = memoToText(memo, template, useTodoList);

				//! ファイルが存在しない場合は空として扱う。
				const fileExists = this.vaultHandler.fileExists(filePath);
				let fileContent = "";
				if (fileExists) {
					fileContent = await this.vaultHandler.readFile(filePath);
				}

				//! 既存のメモを分割。
				const existingMemos = splitFileIntoMemos(fileContent);

				//! 挿入位置を決定（昇順: bottom、降順: top）。
				const insertAtTop = order === "desc";
				const newContent = insertMemoIntoList(memoText, existingMemos, insertAtTop);

				//! ファイル全体を書き込む。
				await this.vaultHandler.writeFile(filePath, newContent);

				//! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category);
				this.cacheManager.invalidateMemos(cacheKey);

				notify.success("メモを追加しました");
				return memo;
			})(),
			{ filePath, category, context: "MemoManager.addMemo" }
		);

		if (!result.success || !result.data) {
			throw new FileIOError("メモの追加に失敗しました", {
				filePath,
				category,
			});
		}

		return result.data;
	}

	//! メモをゴミ箱に移動する（削除フラグを追加してコメントアウト）。
	async moveToTrash(
		filePath: string,
		category: string,
		memoId: string,
		rootDirectory: string
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					notify.warning("ファイルが見つかりません");
					return false;
				}

				//! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath);

				//! メモを分割してゴミ箱操作で削除状態にする。
				const memos = splitFileIntoMemos(fileContent);
				const trashedAt = toLocalISOString();
				const { memos: updatedMemos, marked } = markMemoAsDeleted(memos, memoId, trashedAt);

				if (!marked) {
					notify.warning("削除対象のメモが見つかりません");
					return false;
				}

				//! ファイルを更新。
				const newContent = joinMemosToFileContent(updatedMemos);
				await this.vaultHandler.writeFile(filePath, newContent);

				//! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category);
				this.cacheManager.invalidateMemos(cacheKey);

				notify.success("メモをゴミ箱に移動しました");
				return true;
			})(),
			{ filePath, category, memoId, rootDirectory, context: "MemoManager.moveToTrash" }
		);

		return result.success && result.data ? result.data : false;
	}

	//! ゴミ箱からメモを復活させる。
	async restoreFromTrash(
		memoId: string,
		rootDirectory: string,
		pathFormat: string,
		saveUnit: SaveUnit,
		useDirectoryCategory: boolean
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! 全カテゴリのファイルから対象メモを検索。
				const allFiles = this.vaultHandler.getMarkdownFiles();
				const fileContents = new Map<string, string>();

				//! ファイル内容を読み込んでMapに格納。
				for (const file of allFiles) {
					const content = await this.vaultHandler.readFile(file.path);
					fileContents.set(file.path, content);
				}

				//! memolog配下のファイルのみをフィルタリング。
				const memologFileContents = filterMemologFiles(fileContents, rootDirectory);

				//! 削除されたメモを検索。
				const searchResult = findDeletedMemoInFiles(memologFileContents, memoId);

				if (!searchResult) {
					notify.warning("復活対象のメモが見つかりません");
					return false;
				}

				const { filePath: targetFilePath, memoIndex: targetMemoIndex, allMemos } = searchResult;

				//! ゴミ箱操作で復元する。
				const { memos: updatedMemos, restored } = markMemoAsRestored(allMemos, memoId);

				if (!restored) {
					notify.warning("メモの復元に失敗しました");
					return false;
				}

				//! ファイルに書き込み。
				const newContent = joinMemosToFileContent(updatedMemos);
				await this.vaultHandler.writeFile(targetFilePath, newContent);

				//! categoryを抽出してキャッシュを無効化。
				const restoredMemo = updatedMemos[targetMemoIndex];
				const category = extractCategoryFromMemo(restoredMemo);
				if (category) {
					const cacheKey = generateCacheKey(targetFilePath, category);
					this.cacheManager.invalidateMemos(cacheKey);
				}

				notify.success("メモを復活しました");
				return true;
			})(),
			{ memoId, rootDirectory, pathFormat, saveUnit, useDirectoryCategory, context: "MemoManager.restoreFromTrash" }
		);

		return result.success && result.data ? result.data : false;
	}

	//! メモを削除する（IDで検索して削除）。
	async deleteMemo(filePath: string, category: string, memoId: string): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					notify.warning("ファイルが見つかりません");
					return false;
				}

				//! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath);

				//! メモを分割してCRUD操作で削除。
				const memos = splitFileIntoMemos(fileContent);
				const { memos: filtered, removed } = removeMemoFromList(memos, memoId);

				if (!removed) {
					//! 削除対象が見つからなかった。
					notify.warning("削除対象のメモが見つかりません");
					return false;
				}

				//! ファイル全体を書き込む。
				const newContent = joinMemosToFileContent(filtered);
				await this.vaultHandler.writeFile(filePath, newContent);

				//! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category);
				this.cacheManager.invalidateMemos(cacheKey);

				notify.success("メモを削除しました");
				return true;
			})(),
			{ filePath, category, memoId, context: "MemoManager.deleteMemo" }
		);

		return result.success && result.data ? result.data : false;
	}

	//! カテゴリ内の全メモを取得する。
	async getMemos(filePath: string, category: string): Promise<MemoEntry[]> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! キャッシュキーを生成（ファイルパス + カテゴリ）。
				const cacheKey = generateCacheKey(filePath, category);

				//! キャッシュをチェック。
				const cachedMemos = await this.cacheManager.getMemos(cacheKey);
				if (cachedMemos) {
					return cachedMemos;
				}

				//! ファイルが存在しない場合は空配列を返す。
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					return [];
				}

				//! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath);
				if (!fileContent) {
					return [];
				}

				//! メモを分割（HTMLコメント <!-- memo-id: で分割）。
				const memoTexts = splitFileIntoMemos(fileContent);

				//! メモエントリに変換（categoryでフィルタリング）。
				const memos: MemoEntry[] = [];
				for (const text of memoTexts) {
					const memo = parseTextToMemo(text, category);
					//! categoryが空文字の場合はフィルタリングしない（全メモを取得）。
					if (memo && (!category || memo.category === category)) {
						memos.push(memo);
					}
				}

				//! キャッシュに保存。
				await this.cacheManager.setMemos(cacheKey, memos);

				return memos;
			})(),
			{ filePath, category, context: "MemoManager.getMemos" }
		);

		return result.success && result.data ? result.data : [];
	}

	//! 特定のメモを取得する。
	async getMemoById(filePath: string, category: string, memoId: string): Promise<MemoEntry | null> {
		const memos = await this.getMemos(filePath, category);
		return memos.find((m) => m.id === memoId) || null;
	}

	//! メモを更新する（IDで検索して内容を置き換え）。
	async updateMemo(
		filePath: string,
		category: string,
		memoId: string,
		newContent: string,
		template?: string,
		useTodoList = false
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					notify.warning("ファイルが見つかりません");
					return false;
				}

				//! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath);

				//! メモを分割してCRUD操作で更新。
				const memoTexts = splitFileIntoMemos(fileContent);

				//! 対象メモを検索してインデックスを取得。
				const memoIndex = findMemoIndexById(memoTexts, memoId);
				if (memoIndex === -1) {
					notify.warning("更新対象のメモが見つかりません");
					return false;
				}

				//! 対象メモを解析して内容を更新。
				const memo = parseTextToMemo(memoTexts[memoIndex], category);
				if (!memo) {
					notify.warning("メモの解析に失敗しました");
					return false;
				}
				memo.content = newContent;

				//! 新しいテキストに変換してCRUD操作で更新。
				const newMemoText = memoToText(memo, template, useTodoList);
				const { memos: updatedMemos, updated } = updateMemoInList(memoTexts, memoId, newMemoText);

				if (!updated) {
					notify.warning("メモの更新に失敗しました");
					return false;
				}

				//! ファイル全体を書き込む。
				const newFileContent = joinMemosToFileContent(updatedMemos);
				await this.vaultHandler.writeFile(filePath, newFileContent);

				//! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category);
				this.cacheManager.invalidateMemos(cacheKey);

				notify.success("メモを更新しました");
				return true;
			})(),
			{ filePath, category, memoId, context: "MemoManager.updateMemo" }
		);

		return result.success && result.data ? result.data : false;
	}

	//! TODO完了状態を更新する。
	async updateTodoCompleted(
		filePath: string,
		category: string,
		memoId: string,
		completed: boolean
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					return false;
				}

				const fileContent = await this.vaultHandler.readFile(filePath);
				const memoTexts = splitFileIntoMemos(fileContent);
				let updated = false;

				const newMemoTexts = memoTexts.map((memoText) => {
					if (memoText.includes(`memo-id: ${memoId}`)) {
						updated = true;
						let newText: string;
						//! チェックボックスを切り替え。
						if (completed) {
							//! - [ ] を - [x] に置換。
							//! HTMLコメントの後の改行も考慮して、行頭または改行直後のチェックボックスを探す。
							newText = memoText.replace(/(^|\n)-\s*\[\s?\]\s+/m, "$1- [x] ");
						} else {
							//! - [x] を - [ ] に置換。
							newText = memoText.replace(/(^|\n)-\s*\[x\]\s+/m, "$1- [ ] ");
						}

						return newText;
					}
					return memoText;
				});

				if (!updated) {
					return false;
				}

				const newFileContent = joinMemosToFileContent(newMemoTexts);
				await this.vaultHandler.writeFile(filePath, newFileContent);

				const cacheKey = generateCacheKey(filePath, category);
				this.cacheManager.invalidateMemos(cacheKey);

				return true;
			})(),
			{ filePath, category, memoId, context: "MemoManager.updateTodoCompleted" }
		);

		return result.success && result.data ? result.data : false;
	}

	//! カテゴリ領域を初期化する。
	async initializeCategory(
		filePath: string,
		category: string,
		order: SortOrder = "asc"
	): Promise<void> {
		await this.vaultHandler.initializeTagPair(filePath, category, { order });
	}
}
