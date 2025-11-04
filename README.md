# memolog

[![CI](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml/badge.svg)](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml)

メモを素早く記録・整理・回顧する (v0.0.13 - 開発進行中)

memologはObsidianでのメモ記録を効率化するための非公式プラグインです。素早い入力、柔軟な整理、あとからの振り返りを強力にサポートすることを目的としています。

## 主なポイント
- Obsidian上での高速なメモ入力と検索体験
- カテゴリやタグによる整理、テンプレート管理などの実用的な機能
- 高いテストカバレッジを維持する堅牢なコードベース

## 使い方
1. このリポジトリをクローンします。
2. 依存関係をインストールしてビルドします。
   ```bash
   npm install
   npm run build
   ```
3. `main.ts` でビルドされたプラグインをObsidianに読み込ませます。

## 開発
- 実装の詳細仕様は [SPEC.md](./SPEC.md) を参照してください。
- テストの実行方法は [TESTING_GUIDE.md](./TESTING_GUIDE.md) にまとめています。
- コントリビューションの手順は [CONTRIBUTING.md](./CONTRIBUTING.md) をご覧ください。

より詳細な情報は以下のドキュメントを参照してください。

- [docs/changelog.md](./docs/changelog.md): 詳細な変更履歴
- [docs/setup.md](./docs/setup.md): セットアップ手順
- [docs/development.md](./docs/development.md): 開発体制とテスト状況
- [docs/versioning.md](./docs/versioning.md): バージョニングとブランチ戦略

## 作者
xcd0

## ライセンス
本プロジェクトは [CC0 1.0 Universal](./LICENSE) で提供されています。法律上可能な範囲で、すべての著作権および関連する権利を放棄しています。

- 商用・非商用問わず自由に使用可能
- 改変・再配布自由
- クレジット表記不要
- 無保証

詳細は `LICENSE` ファイル、もしくは <https://creativecommons.org/publicdomain/zero/1.0/> を参照してください。

### 使用ライブラリのライセンス

本プロジェクトで利用しているライブラリは、各ライブラリのライセンスに従います。主な依存関係とライセンスは以下の通りです。

- **uuid** (MIT License) - UUID生成
- **Obsidian API** (Proprietary) - プラグイン開発用API
- **TypeScript** (Apache-2.0) - TypeScriptコンパイラ
- **esbuild** (MIT License) - バンドラー
- **Jest** (MIT License) - テストフレームワーク
- **ESLint** (MIT License) - リンター
- **Prettier** (MIT License) - フォーマッター
