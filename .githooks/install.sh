#!/bin/bash

# ! Git hooksのインストールスクリプト。
# ! .githooksディレクトリのフックを.git/hooksにコピーする。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

echo "Installing git hooks..."

# ! .git/hooksディレクトリが存在することを確認。
if [ ! -d "$GIT_HOOKS_DIR" ]; then
    echo "Error: .git/hooks directory not found."
    exit 1
fi

# ! pre-commitフックをコピー。
if [ -f "$SCRIPT_DIR/pre-commit" ]; then
    cp "$SCRIPT_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
    chmod +x "$GIT_HOOKS_DIR/pre-commit"
    echo "✓ pre-commit hook installed."
else
    echo "Warning: pre-commit hook not found in .githooks directory."
fi

echo "Git hooks installation completed."
