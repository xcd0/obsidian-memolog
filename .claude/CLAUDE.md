# Claude Code 作業ルール

## 作業の一区切りについて

**重要:** 作業の一区切りは、commit pushしてユーザーがGitHub ActionsのCIを確認できる状態までです。

### 作業完了の基準

1. **コード変更の実装** - 機能追加や修正を完了
2. **ビルド確認** - `npm run build` が成功することを確認
3. **Git commit** - 変更をコミット（適切なコミットメッセージで）
4. **Git push** - リモートリポジトリにプッシュ
5. **CI確認待機** - GitHub ActionsのCIが実行される状態にする

### コミットメッセージ規約

- Angular Conventional Commitに従う
- 文章は日本語で記述
- 形式: `<type>(<scope>): <subject>`
- 例: `feat(migration): ファイル変換ダイアログに書式情報を表示`

### CI/CD パイプライン

- GitHub Actionsで自動テスト・ビルドが実行される
- CIが成功することを確認してから次の作業に移る
- CIが失敗した場合は修正してから次に進む

### 作業フロー

1. 機能実装
2. `npm run build` でビルド確認
3. `git add` で変更をステージング
4. `git commit` でコミット
5. `git push` でプッシュ
6. GitHub ActionsのCI実行を確認
7. ✅ ここまでが一区切り

## その他のルール

### コーディング規約

- TypeScript を使用
- インデントはタブを使用
- コメントは日本語で記述
- 行コメントには句点(。)を付ける

### 開発環境

- OS: Windows 11 または WSL
- エディタ: VSCode / neovim
- ランタイム: Node.js

### テスト

- テストコードも同時に生成する（該当する場合）
- エラーハンドリングを適切に実装する
