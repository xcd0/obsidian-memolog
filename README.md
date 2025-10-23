# memolog

[![CI](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml/badge.svg)](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml)

Obsidian上でメモを素早く記録・整理・回顧するプラグイン (v0.8)

## 概要

memologは、Obsidianでメモを効率的に管理するためのプラグインです。

### 主な機能

#### v0.8の新機能 (最新)
- **設定画面拡充**: 高度な機能の設定セクション追加
  - 検索履歴設定 (有効化、最大サイズ調整)
  - メモ間リンク設定 (有効化、孤立メモ警告、リンク切れチェック)
  - タグ管理設定 (パネル表示、自動補完)

#### v0.7の新機能
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

#### v0.5の新機能
- **検索機能**: 全文検索、日付範囲フィルタ、カテゴリフィルタ
- **メモ編集**: インライン編集機能
- **エクスポート**: Markdown/JSON/CSV形式でエクスポート
- **テンプレート管理**: カスタマイズ可能なメモテンプレート

#### v0.4までの機能
- 任意書式のメモ作成
- カテゴリ分類
- カード形式のUI表示
- 添付ファイル対応
- カレンダー表示
- タグ管理システム
- キャッシュ最適化

## インストール

### 開発版

1. このリポジトリをクローン
2. `npm install` で依存関係をインストール
3. `npm run dev` で開発モード起動

### ビルド

```bash
npm run build
```

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
