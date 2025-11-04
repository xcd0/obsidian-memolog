// ! キャッシュエントリの型定義。
export interface CacheEntry<T> {
	data: T
	timestamp: number
	mtime?: number // ! ファイルの最終更新時刻 (ファイルベースのキャッシュ用)。
}

// ! LRUキャッシュの実装。
// ! Least Recently Used (最も最近使われていない) アルゴリズムで古いエントリを削除する。
export class LRUCache<K, V> {
	private capacity: number
	private cache: Map<K, CacheEntry<V>>
	private accessOrder: K[]

	constructor(capacity: number) {
		this.capacity = capacity
		this.cache = new Map()
		this.accessOrder = []
	}

	// ! キャッシュから値を取得する。
	get(key: K): V | undefined {
		const entry = this.cache.get(key)
		if (!entry) {
			return undefined
		}

		// ! アクセス順序を更新。
		this.updateAccessOrder(key)

		return entry.data
	}

	// ! キャッシュエントリ全体を取得する。
	getEntry(key: K): CacheEntry<V> | undefined {
		const entry = this.cache.get(key)
		if (entry) {
			this.updateAccessOrder(key)
		}
		return entry
	}

	// ! キャッシュに値を設定する。
	set(key: K, value: V, mtime?: number): void {
		// ! 既存のエントリがある場合は削除。
		if (this.cache.has(key)) {
			this.cache.delete(key)
			this.accessOrder = this.accessOrder.filter(k => k !== key)
		}

		// ! 容量を超える場合は最も古いエントリを削除。
		if (this.cache.size >= this.capacity) {
			const oldestKey = this.accessOrder.shift()
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey)
			}
		}

		// ! 新しいエントリを追加。
		this.cache.set(key, {
			data: value,
			timestamp: Date.now(),
			mtime,
		})
		this.accessOrder.push(key)
	}

	// ! キャッシュから指定のキーを削除する。
	invalidate(key: K): void {
		this.cache.delete(key)
		this.accessOrder = this.accessOrder.filter(k => k !== key)
	}

	// ! キャッシュをクリアする。
	clear(): void {
		this.cache.clear()
		this.accessOrder = []
	}

	// ! キャッシュのサイズを取得する。
	size(): number {
		return this.cache.size
	}

	// ! アクセス順序を更新する。
	private updateAccessOrder(key: K): void {
		this.accessOrder = this.accessOrder.filter(k => k !== key)
		this.accessOrder.push(key)
	}

	// ! キャッシュに指定のキーが存在するか確認する。
	has(key: K): boolean {
		return this.cache.has(key)
	}

	// ! アクセス順序を取得する（テスト用）。
	getAccessOrder(): K[] {
		return [...this.accessOrder]
	}

	// ! キャッシュの全キーを取得する。
	keys(): K[] {
		return Array.from(this.cache.keys())
	}

	// ! キャッシュの全エントリを取得する。
	entries(): [K, CacheEntry<V>][] {
		return Array.from(this.cache.entries())
	}
}
