# Obsidian Community Plugins 提出準備チェックリスト

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
