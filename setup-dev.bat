@echo off
REM 開発環境セットアップスクリプト (Windows)
REM シンボリックリンクを使用してVaultとプロジェクトを接続

setlocal

REM Vaultパスの設定。
if "%OBSIDIAN_VAULT_PATH%"=="" (
    set "VAULT_PATH=%USERPROFILE%\Desktop\dummy\vault"
) else (
    set "VAULT_PATH=%OBSIDIAN_VAULT_PATH%"
)

set "PLUGIN_DIR=%VAULT_PATH%\.obsidian\plugins\obsidian-memolog"
set "PROJECT_DIR=%CD%"

echo === memolog 開発環境セットアップ ===
echo Vault パス: %VAULT_PATH%
echo プラグインディレクトリ: %PLUGIN_DIR%
echo プロジェクトディレクトリ: %PROJECT_DIR%
echo.

REM 既存のプラグインディレクトリを確認。
if exist "%PLUGIN_DIR%" (
    echo 既存のプラグインディレクトリが見つかりました。
    echo 削除してシンボリックリンクに置き換えます。
    rmdir /S /Q "%PLUGIN_DIR%"
)

REM .obsidian/pluginsディレクトリを作成。
if not exist "%VAULT_PATH%\.obsidian\plugins" (
    mkdir "%VAULT_PATH%\.obsidian\plugins"
)

REM シンボリックリンクを作成（管理者権限が必要）。
echo シンボリックリンクを作成中...
echo mklink /D "%PLUGIN_DIR%" "%PROJECT_DIR%"
mklink /D "%PLUGIN_DIR%" "%PROJECT_DIR%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo エラー: シンボリックリンクの作成に失敗しました。
    echo.
    echo 管理者権限で実行する必要があります:
    echo 1. コマンドプロンプトを右クリック
    echo 2. "管理者として実行"を選択
    echo 3. このスクリプトを再実行
    echo.
    echo または、PowerShellを使用:
    echo   New-Item -ItemType SymbolicLink -Path "%PLUGIN_DIR%" -Target "%PROJECT_DIR%"
    pause
    exit /b 1
)

echo.
echo ✓ セットアップ完了!
echo.
echo 次の手順:
echo 1. このディレクトリで `npm run dev` を実行
echo 2. Obsidianを起動（または再起動）
echo 3. 設定 → コミュニティプラグイン → memologを有効化
echo 4. ファイルを編集すると自動的にリビルドされます
echo 5. Obsidianでプラグインをリロード (Ctrl+R)

endlocal
