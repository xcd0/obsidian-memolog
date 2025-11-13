# memolog 仕様書 v0.0.14 - スレッド機能

最終更新: 2025-11-13
バージョン: v0.0.14（実装完了）

---

## 1. 概要

v0.0.14では、メモ同士を関連付けるスレッド機能を実装する。既存の投稿に対して返信のような形でメモを連鎖させることで、議論の流れや関連するメモをまとめて管理できるようにする。

### 1.1 背景

現状のmemologでは、メモは独立した単位として管理されており、関連するメモ同士の繋がりを表現する手段がない。以下のニーズがある：

- **会議の議論**: 議題に対する複数のコメントや意見を関連付けたい
- **タスクの詳細化**: メインタスクに対する補足説明やサブタスクを紐付けたい
- **アイデアの展開**: 1つのアイデアから派生した複数の思考を追跡したい
- **問題解決**: 問題提起とその解決策を一連の流れとして管理したい

### 1.2 主な変更点

1. **スレッド構造の導入**
   - 親メモと子メモの関係を表現
   - スレッドツリーの構築と表示
   - スレッド単位での操作（折りたたみ、展開、削除など）
   - **深さ無制限**: 任意の階層まで対応

2. **効率的なデータ構造**
   - **ハイブリッドインデックス方式**: ファイルには親ID、メモリには双方向インデックス
   - O(1)での親子双方向参照
   - スレッドツリーの効率的なキャッシング
   - 枝分かれ（複数の子）にも完全対応

3. **UI/UX の改善**
   - インデント表示によるスレッド階層の可視化
   - 返信ボタンの追加
   - スレッド折りたたみ/展開機能
   - 長いスレッドの仮想スクロール対応

---

## 2. データ構造設計

### 2.1 スレッド関係の表現方法

#### 採用方式: ハイブリッドインデックス方式

**ファイルレイヤー（永続化）**: 親ID参照のみ
**メモリレイヤー（実行時）**: 双方向インデックス構造

この方式により、以下を実現：

- ファイルフォーマットはシンプル（親IDのみ）
- 実行時は高速な双方向参照（O(1)）
- データ整合性の維持が容易

### 2.2 ハイブリッドインデックスの詳細

```typescript
// ! スレッドインデックス（メモリ内のみ）。
export interface ThreadIndex {
	// ! 親メモID → 子メモIDリストのマップ。
	childrenMap: Map<string, string[]>

	// ! 子メモID → 親メモIDのマップ。
	parentMap: Map<string, string>

	// ! ルートメモIDのセット（parentIdがないメモ）。
	rootIds: Set<string>

	// ! 各メモの深さ（ルート=0）。
	depthMap: Map<string, number>

	// ! 各メモの子孫数（自身含まず）。
	descendantCountMap: Map<string, number>
}
```

**構築方法:**

```typescript
// ! スレッドインデックスを構築する。
function buildThreadIndex(memos: MemoEntry[]): ThreadIndex {
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
			childrenMap.get(memo.parentId)!.push(memo.id)
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
			const currentId = stack.pop()!
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
```

**計算量:**

- 構築: O(N) （Nはメモ数）
- 子メモ取得: O(1)
- 親メモ取得: O(1)
- 深さ取得: O(1)
- 子孫数取得: O(1)

**メリット:**

1. **ファイルフォーマットがシンプル**: 親IDのみを保存
2. **高速な双方向参照**: メモリ上では完全な双方向インデックス
3. **整合性維持が容易**: ファイル読み込み時に再構築するため、常に正しい状態
4. **深さ無制限**: インデックス構築はO(N)で深さに依存しない
5. **枝分かれ対応**: childrenMapが配列なので複数の子メモに対応

### 2.3 MemoEntry型の拡張

