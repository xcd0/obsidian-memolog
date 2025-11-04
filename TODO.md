# memolog 実装TODO リスト

最終更新: 2025-11-04
バージョン: v0.0.14 (開発中)

---

## 実装状況サマリー

### v0.0.14 スレッド対応機能 🚧 **進行中**
- データモデルに親子関係情報を追加し、既存のパーサー/シリアライザーを拡張する
- ThreadIndex とキャッシュ管理を導入してスレッドツリーを効率的に構築・再利用する
- 返信作成・削除・親変更などのCRUDをスレッド仕様に対応させる
- UIで返信操作・階層表示・折りたたみ制御を提供する

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
- [ ] MemoCard の返信ボタン・返信数バッジ・インデント表示の UI テスト/スナップショットを先に定義
- [ ] テストを満たす MemoCard の UI 実装を追加
- [ ] 親メモコンテキスト付き返信フォームと reply API 連携の統合テストを先に作成
- [ ] テスト駆動で返信フォームの UI/ロジックを実装し、API と連携
- [ ] サイドバー表示切り替え・折りたたみ永続化の期待動作を定義する UI テストを追加
- [ ] 追加テストを通すサイドバーのトグル実装と状態永続化を行う
- [ ] ツリー表示/折りたたみ/インデント用スタイルのビジュアルリグレッションまたはスナップショットテストを準備
- [ ] スタイル実装を行い、既存/新設テストをすべて通過させる
- [ ] UI の主要フロー（返信投稿・折りたたみ・表示切替）を検証する統合テストを整備し、継続的にグリーンを維持

---

## 凡例
- [ ] 未着手
- [!] 進行中
- [x] 完了
- [?] 保留・要検討

---

## Obsidian Community Plugins 提出準備チェックリスト

### 必須ファイル (Before you begin)
- [ ] README.md - プラグインの目的と使い方を記述
- [ ] LICENSE - ライセンスファイル (MIT推奨)
- [ ] manifest.json - プラグイン定義ファイル
  - [ ] `id` - ユニーク、"obsidian"を含まない
  - [ ] `name` - プラグイン名
  - [ ] `author` - 作者名
  - [ ] `description` - 短く簡潔な説明 (最大250文字、ピリオドで終わる)
  - [ ] `version` - Semantic Versioning (x.y.z形式)
  - [ ] `minAppVersion` - 最小互換Obsidianバージョン
  - [ ] `isDesktopOnly` - Node.js/Electron API使用時はtrue

### GitHub リリース準備 (Step 2)
- [ ] GitHubリポジトリ作成・公開
- [ ] manifest.jsonのバージョンを更新 (例: 1.0.0)
- [ ] GitHubリリースを作成
  - [ ] タグバージョンがmanifest.jsonと一致
  - [ ] リリース名と説明を記入
  - [ ] 以下のファイルをバイナリ添付:
    - [ ] main.js
    - [ ] manifest.json
    - [ ] styles.css (使用している場合)

### 提出準備 (Step 3)
- [ ] community-plugins.jsonにエントリ追加
  - [ ] `id` - manifest.jsonと一致、ユニーク
  - [ ] `name` - manifest.jsonと一致
  - [ ] `author` - manifest.jsonと一致
  - [ ] `description` - manifest.jsonと一致
  - [ ] `repo` - GitHubリポジトリパス (例: username/repo-name)
- [ ] Pull Request作成
  - [ ] タイトル: "Add plugin: [プラグイン名]"
  - [ ] チェックボックスをすべて確認
- [ ] bot検証通過を待つ (Ready for reviewラベル)

### プラグインガイドライン - 一般

#### 必須対応項目
- [ ] グローバルappインスタンスを使用しない (this.app を使用)
- [ ] 不要なconsole.logを削除 (デバッグメッセージは削除)
- [ ] プレースホルダークラス名を変更 (MyPlugin, MyPluginSettings等)
- [ ] サンプルコードをすべて削除

#### 推奨対応項目
- [ ] フォルダを使用してコードベースを整理

### プラグインガイドライン - モバイル対応
- [ ] Node.js/Electron APIを使用していないか確認
  - [ ] fs, crypto, os等のNode.jsパッケージ不使用
  - [ ] 使用している場合は`isDesktopOnly: true`を設定
- [ ] 正規表現でlookbehindを使用している場合、iOS 16.4以下の対応確認
- [ ] モバイルでの動作テスト完了

#### Node.js API代替手段の使用確認
- [ ] cryptoの代わりにSubtleCryptoを使用
- [ ] クリップボードアクセスにnavigator.clipboard APIを使用

### プラグインガイドライン - UIテキスト
- [ ] 設定の最上位に「設定」見出しを追加していない
- [ ] 設定の見出しに「設定」という単語を含めていない
- [ ] UI要素で文頭大文字を使用 (タイトルケース不使用)
- [ ] プラグインの説明はアクションステートメントで開始
- [ ] 説明は250文字以内でピリオドで終わる
