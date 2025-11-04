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
- **v0.0.14 スレッド対応機能**: データモデルとインデックス基盤は完了。ThreadIndex の統合と CRUD/UI まわりの拡張をこれから実装する段階。

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
- [ ] 親メモコンテキスト付き返信フォームと reply API 連携の統合テストを先に作成
- [ ] テスト駆動で返信フォームの UI/ロジックを実装し、API と連携
- [ ] サイドバー表示切り替え・折りたたみ永続化の期待動作を定義する UI テストを追加
- [ ] 追加テストを通すサイドバーのトグル実装と状態永続化を行う
- [ ] ツリー表示/折りたたみ/インデント用スタイルのビジュアルリグレッションまたはスナップショットテストを準備
- [ ] スタイル実装を行い、既存/新設テストをすべて通過させる
- [ ] UI の主要フロー（返信投稿・折りたたみ・表示切替）を検証する統合テストを整備し、継続的にグリーンを維