# memolog 実装TODO リスト

最終更新: 2025-11-04
バージョン: v0.0.15 (開発中)

---

## 凡例

- [ ] 未着手
- [!] 進行中
- [x] 完了
- [?] 保留・要検討

## 作業方針

- t-wada さんのTDD手法を徹底し、必ずテストを先に書いてから実装に着手する。
- TODOを新規追加する際は、「先に作成するテスト」と「テストを通す実装」の両方をセットで記述する。

## 現在の作業サマリー

- **v0.0.14 スレッド対応機能**: 完了済み
- **v0.0.15 Twitter/X形式スレッド表示**: メインビューにルートメモのみ表示、カードクリックでスレッドビューに遷移する形式に変更

## 現在中止中のTODO

- 現在中止すべきタスクはありません。

---

## v0.0.14 スレッド対応タスク

### スレッド対応データモデル

- [x] MemoEntry 型に `parentId` / `replyCount` を追加するユニットテストを先に作成
- [x] 上記テストを通すために MemoEntry 型へ `parentId` / `replyCount` を追加
- [x] スレッド木構造 (`ThreadNode` / `ThreadTree`) の型定義用テストを作成
- [x] テスト駆動で `ThreadNode` / `ThreadTree` の型定義を実装
- [x] parser/serializer が HTMLコメントの `parent-id` 属性を読み書きできることを保証するテストを追加
- [x] テストを満たす形で parser/serializer を拡張して `parent-id` 属性を取り扱う
- [x] 既存の memo-helpers / memo-crud-operations テストを新仕様の期待値で先に書き換え
- [x] 更新されたテストをすべて通過させるよう実装を調整

### ThreadIndex とキャッシュ管理

- [x] `buildThreadIndex` / `buildThreadTree` の期待されるマップ構造を検証するテストを先に作成
- [x] テストを通す `buildThreadIndex` / `buildThreadTree` の実装で `childrenMap` `parentMap` `depthMap` `descendantCountMap` を生成
- [x] ThreadIndexManager の再構築・キャッシュ更新動作を定義するテストを作成
- [x] テスト駆動で ThreadIndexManager を実装し、メモデータ変更時にインデックス再構築とキャッシュ更新を行う
- [x] MemoManager / CacheManager と ThreadIndexManager の統合仕様をテストで先に定義
- [x] テストを通す形で MemoManager / CacheManager に ThreadIndexManager を統合し、必要なインターフェースを公開
- [x] スレッドインデックス計算とキャッシュ無効化のテストケースを追加し、既存テスト群に組み込む

### スレッド対応 CRUD 強化

- [x] 返信作成APIの期待挙動（親メモと同一カテゴリ保存・`parentId` 設定・インデックス更新）を定義するテストを作成
- [x] テストを満たす返信作成APIを実装
- [x] メモ削除時の子孫メモ再帰削除を検証するテストを先に用意
- [x] テスト駆動でカスケード削除ロジックを実装
- [x] 親変更時に循環を検出しエラーを返す挙動を確認するテストを作成
- [x] 上記テストを通す `wouldIntroduceCycle` 検出ロジックとエラー応答を実装
- [x] 正常系・循環検出・カテゴリ不一致エラーなどの新規ロジックをカバーするテストケースを網羅的に追加
- [x] 追加したテストすべてが緑になるよう実装の整合性を保つ

### UI/UX スレッド機能

- [x] MemoCard の返信ボタン・返信数バッジ・インデント表示の UI 実装を追加
  - MemoCardHandlersにonReplyハンドラーを追加
  - コンストラクタにthreadDepthとreplyCount引数を追加
  - 返信ボタン（message-squareアイコン）を追加
  - 返信数バッジ（replyCount > 0の場合）を追加
  - スレッド深さに応じたインデント表示（20px × depth）
  - スレッド用CSSスタイルを追加（border-left、background、接続線）
- [x] InputFormに返信モード機能を実装
  - enterReplyMode/exitReplyMode/isInReplyMode/getReplyToMemoIdメソッド追加
  - 返信コンテキスト表示エリア（親メモ内容とキャンセルボタン）実装
  - 返信コンテキスト用CSSスタイル追加
- [x] Sidebarに返信処理を統合
  - handleReply()メソッドで返信ボタン押下時にInputForm返信モードを起動
  - handleSubmit()を返信モード時にaddReply() API呼び出しに分岐
  - MemoListでcalculateThreadDepths()実装、threadDepthとreplyCountをMemoCardに渡す
- [x] スレッド折りたたみ機能を実装
  - GlobalSettingsにcollapsedThreads配列を追加して永続化
  - MemoCardに折りたたみボタン追加（返信がある場合のみ表示）
  - MemoListでcalculateHiddenMemos()実装、折りたたまれた子孫を非表示化
  - SidebarでhandleThreadToggle()実装、折りたたみ状態を設定に保存
- [?] ツリー表示/折りたたみ/インデント用スタイルのビジュアルリグレッションまたはスナップショットテストを準備（手動テストで代替）
- [x] UI の主要フロー（返信投稿・折りたたみ・表示切替）を検証する統合テストを整備し、継続的にグリーンを維持
  - thread-ui-integration.test.ts: 返信投稿フロー、カスケード削除フロー、スレッド表示ロジック、ThreadIndexキャッシュ管理のテスト (11件)
  - thread-collapse-state.test.ts: 折りたたみ状態の計算、トグル、配列変換、スレッド深さ計算のテスト (10件)

---

## v0.0.15 Twitter/X形式スレッド表示

### 目標（Twitter/Xの表示をイメージ）

- **メインビュー**: ルートメモ（parentId === undefined）のみをタイムライン形式で表示
  - 各カードに返信数バッジを表示（「〇件の返信」）
  - カードクリック→スレッドビューに遷移
