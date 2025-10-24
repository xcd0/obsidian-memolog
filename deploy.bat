@echo off
REM Obsidianテスト環境へのデプロイスクリプト (Windows)

setlocal

REM デプロイ先のパスを環境変数から取得、デフォルトはユーザーのデスクトップ。
if "%OBSIDIAN_VAULT_PATH%"=="" (
    set "VAULT_PATH=%USERPROFILE%\Desktop\dummy\vault"
) else (
    set "VAULT_PATH=%OBSIDIAN_VAULT_PATH%"
)

set "PLUGIN_DIR=%VAULT_PATH%\.obsidian\plugins\obsidian-memolog"

echo === memolog デプロイスクリプト ===
echo Vault パス: %VAULT_PATH%
echo プラグインディレクトリ: %PLUGIN_DIR%
echo.

REM プラグインディレクトリを作成。
if not exist "%PLUGIN_DIR%" (
    echo プラグインディレクトリを作成中: %PLUGIN_DIR%
    mkdir "%PLUGIN_DIR%"
)

REM ビルドファイルをコピー。
echo ファイルをコピー中...
copy /Y main.js "%PLUGIN_DIR%\"
copy /Y manifest.json "%PLUGIN_DIR%\"
copy /Y styles.css "%PLUGIN_DIR%\"

echo.
echo ✓ デプロイ完了!
echo.
echo 次の手順:
echo 1. Obsidianを起動
echo 2. 設定 → コミュニティプラグイン → memologを有効化
echo 3. プラグインをリロード (Ctrl+R)

endlocal
