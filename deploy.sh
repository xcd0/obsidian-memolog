#!/bin/bash
#! Obsidianテスト環境へのデプロイスクリプト。

set -e

#! デプロイ先のパスを環境変数から取得。
VAULT_PATH="${OBSIDIAN_VAULT_PATH:-$HOME/Desktop/dummy/vault}"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-memolog"

echo "=== memolog デプロイスクリプト ==="
echo "Vault パス: $VAULT_PATH"
echo "プラグインディレクトリ: $PLUGIN_DIR"
echo ""

#! プラグインディレクトリを作成。
mkdir -p "$PLUGIN_DIR"

#! ビルドファイルをコピー。
echo "ファイルをコピー中..."
cp -v main.js "$PLUGIN_DIR/"
cp -v manifest.json "$PLUGIN_DIR/"
cp -v styles.css "$PLUGIN_DIR/"

echo ""
echo "✅ デプロイ完了!"
echo ""
echo "次の手順:"
echo "1. Obsidianを起動"
echo "2. 設定 → コミュニティプラグイン → memologを有効化"
echo "3. プラグインをリロード (Ctrl+R / Cmd+R)"