- **スレッドビュー**: 選択されたメモとその返信ツリーを表示
  - フォーカスメモ（クリックされたメモ）を強調表示
  - フォーカスメモの返信をインデント付きで階層表示
  - 返信の返信をクリック→そのメモをフォーカスとして再表示
  - 上部に「←戻る」ボタン（メインビューに戻る）
  - フォーカスメモに親がいる場合、親メモへのナビゲーションを表示
- **検索・フィルター**: すべてのメモを対象に（ルートメモに限定しない）
  - 返信メモがヒットした場合、そのメモのスレッドビューに遷移

### 型定義とデータモデル

- [x] ViewMode型（"main" | "thread"）をテストで先に定義
- [x] テストを通すViewMode型をtypes/index.tsに追加
- [x] Sidebarの状態に`viewMode`と`focusedThreadId`を追加するテストを作成
- [x] テストを通すように状態プロパティを実装

### ThreadViewコンポーネント

- [x] ThreadViewの基本構造をテストで先に定義（コンストラクタ、render、destroy）
- [x] テスト駆動でThreadViewコンポーネントを新規作成（src/ui/components/thread-view.ts）
- [x] ThreadViewがルートメモとその子孫を階層表示するロジックのテストを作成
- [x] テストを通すrenderThreadTree()メソッドを実装（インデント表示、折りたたみ機能を含む）
- [x] ThreadView内のメモカードクリックで、そのメモを新しいルートとして再表示するテストを作成
- [x] テストを通すonThreadCardClick()ハンドラーを実装し、focusedThreadIdを更新してre-render
- [x] ThreadViewに戻るボタンを追加するテストを作成（メインビューに戻る）
- [x] テストを通す戻るボタンUI実装とonBackハンドラー追加
- [x] ThreadViewに親メモへ戻るボタンを追加するテストを作成（スレッド階層を上に戻る）
- [x] テストを通す親メモ表示機能を実装（focusedMemoのparentIdがあれば表示）

### MemoListの変更

- [x] MemoListがルートメモのみをフィルタリングする動作のテストを作成
- [x] テストを通すようMemoList.render()を変更し、viewMode === "main"時はparentId === undefinedのメモのみ表示
- [x] 検索結果に返信メモが含まれる場合の動作テストを作成（返信メモがヒットしてもルートメモを表示）
- [x] テストを通すようフィルタリングロジックを実装

### MemoCardの変更

- [x] MemoCardがクリック時にスレッドビューに遷移するテストを作成
- [x] テストを通すonThreadClickハンドラーをMemoCardHandlersに追加
- [x] カード全体またはスレッド遷移ボタンのクリックでonThreadClickを呼び出すテストを作成
- [x] テストを通すUI実装（カードクリックまたは専用ボタン）

### Sidebarの統合

- [x] Sidebarのビューモード切り替え（main ⇔ thread）ロジックのテストを作成
- [x] テストを通すshowThreadView(memoId)とshowMainView()メソッドを実装
- [x] ThreadViewとMemoListの表示切り替え処理のテストを作成
- [x] テストを通すDOM切り替えロジックを実装
- [x] スレッドビュー時の返信ボタン動作テストを作成（スレッドビュー内で返信を投稿）
- [x] テストを通すようhandleReply()を調整し、スレッドビュー時もfocusedThreadIdを考慮

### UIスタイルの調整

- [x] ThreadView用のCSSスタイルを追加（メインビューと視覚的に区別できるデザイン）
- [x] 戻るボタンのスタイル実装
- [x] MemoCardのインデント表示をThreadViewでのみ適用するようCSS調整

### 既存機能の互換性

- [x] 返信作成、編集、削除、カスケード削除がスレッドビューでも動作するテストを作成
- [x] テストを通すよう既存ハンドラーをviewModeに対応させる
- [x] 折りたたみ機能がスレッドビューで動作するテストを作成
- [x] テストを通すよう折りたたみロジックをThreadViewに移植
- [x] ピン留め機能との整合性テストを作成（ピン留めはルートメモのみ対象）
- [x] テストを通すようピン留め動作を調整

### 統合テスト

- [x] メインビュー → スレッドビュー → メインビューの遷移フローをテスト
- [x] スレッドビューでの返信投稿 → メインビューに戻った時の表示更新をテスト
- [x] 検索でヒットした返信メモからスレッドビューへの遷移をテスト
- [x] すべての統合テストが継続的にグリーンを維持

---

## v0.0.15 完了サマリー

### 実装ファイル

- src/types/memo.ts: ViewMode型を追加
- src/ui/components/thread-view.ts: ThreadViewコンポーネント実装
- src/ui/components/memo-list.ts: viewModeに応じたフィルタリング実装
- src/ui/components/memo-card.ts: onThreadClickハンドラー追加
- src/ui/sidebar.ts: ビュー切り替え機能 (showThreadView/showMainView/renderThreadView)
- styles.css: ThreadView用CSSスタイル追加

### テストファイル

- test/sidebar-integration.test.ts: Sidebarビューモード統合テスト (12テスト)
- test/memo-card-thread-click.test.ts: MemoCardスレッド遷移テスト (14テスト)
- test/thread-view.test.ts: ThreadViewコンポーネントテスト (12テスト)
- test/thread-view-compatibility.test.ts: 既存機能の互換性テスト (16テスト)
- test/thread-view-integration.test.ts: 統合テスト (22テスト)

合計: 76テスト、全て成功

### 次のバージョン候補

- v0.0.16: パフォーマンス最適化（仮想スクロール、遅延ロード等）
- v0.0.17: 検索機能の強化（スレッド内検索、ハイライト等）
- v0.0.18: エクスポート機能（スレッド単位でのMarkdownエクスポート等）
