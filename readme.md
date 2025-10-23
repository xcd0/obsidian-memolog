# memolog 仕様書 v0.8

最終更新: 2025-10-23
対象: Obsidian 1.6+（Desktop/Mobile）
言語: TypeScript
ライセンス: CC0 1.0 Universal (Public Domain)
配布: Obsidian Community Plugins

---

## 1. 概要
- 目的: Obsidian上でメモを素早く記録・整理・回顧するプラグイン **memolog** を開発する。
- コンセプト: 「任意書式・任意粒度・カテゴリ分離・添付対応・カードUIによる視認性・高い保守性」。

---

## 2. 基本方針
- ユーザーが自由に定義したテンプレート書式に従ってメモを保存する。
- 保存単位は「日・週・月・年・全期間」から選択可能。
- ObsidianのDaily Notesに直接保存する設定も可能。
- 各ファイルにはmemolog専用コメントタグで管理範囲を明示する。
- ファイル内にはmemologが管理しない領域とmemologが管理する領域を明確に分離する。
- ファイル内に複数の `<!-- memolog: start -->` ／ `<!-- memolog: end -->` ペアを設置可能とし、カテゴリごとに独立したメモ領域を管理できるようにする。

---

## 3. 設定ファイル構成

### 3.1 グローバル設定ファイル
- **ファイル名:** `global-setting.json`
- **役割:** memolog全体で共通する動作・カテゴリ・UI設定を保持。

#### 主な項目
```json
{
  "useDirectoryCategory": true,
  "categories": [
    {
      "name": "仕事",
      "directory": "work",
      "color": "#3b82f6",
      "icon": "briefcase"
    },
    {
      "name": "趣味",
      "directory": "hobby",
      "color": "#22c55e",
      "icon": "gamepad-2"
    }
  ],
  "defaultCategory": "仕事",
  "saveUnit": "day",
  "order": "asc",
  "enableDailyNotes": false
}
```

#### 補足仕様
- `useDirectoryCategory`: ディレクトリでカテゴリを分離して管理するかどうかを切り替えるフラグ。
  - `true`: 各カテゴリに対応するディレクトリを作成し、その中にメモを保存する。
  - `false`: 単一ディレクトリ内でカテゴリを論理的に管理（ファイル名・タグ・内部メタで判別）。
- `categories`: カテゴリ情報配列。
  - `name`: カテゴリ表示名（UIに表示されるラベル）。
  - `directory`: 実際の保存フォルダ名（ファイルパスで利用）。
  - `color`: UI上でタブやカード背景色に利用するカラーコード。
  - `icon`: アイコン名（Obsidianのアイコンセットを参照）。
- `defaultCategory`: 新規メモ作成時に既定で選択されるカテゴリ。
- `enableDailyNotes`: ObsidianのDaily Notes連携を有効化するかどうか。

### 3.2 ローカル設定ファイル
- **ファイル名:** 各カテゴリディレクトリ以下の `setting.json`
- **役割:** 特定カテゴリまたはディレクトリ固有の設定を上書き適用。

#### 例:
`/memolog/work/setting.json`
```json
{
  "template": "## %Y-%m-%d %H:%M\n内容",
  "order": "desc",
  "attachmentPath": "./attachments/",
  "pathFormat": "%Y/%m/%d/%H-%M.md"
}
```

### 3.3 設定適用順序
1. グローバル設定 (`global-setting.json`) をロード。
2. 現在のカテゴリまたはファイルが属するディレクトリに `setting.json` が存在すれば、その内容を上書き適用。
3. 一時的なUI上の設定変更はセッションキャッシュに保持され、再起動時にリセットされる。

---

## 4. ファイル構造仕様
各ファイルは以下の形式で構成される。

```
{memologが関知しない部分（ユーザー任意）}
<!-- memolog: {"format": "template", "order": "asc", "timestamp": "YYYY-MM-DD HH:mm:ss"} -->
<!-- memolog: start category="work" -->
{workカテゴリのメモ群}
<!-- memolog: end -->

<!-- memolog: start category="hobby" -->
{hobbyカテゴリのメモ群}
<!-- memolog: end -->
{memologが関知しない部分（ユーザー任意）}
```

