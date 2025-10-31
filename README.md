# memolog

[![CI](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml/badge.svg)](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml)

メモを素早く記録・整理・回顧する (v0.0.12 - 開発進行中)

## 概要

memologは、Obsidianでメモを効率的に管理するためのプラグインです。

詳細な仕様については [SPEC.md](./SPEC.md) をご参照ください。

### 主な機能

#### v0.0.12 (UI/UX改善とコード品質向上)
- **UI/UX改善**: ユーザー体験の向上
  - ゴミ箱タブのラベル削除
  - ログ出力抑制機能
  - Shift+Enter送信対応
  - チェックボックスクリック機能の全カテゴリ対応
- **コード品質向上（リファクタリング）**
  - memo-search-operations.ts 抽出 (13関数, 65テスト, 100%カバレッジ)
  - ヘルパー関数の活用でコードの一貫性向上
  - TypeScript/ESLintエラー修正
- **テスト拡充**: 包括的なテストカバレッジ達成
  - テスト数: 777件 → 785件 (+8件)
  - 全体カバレッジ: 92.87% → **95.19%** (+2.32%)
  - memo-manager.ts: 54.16% → **78.57%** (+24.41%)
  - template-manager.ts: 98.18% → **100%** ✨
- **カバレッジ分析**: 低カバレッジファイルの妥当性を検証
  - 技術的制約（ブラウザAPI依存）や防御的コードと確認
  - 重要なロジックは全て高カバレッジを達成

#### v0.0.11 (リファクタリングと品質向上)
- **大規模リファクタリング**: コードの保守性とテスト容易性を大幅に改善
  - memo-manager.ts: 610行 → 442行 (-168行, -27.5%)
  - cache-manager.ts: 210行 → 115行 (-95行, -45.2%)
  - path-migrator.ts: 497行 → 460行 (-37行, -7.4%)
- **純粋関数の抽出**: I/O操作と業務ロジックの分離
  - memo-crud-operations.ts (8関数, 100%カバレッジ)
  - memo-trash-operations.ts (8関数, 100%カバレッジ)
  - memo-query-operations.ts (13関数, 100%カバレッジ)
  - memo-split-operations.ts (5関数, 100%カバレッジ)
  - cache/lru-cache.ts (LRUCache実装, 100%カバレッジ)
- **テスト拡充**: 包括的なテストスイート
  - テスト数: 527件 → 723件 (+196件, +37.2%)
  - 全体カバレッジ: 88.4% → 91.89% (+3.49%)
  - tag-manager.ts: 88.46% → 100%
  - cache-manager.ts: 83.09% → 92.5%
  - path-migrator.ts: 新規20テスト追加 (モックベース)

#### v0.0.10 (プロトタイプ版)
- **コード品質向上**: v0.1.0に向けた既存機能のブラッシュアップ
  - ESLintエラー修正 (61件→41件に削減)
  - 不要なasync/await削除
  - Floating Promise修正
  - const宣言の適正化
  - エスケープ文字の修正
- **ドキュメント整備**: 開発体制とロードマップの明確化
  - TODO.mdの更新 (v0.0.10の方針明記)
  - 機能改善の方針策定
- **テスト**: 全392テスト成功、ビルド正常

#### v0.0.9
- **ゴミ箱機能**: 削除メモの管理機能追加
  - ゴミ箱ファイルへの一時保存
  - 保持期間設定 (日数指定)
  - ゴミ箱専用タブ表示
  - 設定画面に専用タブ追加
- **ピン留め機能の改善**: メモのピン留め機能を強化
  - ピン留めタブへの投稿表示を修正
  - ソート変更時のピン状態維持を改善
  - 日付フィルタ適用時もピン留め投稿を表示
- **日付範囲フィルタの改善**: フィルタ動作を修正
  - 「今日」「一週間」ボタン両方OFF時に全期間表示
  - 初期状態を全期間表示に変更
  - カテゴリタブでの日付フィルタ動作を改善
- **パス変換機能の改善**: ファイルパス書式変更時の既存ファイル変換機能強化
  - バックアップのみ実行ボタンの追加
  - 変換予定の全件表示 (スクロール可能なテーブル形式)
  - 特別なファイル (index.md、ゴミ箱ファイル) の自動除外
  - 古いパス書式にマッチしないファイルの除外
  - Git検出ロジックの修正 (隠しファイル対応)
- **UI/UX改善**: 設定画面とメモ表示の改善
  - カテゴリ設定タブの表示順序変更 (All→ピン留め→デフォルト→個別)
  - デフォルトカテゴリ設定のアイコン色をカテゴリ色に変更
  - ピン留めタブのラベル削除 (アイコンのみ表示)
  - ピン留めボタンの透明度を調整 (より目立たなく)
- **設定画面の拡充**: ファイルパス書式と添付ファイル保存先のプリセット追加
  - ファイルパス書式: `%C/%Y-%m-%d.md`, `%C/%Y%m%d.md` 追加
  - 添付ファイル保存先: `./attachments/%Y-%m-%d`, `./attachments/%Y%m%d` 追加

#### v0.0.8
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

### テストカバレッジ (v0.0.12)

- **全体カバレッジ**: **95.19%** ⬆️ (+3.3% from v0.0.11)
- **ステートメント**: 95.19%
- **ブランチ**: 85.57%
- **関数**: 97.74%
- **行**: 95.07%

785個のテスト、すべてパス ✅

**主な改善点:**
- memo-manager.ts: 54.16% → 78.57% (+24.41%)
- template-manager.ts: 98.18% → 100% ✨
- ゴミ箱機能の統合テスト追加 (6件)
- 無効テンプレートのテスト追加 (2件)

詳細は [TESTING_GUIDE.md](./TESTING_GUIDE.md) を参照してください。

## バージョン管理方針

### 現在のフェーズ: v0.0.x (プロトタイプ版)

本プロジェクトは現在 **v0.0.9** として、v0.1.0の仕様を決定するための試験的な実装フェーズです。

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
