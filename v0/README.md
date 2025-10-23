# memolog v0.x

[![CI](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml/badge.svg)](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml)

Obsidian上でメモを素早く記録・整理・回顧するプラグイン

## 概要

memologは、Obsidianでメモを効率的に管理するためのプラグインです。

### 主な機能

- 任意書式のメモ作成
- カテゴリ分類
- カード形式のUI表示
- 添付ファイル対応
- カレンダー表示

## インストール

### 開発版

1. このリポジトリをクローン
2. v0/ディレクトリに移動
3. `npm install` で依存関係をインストール
4. `npm run dev` で開発モード起動

### ビルド

```bash
cd v0
npm run build
```

## 開発

### ディレクトリ構造

```
v0/
├── src/
│   ├── ui/        # UI層
│   ├── core/      # ロジック層
│   ├── fs/        # ファイルアクセス層
│   ├── types/     # 型定義
│   └── utils/     # ユーティリティ
├── test/          # テストコード
├── docs/          # ドキュメント
├── main.ts        # エントリーポイント
└── manifest.json  # プラグイン定義
```

### スクリプト

- `npm run dev` - 開発モード（ホットリロード）
- `npm run build` - プロダクションビルド
- `npm run test` - テスト実行
- `npm run lint` - Lint実行
- `npm run format` - コードフォーマット

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
