# memolog 仕様書 v0.0.14 - スレッド機能

最終更新: 2025-11-04
バージョン: v0.0.14（策定中）

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

2. **効率的なデータ構造**
   - 双方向リンク構造による高速な親子参照
   - スレッドツリーのキャッシング
   - パフォーマンスを損なわない設計

3. **UI/UX の改善**
   - インデント表示によるスレッド階層の可視化
   - 返信ボタンの追加
   - スレッド折りたたみ/展開機能

---

## 2. データ構造設計

### 2.1 スレッド関係の表現方法

#### 方針A: 親ID参照方式 (採用案)

各メモが親メモのIDを保持する方式。シンプルで拡張性が高い。

**メリット:**
- データ構造がシンプル
- 既存のMemoEntry型への変更が最小限
- ファイルフォーマットの変更が容易
- 循環参照のチェックが容易

**デメリット:**
- 子メモのリストを取得する際に全メモを走査する必要がある（初回のみ、後はキャッシュ）
- ルートから辿る際の効率は低い（キャッシュで対応）

#### 方針B: 双方向リンク方式 (不採用)

各メモが親IDと子IDリストの両方を保持する方式。

**メリット:**
- 親子双方向の参照が高速

**デメリット:**
- データの整合性維持が複雑
- メモ追加/削除時に親メモも更新が必要
- ファイルフォーマットが複雑化
- 既存データのマイグレーションが困難

**結論: 方針Aを採用**
- シンプルさと保守性を優先
- パフォーマンスはキャッシュレイヤーで解決
- 既存データ構造への影響を最小化

### 2.2 MemoEntry型の拡張

```typescript
//! メモエントリの型定義。
export interface MemoEntry {
	//! メモの一意識別子（UUID等）。
	id: string;

	//! カテゴリ名。
	category: string;

	//! タイムスタンプ（ISO 8601形式）。
	timestamp: string;

	//! メモの本文。
	content: string;

	//! 添付ファイルのパス配列（オプション）。
	attachments?: string[];

	//! メモ作成時に使用されたテンプレート（オプション）。
	template?: string;

	//! 作成日時（Date型）。
	createdAt?: Date;

	//! 更新日時（Date型）。
	updatedAt?: Date;

	//! ゴミ箱に移動した日時（ISO 8601形式）。
	trashedAt?: string;

	//! ピン留めした日時（ISO 8601形式）。
	pinnedAt?: string;

	//! 親メモのID（スレッドの場合）。v0.0.14で追加。
	parentId?: string;

	//! 返信数（キャッシュ用）。v0.0.14で追加。
	replyCount?: number;
}
```

### 2.3 スレッドツリー構造

```typescript
//! スレッドツリーのノード。
export interface ThreadNode {
	//! メモエントリ。
	memo: MemoEntry;

	//! 子ノードの配列（返信）。
	children: ThreadNode[];

	//! スレッドの深さ（0がルート）。
	depth: number;

	//! 折りたたみ状態（UIで使用）。
	collapsed?: boolean;
}

//! スレッドツリー。
export interface ThreadTree {
	//! ルートメモのID。
	rootId: string;

	//! ルートノード。
	root: ThreadNode;

	//! 全メモ数（ルート含む）。
	totalCount: number;

	//! 最大深さ。
	maxDepth: number;

	//! 最終更新日時（ツリー内の最新タイムスタンプ）。
	lastUpdated: string;
}
```

### 2.4 HTMLコメントタグの拡張

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
//! 返信メモを作成する。
async function createReply(
	parentMemo: MemoEntry,
	content: string,
	category: string
): Promise<MemoEntry> {
	//! 新しいメモを作成。
	const replyMemo = createMemoEntry(category, content);

	//! 親メモIDを設定。
	replyMemo.parentId = parentMemo.id;

	//! 親メモと同じファイルに追加。
	await addMemoToFile(replyMemo, parentMemo);

	//! キャッシュを更新。
	await updateThreadCache(parentMemo.id);

	return replyMemo;
}
```

#### 3.1.2 制約

- **最大深さ**: 10階層まで（パフォーマンスとUI可読性のため）
- **循環参照の禁止**: 親メモが子孫メモを参照することは不可
- **カテゴリ制約**: 返信は親メモと同じカテゴリのみ可能

### 3.2 スレッドツリーの構築

```typescript
//! スレッドツリーを構築する。
function buildThreadTree(rootMemo: MemoEntry, allMemos: MemoEntry[]): ThreadTree {
	//! ルートノードを作成。
	const root: ThreadNode = {
		memo: rootMemo,
		children: [],
		depth: 0,
	};

	//! 子メモを再帰的に追加。
	function addChildren(node: ThreadNode, currentDepth: number): void {
		if (currentDepth >= MAX_THREAD_DEPTH) return;

		//! このノードの子メモを検索。
		const children = allMemos.filter(m => m.parentId === node.memo.id);

		//! タイムスタンプ順にソート。
		children.sort((a, b) =>
			new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
		);

		//! 子ノードを作成。
		for (const childMemo of children) {
			const childNode: ThreadNode = {
				memo: childMemo,
				children: [],
				depth: currentDepth + 1,
			};
			node.children.push(childNode);

			//! 再帰的に孫メモを追加。
			addChildren(childNode, currentDepth + 1);
		}
	}

	addChildren(root, 0);

	//! ツリー統計を計算。
	let totalCount = 0;
	let maxDepth = 0;
	let lastUpdated = rootMemo.timestamp;

	function traverse(node: ThreadNode): void {
		totalCount++;
		maxDepth = Math.max(maxDepth, node.depth);
		if (node.memo.timestamp > lastUpdated) {
			lastUpdated = node.memo.timestamp;
		}
		for (const child of node.children) {
			traverse(child);
		}
	}

	traverse(root);

	return {
		rootId: rootMemo.id,
		root,
		totalCount,
		maxDepth,
		lastUpdated,
	};
}
```

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
//! スレッド全体を削除する。
async function deleteThread(rootMemo: MemoEntry): Promise<void> {
	//! スレッドツリーを構築。
	const tree = buildThreadTree(rootMemo, allMemos);

	//! 削除確認。
	const confirmed = await confirmDialog(
		`このメモと返信${tree.totalCount - 1}件を削除しますか？`
	);
	if (!confirmed) return;

	//! ツリー内の全メモを収集。
	const memosToDelete: string[] = [];
	function collectIds(node: ThreadNode): void {
		memosToDelete.push(node.memo.id);
		for (const child of node.children) {
			collectIds(child);
		}
	}
	collectIds(tree.root);

	//! 一括削除。
	for (const memoId of memosToDelete) {
		await deleteMemo(memoId);
	}
}
```

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

