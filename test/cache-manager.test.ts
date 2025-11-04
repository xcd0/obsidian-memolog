import { App } from "obsidian"
import { CacheManager } from "../src/core/cache-manager"
import { MemoEntry } from "../src/types"

// ! statモック関数。
const mockStat = jest.fn()

// ! Appのモック。
const mockApp = {
	vault: {
		adapter: {
			stat: mockStat,
		},
	},
} as unknown as App

describe("CacheManager", () => {
	let cacheManager: CacheManager

	beforeEach(() => {
		// ! 各テストの前にCacheManagerを初期化。
		cacheManager = new CacheManager(mockApp, 5)
		jest.clearAllMocks()
	})

	describe("メモキャッシュ", () => {
		it("メモリストをキャッシュに保存して取得できる", async () => {
			const memos: MemoEntry[] = [
				{
					id: "test-1",
					category: "work",
					timestamp: "2025-01-23T10:00:00Z",
					content: "テストメモ1",
				},
				{
					id: "test-2",
					category: "work",
					timestamp: "2025-01-23T11:00:00Z",
					content: "テストメモ2",
				},
			]

			// ! ファイル情報のモック。
			mockStat.mockResolvedValue({
				mtime: 1000000,
			})

			// ! キャッシュに保存。
			await cacheManager.setMemos("test-file.md", memos)

			// ! キャッシュから取得。
			const cachedMemos = await cacheManager.getMemos("test-file.md")

			expect(cachedMemos).toEqual(memos)
		})

		it("ファイルが更新されるとキャッシュが無効化される", async () => {
			const memos: MemoEntry[] = [
				{
					id: "test-1",
					category: "work",
					timestamp: "2025-01-23T10:00:00Z",
					content: "テストメモ",
				},
			]

			// ! 初回のファイル情報（mtime: 1000000）。
			mockStat.mockResolvedValueOnce({
				mtime: 1000000,
			})

			// ! キャッシュに保存。
			await cacheManager.setMemos("test-file.md", memos)

			// ! ファイルが更新された（getMemos内でfileExistsとgetFileMtimeが呼ばれる）。
			mockStat
				.mockResolvedValueOnce({
					mtime: 2000000,
				}) // ! fileExists()の呼び出し。
				.mockResolvedValueOnce({
					mtime: 2000000,
				}) // ! getFileMtime()の呼び出し。

			// ! キャッシュを取得（ファイル更新検知でundefinedが返る）。
			const cachedMemos = await cacheManager.getMemos("test-file.md")

			expect(cachedMemos).toBeUndefined()
		})

		it("ファイルが存在しない場合はキャッシュが無効化される", async () => {
			const memos: MemoEntry[] = [
				{
					id: "test-1",
					category: "work",
					timestamp: "2025-01-23T10:00:00Z",
					content: "テストメモ",
				},
			]

			// ! 初回のファイル情報。
			mockStat.mockResolvedValueOnce({
				mtime: 1000000,
			})

			// ! キャッシュに保存。
			await cacheManager.setMemos("test-file.md", memos)

			// ! ファイルが削除された（stat()がnullを返す）。
			mockStat.mockResolvedValueOnce(null)

			// ! キャッシュを取得（ファイル削除検知でundefinedが返る）。
			const cachedMemos = await cacheManager.getMemos("test-file.md")

			expect(cachedMemos).toBeUndefined()
		})

		it("invalidateMemosでキャッシュを無効化できる", async () => {
			const memos: MemoEntry[] = [
				{
					id: "test-1",
					category: "work",
					timestamp: "2025-01-23T10:00:00Z",
					content: "テストメモ",
				},
			]

			// ! ファイル情報のモック。
			mockStat.mockResolvedValue({
				mtime: 1000000,
			})

			// ! キャッシュに保存。
			await cacheManager.setMemos("test-file.md", memos)

			// ! キャッシュを無効化。
			cacheManager.invalidateMemos("test-file.md")

			// ! キャッシュから取得（undefinedが返る）。
			mockStat.mockResolvedValue({
				mtime: 1000000,
			})
			const cachedMemos = await cacheManager.getMemos("test-file.md")

			expect(cachedMemos).toBeUndefined()
		})
	})

	describe("設定キャッシュ", () => {
		it("設定をキャッシュに保存して取得できる", () => {
			const settings = {
				rootDirectory: "memolog",
				saveUnit: "day" as const,
			}

			// ! キャッシュに保存。
			cacheManager.setSettings("global", settings)

			// ! キャッシュから取得。
			const cachedSettings = cacheManager.getSettings<typeof settings>("global")

			expect(cachedSettings).toEqual(settings)
		})

		it("invalidateSettingsで設定キャッシュを無効化できる", () => {
			const settings = {
				rootDirectory: "memolog",
			}

			// ! キャッシュに保存。
			cacheManager.setSettings("global", settings)

			// ! キャッシュを無効化。
			cacheManager.invalidateSettings("global")

			// ! キャッシュから取得（undefinedが返る）。
			const cachedSettings = cacheManager.getSettings("global")

			expect(cachedSettings).toBeUndefined()
		})
	})

	describe("LRUキャッシュ", () => {
		it("容量を超えるとLRU方式で古いエントリが削除される", async () => {
			// ! 容量3のCacheManagerを作成。
			const smallCache = new CacheManager(mockApp, 3)

			// ! ファイル情報のモック。
			mockStat.mockResolvedValue({
				mtime: 1000000,
			})

			// ! 3件のメモをキャッシュに保存。
			await smallCache.setMemos("file1.md", [
				{ id: "1", category: "work", timestamp: "2025-01-23T10:00:00Z", content: "Memo 1" },
			])
			await smallCache.setMemos("file2.md", [
				{ id: "2", category: "work", timestamp: "2025-01-23T10:00:00Z", content: "Memo 2" },
			])
			await smallCache.setMemos("file3.md", [
				{ id: "3", category: "work", timestamp: "2025-01-23T10:00:00Z", content: "Memo 3" },
			])

			// ! キャッシュサイズを確認。
			expect(smallCache.getMemoCacheSize()).toBe(3)

			// ! 4件目を追加（最も古いfile1.mdが削除される）。
			await smallCache.setMemos("file4.md", [
				{ id: "4", category: "work", timestamp: "2025-01-23T10:00:00Z", content: "Memo 4" },
			])

			// ! キャッシュサイズは3のまま。
			expect(smallCache.getMemoCacheSize()).toBe(3)

			// ! file1.mdは削除されている。
			const file1Memos = await smallCache.getMemos("file1.md")
			expect(file1Memos).toBeUndefined()

			// ! file2.md, file3.md, file4.mdは存在する。
			const file2Memos = await smallCache.getMemos("file2.md")
			expect(file2Memos).toBeDefined()
		})
	})

	describe("キャッシュクリア", () => {
		it("clearAllで全てのキャッシュをクリアできる", async () => {
			// ! メモキャッシュを保存。
			mockStat.mockResolvedValue({
				mtime: 1000000,
			})
			await cacheManager.setMemos("test-file.md", [
				{ id: "1", category: "work", timestamp: "2025-01-23T10:00:00Z", content: "Memo" },
			])

			// ! 設定キャッシュを保存。
			cacheManager.setSettings("global", { rootDirectory: "memolog" })

			// ! キャッシュサイズを確認。
			expect(cacheManager.getMemoCacheSize()).toBe(1)
			expect(cacheManager.getSettingsCacheSize()).toBe(1)

			// ! 全てのキャッシュをクリア。
			cacheManager.clearAll()

			// ! キャッシュサイズが0になる。
			expect(cacheManager.getMemoCacheSize()).toBe(0)
			expect(cacheManager.getSettingsCacheSize()).toBe(0)
		})
	})
})
