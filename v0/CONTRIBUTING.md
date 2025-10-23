# 開発者向けガイド

memolog v0.x の開発に参加いただきありがとうございます。

## 開発環境のセットアップ

### 必要な環境

- Node.js 18+
- npm 9+
- Git

### セットアップ手順

```bash
# リポジトリをクローン
git clone https://github.com/xcd0/obsidian-memolog.git
cd obsidian-memolog/v0

# 依存関係をインストール
npm install

# 開発モードで起動
npm run dev
```

## コーディング規約

### TypeScript

- strict mode必須
- インデントはtab使用
- コメントは日本語で記述
- doxygen形式のコメント (`//!`) を使用

### 例

```typescript
//! ユーザー設定を管理するクラス。
class SettingsManager {
	//! 設定ファイルを読み込む。
	async loadSettings(): Promise<Settings> {
		// 実装
	}
}
```

## Git運用

### ブランチ戦略

- `main`: 安定版
- `develop`: 開発版
- `feature/xxx`: 機能開発
- `hotfix/xxx`: 緊急修正

### コミットメッセージ

Angular Conventional Commit形式（日本語）を使用:

- `feat: 新機能を追加`
- `fix: バグを修正`
- `docs: ドキュメント更新`
- `refactor: リファクタリング`
- `test: テスト追加・修正`
- `chore: ビルド・ツール関連`

### 例

```
feat: カレンダー表示機能を追加

- カレンダーコンポーネントを実装
- 日付選択機能を実装
- メモフィルタリング機能を実装
```

## テスト

### テストの実行

```bash
# 全テスト実行
npm run test

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test -- --coverage
```

### テスト作成

- 各クラス・関数ごとに単体テストを作成
- `test/` ディレクトリに配置
- ファイル名は `*.test.ts` または `*.spec.ts`

## プルリクエスト

1. featureブランチを作成
2. 変更を実装
3. テストを追加・更新
4. Lintとテストをパス
5. プルリクエストを作成

## 質問・問題報告

- GitHub Issuesで報告してください
- 再現手順を明記してください

## ライセンス

MIT License
