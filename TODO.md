# memolog 実装TODO リスト

最終更新: 2025-11-04
バージョン: v0.0.15 (開発中)

## 凡例

- [ ] 未着手
- [!] 進行中
- [x] 完了
- [?] 保留・要検討

## 作業方針

- t-wada さんのTDD手法を徹底し、必ずテストを先に書いてから実装に着手する。
- TODOを新規追加する際は、「先に作成するテスト」と「テストを通す実装」の両方をセットで記述する。
- 以降のtodo.mdの記述を毎作業ごとに更新する。終わったタスクに関する記述を削除し、追加の作業があれば追加する。

---

## ゴミ箱機能の返信投稿対応

### 背景と問題点

現状、返信投稿（parentId !== null）が削除されてもゴミ箱タブに表示されない。
メインビューで「ルート投稿のみ表示」のフィルタリングがゴミ箱にも適用されているため。
結果、削除された返信投稿を復元する手段がUI上に存在せず、手動でファイル編集するしかない。

### 仕様

#### 削除動作

| ゴミ箱 | 返信 | 選択         | 動作                                            |
| ------ | ---- | ------------ | ----------------------------------------------- |
| OFF    | なし | -            | 完全削除（メモ削除）                            |
| OFF    | あり | -            | 削除マーカー作成（`permanently-deleted: true`） |
| ON     | なし | -            | ゴミ箱へ移動（`trashedAt` 設定）                |
| ON     | あり | すべて削除   | 本体+子孫すべてゴミ箱へ                         |
| ON     | あり | このメモのみ | 本体のみゴミ箱へ、子孫は維持                    |

#### 表示動作

**ゴミ箱タブ:**

- 全ての削除済みメモを表示（ルート/返信問わず）
- スレッド構造を維持して表示
- 各カードに「復元」ボタン配置

**メインビュー/スレッドビュー:**

- 削除済み投稿に返信がある場合のみ、削除済みプレースホルダーを表示
- 返信がない場合は非表示
- プレースホルダー内容:
  - `permanently-deleted: true`: `[削除済み] (復元できません)`
  - `trashedAt !== null`: `[削除済み] [復元]`

#### 復元動作

- 単独投稿の復元: その投稿のみ復元
- 親投稿の復元: 削除済みの全子孫も一括復元

### フェーズ1: データ構造の拡張

- [x] MemoEntry型に`permanentlyDeleted?: boolean`フィールドを追加するテストを作成
- [x] テストを通すようMemoEntry型を拡張（src/types/memo.ts）
- [x] parseMetadata()が`permanently-deleted`フラグを読み取るテストを作成
- [x] テストを通すようparseMetadata()を拡張（src/core/memo-helpers.ts）
- [x] parseTextToMemo()が`permanentlyDeleted`プロパティを設定するテストを作成
- [x] テストを通すようparseTextToMemo()を拡張（src/core/memo-helpers.ts）
- [x] createDeletionMarker()関数の動作を定義するテストを作成
- [x] テストを通すcreateDeletionMarker()を実装（src/core/memo-trash-operations.ts）
- [!] parseTextToMemo()の削除マーカーパース修正（`[削除済み]`を正しく読み取る）

### フェーズ2: 削除ロジックの修正

- [ ] ゴミ箱OFF時に返信チェックを追加するテストを作成
- [ ] テストを通すようMemoManager.deleteMemo()を修正（src/core/memo-manager.ts）
- [ ] ゴミ箱OFF時の「このメモのみ削除」ケースのテストを作成
- [ ] テストを通すようMemoManager.deleteMemoWithDescendants()を修正
- [ ] 削除マーカー作成時のファイル更新処理テストを作成
- [ ] テストを通すようファイル更新処理を実装

### フェーズ3: 表示ロジックの修正

- [ ] hasActiveReplies()関数の動作を定義するテストを作成
- [ ] テストを通すhasActiveReplies()を実装（src/core/memo-query-operations.ts）
- [ ] shouldShowDeletedPlaceholder()関数のテストを作成
- [ ] テストを通すshouldShowDeletedPlaceholder()を実装（src/core/memo-query-operations.ts）
- [ ] MemoList.render()のフィルタリングロジック変更テストを作成
- [ ] テストを通すようMemoList.render()を修正（src/ui/components/memo-list.ts）
  - ゴミ箱: 全削除済みメモ表示
  - メインビュー: ルート投稿 + 返信を持つ削除済み投稿
  - スレッドビュー: 全メモ

### フェーズ4: UIコンポーネントの実装

- [ ] DeletedMemoPlaceholderコンポーネントの動作を定義するテストを作成
- [ ] テストを通すDeletedMemoPlaceholderコンポーネントを実装（src/ui/components/deleted-memo-placeholder.ts）
  - プロパティ: memo, canRestore, onRestore
  - 表示: `[削除済み]` + 復元ボタン（復元可能な場合）
  - スタイル: グレーアウト、破線枠
- [ ] MemoList.render()内でプレースホルダーを表示するテストを作成
- [ ] テストを通すようMemoList.render()を拡張
- [ ] プレースホルダーのCSSスタイルを追加（styles.css）

### フェーズ5: 復元ロジックの実装

- [ ] getDescendantMemos()関数の動作を定義するテストを作成
- [ ] テストを通すgetDescendantMemos()を実装（src/core/memo-query-operations.ts）
- [ ] MemoManager.restoreMemoWithDescendants()の動作を定義するテストを作成
- [ ] テストを通すrestoreMemoWithDescendants()を実装（src/core/memo-manager.ts）
- [ ] Sidebar.handleRestore()ハンドラーの動作テストを作成
- [ ] テストを通すhandleRestore()を実装（src/ui/sidebar.ts）
- [ ] 復元ボタンのイベントハンドラーを接続するテストを作成
- [ ] テストを通すようイベントハンドラーを接続

### フェーズ6: 統合テスト

- [ ] 削除マーカーの生成・パース・表示の統合テストを作成（test/trash-feature-off.test.ts）
- [ ] ゴミ箱OFF時の削除動作テストを作成
  - 返信なし投稿 → 完全削除
  - 返信あり投稿 → 削除マーカー作成
- [ ] ゴミ箱ON時の返信削除・表示テストを作成（test/trash-feature-reply.test.ts）
  - 返信投稿がゴミ箱に表示される
  - スレッド構造が維持される
- [ ] 復元機能の統合テストを作成（test/trash-feature-restore.test.ts）
  - 単独投稿の復元
  - 親投稿 + 子孫の一括復元
  - 完全削除済み投稿は復元不可
- [ ] 削除済みプレースホルダー表示の統合テストを作成
  - メインビューでの表示
  - スレッドビューでの表示
  - 復元ボタンの動作
- [ ] 全テストの実行と継続的なグリーン維持
