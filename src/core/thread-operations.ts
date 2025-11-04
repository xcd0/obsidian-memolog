import { MemoEntry, ThreadIndex, ThreadNode, ThreadTree } from "../types/memo"

// ! スレッドインデックスを構築する。
export function buildThreadIndex(memos: MemoEntry[]): ThreadIndex {
	const childrenMap = new Map<string, string[]>()
	const parentMap = new Map<string, string>()
	const rootIds = new Set<string>()
	const depthMap = new Map<string, number>()
	const descendantCountMap = new Map<string, number>()

	// ! 第1パス: 親子関係を構築。
	for (const memo of memos) {
		if (memo.parentId) {
			// ! 子として登録。
			if (!childrenMap.has(memo.parentId)) {
				childrenMap.set(memo.parentId, [])
			}
			const children = childrenMap.get(memo.parentId)
			if (children) {
				children.push(memo.id)
			}
			parentMap.set(memo.id, memo.parentId)
		} else {
			// ! ルートメモ。
			rootIds.add(memo.id)
		}
	}

	// ! 第2パス: 深さと子孫数を計算（BFS）。
	const queue: Array<{ id: string; depth: number }> = []
	for (const rootId of rootIds) {
		queue.push({ id: rootId, depth: 0 })
	}

	// ! 配列のshift()はO(N)になるため、ポインタで管理する。
	let head = 0
	while (head < queue.length) {
		const { id, depth } = queue[head++]
		depthMap.set(id, depth)

		const children = childrenMap.get(id) || []
		for (const childId of children) {
			queue.push({ id: childId, depth: depth + 1 })
		}
	}

	// ! 第3パス: 子孫数を計算（反復処理）。
	const postOrder: string[] = []
	const stack: string[] = []
	for (const rootId of rootIds) {
		stack.push(rootId)
		while (stack.length > 0) {
			const currentId = stack.pop()
			if (!currentId) continue
			postOrder.push(currentId)
			const children = childrenMap.get(currentId) || []
			for (const childId of children) {
				stack.push(childId)
			}
		}
	}

	// ! 末尾から走査して子孫数を集計。
	for (let i = postOrder.length - 1; i >= 0; i--) {
		const memoId = postOrder[i]
		const children = childrenMap.get(memoId) || []
		let count = 0
		for (const childId of children) {
			count += 1 + (descendantCountMap.get(childId) || 0)
		}
		descendantCountMap.set(memoId, count)
	}

	return {
		childrenMap,
		parentMap,
		rootIds,
		depthMap,
		descendantCountMap,
	}
}

// ! スレッドツリーを構築する（ThreadIndexから）。
export function buildThreadTree(
	rootId: string,
	threadIndex: ThreadIndex,
	memoMap: Map<string, MemoEntry>,
): ThreadTree {
	const nodes = new Map<string, ThreadNode>()
	let totalCount = 0
	let maxDepth = 0
	let lastUpdated = ""

	// ! BFSでツリーを構築。
	const queue: string[] = [rootId]
	let head = 0

	while (head < queue.length) {
		const currentId = queue[head++]
		const depth = threadIndex.depthMap.get(currentId) || 0
		const childIds = threadIndex.childrenMap.get(currentId) || []
		const descendantCount = threadIndex.descendantCountMap.get(currentId) || 0
		const parentId = threadIndex.parentMap.get(currentId)

		// ! ノードを作成。
		const node: ThreadNode = {
			id: currentId,
			childIds: [...childIds], // コピー
			parentId,
			depth,
			descendantCount,
		}

		nodes.set(currentId, node)

		// ! 統計を更新。
		totalCount++
		maxDepth = Math.max(maxDepth, depth)

		const memo = memoMap.get(currentId)
		if (memo && (!lastUpdated || memo.timestamp > lastUpdated)) {
			lastUpdated = memo.timestamp
		}

		// ! 子をキューに追加。
		queue.push(...childIds)
	}

	return {
		rootId,
		nodes,
		totalCount,
		maxDepth,
		lastUpdated,
	}
}

