# memolog

[![CI](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml/badge.svg)](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml)

メモを素早く記録・整理・回顧する (v0.0.8 - プロトタイプ版)

## 概要

memologは、Obsidianでメモを効率的に管理するためのプラグインです。

詳細な仕様については [SPEC.md](./SPEC.md) をご参照ください。

### 主な機能

#### v0.0.8 (最新 - プロトタイプ版)
- **設定画面拡充**: 高度な機能の設定セクション追加
  - 検索履歴設定 (有効化、最大サイズ調整)
  - メモ間リンク設定 (有効化、孤立メモ警告、リンク切れチェック)
  - タグ管理設定 (パネル表示、自動補完)
- **カテゴリ変更機能**: メモカードから直接カテゴリを変更
  - カテゴリ変更ボタン（現在のカテゴリアイコン表示）
  - ドロップダウンメニューでカテゴリ選択
  - メモを別カテゴリのファイルに移動
- **検索機能強化**: 日付範囲検索の改善
  - 日付範囲指定時に該当期間の全メモを検索対象に
  - 「過去全て」プリセットの追加
  - 検索バーのUI全面改善（スタイリング刷新）

#### v0.0.7
- **メモ間リンク**: `[[memo-id]]` 形式のWikiスタイルリンク
  - バックリンク表示 (メモを参照している全メモ)
  - リンクグラフ可視化 (メモ間の参照関係)
  - 孤立メモ検出 (リンクなし・参照なし)
  - リンク切れ検出と警告
- **検索履歴**: 検索クエリの履歴管理
  - 履歴の保存・再利用
  - 頻繁な検索の分析
  - JSON形式でのエクスポート/インポート
- **タグ管理UI**: インタラクティブなタグパネル
  - タグのフィルタリング・ソート
  - タグのCRUD操作 (作成・名前変更・削除)
  - タグ統計情報表示

#### v0.0.5
- **検索機能**: 全文検索、日付範囲フィルタ、カテゴリフィルタ
- **メモ編集**: インライン編集機能
- **エクスポート**: Markdown/JSON/CSV形式でエクスポート
- **テンプレート管理**: カスタマイズ可能なメモテンプレート

#### v0.0.4以前
- 任意書式のメモ作成
- カテゴリ分類
- カード形式のUI表示
- 添付ファイル対応
- カレンダー表示
- タグ管理システム
- キャッシュ最適化

## インストール

### 開発環境セットアップ

#### 1. リポジトリのクローンとビルド

```bash
git clone https://github.com/xcd0/obsidian-memolog.git
cd obsidian-memolog
npm install
npm run build
```

#### 2. Obsidianテスト環境へのデプロイ

**方法1: 手動コピー（推奨）**

ビルドした以下のファイルをObsidianのプラグインディレクトリにコピー:

```bash
# Windowsの場合
mkdir %USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog
copy main.js %USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog\
copy manifest.json %USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog\
copy styles.css %USERPROFILE%\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog\

# または、PowerShellの場合
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog"
Copy-Item main.js, manifest.json, styles.css "$env:USERPROFILE\Desktop\dummy\vault\.obsidian\plugins\obsidian-memolog\"

# Linux/macOSの場合
mkdir -p ~/Desktop/dummy/vault/.obsidian/plugins/obsidian-memolog
cp main.js manifest.json styles.css ~/Desktop/dummy/vault/.obsidian/plugins/obsidian-memolog/
```

**注意**: Vaultのパスは環境に合わせて変更してください。

**方法2: シンボリックリンク（開発効率化・推奨）**

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
- 管理者権限が必要です
- コマンドプロンプトを右クリック →「管理者として実行」

#### 3. Obsidianでプラグインを有効化

1. Obsidianを起動
2. 設定 → コミュニティプラグイン
3. "memolog"を有効化

### 開発モード

変更を監視して自動ビルド:

```bash
npm run dev
```

ビルド後、Obsidianでプラグインをリロード（Ctrl+R または Cmd+R）

