# MemoManager.ts 分析レポート

## 概要

- **ファイル**: `src/core/memo-manager.ts`
- **行数**: 610行
- **現在のカバレッジ**: 57.79%
- **目標カバレッジ**: 85%+

## メソッド一覧と責務分析

### プライベートメソッド (ヘルパー)

#### 1. `generateTimestamp(): string` (27行)

- **責務**: 現在のタイムスタンプ生成
- **分類**: ユーティリティ
- **テスト**: 容易
- **提案**: そのまま残す (単純なため)

#### 2. `parseTextToMemo(text: string, category: string): MemoEntry | null` (33-158行, 約125行)

- **責務**: テキストからMemoEntryへのパース
- **分類**: ビジネスロジック
- **テスト**: 容易
- **提案**: **`memo-helpers.ts`に移動** ← 最優先
- **理由**:
  - 純粋関数として抽出可能
  - 複雑なロジック (125行)
  - I/O依存なし
  - テストカバレッジ向上に直結

### パブリックメソッド (API)

#### 3. `async addMemo(...)` (159-228行, 約69行)

- **責務**: 新規メモの追加
- **分類**: CRUD操作 (I/O含む)
- **依存**: vaultHandler, cacheManager
- **テスト**: モック必要
- **提案**: **ロジック部分を `memo-crud-operations.ts` に抽出**
- **抽出可能な部分**:
  - メモオブジェクトの生成ロジック
  - ファイルパスの決定ロジック
  - コンテンツの構築ロジック
- **残す部分**:
  - ファイルI/O呼び出し
  - キャッシュ操作

#### 4. `async moveToTrash(...)` (229-302行, 約73行)

- **責務**: メモをゴミ箱に移動
- **分類**: ゴミ箱管理 (I/O含む)
- **依存**: vaultHandler, cacheManager
- **テスト**: モック必要
- **提案**: **`memo-trash-operations.ts` に抽出**
- **抽出可能な部分**:
  - コメントアウト処理
  - ゴミ箱ファイルパスの決定
  - メタデータの更新
- **残す部分**:
  - ファイルI/O呼び出し
  - キャッシュ操作

#### 5. `async restoreFromTrash(...)` (303-388行, 約85行)

- **責務**: ゴミ箱からメモを復元
- **分類**: ゴミ箱管理 (I/O含む)
- **依存**: vaultHandler, cacheManager
- **テスト**: モック必要
- **提案**: **`memo-trash-operations.ts` に抽出**
- **抽出可能な部分**:
  - コメント解除処理
  - メタデータの復元
  - 復元先ファイルパスの決定
- **残す部分**:
  - ファイルI/O呼び出し
  - キャッシュ操作

#### 6. `async deleteMemo(...)` (389-429行, 約40行)

- **責務**: メモの完全削除
- **分類**: CRUD操作 (I/O含む)
- **依存**: vaultHandler, cacheManager
- **テスト**: モック必要
- **提案**: **`memo-crud-operations.ts` に抽出**
- **抽出可能な部分**:
  - 削除対象の検索ロジック
- **残す部分**:
  - ファイルI/O呼び出し
  - キャッシュ操作

#### 7. `async getMemos(...)` (430-478行, 約48行)

- **責務**: メモ一覧の取得
- **分類**: CRUD操作 (I/O含む)
- **依存**: vaultHandler, cacheManager
- **テスト**: モック必要
- **提案**: **`memo-query-operations.ts` に抽出**
- **抽出可能な部分**:
  - メモフィルタリングロジック
  - ソート処理
- **残す部分**:
  - ファイルI/O呼び出し
  - キャッシュ操作

#### 8. `async getMemoById(...)` (479-484行, 約6行)

- **責務**: IDによるメモ取得
- **分類**: CRUD操作
- **依存**: getMemos()
- **テスト**: 容易
- **提案**: そのまま残す (単純なラッパー)

#### 9. `async updateMemo(...)` (485-547行, 約62行)

- **責務**: メモの更新
- **分類**: CRUD操作 (I/O含む)
- **依存**: vaultHandler, cacheManager
- **テスト**: モック必要
- **提案**: **`memo-crud-operations.ts` に抽出**
- **抽出可能な部分**:
  - メモ検索ロジック
  - 更新処理
  - 新しいテキスト生成
- **残す部分**:
  - ファイルI/O呼び出し
  - キャッシュ操作

#### 10. `async updateTodoCompleted(...)` (548-602行, 約54行)

- **責務**: TODOの完了状態更新
- **分類**: TODO管理 (I/O含む)
- **依存**: vaultHandler, cacheManager
- **テスト**: モック必要
- **提案**: **`memo-todo-operations.ts` に抽出**
- **抽出可能な部分**:
  - TODOチェックボックスの切り替えロジック
  - 完了状態の判定
- **残す部分**:
  - ファイルI/O呼び出し
  - キャッシュ操作

#### 11. `async initializeCategory(...)` (603-610行, 約7行)

- **責務**: カテゴリの初期化
- **分類**: 初期化処理
- **依存**: vaultHandler
- **テスト**: 容易
- **提案**: そのまま残す (単純なため)