```typescript
// ! メモエントリの型定義。
export interface MemoEntry {
	// ! メモの一意識別子（UUID等）。
	id: string

	// ! カテゴリ名。
	category: string

	// ! タイムスタンプ（ISO 8601形式）。
	timestamp: string

	// ! メモの本文。
	content: string

	// ! 添付ファイルのパス配列（オプション）。
	attachments?: string[]

	// ! メモ作成時に使用されたテンプレート（オプション）。
	template?: string

	// ! 作成日時（Date型）。
	createdAt?: Date

	// ! 更新日時（Date型）。
	updatedAt?: Date

	// ! ゴミ箱に移動した日時（ISO 8601形式）。
	trashedAt?: string

	// ! ピン留めした日時（ISO 8601形式）。
	pinnedAt?: string

	// ! 親メモのID（スレッドの場合）。v0.0.14で追加。
	parentId?: string

	// ! 返信数（キャッシュ用）。v0.0.14で追加。
	replyCount?: number
}
```

### 2.4 スレッドツリー構造

```typescript
// ! スレッドツリーのノード。
export interface ThreadNode {
	// ! メモID。
	id: string

	// ! 子ノードのID配列（返信）。
	childIds: string[]

	// ! 親ノードのID。
	parentId?: string

	// ! スレッドの深さ（0がルート）。
	depth: number

	// ! 子孫の総数（自身含まず）。
	descendantCount: number

	// ! 折りたたみ状態（UIで使用）。
	collapsed?: boolean
}

// ! スレッドツリー。
export interface ThreadTree {
	// ! ルートメモのID。
	rootId: string

	// ! ノードマップ（ID → ThreadNode）。
	nodes: Map<string, ThreadNode>

	// ! 全メモ数（ルート含む）。
	totalCount: number

	// ! 最大深さ。
	maxDepth: number

	// ! 最終更新日時（ツリー内の最新タイムスタンプ）。
	lastUpdated: string
}
```

**設計変更点:**

- ノード内にメモ本体を持たず、IDのみを保持
- メモ本体はMemoManagerから取得（メモリ効率化）
- nodesをMapで管理し、任意のノードへO(1)アクセス

### 2.5 HTMLコメントタグの拡張

現在のフォーマット:

```html
<!-- memo-id: abc123, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
```

v0.0.14での拡張:

```html
<!-- memo-id: abc123, timestamp: 2025-11-04T10:00:00+09:00, category: "work", parent-id: xyz789 -->
```

**ポイント:**

- `parent-id` はオプション属性
- 親メモが存在しない（ルートメモ）場合は省略
- 既存のメモとの後方互換性を維持

---

## 3. スレッド操作機能

### 3.1 スレッド作成

#### 3.1.1 返信の作成

**操作:**

1. 既存のメモカードの「返信」ボタンをクリック
2. 入力フォームが開き、親メモの情報が表示される
3. メモを入力して送信

**実装:**

```typescript
// ! 返信メモを作成する。
async function createReply(
	parentMemo: MemoEntry,
	content: string,
	category: string,
	threadIndex: ThreadIndex,
): Promise<MemoEntry> {
	// ! 新しいメモを作成。
	const replyMemo = createMemoEntry(category, content)

	// ! 親メモIDを設定。
	replyMemo.parentId = parentMemo.id

	// ! 親メモと同じファイルに追加。
	await addMemoToFile(replyMemo, parentMemo)

	// ! スレッドインデックスを更新。
	await updateThreadIndex(threadIndex, replyMemo)

	return replyMemo
}
```

> NOTE: 新規返信は既存ツリー外から挿入されるため循環参照は発生しない。親変更（リパレンティング）機能では `wouldIntroduceCycle()` を使用して検証する。

#### 3.1.2 制約

- **最大深さ**: **無制限**（UI表示は適宜調整）
- **循環参照の禁止**: 親メモが子孫メモを参照することは不可
- **カテゴリ制約**: 返信は親メモと同じカテゴリのみ可能
- **枝分かれ**: 1つのメモに対して複数の返信可能

### 3.2 スレッドツリーの構築

```typescript
// ! スレッドツリーを構築する（ThreadIndexから）。
function buildThreadTree(
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

	while (queue.length > 0) {
		const currentId = queue.shift()!
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
```

**最適化ポイント:**

1. ThreadIndexから直接構築（O(N)）
2. 再帰を使わずBFSで実装（スタックオーバーフロー回避）
3. メモ本体は参照のみ（メモリ効率化）
4. 深さ無制限に対応