## 開発

### ディレクトリ構造

```
obsidian-memolog/
├── src/
│   ├── ui/        # UI層
│   ├── core/      # ロジック層
│   ├── fs/        # ファイルアクセス層
│   ├── types/     # 型定義
│   └── utils/     # ユーティリティ
├── test/          # テストコード
├── docs/          # ドキュメント
├── main.ts        # エントリーポイント
├── manifest.json  # プラグイン定義
├── SPEC.md        # 仕様書
└── TODO.md        # 実装計画
```

### スクリプト

- `npm run dev` - 開発モード（ホットリロード）
- `npm run build` - プロダクションビルド
- `npm run test` - テスト実行
- `npm run test:coverage` - テストカバレッジ測定
- `npm run test:watch` - テストウォッチモード
- `npm run lint` - Lint実行
- `npm run lint:fix` - Lint自動修正
- `npm run format` - コードフォーマット

### テストカバレッジ

- **ステートメント**: 73.92%
- **ブランチ**: 67.63%
- **関数**: 77.82%
- **行**: 73.55%

219個のテスト、すべてパス ✅

## バージョン管理方針

### 現在のフェーズ: v0.0.x (プロトタイプ版)

本プロジェクトは現在 **v0.0.8** として、v0.1.0の仕様を決定するための試験的な実装フェーズです。

### バージョニング戦略

#### v0.0.x (プロトタイプ版) - 現在
- **目的**: v0.1.0の仕様策定のための試験的実装
- **ブランチ**: `master`で直接作業
- **位置づけ**: 実験的機能の検証、仕様の確定
- **更新頻度**: 高頻度で機能追加・変更を実施

#### v0.1.0以降 (正式開発版)
- **開発ブランチ**: `develop`
- **安定版ブランチ**: `master`
- **運用方針**:
  - 日常的な開発は`develop`ブランチで実施
  - 機能開発は`feature/機能名`ブランチを切って作業
  - リリース準備は`release/v0.x.0`ブランチで実施
  - 安定版になったタイミングで`master`にマージ
  - 緊急修正は`hotfix/修正内容`ブランチで対応

### ブランチ戦略 (v0.1.0以降)

```
master (安定版)
  ↑
  │ マージ (安定版リリース時)
  │
develop (開発版)
  ↑
  ├── feature/new-feature (機能開発)
  ├── feature/improve-ui (UI改善)
  └── release/v0.x.0 (リリース準備)

master
  ↑
  └── hotfix/critical-bug (緊急修正)
```

### バージョン番号の意味

- **v0.0.x**: プロトタイプ版（仕様策定フェーズ）
- **v0.x.0**: 開発版（機能追加・改善）
- **v1.0.0**: 正式版（安定版リリース）

## ライセンス

### 本プロジェクトのライセンス

CC0 1.0 Universal (Public Domain)

このプロジェクトの作成者は、法律上可能な範囲で、全ての著作権および関連する権利を放棄しています。

- 商用・非商用問わず自由に使用可能
- 改変・再配布自由
- クレジット表記不要
- 無保証

詳細は[LICENSE](../LICENSE)ファイルまたは https://creativecommons.org/publicdomain/zero/1.0/ をご参照ください。

### 使用ライブラリのライセンス

**重要**: 本プロジェクトで使用している各ライブラリのライセンスは、言うまでもなく各ライブラリのライセンスに従います。

主な依存関係:
- **uuid** (MIT License) - UUID生成
- **Obsidian API** (Proprietary) - プラグイン開発用API
- **TypeScript** (Apache-2.0) - TypeScriptコンパイラ
- **esbuild** (MIT License) - バンドラー
- **Jest** (MIT License) - テストフレームワーク
- **ESLint** (MIT License) - リンター
- **Prettier** (MIT License) - フォーマッター

詳細なライセンス情報は[プロジェクトルートのreadme.md](../readme.md#10-ライセンス)をご参照ください。

## 作者

xcd0