## 責務別グループ化

### グループ1: ヘルパー関数 (memo-helpers.ts)

既に一部抽出済み。追加で抽出すべき:

- ✅ `formatTimestamp()` - 抽出済み
- ✅ `memoToText()` - 抽出済み
- ⬜ **`parseTextToMemo()`** - 125行の大型関数、最優先で抽出

### グループ2: CRUD操作 (memo-crud-operations.ts)

新規作成予定:

- メモ作成ロジック (`addMemo`から抽出)
- メモ更新ロジック (`updateMemo`から抽出)
- メモ削除ロジック (`deleteMemo`から抽出)
- メモ検索ロジック (複数メソッドから抽出)

### グループ3: クエリ操作 (memo-query-operations.ts)

新規作成予定:

- メモフィルタリング (`getMemos`から抽出)
- メモソート処理
- メモ検索処理

### グループ4: ゴミ箱操作 (memo-trash-operations.ts)

新規作成予定:

- ゴミ箱移動ロジック (`moveToTrash`から抽出)
- 復元ロジック (`restoreFromTrash`から抽出)
- ゴミ箱ファイルパス管理

### グループ5: TODO操作 (memo-todo-operations.ts)

新規作成予定:

- TODO完了切り替えロジック (`updateTodoCompleted`から抽出)
- TODO状態判定

### グループ6: ファイルI/O操作 (memo-file-io.ts)

新規作成予定:

- ファイル読み込みラッパー
- ファイル書き込みラッパー
- ファイル追記ラッパー
- キャッシュ連携処理

### グループ7: MemoManager (ファサード)

最終的に残る部分:

- 各操作モジュールの呼び出し
- エラーハンドリング
- 通知処理
- 初期化処理

## リファクタリング優先順位

### 最優先 (Priority 1)

1. **`parseTextToMemo()` を `memo-helpers.ts` に移動**
   - 理由: 125行の大型関数、純粋関数として抽出可能
   - 効果: カバレッジ大幅向上、テストが容易に
   - 工数: 1日

### 高優先 (Priority 2)

2. **`memo-crud-operations.ts` の作成**
   - 対象: `addMemo`, `updateMemo`, `deleteMemo`
   - 理由: コアビジネスロジック、テスト重要度が高い
   - 効果: CRUD操作の品質保証
   - 工数: 2-3日

3. **`memo-trash-operations.ts` の作成**
   - 対象: `moveToTrash`, `restoreFromTrash`
   - 理由: ゴミ箱機能の重要性、バグの影響大
   - 効果: データ損失リスクの低減
   - 工数: 1-2日

### 中優先 (Priority 3)

4. **`memo-query-operations.ts` の作成**
   - 対象: `getMemos`のフィルタリング/ソート部分
   - 理由: 検索機能の品質向上
   - 効果: ユーザー体験の改善
   - 工数: 1日

5. **`memo-todo-operations.ts` の作成**
   - 対象: `updateTodoCompleted`
   - 理由: TODO機能の独立性
   - 効果: TODO機能の拡張性向上
   - 工数: 0.5日

### 低優先 (Priority 4)

6. **`memo-file-io.ts` の作成**
   - 対象: ファイルI/O操作のラッパー
   - 理由: 既存のvaultHandlerで十分
   - 効果: 抽象化レベルの統一
   - 工数: 1日

## 期待される成果

### カバレッジ改善

- **現状**: 57.79%
- **目標**: 85%+
- **内訳**:
  - memo-helpers.ts: 98% → 99% (parseTextToMemo追加)
  - memo-crud-operations.ts: 95%+ (新規)
  - memo-trash-operations.ts: 95%+ (新規)
  - memo-query-operations.ts: 95%+ (新規)
  - memo-todo-operations.ts: 95%+ (新規)
  - memo-manager.ts: 85%+ (ファサードのみ)

### コード品質

- **行数**: 610行 → 150行以下 (MemoManager本体)
- **平均関数サイズ**: 50行超 → 20行以下
- **テストケース**: +150個

### 保守性

- 責務が明確化
- モジュール間の疎結合化
- テストが容易に

## 次のステップ

1. **Phase 1.1**: `parseTextToMemo()` の抽出
   - memo-helpers.ts に追加
   - テストケース作成 (20個)
   - MemoManagerから参照に変更

2. **Phase 1.2**: `memo-crud-operations.ts` の作成
   - インターフェース定義
   - addMemo, updateMemo, deleteMemoの抽出
   - テストケース作成 (40個)

3. **Phase 1.3**: `memo-trash-operations.ts` の作成
   - インターフェース定義
   - moveToTrash, restoreFromTrashの抽出
   - テストケース作成 (30個)

4. **Phase 1.4**: その他モジュールの作成
   - memo-query-operations.ts (20テスト)
   - memo-todo-operations.ts (10テスト)

5. **Phase 1.5**: MemoManagerのリファクタリング
   - 各モジュールの統合
   - エラーハンドリングの整備
   - 統合テスト (30個)

---

**作成日**: 2025-10-30
**分析対象**: src/core/memo-manager.ts (610行)
**目標**: 85%+ カバレッジ、150行以下に削減
