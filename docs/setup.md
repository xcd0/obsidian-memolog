# セットアップ手順

memologを開発・テストするための環境構築手順です。

## 1. リポジトリのクローンとビルド

```bash
git clone https://github.com/xcd0/obsidian-memolog.git
cd obsidian-memolog
npm install
npm run build
```

## 2. Obsidianテスト環境へのデプロイ

### 方法1: 手動コピー（推奨）

ビルドした以下のファイルをObsidianのプラグインディレクトリにコピーします。

```bash
# Windowsの場合
mkdir %USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog
copy main.js %USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog\
copy manifest.json %USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog\
copy styles.css %USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog\

# PowerShellの場合
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog"
Copy-Item main.js, manifest.json, styles.css "$env:USERPROFILE\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog\"

# Linux/macOSの場合
mkdir -p ~/Desktop/dummy/vault/.obsidian/plugins/obsidian-memolog
cp main.js manifest.json styles.css ~/Desktop/dummy/vault/.obsidian/plugins/obsidian-memolog/
```

> **注意:** Vaultのパスは環境に合わせて変更してください。

### 方法2: シンボリックリンク（開発効率化・推奨）

```bash
# Windowsの場合（管理者権限で実行）
mklink /D "%USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog" "%CD%"

# Linux/macOSの場合
ln -s "$(pwd)" ~/Desktop/dummy/vault/.obsidian/plugins/obsidian-memolog
```

**利点:**

- ビルド後のファイルコピーが不要
- `npm run dev`で自動ビルド → Obsidianで即座に反映
- 開発効率が大幅に向上

**注意（Windows）:**

- 管理者権限が必要
- コマンドプロンプトを右クリック →「管理者として実行」

## 3. Obsidianでプラグインを有効化

1. Obsidianを起動
2. 設定 → コミュニティプラグイン
3. "memolog"を有効化

## 開発モード

変更を監視して自動ビルドするには以下を実行します。

```bash
npm run dev
```

ビルド後、Obsidianでプラグインをリロードします（Ctrl+R または Cmd+R）。
