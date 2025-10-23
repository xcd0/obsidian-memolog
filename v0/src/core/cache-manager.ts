import { App } from "obsidian";
import { MemoEntry } from "../types";

//! キャッシュエントリの型定義。
interface CacheEntry<T> {
	data: T;
	timestamp: number;
	mtime?: number; //! ファイルの最終更新時刻 (ファイルベースのキャッシュ用)。
}

//! LRUキャッシュの実装。
class LRUCache<K, V> {
	private capacity: number;
	private cache: Map<K, CacheEntry<V>>;
	private accessOrder: K[];

	constructor(capacity: number) {
		this.capacity = capacity;
		this.cache = new Map();
		this.accessOrder = [];
	}

	//! キャッシュから値を取得する。
	get(key: K): V | undefined {
		const entry = this.cache.get(key);
		if (!entry) {
			return undefined;
		}

		//! アクセス順序を更新。
		this.updateAccessOrder(key);

		return entry.data;
	}

	//! キャッシュエントリ全体を取得する。
	getEntry(key: K): CacheEntry<V> | undefined {
		const entry = this.cache.get(key);
		if (entry) {
			this.updateAccessOrder(key);
		}
		return entry;
	}

	//! キャッシュに値を設定する。
	set(key: K, value: V, mtime?: number): void {
		//! 既存のエントリがある場合は削除。
		if (this.cache.has(key)) {
			this.cache.delete(key);
			this.accessOrder = this.accessOrder.filter((k) => k !== key);
		}

		//! 容量を超える場合は最も古いエントリを削除。
		if (this.cache.size >= this.capacity) {
			const oldestKey = this.accessOrder.shift();
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey);
			}
		}

		//! 新しいエントリを追加。
		this.cache.set(key, {
			data: value,
			timestamp: Date.now(),
			mtime,
		});
		this.accessOrder.push(key);
	}

	//! キャッシュから指定のキーを削除する。
	invalidate(key: K): void {
		this.cache.delete(key);
		this.accessOrder = this.accessOrder.filter((k) => k !== key);
	}

	//! キャッシュをクリアする。
	clear(): void {
		this.cache.clear();
		this.accessOrder = [];
	}

	//! キャッシュのサイズを取得する。
	size(): number {
		return this.cache.size;
	}

	//! アクセス順序を更新する。
	private updateAccessOrder(key: K): void {
		this.accessOrder = this.accessOrder.filter((k) => k !== key);
		this.accessOrder.push(key);
	}

	//! キャッシュに指定のキーが存在するか確認する。
	has(key: K): boolean {
		return this.cache.has(key);
	}
}

//! キャッシュマネージャー。
export class CacheManager {
	private app: App;
	private memoCache: LRUCache<string, MemoEntry[]>;
	private settingsCache: Map<string, CacheEntry<unknown>>;

	//! デフォルトのキャッシュ容量。
	private static readonly DEFAULT_CACHE_CAPACITY = 50;

	constructor(app: App, capacity = CacheManager.DEFAULT_CACHE_CAPACITY) {
		this.app = app;
		this.memoCache = new LRUCache(capacity);
		this.settingsCache = new Map();
	}

	//! メモリストをキャッシュから取得する。
	async getMemos(filePath: string): Promise<MemoEntry[] | undefined> {
		//! ファイルが存在しない場合はキャッシュも無効。
		const fileExists = await this.fileExists(filePath);
		if (!fileExists) {
			this.memoCache.invalidate(filePath);
			return undefined;
		}

		//! キャッシュエントリを取得。
		const entry = this.memoCache.getEntry(filePath);
		if (!entry) {
			return undefined;
		}

		//! ファイルの更新時刻を確認。
		const currentMtime = await this.getFileMtime(filePath);
		if (entry.mtime !== undefined && currentMtime !== entry.mtime) {
			//! ファイルが更新されている場合はキャッシュを無効化。
			this.memoCache.invalidate(filePath);
			return undefined;
		}

		return entry.data;
	}

	//! メモリストをキャッシュに設定する。
	async setMemos(filePath: string, memos: MemoEntry[]): Promise<void> {
		const mtime = await this.getFileMtime(filePath);
		this.memoCache.set(filePath, memos, mtime);
	}

	//! メモキャッシュを無効化する。
	invalidateMemos(filePath: string): void {
		this.memoCache.invalidate(filePath);
	}

	//! 設定をキャッシュから取得する。
	getSettings<T>(key: string): T | undefined {
		const entry = this.settingsCache.get(key);
		if (!entry) {
			return undefined;
		}
		return entry.data as T;
	}

	//! 設定をキャッシュに設定する。
	setSettings<T>(key: string, settings: T): void {
		this.settingsCache.set(key, {
			data: settings,
			timestamp: Date.now(),
		});
	}

	//! 設定キャッシュを無効化する。
	invalidateSettings(key: string): void {
		this.settingsCache.delete(key);
	}

	//! 全てのキャッシュをクリアする。
	clearAll(): void {
		this.memoCache.clear();
		this.settingsCache.clear();
	}

	//! メモキャッシュのサイズを取得する。
	getMemoCacheSize(): number {
		return this.memoCache.size();
	}

	//! 設定キャッシュのサイズを取得する。
	getSettingsCacheSize(): number {
		return this.settingsCache.size;
	}

	//! ファイルの最終更新時刻を取得する。
	private async getFileMtime(filePath: string): Promise<number | undefined> {
		try {
			const stat = await this.app.vault.adapter.stat(filePath);
			return stat?.mtime;
		} catch (error) {
			console.error(`ファイル情報取得エラー: ${filePath}`, error);
			return undefined;
		}
	}

	//! ファイルが存在するか確認する。
	private async fileExists(filePath: string): Promise<boolean> {
		try {
			const stat = await this.app.vault.adapter.stat(filePath);
			return stat !== null && stat !== undefined;
		} catch (error) {
			return false;
		}
	}
}
