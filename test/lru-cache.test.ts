import { LRUCache } from "../src/core/cache/lru-cache"

// ! LRUCacheのテスト。
describe("LRUCache", () => {
	describe("基本操作", () => {
		test("値を設定して取得", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			expect(cache.get("a")).toBe(1)
			expect(cache.get("b")).toBe(2)
			expect(cache.get("c")).toBe(3)
		})

		test("存在しないキーはundefined", () => {
			const cache = new LRUCache<string, number>(3)

			expect(cache.get("nonexistent")).toBeUndefined()
		})

		test("キャッシュサイズを取得", () => {
			const cache = new LRUCache<string, number>(3)

			expect(cache.size()).toBe(0)

			cache.set("a", 1)
			expect(cache.size()).toBe(1)

			cache.set("b", 2)
			expect(cache.size()).toBe(2)

			cache.set("c", 3)
			expect(cache.size()).toBe(3)
		})

		test("キーの存在確認", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)

			expect(cache.has("a")).toBe(true)
			expect(cache.has("b")).toBe(false)
		})

		test("全キーを取得", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			const keys = cache.keys()
			expect(keys).toContain("a")
			expect(keys).toContain("b")
			expect(keys).toContain("c")
			expect(keys.length).toBe(3)
		})
	})

	describe("LRU動作", () => {
		test("容量を超えると最も古いエントリが削除される", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			// ! 容量を超える4つ目を追加。
			cache.set("d", 4)

			// ! 最も古い"a"が削除される。
			expect(cache.has("a")).toBe(false)
			expect(cache.has("b")).toBe(true)
			expect(cache.has("c")).toBe(true)
			expect(cache.has("d")).toBe(true)
			expect(cache.size()).toBe(3)
		})

		test("アクセスされたエントリは最新として扱われる", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			// ! "a"にアクセス → "a"が最新になる。
			cache.get("a")

			// ! 4つ目を追加。
			cache.set("d", 4)

			// ! アクセスされた"a"は残り、"b"が削除される。
			expect(cache.has("a")).toBe(true)
			expect(cache.has("b")).toBe(false)
			expect(cache.has("c")).toBe(true)
			expect(cache.has("d")).toBe(true)
		})

		test("getEntry()もアクセス順序を更新する", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			// ! getEntry()で"a"にアクセス。
			cache.getEntry("a")

			// ! 4つ目を追加。
			cache.set("d", 4)

			// ! アクセスされた"a"は残り、"b"が削除される。
			expect(cache.has("a")).toBe(true)
			expect(cache.has("b")).toBe(false)
		})

		test("アクセス順序が正しく更新される", () => {
			const cache = new LRUCache<string, number>(5)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			// ! 初期順序: [a, b, c]。
			expect(cache.getAccessOrder()).toEqual(["a", "b", "c"])

			// ! "a"にアクセス → 順序: [b, c, a]。
			cache.get("a")
			expect(cache.getAccessOrder()).toEqual(["b", "c", "a"])

			// ! "b"にアクセス → 順序: [c, a, b]。
			cache.get("b")
			expect(cache.getAccessOrder()).toEqual(["c", "a", "b"])
		})
	})

	describe("エントリの更新", () => {
		test("既存のキーを上書き", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			expect(cache.get("a")).toBe(1)

			cache.set("a", 100)
			expect(cache.get("a")).toBe(100)

			// ! サイズは変わらない。
			expect(cache.size()).toBe(1)
		})

		test("上書き時もアクセス順序が更新される", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			// ! "a"を上書き → 最新になる。
			cache.set("a", 100)

			// ! 4つ目を追加。
			cache.set("d", 4)

			// ! 上書きされた"a"は最新なので残り、"b"が削除される。
			expect(cache.has("a")).toBe(true)
			expect(cache.has("b")).toBe(false)
			expect(cache.has("c")).toBe(true)
			expect(cache.has("d")).toBe(true)
		})
	})

	describe("エントリの削除", () => {
		test("invalidate()でエントリを削除", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			cache.invalidate("b")

			expect(cache.has("a")).toBe(true)
			expect(cache.has("b")).toBe(false)
			expect(cache.has("c")).toBe(true)
			expect(cache.size()).toBe(2)
		})

		test("存在しないキーをinvalidateしてもエラーにならない", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)

			expect(() => cache.invalidate("nonexistent")).not.toThrow()
			expect(cache.size()).toBe(1)
		})

		test("clear()で全エントリを削除", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			cache.clear()

			expect(cache.size()).toBe(0)
			expect(cache.has("a")).toBe(false)
			expect(cache.has("b")).toBe(false)
			expect(cache.has("c")).toBe(false)
		})
	})

	describe("CacheEntry", () => {
		test("getEntry()でエントリ全体を取得", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)

			const entry = cache.getEntry("a")

			expect(entry).toBeDefined()
			expect(entry?.data).toBe(1)
			expect(entry?.timestamp).toBeGreaterThan(0)
		})

		test("getEntry()で存在しないキーはundefined", () => {
			const cache = new LRUCache<string, number>(3)

			const entry = cache.getEntry("nonexistent")

			expect(entry).toBeUndefined()
		})

		test("mtimeを含むエントリを設定", () => {
			const cache = new LRUCache<string, number>(3)
			const mtime = 1234567890

			cache.set("a", 1, mtime)

			const entry = cache.getEntry("a")

			expect(entry?.mtime).toBe(mtime)
		})

		test("mtimeなしでエントリを設定", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)

			const entry = cache.getEntry("a")

			expect(entry?.mtime).toBeUndefined()
		})
	})

	describe("entries()", () => {
		test("全エントリを取得", () => {
			const cache = new LRUCache<string, number>(3)

			cache.set("a", 1)
			cache.set("b", 2)
			cache.set("c", 3)

			const entries = cache.entries()

			expect(entries.length).toBe(3)

			const keys = entries.map(([key]) => key)
			expect(keys).toContain("a")
			expect(keys).toContain("b")
			expect(keys).toContain("c")

			const values = entries.map(([, entry]) => entry.data)
			expect(values).toContain(1)
			expect(values).toContain(2)
			expect(values).toContain(3)
		})

		test("空のキャッシュのentries()", () => {
			const cache = new LRUCache<string, number>(3)

			const entries = cache.entries()

			expect(entries.length).toBe(0)
		})
	})

	describe("容量1のキャッシュ", () => {
		test("容量1で常に1つのエントリのみ保持", () => {
			const cache = new LRUCache<string, number>(1)

			cache.set("a", 1)
			expect(cache.size()).toBe(1)
			expect(cache.get("a")).toBe(1)

			cache.set("b", 2)
			expect(cache.size()).toBe(1)
			expect(cache.has("a")).toBe(false)
			expect(cache.get("b")).toBe(2)
		})
	})

	describe("異なる型のキャッシュ", () => {
		test("オブジェクトをキャッシュ", () => {
			interface User {
				id: number
				name: string
			}

			const cache = new LRUCache<string, User>(3)

			cache.set("user1", { id: 1, name: "Alice" })
			cache.set("user2", { id: 2, name: "Bob" })

			const user1 = cache.get("user1")
			expect(user1).toEqual({ id: 1, name: "Alice" })

			const user2 = cache.get("user2")
			expect(user2).toEqual({ id: 2, name: "Bob" })
		})

		test("配列をキャッシュ", () => {
			const cache = new LRUCache<string, number[]>(3)

			cache.set("array1", [1, 2, 3])
			cache.set("array2", [4, 5, 6])

			expect(cache.get("array1")).toEqual([1, 2, 3])
			expect(cache.get("array2")).toEqual([4, 5, 6])
		})

		test("数値キーでキャッシュ", () => {
			const cache = new LRUCache<number, string>(3)

			cache.set(1, "one")
			cache.set(2, "two")
			cache.set(3, "three")

			expect(cache.get(1)).toBe("one")
			expect(cache.get(2)).toBe("two")
			expect(cache.get(3)).toBe("three")
		})
	})
})
