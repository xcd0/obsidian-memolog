// ! パフォーマンス最適化ユーティリティ。

// ! debounce関数 - 連続した呼び出しを遅延させ、最後の呼び出しのみを実行する。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function(this: any, ...args: Parameters<T>) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias, @typescript-eslint/no-unsafe-assignment
		const context = this

		if (timeout) {
			clearTimeout(timeout)
		}

		timeout = setTimeout(() => {
			func.apply(context, args)
			timeout = null
		}, wait)
	}
}

// ! throttle関数 - 指定時間内に1回のみ関数を実行する。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let inThrottle = false
	let lastArgs: Parameters<T> | null = null

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function(this: any, ...args: Parameters<T>) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias, @typescript-eslint/no-unsafe-assignment
		const context = this

		if (!inThrottle) {
			func.apply(context, args)
			inThrottle = true

			setTimeout(() => {
				inThrottle = false

				// ! throttle期間中に呼び出しがあった場合、最後の引数で再実行。
				if (lastArgs) {
					func.apply(context, lastArgs)
					lastArgs = null
				}
			}, wait)
		} else {
			// ! throttle期間中は最後の引数を保持。
			lastArgs = args
		}
	}
}

// ! requestAnimationFrameベースのdebounce - UIレンダリングに最適化。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rafDebounce<T extends (...args: any[]) => any>(
	func: T,
): (...args: Parameters<T>) => void {
	let rafId: number | null = null

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function(this: any, ...args: Parameters<T>) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias, @typescript-eslint/no-unsafe-assignment
		const context = this

		if (rafId !== null) {
			cancelAnimationFrame(rafId)
		}

		rafId = requestAnimationFrame(() => {
			func.apply(context, args)
			rafId = null
		})
	}
}

// ! 非同期処理のバッチ実行 - 複数の非同期処理を効率的に実行する。
export async function batch<T>(
	items: T[],
	processor: (item: T) => Promise<void>,
	batchSize: number = 10,
): Promise<void> {
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize)
		await Promise.all(batch.map(processor))
	}
}

// ! メモ化 - 関数の結果をキャッシュする。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function memoize<T extends (...args: any[]) => any>(
	func: T,
	resolver?: (...args: Parameters<T>) => string,
): T {
	const cache = new Map<string, ReturnType<T>>()

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function(this: any, ...args: Parameters<T>): ReturnType<T> {
		const key = resolver ? resolver(...args) : JSON.stringify(args)

		if (cache.has(key)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-return
			return cache.get(key)!
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const result = func.apply(this, args)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		cache.set(key, result)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return result
	} as T
}
