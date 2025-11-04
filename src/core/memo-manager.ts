import { App } from "obsidian"
import { MemologVaultHandler } from "../fs/vault-handler"
import { MemoEntry, SaveUnit, SortOrder, ThreadIndex, ThreadTree } from "../types"
import { notify } from "../utils/notification-manager"
import { CacheManager } from "./cache-manager"
import { FileIOError, getErrorHandler } from "./error-handler"
import {
	createMemoEntry,
	generateCacheKey,
	insertMemoIntoList,
	joinMemosToFileContent,
	removeMemoFromList,
	sortMemosByTimestamp,
	splitFileIntoMemos,
	toLocalISOString,
	updateMemoInList,
} from "./memo-crud-operations"
import { memoToText, parseTextToMemo } from "./memo-helpers"
import {
	extractCategoryFromMemo,
	filterMemologFiles,
	findDeletedMemoInFiles,
	findMemoIndexById,
} from "./memo-search-operations"
import { markMemoAsDeleted, markMemoAsRestored } from "./memo-trash-operations"
import { ThreadIndexManager } from "./thread-operations"

// ! メモを管理するクラス。
export class MemoManager {
	// ! VaultHandlerインスタンス（publicアクセス可能）。
	public vaultHandler: MemologVaultHandler

	// ! CacheManagerインスタンス。
	private cacheManager: CacheManager

	// ! ThreadIndexManagerインスタンス（publicアクセス可能）。
	public threadIndexManager: ThreadIndexManager

	// ! ErrorHandlerインスタンス。
	private errorHandler = getErrorHandler()

	constructor(app: App) {
		this.vaultHandler = new MemologVaultHandler(app)
		this.cacheManager = new CacheManager(app)
		this.threadIndexManager = new ThreadIndexManager()
	}

	// ! メモを追加する。
	async addMemo(
		filePath: string,
		category: string,
		content: string,
		_order: SortOrder = "asc", // ! 互換性のため残すが、ファイル内は常に古い順にソート。
		template?: string,
		attachments?: string[],
		existingId?: string,
		existingTimestamp?: string,
		useTodoList = false,
	): Promise<MemoEntry> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! メモエントリを作成。
				const memo = createMemoEntry(
					category,
					content,
					existingId,
					existingTimestamp,
					attachments,
					template,
				)

				// ! メモをテキスト形式に変換。
				const memoText = memoToText(memo, template, useTodoList)

				// ! ファイルが存在しない場合は空として扱う。
				const fileExists = this.vaultHandler.fileExists(filePath)
				let fileContent = ""
				if (fileExists) {
					fileContent = await this.vaultHandler.readFile(filePath)
				}

				// ! 既存のメモを分割。
				const existingMemos = splitFileIntoMemos(fileContent)

				// ! 常にファイル末尾に追加（ファイル内は常に古い順=タイムスタンプ昇順）。
				const allMemos = insertMemoIntoList(memoText, existingMemos, false)

				// ! タイムスタンプ順にソート。
				const memoTexts = splitFileIntoMemos(allMemos)
				const sortedMemos = sortMemosByTimestamp(memoTexts)
				const newContent = joinMemosToFileContent(sortedMemos)

				// ! ファイル全体を書き込む。
				await this.vaultHandler.writeFile(filePath, newContent)

				// ! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category)
				this.cacheManager.invalidateMemos(cacheKey)

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				notify.success("メモを追加しました")
				return memo
			})(),
			{ filePath, category, context: "MemoManager.addMemo" },
		)

		if (!result.success || !result.data) {
			throw new FileIOError("メモの追加に失敗しました", {
				filePath,
				category,
			})
		}

		return result.data
	}

	// ! メモをゴミ箱に移動する（削除フラグを追加してコメントアウト）。
	async moveToTrash(
		filePath: string,
		category: string,
		memoId: string,
		rootDirectory: string,
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath)
				if (!fileExists) {
					notify.warning("ファイルが見つかりません")
					return false
				}

				// ! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath)

				// ! メモを分割してゴミ箱操作で削除状態にする。
				const memos = splitFileIntoMemos(fileContent)
				const trashedAt = toLocalISOString()
				const { memos: updatedMemos, marked } = markMemoAsDeleted(memos, memoId, trashedAt)

				if (!marked) {
					notify.warning("削除対象のメモが見つかりません")
					return false
				}

				// ! タイムスタンプ順にソート。
				const sortedMemos = sortMemosByTimestamp(updatedMemos)

				// ! ファイルを更新。
				const newContent = joinMemosToFileContent(sortedMemos)
				await this.vaultHandler.writeFile(filePath, newContent)

				// ! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category)
				this.cacheManager.invalidateMemos(cacheKey)

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				notify.success("メモをゴミ箱に移動しました")
				return true
			})(),
			{ filePath, category, memoId, rootDirectory, context: "MemoManager.moveToTrash" },
		)

		return result.success && result.data ? result.data : false
	}

	// ! ゴミ箱からメモを復活させる。
	async restoreFromTrash(
		memoId: string,
		rootDirectory: string,
		pathFormat: string,
		saveUnit: SaveUnit,
		useDirectoryCategory: boolean,
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! 全カテゴリのファイルから対象メモを検索。
				const allFiles = this.vaultHandler.getMarkdownFiles()
				const fileContents = new Map<string, string>()

				// ! ファイル内容を読み込んでMapに格納。
				for (const file of allFiles) {
					const content = await this.vaultHandler.readFile(file.path)
					fileContents.set(file.path, content)
				}

				// ! memolog配下のファイルのみをフィルタリング。
				const memologFileContents = filterMemologFiles(fileContents, rootDirectory)

				// ! 削除されたメモを検索。
				const searchResult = findDeletedMemoInFiles(memologFileContents, memoId)

				if (!searchResult) {
					notify.warning("復活対象のメモが見つかりません")
					return false
				}

				const { filePath: targetFilePath, memoIndex: targetMemoIndex, allMemos } = searchResult

				// ! ゴミ箱操作で復元する。
				const { memos: updatedMemos, restored } = markMemoAsRestored(allMemos, memoId)

				if (!restored) {
					notify.warning("メモの復元に失敗しました")
					return false
				}

				// ! タイムスタンプ順にソート。
				const sortedMemos = sortMemosByTimestamp(updatedMemos)

				// ! ファイルに書き込み。
				const newContent = joinMemosToFileContent(sortedMemos)
				await this.vaultHandler.writeFile(targetFilePath, newContent)

				// ! categoryを抽出してキャッシュを無効化。
				const restoredMemo = updatedMemos[targetMemoIndex]
				const category = extractCategoryFromMemo(restoredMemo)
				if (category) {
					const cacheKey = generateCacheKey(targetFilePath, category)
					this.cacheManager.invalidateMemos(cacheKey)
				}

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				notify.success("メモを復活しました")
				return true
			})(),
			{ memoId, rootDirectory, pathFormat, saveUnit, useDirectoryCategory, context: "MemoManager.restoreFromTrash" },
		)

		return result.success && result.data ? result.data : false
	}

	// ! メモを削除する（IDで検索して削除）。
	async deleteMemo(filePath: string, category: string, memoId: string): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath)
				if (!fileExists) {
					notify.warning("ファイルが見つかりません")
					return false
				}

				// ! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath)

				// ! メモを分割してCRUD操作で削除。
				const memos = splitFileIntoMemos(fileContent)
				const { memos: filtered, removed } = removeMemoFromList(memos, memoId)

				if (!removed) {
					// ! 削除対象が見つからなかった。
					notify.warning("削除対象のメモが見つかりません")
					return false
				}

				// ! タイムスタンプ順にソート。
				const sortedFiltered = sortMemosByTimestamp(filtered)

				// ! ファイル全体を書き込む。
				const newContent = joinMemosToFileContent(sortedFiltered)
				await this.vaultHandler.writeFile(filePath, newContent)

				// ! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category)
				this.cacheManager.invalidateMemos(cacheKey)

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				notify.success("メモを削除しました")
				return true
			})(),
			{ filePath, category, memoId, context: "MemoManager.deleteMemo" },
		)

		return result.success && result.data ? result.data : false
	}

	// ! カテゴリ内の全メモを取得する。
	async getMemos(filePath: string, category: string): Promise<MemoEntry[]> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! キャッシュキーを生成（ファイルパス + カテゴリ）。
				const cacheKey = generateCacheKey(filePath, category)

				// ! キャッシュをチェック。
				const cachedMemos = await this.cacheManager.getMemos(cacheKey)
				if (cachedMemos) {
					return cachedMemos
				}

				// ! ファイルが存在しない場合は空配列を返す。
				const fileExists = this.vaultHandler.fileExists(filePath)
				if (!fileExists) {
					return []
				}

				// ! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath)
				if (!fileContent) {
					return []
				}

				// ! メモを分割（HTMLコメント <!-- memo-id: で分割）。
				const memoTexts = splitFileIntoMemos(fileContent)

				// ! メモエントリに変換（categoryでフィルタリング）。
				const memos: MemoEntry[] = []
				for (const text of memoTexts) {
					const memo = parseTextToMemo(text, category, filePath)
					// ! categoryが空文字の場合はフィルタリングしない（全メモを取得）。
					if (memo && (!category || memo.category === category)) {
						memos.push(memo)
					}
				}

				// ! キャッシュに保存。
				await this.cacheManager.setMemos(cacheKey, memos)

				return memos
			})(),
			{ filePath, category, context: "MemoManager.getMemos" },
		)

		return result.success && result.data ? result.data : []
	}

	// ! 特定のメモを取得する。
	async getMemoById(filePath: string, category: string, memoId: string): Promise<MemoEntry | null> {
		const memos = await this.getMemos(filePath, category)
		return memos.find(m => m.id === memoId) || null
	}

	// ! メモを更新する（IDで検索して内容を置き換え）。
	async updateMemo(
		filePath: string,
		category: string,
		memoId: string,
		newContent: string,
		template?: string,
		useTodoList = false,
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath)
				if (!fileExists) {
					notify.warning("ファイルが見つかりません")
					return false
				}

				// ! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath)

				// ! メモを分割してCRUD操作で更新。
				const memoTexts = splitFileIntoMemos(fileContent)

				// ! 対象メモを検索してインデックスを取得。
				const memoIndex = findMemoIndexById(memoTexts, memoId)
				if (memoIndex === -1) {
					notify.warning("更新対象のメモが見つかりません")
					return false
				}

				// ! 対象メモを解析して内容を更新。
				const memo = parseTextToMemo(memoTexts[memoIndex], category, filePath)
				if (!memo) {
					notify.warning("メモの解析に失敗しました")
					return false
				}
				memo.content = newContent

				// ! 新しいテキストに変換してCRUD操作で更新。
				const newMemoText = memoToText(memo, template, useTodoList)
				const { memos: updatedMemos, updated } = updateMemoInList(memoTexts, memoId, newMemoText)

				if (!updated) {
					notify.warning("メモの更新に失敗しました")
					return false
				}

				// ! タイムスタンプ順にソート。
				const sortedMemos = sortMemosByTimestamp(updatedMemos)

				// ! ファイル全体を書き込む。
				const newFileContent = joinMemosToFileContent(sortedMemos)
				await this.vaultHandler.writeFile(filePath, newFileContent)

				// ! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category)
				this.cacheManager.invalidateMemos(cacheKey)

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				notify.success("メモを更新しました")
				return true
			})(),
			{ filePath, category, memoId, context: "MemoManager.updateMemo" },
		)

		return result.success && result.data ? result.data : false
	}

	// ! TODO完了状態を更新する。
	async updateTodoCompleted(
		filePath: string,
		category: string,
		memoId: string,
		completed: boolean,
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				const fileExists = this.vaultHandler.fileExists(filePath)
				if (!fileExists) {
					return false
				}

				const fileContent = await this.vaultHandler.readFile(filePath)
				const memoTexts = splitFileIntoMemos(fileContent)
				let updated = false

				const newMemoTexts = memoTexts.map(memoText => {
					if (memoText.includes(`memo-id: ${memoId}`)) {
						updated = true
						let newText: string
						// ! チェックボックスを切り替え。
						if (completed) {
							// ! - [ ] を - [x] に置換。
							// ! HTMLコメントの後の改行も考慮して、行頭または改行直後のチェックボックスを探す。
							newText = memoText.replace(/(^|\n)-\s*\[\s?\]\s+/m, "$1- [x] ")
						} else {
							// ! - [x] を - [ ] に置換。
							newText = memoText.replace(/(^|\n)-\s*\[x\]\s+/m, "$1- [ ] ")
						}

						return newText
					}
					return memoText
				})

				if (!updated) {
					return false
				}

				// ! タイムスタンプ順にソート。
				const sortedMemoTexts = sortMemosByTimestamp(newMemoTexts)

				const newFileContent = joinMemosToFileContent(sortedMemoTexts)
				await this.vaultHandler.writeFile(filePath, newFileContent)

				const cacheKey = generateCacheKey(filePath, category)
				this.cacheManager.invalidateMemos(cacheKey)

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				return true
			})(),
			{ filePath, category, memoId, context: "MemoManager.updateTodoCompleted" },
		)

		return result.success && result.data ? result.data : false
	}

	// ! カテゴリ領域を初期化する。
	async initializeCategory(
		filePath: string,
		category: string,
		order: SortOrder = "asc",
	): Promise<void> {
		await this.vaultHandler.initializeTagPair(filePath, category, { order })
	}

	// ! スレッドインデックスを取得する。
	async getThreadIndex(filePath: string, category: string): Promise<ThreadIndex> {
		// ! ファイルからメモを読み込む。
		const fileContent = await this.vaultHandler.readFile(filePath)
		const memoTexts = splitFileIntoMemos(fileContent)
		const memos = memoTexts
			.map(text => parseTextToMemo(text, category, filePath))
			.filter((memo): memo is MemoEntry => memo !== null)
			.filter(memo => memo.category === category) // カテゴリでフィルタリング

		// ! ThreadIndexManagerを使ってインデックスを取得。
		return this.threadIndexManager.getIndex(memos)
	}

	// ! スレッドツリーを取得する。
	async getThreadTree(
		filePath: string,
		category: string,
		rootId: string,
	): Promise<ThreadTree> {
		const index = await this.getThreadIndex(filePath, category)
		const fileContent = await this.vaultHandler.readFile(filePath)
		const memoTexts = splitFileIntoMemos(fileContent)
		const memos = memoTexts
			.map(text => parseTextToMemo(text, category, filePath))
			.filter((memo): memo is MemoEntry => memo !== null)
			.filter(memo => memo.category === category) // カテゴリでフィルタリング

		const memoMap = new Map(memos.map(m => [m.id, m]))
		return this.threadIndexManager.getThreadTree(rootId, index, memoMap)
	}

	// ! 子メモIDリストを取得する。
	async getThreadChildren(
		filePath: string,
		category: string,
		parentId: string,
	): Promise<string[]> {
		const index = await this.getThreadIndex(filePath, category)
		return this.threadIndexManager.getChildren(parentId, index)
	}

	// ! 親メモIDを取得する。
	async getThreadParent(
		filePath: string,
		category: string,
		childId: string,
	): Promise<string | undefined> {
		const index = await this.getThreadIndex(filePath, category)
		return this.threadIndexManager.getParent(childId, index)
	}

	// ! メモの深さを取得する。
	async getThreadDepth(
		filePath: string,
		category: string,
		memoId: string,
	): Promise<number> {
		const index = await this.getThreadIndex(filePath, category)
		return this.threadIndexManager.getDepth(memoId, index)
	}

	// ! 子孫数を取得する。
	async getThreadDescendantCount(
		filePath: string,
		category: string,
		memoId: string,
	): Promise<number> {
		const index = await this.getThreadIndex(filePath, category)
		return this.threadIndexManager.getDescendantCount(memoId, index)
	}

	// ! 直接の子メモの数を取得する。
	async getDirectChildrenCount(
		filePath: string,
		category: string,
		memoId: string,
	): Promise<number> {
		const index = await this.getThreadIndex(filePath, category)
		const children = index.childrenMap.get(memoId) || []
		return children.length
	}

	// ! 返信メモを作成する。
	async addReply(
		filePath: string,
		category: string,
		parentId: string,
		content: string,
		_order: SortOrder = "asc", // ! 互換性のため残すが、ファイル内は常に古い順にソート。
		template?: string,
		attachments?: string[],
		useTodoList = false,
	): Promise<MemoEntry> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! ファイルを読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath)
				const memoTexts = splitFileIntoMemos(fileContent)

				// ! 親メモを検索。
				const parentMemo = memoTexts
					.map(text => parseTextToMemo(text, category, filePath))
					.filter((memo): memo is MemoEntry => memo !== null)
					.find(memo => memo.id === parentId)

				// ! 親メモが存在しない。
				if (!parentMemo) {
					throw new Error(`親メモが見つかりません: ${parentId}`)
				}

				// ! 親メモのカテゴリと一致しない。
				if (parentMemo.category !== category) {
					throw new Error(
						`親メモのカテゴリ(${parentMemo.category})と返信のカテゴリ(${category})が一致しません`,
					)
				}

				// ! 返信メモエントリを作成（parentIdを設定）。
				const memo = createMemoEntry(
					category,
					content,
					undefined,
					undefined,
					attachments,
					template,
				)
				memo.parentId = parentId

				// ! メモをテキスト形式に変換。
				const memoText = memoToText(memo, template, useTodoList)

				// ! 常にファイル末尾に追加（ファイル内は常に古い順=タイムスタンプ昇順）。
				const allMemos = insertMemoIntoList(memoText, memoTexts, false)

				// ! タイムスタンプ順にソート。
				const allMemoTexts = splitFileIntoMemos(allMemos)
				const sortedMemos = sortMemosByTimestamp(allMemoTexts)
				const newContent = joinMemosToFileContent(sortedMemos)

				// ! ファイル全体を書き込む。
				await this.vaultHandler.writeFile(filePath, newContent)

				// ! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category)
				this.cacheManager.invalidateMemos(cacheKey)

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				notify.success("返信を追加しました")
				return memo
			})(),
			{ filePath, category, parentId, context: "MemoManager.addReply" },
		)

		if (!result.success || !result.data) {
			throw new FileIOError("返信の追加に失敗しました", {
				filePath,
				category,
			})
		}

		return result.data
	}

	// ! メモを子孫と共に削除する（カスケード削除）。
	async deleteMemoWithDescendants(
		filePath: string,
		category: string,
		memoId: string,
		moveToTrash = false,
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! ファイルを読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath)
				const memoTexts = splitFileIntoMemos(fileContent)

				// ! メモをパース。
				const memos = memoTexts
					.map(text => parseTextToMemo(text, category, filePath))
					.filter((memo): memo is MemoEntry => memo !== null)
					.filter(memo => memo.category === category)

				// ! 削除対象のメモが存在するか確認。
				const targetMemo = memos.find(memo => memo.id === memoId)
				if (!targetMemo) {
					throw new Error(`削除対象のメモが見つかりません: ${memoId}`)
				}

				// ! スレッドインデックスを構築。
				const index = this.threadIndexManager.getIndex(memos)

				// ! 削除対象のメモとその子孫をすべて収集。
				const idsToDelete = new Set<string>([memoId])
				const queue: string[] = [memoId]
				let head = 0

				while (head < queue.length) {
					const currentId = queue[head++]
					const children = index.childrenMap.get(currentId) || []

					for (const childId of children) {
						idsToDelete.add(childId)
						queue.push(childId)
					}
				}

				if (moveToTrash) {
					// ! ゴミ箱に移動する場合は、すべての削除対象メモにtrashedAtフラグを付ける。
					const trashedAt = toLocalISOString()
					const updatedMemoTexts = memoTexts.map(text => {
						const memo = parseTextToMemo(text, category, filePath)
						if (!memo || !idsToDelete.has(memo.id)) {
							return text // 削除対象外のメモはそのまま
						}

						// ! 削除対象のメモにtrashedAtフラグを付ける。
						const { memos: updated } = markMemoAsDeleted([text], memo.id, trashedAt)
						return updated[0]
					})

					// ! ファイルを更新。
					// ! タイムスタンプ順にソート。
					const sortedMemoTexts1 = sortMemosByTimestamp(updatedMemoTexts)
					const newContent = joinMemosToFileContent(sortedMemoTexts1)
					await this.vaultHandler.writeFile(filePath, newContent)

					notify.success(`メモと子孫${idsToDelete.size - 1}件をゴミ箱に移動しました`)
				} else {
					// ! 完全削除の場合は、削除対象以外のメモだけを残す。
					const remainingMemos = memoTexts.filter(text => {
						const memo = parseTextToMemo(text, category, filePath)
						if (!memo) return true // パース失敗したメモは残す（別カテゴリなど）
						return !idsToDelete.has(memo.id)
					})

					// ! タイムスタンプ順にソート。
					const sortedRemaining = sortMemosByTimestamp(remainingMemos)

					// ! ファイルを更新。
					const newContent = joinMemosToFileContent(sortedRemaining)
					await this.vaultHandler.writeFile(filePath, newContent)

					notify.success(`メモと子孫${idsToDelete.size - 1}件を削除しました`)
				}

				// ! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category)
				this.cacheManager.invalidateMemos(cacheKey)

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				return true
			})(),
			{ filePath, category, memoId, moveToTrash, context: "MemoManager.deleteMemoWithDescendants" },
		)

		return result.success && result.data ? result.data : false
	}

	// ! メモを削除し、直接の子メモを親なしに変換する。
	async deleteOnlyMemoAndOrphanChildren(
		filePath: string,
		category: string,
		memoId: string,
		moveToTrash = false,
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				// ! ファイルを読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath)
				const memoTexts = splitFileIntoMemos(fileContent)

				// ! メモをパース。
				const memos = memoTexts
					.map(text => parseTextToMemo(text, category, filePath))
					.filter((memo): memo is MemoEntry => memo !== null)
					.filter(memo => memo.category === category)

				// ! 削除対象のメモが存在するか確認。
				const targetMemo = memos.find(memo => memo.id === memoId)
				if (!targetMemo) {
					throw new Error(`削除対象のメモが見つかりません: ${memoId}`)
				}

				// ! スレッドインデックスを構築。
				const index = this.threadIndexManager.getIndex(memos)

				// ! 直接の子メモを取得。
				const directChildren = index.childrenMap.get(memoId) || []

				if (moveToTrash) {
					// ! ゴミ箱に移動する場合は、対象メモのみにtrashedAtフラグを付け、子はparentIdを削除。
					const trashedAt = toLocalISOString()
					const updatedMemoTexts = memoTexts.map(text => {
						const memo = parseTextToMemo(text, category, filePath)
						if (!memo) return text // パース失敗したメモはそのまま残す

						// ! 削除対象のメモにtrashedAtフラグを付ける。
						if (memo.id === memoId) {
							const { memos: updated } = markMemoAsDeleted([text], memo.id, trashedAt)
							return updated[0]
						}

						// ! 直接の子メモのparentIdを削除。
						if (directChildren.includes(memo.id)) {
							delete memo.parentId
							return memoToText(memo, memo.template, false)
						}

						return text
					})

					// ! タイムスタンプ順にソート。
					const sortedMemoTexts1 = sortMemosByTimestamp(updatedMemoTexts)

					// ! ファイルを更新。
					const newContent = joinMemosToFileContent(sortedMemoTexts1)
					await this.vaultHandler.writeFile(filePath, newContent)

					notify.success(
						directChildren.length > 0
							? `メモをゴミ箱に移動し、${directChildren.length}件の子メモを親なしに変換しました`
							: "メモをゴミ箱に移動しました",
					)
				} else {
					// ! 完全削除の場合は、削除対象のメモを除外し、直接の子メモのparentIdをundefinedに更新。
					const updatedMemoTexts = memoTexts
						.map(text => {
							const memo = parseTextToMemo(text, category, filePath)
							if (!memo) return text // パース失敗したメモはそのまま残す

							// ! 削除対象のメモは除外。
							if (memo.id === memoId) {
								return null
							}

							// ! 直接の子メモのparentIdを削除。
							if (directChildren.includes(memo.id)) {
								delete memo.parentId
								return memoToText(memo, memo.template, false)
							}

							return text
						})
						.filter((text): text is string => text !== null)

					// ! タイムスタンプ順にソート。
					const sortedMemoTexts1 = sortMemosByTimestamp(updatedMemoTexts)

					// ! ファイルを更新。
					const newContent = joinMemosToFileContent(sortedMemoTexts1)
					await this.vaultHandler.writeFile(filePath, newContent)

					notify.success(
						directChildren.length > 0
							? `メモを削除し、${directChildren.length}件の子メモを親なしに変換しました`
							: "メモを削除しました",
					)
				}

				// ! キャッシュを無効化。
				const cacheKey = generateCacheKey(filePath, category)
				this.cacheManager.invalidateMemos(cacheKey)

				// ! スレッドインデックスを無効化。
				this.threadIndexManager.clear()

				notify.success(
					directChildren.length > 0
						? `メモを削除し、${directChildren.length}件の子メモを親なしに変換しました`
						: "メモを削除しました",
				)
				return true
			})(),
			{
				filePath,
				category,
				memoId,
				context: "MemoManager.deleteOnlyMemoAndOrphanChildren",
			},
		)

		return result.success && result.data ? result.data : false
	}
}
