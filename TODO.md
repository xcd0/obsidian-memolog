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
- [ ] MemoEntry 型に `parentId` / `replyCount` を追加
- [ ] スレッド木構造 (`ThreadNode` / `ThreadTree`) の型定義を追加
- [ ] HTMLコメント入出力で `parent-id` 属性を読み書きするよう parser/serializer を拡張
- [ ] 既存の memo-helpers / memo-crud-operations テストを新仕様に対応させる

### ThreadIndex とキャッシュ管理
- [ ] `buildThreadIndex` / `buildThreadTree` を実装し、`childrenMap` `parentMap` `depthMap` `descendantCountMap` を生成
- [ ] ThreadIndexManager を新設し、メモデータ変更時にインデックスの再構築・キャッシュ更新を行う
- [ ] MemoManager / CacheManager へ ThreadIndexManager を統合し、必要なインターフェースを公開
- [ ] スレッドインデックス計算とキャッシュ無効化の単体テストを追加

### スレッド対応 CRUD 強化
- [ ] 返信作成APIを追加し、親メモと同一カテゴリでの保存・`parentId` 設定・インデックス更新を行う
- [ ] メモ削除時に子孫メモを再帰的に削除するカスケード削除を実装
- [ ] 親変更時に `wouldIntroduceCycle` で循環を検出し、エラー応答を行う
- [ ] 新規ロジックをカバーするテスト（正常系・循環検出・カテゴリ不一致エラー）を追加

### UI/UX スレッド機能
- [ ] MemoCard に返信ボタン・返信数バッジ・インデント表示を追加
- [ ] 親メモのコンテキストを表示する返信フォームを実装し、新しい reply API と連携
- [ ] サイドバーにフラット表示/ツリー表示の切り替えトグルと、スレッド折りたたみ状態の永続化を追加
- [ ] ツリー表示/折りたたみ/インデントに対応したスタイルを styles.css に追加
- [ ] UI の主要フロー（返信投稿・折りたたみ・表示切替）を検証する統合テストを整備

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