// ! 既存メモの親を変更する際に循環参照が生じないか検証する。
export function wouldIntroduceCycle(
	childId: string,
	candidateParentId: string,
	threadIndex: ThreadIndex,
): boolean {
	if (childId === candidateParentId) return true

	let currentId: string | undefined = candidateParentId
	while (currentId) {
		if (currentId === childId) return true // childの祖先に到達
		currentId = threadIndex.parentMap.get(currentId)
	}

	return false
}

// ! 孤児メモ（親が存在しないメモ）を検出。
export function findOrphanMemos(allMemos: MemoEntry[]): MemoEntry[] {
	const memoIds = new Set(allMemos.map(m => m.id))
	return allMemos.filter(m => m.parentId && !memoIds.has(m.parentId))
}

// ! 孤児メモをルートメモに昇格。
export function repairOrphanMemos(orphans: MemoEntry[]): void {
	for (const orphan of orphans) {
		orphan.parentId = undefined
		console.warn(`Orphan memo ${orphan.id} promoted to root`)
	}
}

// ! スレッドインデックスマネージャー。
export class ThreadIndexManager {
	private index: ThreadIndex | null = null
	private treeCache: Map<string, ThreadTree> = new Map()
	private lastSignature: string | null = null // メモ集合の最新署名（構造変化検出用）

	// ! スレッドインデックスを取得（キャッシュ済みなら再利用）。
	getIndex(memos: MemoEntry[]): ThreadIndex {
		const signature = this.createSignature(memos)

		// ! インデックスが未構築、または構造が変わった場合は再構築。
		if (!this.index || this.needsRebuild(signature)) {
			this.index = buildThreadIndex(memos)
			this.lastSignature = signature
			// ! ツリーキャッシュもクリア。
			this.treeCache.clear()
		}
		return this.index
	}

	// ! スレッドツリーをキャッシュから取得（なければ構築）。
	getThreadTree(
		rootId: string,
		threadIndex: ThreadIndex,
		memoMap: Map<string, MemoEntry>,
	): ThreadTree {
		const cached = this.treeCache.get(rootId)
		if (cached) {
			return cached
		}

		const tree = buildThreadTree(rootId, threadIndex, memoMap)
		this.treeCache.set(rootId, tree)
		return tree
	}

	// ! 子メモIDリストを取得（O(1)）。
	getChildren(parentId: string, threadIndex: ThreadIndex): string[] {
		return threadIndex.childrenMap.get(parentId) || []
	}

	// ! 親メモIDを取得（O(1)）。
	getParent(childId: string, threadIndex: ThreadIndex): string | undefined {
		return threadIndex.parentMap.get(childId)
	}

	// ! 深さを取得（O(1)）。
	getDepth(memoId: string, threadIndex: ThreadIndex): number {
		return threadIndex.depthMap.get(memoId) || 0
	}

	// ! 子孫数を取得（O(1)）。
	getDescendantCount(memoId: string, threadIndex: ThreadIndex): number {
		return threadIndex.descendantCountMap.get(memoId) || 0
	}

	// ! インデックスを強制的に再構築。
	rebuild(memos: MemoEntry[]): void {
		this.index = buildThreadIndex(memos)
		this.lastSignature = this.createSignature(memos)
		this.treeCache.clear()
	}

	// ! 特定のツリーキャッシュを無効化。
	invalidateTree(rootId: string): void {
		this.treeCache.delete(rootId)
	}

	// ! 全キャッシュをクリア。
	clear(): void {
		this.index = null
		this.treeCache.clear()
		this.lastSignature = null
	}

	private needsRebuild(signature: string): boolean {
		if (!this.index) return true
		return signature !== this.lastSignature
	}

	// ! メモ集合の署名を生成し、構造変更を検出する。
	private createSignature(memos: MemoEntry[]): string {
		const parts = memos.map(memo => {
			const parent = memo.parentId ?? ""
			const updated = memo.updatedAt
				? memo.updatedAt.toISOString()
				: memo.timestamp
			return `${memo.id}:${parent}:${updated}`
		})
		parts.sort()
		return `${memos.length}|${parts.join("|")}`
	}
}