### 5.1 スレッドキャッシュ

```typescript
//! スレッドキャッシュマネージャー。
export class ThreadCacheManager {
	private treeCache: Map<string, ThreadTree> = new Map();
	private childrenCache: Map<string, string[]> = new Map();

	//! スレッドツリーをキャッシュから取得（なければ構築）。
	getThreadTree(rootId: string, allMemos: MemoEntry[]): ThreadTree {
		if (this.treeCache.has(rootId)) {
			return this.treeCache.get(rootId)!;
		}

		const rootMemo = allMemos.find(m => m.id === rootId);
		if (!rootMemo) throw new Error("Root memo not found");

		const tree = buildThreadTree(rootMemo, allMemos);
		this.treeCache.set(rootId, tree);
		return tree;
	}

	//! 子メモIDリストをキャッシュから取得。
	getChildren(parentId: string, allMemos: MemoEntry[]): string[] {
		if (this.childrenCache.has(parentId)) {
			return this.childrenCache.get(parentId)!;
		}

		const children = allMemos
			.filter(m => m.parentId === parentId)
			.map(m => m.id);

		this.childrenCache.set(parentId, children);
		return children;
	}

	//! キャッシュをクリア。
	clear(): void {
		this.treeCache.clear();
		this.childrenCache.clear();
	}

	//! 特定のツリーのキャッシュを無効化。
	invalidate(rootId: string): void {
		this.treeCache.delete(rootId);
		//! 子孫のキャッシュも削除（再帰的）。
		this.clearDescendants(rootId);
	}

	private clearDescendants(parentId: string): void {
		const children = this.childrenCache.get(parentId) || [];
		this.childrenCache.delete(parentId);
		for (const childId of children) {
			this.clearDescendants(childId);
		}
	}
}
```

### 5.2 キャッシュ無効化のタイミング

- メモ追加時: 親メモのツリーキャッシュを無効化
- メモ削除時: 削除されたメモのツリーキャッシュを無効化
- メモ更新時: 影響を受けるツリーキャッシュを無効化

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

- スレッドツリー構築: 100メモで10ms以内
- 返信作成: 100ms以内
- ツリー表示切り替え: 50ms以内

### 8.2 メモリ使用量

- スレッドキャッシュ: 1000メモで10MB以内
- ツリー表示時の追加メモリ: 5MB以内

### 8.3 制約

- 最大スレッド深さ: 10階層
- 最大返信数（1メモあたり）: 制限なし（UI上は100件まで表示推奨）
- スレッドツリー全体: 500メモまで（それ以上は警告表示）

---

## 9. セキュリティとデータ整合性

### 9.1 循環参照の防止

```typescript
//! 循環参照チェック。
function detectCircularReference(
	memoId: string,
	parentId: string,
	allMemos: MemoEntry[]
): boolean {
	const visited = new Set<string>();
	let currentId: string | undefined = parentId;

	while (currentId) {
		if (currentId === memoId) return true; // 循環発見
		if (visited.has(currentId)) return true; // 無限ループ防止
		visited.add(currentId);

		const parent = allMemos.find(m => m.id === currentId);
		currentId = parent?.parentId;
	}

	return false;
}
```

### 9.2 孤児メモの検出と修復

```typescript
//! 孤児メモ（親が存在しないメモ）を検出。
function findOrphanMemos(allMemos: MemoEntry[]): MemoEntry[] {
	const memoIds = new Set(allMemos.map(m => m.id));
	return allMemos.filter(m =>
		m.parentId && !memoIds.has(m.parentId)
	);
}

//! 孤児メモをルートメモに昇格。
function repairOrphanMemos(orphans: MemoEntry[]): void {
	for (const orphan of orphans) {
		orphan.parentId = undefined;
		console.warn(`Orphan memo ${orphan.id} promoted to root`);
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

| 用語 | 説明 |
|------|------|
| スレッド | 親子関係で繋がったメモの集合 |
| ルートメモ | スレッドの最上位メモ（parentIdがnull） |
| 返信 | 既存メモに対する子メモ |
| スレッドツリー | スレッド全体を木構造で表現したもの |
| 深さ | ルートメモからの階層数（ルート=0） |
| 孤児メモ | 親メモが存在しないメモ（データ不整合） |

---

## 12. 成功基準

### 12.1 機能要件

- [x] 既存メモに返信を追加できる
- [x] スレッドをツリー表示できる
- [x] スレッド全体を削除できる
- [x] 折りたたみ/展開ができる
- [x] 返信数が表示される

### 12.2 非機能要件

- [x] 100メモのスレッドツリーを10ms以内で構築
- [x] 返信作成が100ms以内
- [x] 既存機能への影響なし（後方互換性）
- [x] テストカバレッジ90%以上維持

---

以上、memolog v0.0.14仕様書