### 仕様説明
- 各 `start/end` ペアは独立したカテゴリを表す。
- 昇順設定時は `start` の直下に追記、降順設定時は `end` の直上に追記する。
- `category` 属性により、どのカテゴリ設定に紐づくかを判定。
- memologが管理しない部分はユーザー自由記述領域として扱われ、memologは変更しない。

---

## 5. 型安全な書式テンプレート管理
- 書式テンプレートはTypeScriptインターフェイスによって型定義される。
- 不正な書式構文（未定義キー、型不一致など）は読み込み時に検出し、デフォルトテンプレートにフォールバック。
- 設定UIでは直接JSONを編集せず、フォームベースで安全にテンプレートを定義できる。

例:
```ts
interface MemoTemplate {
  titleFormat: string; // 例: '## %Y-%m-%d %H:%M'
  bodyFormat: string;  // 本文部分
  includeTimestamp: boolean;
}
```

---

## 6. ファイルアクセス層の分離
- Vault操作を担う独立クラス `MemologVaultHandler` を導入。
- 主な責務:
  - ファイル存在確認／生成／削除。
  - コメントタグ構造（start/endペア）の解析と整合性チェック。
  - メモ挿入位置の判定（昇順・降順・カテゴリ別）。
  - ファイルロックと非同期I/O制御。
- UI層やロジック層からファイル操作を切り離し、保守性と安全性を向上。

---

## 7. UI構成
- **メインUI（サイドバー）**
  - **上部タブ領域**: カテゴリ表示（設定がある場合のみ表示）。
  - **ボタン群**:
    - カレンダー表示ボタン（クリックで該当日のメモを表示）。
    - 昇順/降順切替ボタン。
    - 設定ボタン。
  - **メモ表示領域**:
    - カード形式でメモを一覧表示。
    - インフィニティスクロール採用により、大量メモでも軽快に動作。
    - 各カードには内容、日付、添付情報を表示。
  - **入力欄**:
    - 下部固定入力フォームにより即時メモ追加が可能。

---

## 8. 開発効率／保守性向上
- コード分割:
  - UI層、ロジック層、ファイルアクセス層をモジュール単位で分離。
  - `src/ui/`, `src/core/`, `src/fs/` ディレクトリ構成を採用。
- テスト体制:
  - Jestによる単体テスト。
  - ファイルI/Oモックを使用し、Obsidian API依存を排除。
- 開発効率:
  - `npm run dev` でホットリロード開発環境（Rollup＋Vite）。
  - ダミーデータ生成スクリプトで大量メモのパフォーマンステストを容易化。
- 保守性:
  - TypeScript strictモードを有効化。
  - JSON Schemaによる設定検証と自動補完。

---

## 9. 実装計画（ToDoリスト概要）

### v0.1
- グローバル設定ファイル構造の導入（カテゴリ管理含む）。
- memologタグ挿入・単一カテゴリ管理の実装。

### v0.2
- サイドバーUI構築・メモカードUI・基本操作ボタン群の実装。

### v0.3
- カレンダー表示機能・添付ファイル処理・カテゴリタブ・date命名対応。

### v0.4
- ファイルアクセス層の分離・複数カテゴリ領域対応・キャッシュ最適化。

### v0.5
- 型安全テンプレート管理導入・インフィニティスクロール対応・UX改善。

### v0.6
- ディレクトリカテゴリ設定切替・ローカル設定上書き対応・安定版リリース準備。

---

## 10. ライセンス

本プロジェクトはCC0 1.0 Universal (Public Domain)ライセンスの下で公開されています。

### CC0 1.0 Universal

このプロジェクトの作成者は、法律上可能な範囲で、全ての著作権および関連する権利を放棄しています。

- 商用・非商用問わず自由に使用可能
- 改変・再配布自由
- クレジット表記不要
- 無保証

詳細は[LICENSE](LICENSE)ファイルまたは https://creativecommons.org/publicdomain/zero/1.0/ をご参照ください。

---