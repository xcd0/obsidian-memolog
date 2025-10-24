#!/bin/bash
#! 開発環境セットアップスクリプト (Linux/macOS)
#! シンボリックリンクを使用してVaultとプロジェクトを接続。

set -e

#! Vaultパスの設定。
VAULT_PATH="${OBSIDIAN_VAULT_PATH:-$HOME/Desktop/dummy/vault}"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-memolog"
PROJECT_DIR="$(pwd)"

echo "=== memolog 開発環境セットアップ ==="
echo "Vault パス: $VAULT_PATH"
echo "プラグインディレクトリ: $PLUGIN_DIR"
echo "プロジェクトディレクトリ: $PROJECT_DIR"
echo ""

#! 既存のプラグインディレクトリを確認。
if [ -e "$PLUGIN_DIR" ]; then
    echo "既存のプラグインディレクトリが見つかりました。"
    echo "削除してシンボリックリンクに置き換えます。"
    rm -rf "$PLUGIN_DIR"
fi

#! .obsidian/pluginsディレクトリを作成。
mkdir -p "$VAULT_PATH/.obsidian/plugins"

#! シンボリックリンクを作成。
echo "シンボリックリンクを作成中..."
ln -s "$PROJECT_DIR" "$PLUGIN_DIR"

echo ""
echo "✅ セットアップ完了!"
echo ""
echo "次の手順:"
echo "1. このディレクトリで 'npm run dev' を実行"
echo "2. Obsidianを起動（または再起動）"
echo "3. 設定 → コミュニティプラグイン → memologを有効化"
echo "4. ファイルを編集すると自動的にリビルドされます"
echo "5. Obsidianでプラグインをリロード (Ctrl+R / Cmd+R)"