### 3.3 スレッドの表示

#### 3.3.1 フラット表示モード（デフォルト）

全メモをタイムスタンプ順で表示。スレッド関係は視覚的に表現されない。

#### 3.3.2 ツリー表示モード

スレッド関係をインデントで表現。

**表示例:**

```
┌─────────────────────────────────────┐
│ 📝 プロジェクトXの方針について      │ <- ルート
│ 2025-11-04 10:00                    │
│ 次のプロジェクトの方針を検討...     │
│ [返信 1件]                          │
├─────────────────────────────────────┤
│   ┗━ 📝 技術選定について           │ <- 深さ1
│       2025-11-04 10:15              │
│       技術スタックはReactで...       │
│       [返信 2件]                    │
├─────────────────────────────────────┤
│       ┗━ 📝 TypeScript必須         │ <- 深さ2
│           2025-11-04 10:20          │
│           型安全性のため...          │
├─────────────────────────────────────┤
│       ┗━ 📝 Viteを使う             │ <- 深さ2
│           2025-11-04 10:25          │
│           ビルドツールは...          │
└─────────────────────────────────────┘
```

#### 3.3.3 折りたたみ機能

- 返信が1件以上あるメモには折りたたみアイコン（▼/▶）を表示
- クリックで子スレッドを折りたたみ/展開
- 折りたたみ状態はセッションストレージに保存

### 3.4 スレッド削除

#### 3.4.1 削除ポリシー

**オプション1: 子メモも一緒に削除（推奨）**

- 親メモを削除すると、すべての子孫メモも削除される
- スレッドの一貫性を保つ

**オプション2: 子メモを孤児化**

- 親メモのみ削除し、子メモは残る
- 子メモのparentIdをnullに設定

**採用: オプション1（一括削除）**

- 理由: データの整合性を保ちやすい
- ただし、削除前に確認ダイアログを表示

```typescript
// ! スレッド全体を削除する。
async function deleteThread(rootMemo: MemoEntry): Promise<void> {
	// ! スレッドツリーを構築。
	const memoMap = buildMemoMap() // MemoManagerが保持するID→MemoEntryのMapを再構築
	const memoList = Array.from(memoMap.values())
	const threadIndex = threadIndexManager.getIndex(memoList)
	const tree = buildThreadTree(rootMemo.id, threadIndex, memoMap)

	// ! 削除確認。
	const confirmed = await confirmDialog(
		`このメモと返信${tree.totalCount - 1}件を削除しますか？`,
	)
	if (!confirmed) return

	// ! ツリー内の全メモを収集。
	const memosToDelete = Array.from(tree.nodes.keys())

	// ! 一括削除。
	for (const memoId of memosToDelete) {
		await deleteMemo(memoId)
	}
}
```

### 3.5 ゴミ箱機能のスレッド対応（v0.0.16で実装）

#### 3.5.1 返信投稿の削除と復元

**ゴミ箱機能ON時の動作:**

1. **返信投稿の削除**
   - 返信投稿（parentId !== null）を削除すると、`trashedAt`フラグが設定される
   - ゴミ箱タブに移動し、スレッド構造を維持したまま表示される
   - 親投稿と返信投稿は独立して削除・復元可能

2. **削除済み親投稿の表示**
   - 削除済み親投稿にアクティブな返信がある場合、プレースホルダーで表示
   - プレースホルダーには「[削除済み] [復元]」と表示
   - 返信がない削除済み投稿は非表示

3. **復元機能**
   - 単独投稿の復元: その投稿のみ復元
   - 親投稿の復元: 削除済みの全子孫も一括復元
   - ゴミ箱タブから復元ボタンで実行

**ゴミ箱機能OFF時の動作:**

1. **返信なし投稿の削除**
   - 完全削除（ファイルから削除）

2. **返信あり投稿の削除**
   - 削除マーカー（`permanently-deleted: true`）を作成
   - 返信は維持され、削除マーカーがプレースホルダーとして表示
   - 復元不可（「[削除済み] (復元できません)」と表示）

#### 3.5.2 データ構造の拡張

