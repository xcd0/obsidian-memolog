import { batch, debounce, memoize, throttle } from "../src/utils/performance"

describe("Performance Utilities", () => {
	describe("debounce", () => {
		beforeEach(() => {
			jest.useFakeTimers()
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		test("should debounce function calls", () => {
			const func = jest.fn()
			const debouncedFunc = debounce(func, 100)

			// ! 連続して呼び出す。
			debouncedFunc()
			debouncedFunc()
			debouncedFunc()

			// ! まだ実行されていない。
			expect(func).not.toHaveBeenCalled()

			// ! 100ms経過。
			jest.advanceTimersByTime(100)

			// ! 最後の呼び出しのみ実行される。
			expect(func).toHaveBeenCalledTimes(1)
		})

		test("should call function with latest arguments", () => {
			const func = jest.fn()
			const debouncedFunc = debounce(func, 100)

			debouncedFunc(1)
			debouncedFunc(2)
			debouncedFunc(3)

			jest.advanceTimersByTime(100)

			// ! 最後の引数で呼び出される。
			expect(func).toHaveBeenCalledWith(3)
		})
	})

	describe("throttle", () => {
		beforeEach(() => {
			jest.useFakeTimers()
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		test("should throttle function calls", () => {
			const func = jest.fn()
			const throttledFunc = throttle(func, 100)

			// ! 初回は即座に実行される。
			throttledFunc()
			expect(func).toHaveBeenCalledTimes(1)

			// ! 100ms以内の呼び出しは無視される。
			throttledFunc()
			throttledFunc()
			expect(func).toHaveBeenCalledTimes(1)

			// ! 100ms経過後に最後の呼び出しが実行される。
			jest.advanceTimersByTime(100)
			expect(func).toHaveBeenCalledTimes(2)
		})

		test("should call function with latest arguments after throttle period", () => {
			const func = jest.fn()
			const throttledFunc = throttle(func, 100)

			throttledFunc(1)
			expect(func).toHaveBeenCalledWith(1)

			throttledFunc(2)
			throttledFunc(3)

			jest.advanceTimersByTime(100)

			// ! 最後の引数で呼び出される。
			expect(func).toHaveBeenCalledWith(3)
		})
	})

	describe("memoize", () => {
		test("should cache function results", () => {
			const expensiveFunc = jest.fn((x: number) => x * 2)
			const memoizedFunc = memoize(expensiveFunc)

			// ! 初回呼び出し。
			expect(memoizedFunc(5)).toBe(10)
			expect(expensiveFunc).toHaveBeenCalledTimes(1)

			// ! キャッシュから取得。
			expect(memoizedFunc(5)).toBe(10)
			expect(expensiveFunc).toHaveBeenCalledTimes(1)

			// ! 異なる引数で呼び出し。
			expect(memoizedFunc(3)).toBe(6)
			expect(expensiveFunc).toHaveBeenCalledTimes(2)
		})

		test("should use custom resolver", () => {
			const func = jest.fn((a: number, b: number) => a + b)
			const memoizedFunc = memoize(func, (a, b) => `${a}+${b}`)

			expect(memoizedFunc(1, 2)).toBe(3)
			expect(func).toHaveBeenCalledTimes(1)

			// ! カスタムresolverでキャッシュキーが同じため、キャッシュから取得。
			expect(memoizedFunc(1, 2)).toBe(3)
			expect(func).toHaveBeenCalledTimes(1)
		})
	})

	describe("batch", () => {
		test("should process items in batches", async () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			const processedItems: number[] = []

			// eslint-disable-next-line @typescript-eslint/require-await
			const processor = jest.fn(async (item: number) => {
				processedItems.push(item)
			})

			await batch(items, processor, 3)

			// ! 全てのアイテムが処理される。
			expect(processedItems).toHaveLength(10)
			expect(processor).toHaveBeenCalledTimes(10)
		})

		test("should respect batch size", async () => {
			const items = [1, 2, 3, 4, 5]

			// eslint-disable-next-line @typescript-eslint/require-await
			const processor = jest.fn(async (_item: number) => {
				// ! バッチ処理を実行。
			})

			await batch(items, processor, 2)

			// ! バッチサイズ2で処理される。
			expect(processor).toHaveBeenCalledTimes(5)
		})
	})
})
