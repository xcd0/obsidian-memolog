# memolog 仕様書 v0.0.13 (プロトタイプ版)

[![CI](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml/badge.svg)](https://github.com/xcd0/obsidian-memolog/actions/workflows/ci.yml)

最終更新: 2025-10-31
対象: Obsidian 1.6+（Desktop/Mobile）
言語: TypeScript
ライセンス: CC0 1.0 Universal (Public Domain)
配布: Obsidian Community Plugins

---

## 1. 概要

- 目的: メモを素早く記録・整理・回顧するプラグイン **memolog** を開発する。
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

- **ファイル名:** `memolog-setting.json`
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

1. グローバル設定 (`memolog-setting.json`) をロード。
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
	titleFormat: string // 例: '## %Y-%m-%d %H:%M'
	bodyFormat: string // 本文部分
	includeTimestamp: boolean
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

- 型安全テンプレート管理導入・検索機能・メモ編集・エクスポート機能・UX改善。

### v0.6

- テストカバレッジ測定環境構築・ドキュメント整備・安定版リリース準備。

### v0.7

- メモ間リンク機能（`[[memo-id]]` 形式、バックリンク、リンクグラフ）。
- 検索履歴管理（履歴保存・統計・エクスポート/インポート）。
- タグ管理UIパネル（フィルタリング・ソート・CRUD操作）。

### v0.8

- 設定画面拡充（高度な機能セクション）。
- UI/UX洗練（検索履歴設定、メモ間リンク設定、タグ管理設定）。
- コード品質向上・総合テスト。

### v0.9

- ゴミ箱機能（削除メモの一時保管）。
- パス変換機能の改善。
- 設定画面の拡充（ファイルパス書式、添付ファイル保存先プリセット）。

### v0.10

- コード品質向上（ESLintエラー修正、Floating Promise修正）。
- ドキュメント整備（TODO.md更新、開発体制明確化）。

### v0.11

- 大規模リファクタリング（I/O操作と業務ロジックの分離）。
- 純粋関数の抽出（memo-crud-operations, memo-trash-operations, memo-query-operations, memo-split-operations, lru-cache）。
- テスト拡充（527件 → 723件、カバレッジ 88.4% → 91.89%）。
- ドキュメント整備（TESTING_GUIDE.md新規作成）。

### v0.12

- UI/UX改善（ゴミ箱タブラベル削除、ログ出力抑制、Shift+Enter送信）。
- コード品質向上（memo-search-operations.ts抽出、65テスト、100%カバレッジ）。
- テスト拡充（785件、カバレッジ95.19%）。

### v0.13

- **タイムゾーン処理の改善**: ISO 8601形式（タイムゾーンオフセット付き）でタイムスタンプを保存。
- **CI環境互換性の確保**: ローカル(GMT+9)とCI(GMT+0)の両環境で一貫した動作を実現。
- **コード品質の大幅向上**: Lintエラー42個を完全解決、型安全性を大幅に向上。
- **テスト品質の向上**: 環境依存テストの修正、全865テスト成功率100%達成。

---

## 10. ライセンス

### 本プロジェクトのライセンス

本プロジェクトはCC0 1.0 Universal (Public Domain)ライセンスの下で公開されています。

このプロジェクトの作成者は、法律上可能な範囲で、全ての著作権および関連する権利を放棄しています。

- 商用・非商用問わず自由に使用可能
- 改変・再配布自由
- クレジット表記不要
- 無保証

詳細は[LICENSE](LICENSE)ファイルまたは https://creativecommons.org/publicdomain/zero/1.0/ をご参照ください。

### 使用ライブラリのライセンス

**重要**: 本プロジェクトで使用している各ライブラリのライセンスは、言うまでもなく各ライブラリのライセンスに従います。

#### ランタイム依存関係

- **uuid** (v13.0.0) - MIT License
  - UUID生成ライブラリ
  - https://github.com/uuidjs/uuid

#### 開発依存関係

- **Obsidian API** (v1.6.0) - Proprietary
  - Obsidianプラグイン開発用API
  - https://github.com/obsidianmd/obsidian-api

- **TypeScript** (v5.3.3) - Apache-2.0 License
  - TypeScriptコンパイラ
  - https://github.com/microsoft/TypeScript

- **esbuild** (v0.20.1) - MIT License
  - JavaScriptバンドラー
  - https://github.com/evanw/esbuild

- **Jest** (v29.7.0) - MIT License
  - JavaScriptテストフレームワーク
  - https://github.com/jestjs/jest

- **ESLint** (v8.56.0) - MIT License
  - JavaScriptリンター
  - https://github.com/eslint/eslint

- **Prettier** (v3.2.5) - MIT License
  - コードフォーマッター
  - https://github.com/prettier/prettier

その他の開発依存関係については、`package.json`をご参照ください。

### ライセンス遵守について

本プロジェクトを使用・改変・再配布する際は、上記の各ライブラリのライセンス条項を遵守してください。特に、MITライセンスやApache-2.0ライセンスのライブラリについては、著作権表示とライセンス文の保持が必要です。

---

## 11. v0.0.11の主な変更点

### 11.1 大規模リファクタリング

コードの保守性とテスト容易性を大幅に改善するため、I/O操作と業務ロジックを分離。

**リファクタリング成果:**

- `memo-manager.ts`: 610行 → 442行 (-168行, -27.5%)
- `cache-manager.ts`: 210行 → 115行 (-95行, -45.2%)
- `path-migrator.ts`: 497行 → 460行 (-37行, -7.4%)

### 11.2 純粋関数の抽出

I/O操作を含まない純粋関数を独立モジュールとして抽出し、100%テストカバレッジを達成。

**抽出モジュール:**

- `memo-crud-operations.ts` (8関数, 40テスト, 100%カバレッジ)
  - メモのCRUD操作（作成、読み取り、更新、削除）
- `memo-trash-operations.ts` (8関数, 33テスト, 100%カバレッジ)
  - ゴミ箱関連操作
- `memo-query-operations.ts` (13関数, 44テスト, 100%カバレッジ)
  - メモの検索・フィルタリング・ソート
- `memo-split-operations.ts` (5関数, 23テスト, 100%カバレッジ)
  - メモ分割マイグレーション計画
- `cache/lru-cache.ts` (LRUCache実装, 24テスト, 100%カバレッジ)
  - LRUキャッシュアルゴリズムの実装

### 11.3 テスト拡充

包括的なテストスイートを構築し、高いテストカバレッジを達成。

**テスト統計:**

- テスト数: 527件 → 723件 (+196件, +37.2%)
- 全体カバレッジ: 88.4% → 91.89% (+3.49%)
- テストスイート: 28個
- 100%カバレッジモジュール: 6個

**新規テスト:**

- `lru-cache.test.ts` (24テストケース)
- `tag-manager.test.ts` (+12テストケース、88.46% → 100%)
- `path-migrator.test.ts` (20テストケース、モックベース)

### 11.4 ドキュメント整備

プロジェクトの品質向上とメンテナンス性向上のため、ドキュメントを拡充。

**新規ドキュメント:**

- `TESTING_GUIDE.md`: テスト戦略とガイドライン
  - テスト統計とモジュール別カバレッジ
  - テスト作成ガイドライン
  - モックベーステストのベストプラクティス

**更新ドキュメント:**

- `README.md`: v0.0.11の成果を反映
- `TODO.md`: v0.0.11完了、v0.0.12計画追加

---

## 12. v0.0.9の主な変更点

### 12.1 ゴミ箱機能

削除されたメモを一時的に保管する機能を追加。

**設定項目:**

- `enableTrash`: ゴミ箱機能の有効化
- `trashFilePath`: ゴミ箱ファイルパス（デフォルト: `_trash`）
- `trashRetentionDays`: 保持期間（日数）
- `showTrashTab`: ゴミ箱タブの表示

**特徴:**

- ゴミ箱ファイルは `_trash.md` 形式（隠しファイルは不可）
- 専用設定タブを追加
- パス変換処理から除外される特別なファイル

### 12.2 パス変換機能の改善

**変換ダイアログの強化:**

- バックアップのみ実行ボタンの追加
- 変換予定の全件表示（スクロール可能なテーブル）
- 特別なファイルの自動除外（`index.md`, `_*.md`, パス書式にマッチしないファイル）

**Git検出の修正:**

- `adapter.exists()` と `adapter.stat()` を使用
- 隠しファイル（`.git`）の正確な検出

### 12.3 設定画面の拡充

**ファイルパス書式プリセット追加:**

- `%C/%Y-%m-%d.md`
- `%C/%Y%m%d.md`

**添付ファイル保存先プリセット追加:**

- `./attachments/%Y-%m-%d`
- `./attachments/%Y%m%d`

---

## 13. v0.0.13の主な変更点

### 13.1 タイムゾーン処理の改善

**問題**: UTC形式(`2025-10-29T01:59:42.689Z`)でタイムスタンプを保存していたため、異なるタイムゾーンのユーザー間で日付の解釈が異なる問題が発生。

**解決策**: ISO 8601形式（タイムゾーンオフセット付き）でタイムスタンプを保存。

**新しい形式:**

```
2025-10-31T16:31:43.113+09:00
```

**メリット:**

- ユーザーのローカルタイムゾーンで投稿時刻を正確に記録
- 異なるタイムゾーンのユーザー間でも投稿時刻の正確な共有が可能
- 夏時間 (DST) の切り替えに対応

**後方互換性:**

- UTC形式(`Z`終端)のタイムスタンプも引き続きサポート
- 既存のメモは自動的に新形式で再保存される

### 13.2 CI環境互換性の確保

**問題**: テストが環境依存で、ローカル環境(GMT+9)では成功するがCI環境(GMT+0)では失敗する問題が発生。

**根本原因:**

```typescript
// ❌ 環境依存コード
const date = new Date(targetDate)
date.setHours(0, 0, 0, 0) // 実行環境のタイムゾーンに依存
```

**解決策:**

```typescript
// ✅ 環境非依存コード
const date = new Date("2025-10-29T00:00:00.000+09:00") // 明示的なタイムゾーン指定
```

**修正したモジュール:**

- `src/core/memo-helpers.ts`: `createTemplateRegex()`関数を追加
- `test/timezone-handling.test.ts`: 全18テストケースを環境非依存に修正
- `test/date-range-filter-bug.test.ts`: 日付範囲フィルタテストを修正

### 13.3 コード品質の大幅向上

**Lintエラーの完全解決:**

初期状態: 42個のエラー

- テンプレートパース問題: 3テスト失敗
- タイムゾーン問題: 7テスト失敗
- Lintエラー: 32個

修正後: 0個のエラー ✅

**主な修正内容:**

1. **型安全性の向上**
   ```typescript
   // ❌ 修正前
   const value = obj!.property // non-null assertion
   const content = calls[0][1] as string // 型キャスト

   // ✅ 修正後
   if (!obj) throw new Error("Not found")
   const value = obj.property // 型ガード
   const mock = fn as jest.Mock<TReturn, TArgs> // ジェネリック型指定
   ```

2. **コードの不変性**
   ```typescript
   // ❌ 修正前
   let pattern = templatePart.replace(...);

   // ✅ 修正後
   const pattern = templatePart.replace(...);
   ```

3. **意図の明確化**
   ```typescript
   // ❌ 修正前
   it("テスト", async () => { ... }); // awaitなし

   // ✅ 修正後
   it("テスト", () => { ... }); // asyncなし
   ```

### 13.4 テスト品質の向上

**テスト統計:**

- テスト数: 865件
- 成功率: **100%** ✅
- カバレッジ: 95.19%
- Node.js 18.x & 20.x: 両方で成功 ✅

**環境依存テストの修正:**

- `setHours()`使用箇所を全てISO 8601形式に置換
- テンプレートパース処理を正規表現ベースに改善
- Mock型の厳密な指定でLintエラーを解決

**技術的な改善:**

- `createTemplateRegex()`: タイムゾーン非依存のパース処理
- Optional chaining & Nullish coalescing: 安全なnullチェック
- Jest Mock型のジェネリック指定: 型推論の改善

---