```typescript
export interface MemoEntry {
	// ... 既存フィールド ...

	// ! 完全削除済みフラグ（ゴミ箱OFF時）。v0.0.16で追加。
	permanentlyDeleted?: boolean
}
```

#### 3.5.3 関連機能

- `hasActiveReplies()`: アクティブな返信の有無を判定
- `shouldShowDeletedPlaceholder()`: 削除済みプレースホルダーの表示判定
- `getDescendantMemos()`: 全子孫メモを再帰的に取得
- `createDeletionMarker()`: 削除マーカーの生成
- `markMemoAsRestored()`: 復元処理（文字列配列ベース）

---

## 4. UI/UX 設計

### 4.1 メモカードの拡張

```
┌─────────────────────────────────────────┐
│ 📝 プロジェクトXの方針について          │
│ 2025-11-04 10:00                        │
├─────────────────────────────────────────┤
│ 次のプロジェクトの方針を検討したい。    │
│ まずは技術選定から。                    │
├─────────────────────────────────────────┤
│ [📌] [🗑️] [✏️] [💬返信] [↗︎返信1件]     │ <- 新規ボタン
└─────────────────────────────────────────┘
```

**新規追加:**

- **返信ボタン（💬）**: このメモに返信を作成
- **返信数表示（↗︎返信N件）**: スレッド情報を表示、クリックでツリー表示に切り替え

### 4.2 返信入力フォーム

返信ボタンをクリックすると、入力フォームが開き、親メモ情報が表示される。

```
┌─────────────────────────────────────────┐
│ 💬 返信を作成                            │
├─────────────────────────────────────────┤
│ 返信先:                                  │
│ ┌─────────────────────────────────────┐ │
│ │ 📝 プロジェクトXの方針について      │ │
│ │ 2025-11-04 10:00                    │ │
│ │ 次のプロジェクトの方針を検討...     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [                                       ] │
│ [  返信内容を入力...                   ] │
│ [                                       ] │
├─────────────────────────────────────────┤
│ [キャンセル]                    [送信]  │
└─────────────────────────────────────────┘
```

### 4.3 スレッド表示モード切り替え

サイドバー上部に表示モード切り替えボタンを追加。

```
┌─────────────────────────────────────────┐
│ Memolog                                  │
├─────────────────────────────────────────┤
│ 📅 今日 | 📆 一週間                      │
│ 📋 フラット | 🌳 ツリー  <- 新規追加     │
├─────────────────────────────────────────┤
│ [All] [仕事] [個人]                      │
└─────────────────────────────────────────┘
```

**表示モード:**

- **フラット**: 従来通りの時系列表示
- **ツリー**: スレッド構造を可視化

### 4.4 ツリー表示のインデント

```css
.memo-card {
	margin-left: calc(var(--thread-depth) * 20px);
}

.memo-card.depth-0 { margin-left: 0; }
.memo-card.depth-1 { margin-left: 20px; }
.memo-card.depth-2 { margin-left: 40px; }
.memo-card.depth-3 { margin-left: 60px; }
/* ... 最大10階層まで */
```

**視覚的な接続線:**

```
│ <- 縦線で親子関係を表現
┗━ <- 子メモの開始位置
```

---

## 5. キャッシュ戦略

### 5.1 ThreadIndexManagerの実装

```typescript
// ! スレッドインデックスマネージャー。
export class ThreadIndexManager {
	private index: ThreadIndex | null = null
	private treeCache: Map<string, ThreadTree> = new Map()
	private lastBuildTime: number = 0
	private lastSignature: string | null = null // メモ集合の最新署名（構造変化検出用）

	// ! スレッドインデックスを取得（キャッシュ済みなら再利用）。
	getIndex(memos: MemoEntry[]): ThreadIndex {
		const signature = this.createSignature(memos)

		// ! インデックスが未構築、または構造が変わった場合は再構築。
		if (!this.index || this.needsRebuild(signature)) {
			this.index = buildThreadIndex(memos)
			this.lastSignature = signature
			this.lastBuildTime = Date.now()
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
		if (this.treeCache.has(rootId)) {
			return this.treeCache.get(rootId)!
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
		this.lastBuildTime = Date.now()
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
			const updated = memo.updatedAt ? memo.updatedAt.toISOString() : memo.timestamp
			return `${memo.id}:${parent}:${updated}`
		})
		parts.sort()
		return `${memos.length}|${parts.join("|")}`
	}
}
```

