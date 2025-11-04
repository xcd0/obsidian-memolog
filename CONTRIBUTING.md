# Claude Code コミットガイドライン

このドキュメントは、Claude がコミットする際に気をつけるべきガイドラインです。

## コミットメッセージ形式

### Angular Conventional Commit形式（日本語）

コミットメッセージの1行目は以下の形式に従う:

```
<type>: <件名>

<本文（オプション）>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Type（プレフィックス）

- `feat`: 新機能追加
- `fix`: バグ修正
- `docs`: ドキュメント変更のみ
- `style`: コードの意味に影響を与えない変更（空白、フォーマット等）
- `refactor`: バグ修正でも機能追加でもないコードの変更
- `perf`: パフォーマンス向上のための変更
- `test`: テストの追加や修正
- `chore`: ビルドプロセスやツールの変更

### 件名（Subject）

- 簡潔に変更内容を記述（50文字以内推奨）
- 日本語で記述
- 命令形で書く（「追加」「修正」「変更」など）
- 末尾にピリオドを付けない

### 本文（Body）

- 必要に応じて変更の詳細を記述
- 箇条書きで複数の変更をリストアップ
- 「何を」「なぜ」変更したかを明確に

## コミット例

### 良い例

```
feat: カレンダー表示機能を追加

主な変更:
- CalendarViewコンポーネントを実装
- 日付選択時にメモをフィルタリング
- 月次ナビゲーション機能を追加

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
fix: メモ削除時にエラーが発生する問題を修正

- 削除対象のメモIDが見つからない場合の処理を追加
- エラーハンドリングを改善

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 悪い例

```
update code  # 英語、抽象的すぎる
```

```
カテゴリタブを修正しました。  # typeなし、詳細不明
```

## コーディング規約

### TypeScript

- **strict mode**: 必須
- **インデント**: tab使用
- **コメント**: 日本語で記述、doxygen形式 (`//!`) を使用
- **命名規則**:
  - クラス: PascalCase
  - 関数/変数: camelCase
  - 定数: UPPER_SNAKE_CASE
  - プライベートメンバー: `_` プレフィックス

### コメント例

```typescript
// ! ユーザー設定を管理するクラス。
export class SettingsManager {
	// ! 設定ファイルを読み込む。
	async loadSettings(): Promise<Settings> {
		// ! ファイルが存在しない場合はデフォルト設定を返す。
		if (!this.fileExists()) {
			return DEFAULT_SETTINGS
		}
		// 実装
	}
}
```

## Git運用

### 現在のフェーズ: v0.0.13 (安定化フェーズ)

- **ブランチ**: `master`で直接作業
- **目的**: v0.1.0リリースに向けた品質向上と安定化
- **CI/CD**: GitHub Actionsで自動テスト・ビルド実行
- **状況**:
  - 全865テストパス (カバレッジ95.19%)
  - CI環境 (GMT+0) とローカル環境 (GMT+9) の両方で動作保証
  - Lintエラー0件

### v0.1.0以降の運用（将来）

- `main`: 安定版 (リリースブランチ)
- `develop`: 開発版
- `feature/xxx`: 機能開発
- `hotfix/xxx`: 緊急修正

## テスト

### テスト実行

```bash
# 全テスト実行
npm run test

# カバレッジ測定
npm run test:coverage
```

### テスト作成ルール

- 各クラス・関数ごとに単体テストを作成
- `test/` ディレクトリに配置
- ファイル名は `*.test.ts`

## ライセンス

CC0 1.0 Universal (Public Domain)

本プロジェクトに貢献されたコードは、CC0 1.0 Universalライセンスの下で公開されます。
