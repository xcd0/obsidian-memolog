# memolog 実装TODO リスト

最終更新: 2025-11-04
バージョン: v0.0.14 (開発中)

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
- **v0.0.14 スレッド対応機能**: データモデル、ThreadIndex管理、MemoManager統合、CRUD強化（返信作成・カスケード削除）、UI実装（MemoCard、InputForm返信モード、Sidebar統合、折りたたみ機能）が完了。残りは統合テストとビジュアルリグレッションテストの実装段階。

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
- [ ] ツリー表示/折りたたみ/インデント用スタイルのビジュアルリグレッションまたはスナップショットテストを準備
- [ ] UI の主要フロー（返信投稿・折りたたみ・表示切替）を検証する統合テストを整備し、継続的にグリーンを維持