### 5.2 インデックス更新戦略

**差分更新（v0.0.15以降で検討）:**
現在は全体再構築だが、将来的には差分更新を実装。

```typescript
// ! メモ追加時の差分更新。
function addMemoToIndex(memo: MemoEntry, index: ThreadIndex): void {
	if (memo.parentId) {
		// ! 子として登録。
		if (!index.childrenMap.has(memo.parentId)) {
			index.childrenMap.set(memo.parentId, [])
		}
		index.childrenMap.get(memo.parentId)!.push(memo.id)
		index.parentMap.set(memo.id, memo.parentId)

		// ! 深さを設定。
		const parentDepth = index.depthMap.get(memo.parentId) || 0
		index.depthMap.set(memo.id, parentDepth + 1)

		// ! 祖先の子孫数を更新。
		updateAncestorDescendantCount(memo.parentId, index, +1)
	} else {
		// ! ルートメモ。
		index.rootIds.add(memo.id)
		index.depthMap.set(memo.id, 0)
	}

	index.descendantCountMap.set(memo.id, 0)
}

// ! 祖先の子孫数を更新（反復処理）。
function updateAncestorDescendantCount(
	memoId: string,
	index: ThreadIndex,
	delta: number,
): void {
	let currentId: string | undefined = memoId
	while (currentId) {
		const current = index.descendantCountMap.get(currentId) || 0
		index.descendantCountMap.set(currentId, current + delta)
		currentId = index.parentMap.get(currentId)
	}
}
```

### 5.3 キャッシュ無効化のタイミング

- **メモ追加時**: ThreadIndexを再構築、影響を受けるツリーキャッシュを無効化
- **メモ削除時**: ThreadIndexを再構築、削除されたメモを含むツリーキャッシュを無効化
- **メモ更新時（parent変更）**: ThreadIndexを再構築、全ツリーキャッシュをクリア
- **ファイル読み込み時**: ThreadIndexを再構築

### 5.4 メモリ使用量の見積もり

**1000メモ、平均深さ5、平均子数2の場合:**

- ThreadIndex:
  - childrenMap: 1000エントリ × (24B + 配列) ≈ 50KB
  - parentMap: 1000エントリ × 40B ≈ 40KB
  - depthMap: 1000エントリ × 32B ≈ 32KB
  - descendantCountMap: 1000エントリ × 32B ≈ 32KB
  - rootIds: 500エントリ × 16B ≈ 8KB
  - **合計: 約162KB**

- ThreadTreeキャッシュ（100ツリー）:
  - 各ツリー平均10ノード
  - 1ノード ≈ 120B
  - **合計: 100 × 10 × 120B ≈ 120KB**

**総メモリ使用量: 約282KB（1000メモ）**

目標10MB以内に対して十分に小さい。

---

## 6. ファイルフォーマット

### 6.1 スレッド付きメモの例

```markdown
<!-- memo-id: root-001, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->

## 2025-11-04 10:00

プロジェクトXの方針について検討したい。

<!-- memo-id: reply-001, timestamp: 2025-11-04T10:15:00+09:00, category: "work", parent-id: root-001 -->

## 2025-11-04 10:15

技術選定から始めよう。Reactがいいと思う。

<!-- memo-id: reply-002, timestamp: 2025-11-04T10:20:00+09:00, category: "work", parent-id: reply-001 -->

## 2025-11-04 10:20

TypeScriptは必須だね。

<!-- memo-id: reply-003, timestamp: 2025-11-04T10:25:00+09:00, category: "work", parent-id: reply-001 -->

## 2025-11-04 10:25

ビルドツールはViteで。
```

### 6.2 後方互換性

- parent-id 属性がないメモはルートメモとして扱う
- 既存のメモファイルはそのまま動作
- parent-id が存在しないIDを参照している場合はエラーログ出力し、孤児メモとして扱う

