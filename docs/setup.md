# セットアップ手順

memologを開発・テストするための環境構築手順です。

## 1. 空のVaultを作成

Obsidianで新しい空のVaultを作成します。

```bash
# Windowsの場合
mkdir %USERPROFILE%\Desktop\memolog-test-vault

# PowerShellの場合
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Desktop\memolog-test-vault"

# Linux/macOSの場合
mkdir -p ~/Desktop/memolog-test-vault
```

Obsidianで「Vault を開く」→ 作成したディレクトリを選択して開きます。
一度開くと `.obsidian` ディレクトリが自動作成されます。

## 2. プラグインディレクトリにリポジトリをクローン

`.obsidian/plugins` ディレクトリ内に直接クローンします。

```bash
# Windowsの場合
cd %USERPROFILE%\Desktop\memolog-test-vault\.obsidian\plugins
git clone https://github.com/xcd0/obsidian-memolog.git

# PowerShellの場合
cd "$env:USERPROFILE\Desktop\memolog-test-vault\.obsidian\plugins"
git clone https://github.com/xcd0/obsidian-memolog.git

# Linux/macOSの場合
cd ~/Desktop/memolog-test-vault/.obsidian/plugins
git clone https://github.com/xcd0/obsidian-memolog.git
```

## 3. 依存関係のインストールとビルド

```bash
cd obsidian-memolog
npm install
npm run build
```

## 4. Obsidianでプラグインを有効化

1. Obsidianを再起動（または Ctrl+R / Cmd+R でリロード）
2. 設定 → コミュニティプラグイン → 「制限モードをオフにする」
3. インストール済みプラグイン → "memolog"を有効化

## 開発モード

変更を監視して自動ビルドするには以下を実行します。

```bash
npm run dev
```

ファイルを編集後、Obsidianでプラグインをリロードします（Ctrl+R または Cmd+R）。

## ディレクトリ構成

```
memolog-test-vault/
├── .obsidian/
│   └── plugins/
│       └── obsidian-memolog/    # ← ここにクローン
│           ├── src/
│           ├── test/
│           ├── main.js          # ビルド成果物
│           ├── manifest.json
│           ├── styles.css
│           └── package.json
└── (Vaultのメモファイル)
```