---

## 7. 実装計画

### 7.1 フェーズ1: データ構造とコア機能

- [ ] MemoEntry型にparentIdを追加
- [ ] ThreadNode, ThreadTree型の定義
- [ ] buildThreadTree() 関数の実装
- [ ] HTMLコメントタグのパーサー拡張
- [ ] memoToText() 関数の拡張（parent-id対応）
- [ ] 単体テスト作成（50件以上）

### 7.2 フェーズ2: キャッシュとパフォーマンス

- [ ] ThreadCacheManager の実装
- [ ] スレッドツリーキャッシュの統合
- [ ] パフォーマンステスト（1000メモ以上）
- [ ] メモリ使用量の最適化

### 7.3 フェーズ3: UI実装

- [ ] 返信ボタンの追加
- [ ] 返信入力フォームの実装
- [ ] スレッド表示モード切り替えUI
- [ ] ツリー表示のインデント実装
- [ ] 折りたたみ/展開機能
- [ ] 返信数バッジの表示

### 7.4 フェーズ4: スレッド操作

- [ ] createReply() 関数の実装
- [ ] deleteThread() 関数の実装
- [ ] スレッド移動機能（親の変更）
- [ ] スレッド分離機能（子を独立させる）
- [ ] エラーハンドリング

### 7.5 フェーズ5: テストと品質保証

- [ ] 統合テスト（100件以上）
- [ ] E2Eテスト（主要シナリオ）
- [ ] パフォーマンステスト
- [ ] アクセシビリティチェック
- [ ] ドキュメント整備

---

## 8. パフォーマンス目標

### 8.1 レスポンス時間

- **ThreadIndex構築**: 1000メモで20ms以内
- **スレッドツリー構築**: ThreadIndexから5ms以内
- **親メモ取得**: O(1)、1μs以内
- **子メモリスト取得**: O(1)、1μs以内
- **深さ取得**: O(1)、1μs以内
- **返信作成**: 100ms以内
- **ツリー表示切り替え**: 50ms以内

### 8.2 メモリ使用量

- **ThreadIndex**: 1000メモで300KB以内
- **ThreadTreeキャッシュ**: 100ツリーで200KB以内
- **総メモリ**: 1000メモで1MB以内
- **ツリー表示時の追加メモリ**: 500KB以内

### 8.3 スケーラビリティ

- **最大スレッド深さ**: **無制限**（UIは適宜調整）
- **最大返信数（1メモあたり）**: 無制限
- **スレッドツリー全体**: 10,000メモまで快適動作
- **推奨最大深さ（UI）**: 50階層（それ以上は折りたたみ推奨）

### 8.4 長いスレッドへの対応

**仮想スクロール（v0.0.15以降）:**

- 表示領域外のノードはレンダリングしない
- スクロールに応じて動的にレンダリング
- 10,000ノードのスレッドでも滑らかにスクロール

**段階的ローディング（v0.0.15以降）:**

- 初期表示は深さ10まで
- 「さらに表示」ボタンで追加ロード
- メモリとレンダリングコストを削減

---

## 9. セキュリティとデータ整合性

### 9.1 循環参照の防止

```typescript
// ! 既存メモの親を変更する際に循環参照が生じないか検証する。
function wouldIntroduceCycle(
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
```

**利用上の注意:**

- `childId` は既にThreadIndex上に存在している必要がある（新規返信では不要）。
- UI上でドラッグ＆ドロップなどで親を変更する場合にのみ呼び出す。

**計算量: O(D)** （Dは深さ）
ThreadIndexを使用することでO(1)の親参照が可能。

### 9.2 孤児メモの検出と修復

```typescript
// ! 孤児メモ（親が存在しないメモ）を検出。
function findOrphanMemos(allMemos: MemoEntry[]): MemoEntry[] {
	const memoIds = new Set(allMemos.map(m => m.id))
	return allMemos.filter(m => m.parentId && !memoIds.has(m.parentId))
}

// ! 孤児メモをルートメモに昇格。
function repairOrphanMemos(orphans: MemoEntry[]): void {
	for (const orphan of orphans) {
		orphan.parentId = undefined
		console.warn(`Orphan memo ${orphan.id} promoted to root`)
	}
}
```

---

## 10. マイグレーション

### 10.1 既存データの扱い

既存のメモはすべてルートメモとして扱われる（parent-id なし）。特別なマイグレーション処理は不要。

### 10.2 将来的な拡張

#### スレッドのインポート/エクスポート

スレッド構造を保ったままJSON形式でエクスポート。

```json
{
	"rootMemo": { "id": "root-001", ... },
	"replies": [
		{ "id": "reply-001", "parentId": "root-001", ... },
		{ "id": "reply-002", "parentId": "reply-001", ... }
	]
}
```

#### スレッドのマージ

複数のスレッドを1つに統合する機能。

#### スレッドの分割

長いスレッドを複数の小さいスレッドに分割する機能。

---

## 11. 用語集

| 用語           | 説明                                   |
| -------------- | -------------------------------------- |
| スレッド       | 親子関係で繋がったメモの集合           |
| ルートメモ     | スレッドの最上位メモ（parentIdがnull） |
| 返信           | 既存メモに対する子メモ                 |
| スレッドツリー | スレッド全体を木構造で表現したもの     |
| 深さ           | ルートメモからの階層数（ルート=0）     |
| 孤児メモ       | 親メモが存在しないメモ（データ不整合） |

---

## 12. 成功基準

### 12.1 機能要件

- [x] 既存メモに返信を追加できる
- [x] スレッドをツリー表示できる
- [x] スレッド全体を削除できる
- [x] 折りたたみ/展開ができる
- [x] 返信数が表示される

### 12.2 非機能要件

- [x] 1000メモのThreadIndexを20ms以内で構築
- [x] ThreadIndexからツリー構築が5ms以内
- [x] 親子参照がO(1)で実行可能
- [x] 深さ無制限に対応
- [x] 返信作成が100ms以内
- [x] メモリ使用量が1000メモで1MB以内
- [x] 既存機能への影響なし（後方互換性）
- [x] テストカバレッジ90%以上維持

---

## 13. 改訂履歴

### 2025-11-13 (第3版・実装完了版)

**実装完了:**

- スレッド表示機能の全機能を実装完了
- 53個の包括的なテストを追加（全て成功）
- パフォーマンス要件を全て達成
- 後方互換性を完全に維持

**実装された主要機能:**

1. **スレッド表示画面**
   - 親メモ + 返信のツリー表示
   - スレッドボタンの追加（返信があるメモに表示）
   - スレッド表示でのインライン返信機能
   - 2世代以降のスレッドナビゲーション改善

2. **UX改善**
   - スレッドボタンをカテゴリ変更ボタンの左に配置
   - 返信のカテゴリ変更ボタンを非表示化
   - 時系列順（古い順）で返信を表示
   - カテゴリタブ切り替え時にスレッド表示を自動で閉じる

3. **削除機能の改善**
   - 返信があるメモの削除時にオプション選択
   - 「返信も一緒に削除」または「返信を残して親を削除」を選択可能

4. **ゴミ箱機能の返信対応（基盤実装）**
   - 返信があるメモの削除時に削除マーカー作成
   - 子孫メモの一括削除/復元機能

### 2025-11-04 (第2版)

**主な変更点:**

1. **データ構造の最適化**
   - 親ID参照方式からハイブリッドインデックス方式に変更
   - ThreadIndexの導入によりO(1)の双方向参照を実現
   - 深さ無制限に対応

2. **パフォーマンスの大幅向上**
   - ThreadIndex構築: O(N)
   - 親子参照: O(1)
   - メモリ使用量: 1000メモで282KB → 1MB以内

3. **スケーラビリティの向上**
   - 最大深さ制限を撤廃（10階層 → 無制限）
   - 10,000メモまで快適動作を保証
   - 枝分かれ（複数の子）に完全対応

4. **キャッシュ戦略の改善**
   - ThreadIndexManagerの実装
   - ツリーキャッシュの効率化
   - 差分更新の将来実装に向けた設計

---

以上、memolog v0.0.14仕様書（実装完了版）
