# memolog 仕様書 v0.0.9 - カテゴリ別ストレージモード機能

最終更新: 2025-10-28
バージョン: v0.0.9（開発中）

---

## 1. 概要

v0.0.9では、カテゴリごとに独立したストレージモード（ファイル保存方式）を設定できる機能を実装する。

### 1.1 背景

v0.0.8までは、グローバル設定の`useDirectoryCategory`フラグで全カテゴリのディレクトリ分離をON/OFFしていた。しかし、実際の運用では以下のニーズがある：

- 「仕事」カテゴリは専用ディレクトリで厳密に管理したい
- 「メモ」カテゴリはルートディレクトリに雑多に保存したい
- カテゴリごとに異なるファイル管理戦略を取りたい

### 1.2 主な変更点

1. **カテゴリ個別のストレージモード設定**
   - グローバル設定の`useDirectoryCategory`を廃止（後方互換性のため残す）
   - カテゴリごとに`storageMode`を設定可能に

2. **データ移行機能**
   - ストレージモード変更時に既存メモを適切に移行
   - タイムスタンプベースで時刻順に再構築
   - バックアップ推奨の警告表示

3. **安全性の向上**
   - 設定変更とデータ移行を分離（自動移行しない）
   - 移行前のデータ整合性チェック
   - 移行後の検証機能

---

## 2. ストレージモードの種類

### 2.1 ストレージモード定義

各カテゴリは以下のストレージモードを選択できる：

| モード | 値 | 説明 | ファイルパス例 |
|--------|-----|------|---------------|
| **ルート保存** | `"root"` | memologルートディレクトリに直接保存 | `memolog/2025/10/28.md` |
| **カテゴリディレクトリ** | `"category-dir"` | カテゴリ専用ディレクトリに保存 | `memolog/work/2025/10/28.md` |
| **Daily Notes連携** | `"daily-notes"` | ObsidianのDaily Notesに保存 | `DailyNotes/2025-10-28.md` |

### 2.2 ファイル構造の違い

#### モード: `"root"` (ルート保存)

```
memolog/
├── 2025/
│   └── 10/
│       └── 28.md  ← 全カテゴリのメモが混在
│           {workメモ}
│           {hobbyメモ}
```

#### モード: `"category-dir"` (カテゴリディレクトリ)

```
memolog/
├── work/
│   └── 2025/
│       └── 10/
│           └── 28.md  ← workカテゴリのみ
│               {workメモ}
└── hobby/
    └── 2025/
        └── 10/
            └── 28.md  ← hobbyカテゴリのみ
                {hobbyメモ}
```

#### モード: `"daily-notes"` (Daily Notes連携)

```
DailyNotes/
└── 2025-10-28.md  ← Obsidian標準のDaily Notes
    # 今日のメモ
    {ユーザーの任意コンテンツ}

    {workメモ}
```

---

## 3. 型定義の変更

### 3.1 CategoryConfigの拡張

```typescript
//! カテゴリ設定。
export interface CategoryConfig {
    //! カテゴリ表示名。
    name: string;

    //! 実際の保存フォルダ名（storageMode='category-dir'の場合に使用）。
    directory: string;

    //! UI上で使用するカラーコード。
    color: string;

    //! アイコン名（Obsidianのアイコンセット）。
    icon: string;

    //! アイコンを表示するか（デフォルト: true）。
    showIcon?: boolean;

    //! ストレージモード（v0.0.9で追加）。
    storageMode: StorageMode;

    //! このカテゴリ専用のテンプレート（オプション）。
    template?: string;

    //! このカテゴリ専用のソート順（オプション）。
    order?: "asc" | "desc";

    //! このカテゴリ専用のファイルパス書式（オプション）。
    pathFormat?: string;
}

//! ストレージモード。
export type StorageMode = "root" | "category-dir" | "daily-notes";
```

### 3.2 GlobalSettingsの変更

```typescript
export interface GlobalSettings {
    //! ディレクトリでカテゴリを分離するかどうか（非推奨: v0.0.9以降はCategoryConfig.storageModeを使用）。
    //! @deprecated v0.0.9以降は各カテゴリのstorageModeを使用してください。
    useDirectoryCategory: boolean;

    //! カテゴリ情報配列。
    categories: CategoryConfig[];

    // ... その他の設定は変更なし
}
```

### 3.3 後方互換性の処理

```typescript
//! v0.0.8以前の設定を読み込む際の互換性処理。
function migrateSettings(settings: GlobalSettings): GlobalSettings {
    //! useDirectoryCategoryがtrueで、カテゴリにstorageModeがない場合。
    if (settings.useDirectoryCategory) {
        settings.categories = settings.categories.map(cat => ({
            ...cat,
            storageMode: cat.storageMode || "category-dir"
        }));
    } else {
        settings.categories = settings.categories.map(cat => ({
            ...cat,
            storageMode: cat.storageMode || "root"
        }));
    }

    return settings;
}
```

---

## 4. データ移行機能

### 4.1 移行シナリオ

#### シナリオ1: `root` → `category-dir`

**移行前**:
```
memolog/2025/10/28.md
<!-- memo-id: w1, timestamp: 2025-10-28T09:00:00Z, category: "work" -->
## 2025-10-28 09:00
仕事メモ1

<!-- memo-id: w2, timestamp: 2025-10-28T15:00:00Z, category: "work" -->
## 2025-10-28 15:00
仕事メモ2

<!-- memo-id: h1, timestamp: 2025-10-28T12:00:00Z, category: "hobby" -->
## 2025-10-28 12:00
趣味メモ1
```

**移行後**:
```
memolog/work/2025/10/28.md
<!-- memo-id: w1, timestamp: 2025-10-28T09:00:00Z, category: "work" -->
## 2025-10-28 09:00
仕事メモ1

<!-- memo-id: w2, timestamp: 2025-10-28T15:00:00Z, category: "work" -->
## 2025-10-28 15:00
仕事メモ2

memolog/hobby/2025/10/28.md
<!-- memo-id: h1, timestamp: 2025-10-28T12:00:00Z, category: "hobby" -->
## 2025-10-28 12:00
趣味メモ1
```

#### シナリオ2: `category-dir` → `root`

上記の逆処理。カテゴリごとのディレクトリからメモを収集し、タイムスタンプ順にルートディレクトリの同一ファイルに統合。

### 4.2 移行処理の流れ

```
1. 移行前チェック
   ├─ 対象カテゴリのメモを全件読み込み
   ├─ タイムスタンプの整合性チェック
   └─ ディスク容量チェック

2. バックアップ作成（オプション）
   └─ memolog-backup-YYYYMMDD-HHmmss/ にコピー

3. メモの収集とソート
   ├─ 全メモをタイムスタンプでソート
   └─ 日付単位でグループ化

4. 新しいストレージモードでファイル生成
   ├─ ディレクトリ構造を作成
   ├─ メモを時刻順に挿入
   └─ HTMLコメントタグを適切に設定

5. 検証
   ├─ メモ総数の一致確認
   ├─ タイムスタンプの整合性確認
   └─ ファイル読み込みテスト

6. 旧ファイルの処理
   ├─ 成功時: 旧ファイルを削除またはアーカイブ
   └─ 失敗時: ロールバック
```

### 4.3 移行処理の実装クラス

```typescript
//! ストレージモード移行マネージャー。
export class StorageMigrationManager {
    //! 移行前チェック。
    async validateMigration(
        category: string,
        fromMode: StorageMode,
        toMode: StorageMode
    ): Promise<MigrationValidationResult>;

    //! バックアップ作成。
    async createBackup(
        categories: string[]
    ): Promise<string>; // バックアップディレクトリパスを返す

    //! 移行実行。
    async migrate(
        category: string,
        fromMode: StorageMode,
        toMode: StorageMode,
        options: MigrationOptions
    ): Promise<MigrationResult>;

    //! 移行検証。
    async verifyMigration(
        category: string,
        expectedMemoCount: number
    ): Promise<boolean>;

    //! ロールバック。
    async rollback(
        backupPath: string,
        category: string
    ): Promise<void>;
}

//! 移行オプション。
export interface MigrationOptions {
    //! 旧ファイルを削除するか（デフォルト: false）。
    deleteOldFiles: boolean;

    //! バックアップを作成するか（デフォルト: true）。
    createBackup: boolean;

    //! ドライラン（実際には変更しない）。
    dryRun: boolean;
}

//! 移行結果。
export interface MigrationResult {
    success: boolean;
    migratedMemoCount: number;
    createdFiles: string[];
    deletedFiles: string[];
    errors: string[];
    backupPath?: string;
}
```

---

## 5. UI設計

### 5.1 設定画面の変更

#### 5.1.1 グローバル設定セクション

```
┌─────────────────────────────────────────┐
│ 基本設定                                 │
├─────────────────────────────────────────┤
│ ルートディレクトリ: [memolog         ]  │
│ デフォルトカテゴリ: [仕事      ▼]      │
│ 保存単位: [日 ▼]                        │
│ ソート順: [昇順 ▼]                      │
└─────────────────────────────────────────┘
```

**変更点**: `useDirectoryCategory`チェックボックスを削除

#### 5.1.2 カテゴリ管理セクション

```
┌─────────────────────────────────────────────────────────────┐
│ カテゴリ管理                                                 │
├─────────────────────────────────────────────────────────────┤
│ ┌─ 仕事 ─────────────────────────────────────────────────┐ │
│ │ 表示名: [仕事                ]                          │ │
│ │ ディレクトリ名: [work            ]                     │ │
│ │ カラー: [#3b82f6] 🎨  アイコン: [briefcase ▼] 💼     │ │
│ │                                                         │ │
│ │ ストレージモード: [カテゴリディレクトリ ▼]             │ │
│ │   ○ ルート保存 (memolog/2025/10/28.md)                │ │
│ │   ● カテゴリディレクトリ (memolog/work/2025/10/28.md) │ │
│ │   ○ Daily Notes連携                                    │ │
│ │                                                         │ │
│ │ テンプレート: [{{content}}           ] (省略時:共通)  │ │
│ │ ソート順: [デフォルト ▼] (省略時:共通)                │ │
│ │                                                         │ │
│ │ [データ移行...] [削除]                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ 趣味 ─────────────────────────────────────────────────┐ │
│ │ 表示名: [趣味                ]                          │ │
│ │ ... (同様の設定項目)                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [+ 新しいカテゴリを追加]                                   │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.3 データ移行ダイアログ

「データ移行...」ボタンをクリックすると表示：

```
┌────────────────────────────────────────────────────────┐
│ ストレージモード移行 - 仕事カテゴリ                    │
├────────────────────────────────────────────────────────┤
│ ⚠️ 警告: この操作はデータを大規模に変更します！        │
│                                                        │
│ 必ず事前にVault全体のバックアップを取ってください。    │
│                                                        │
│ 移行元: ルート保存                                      │
│ 移行先: カテゴリディレクトリ                            │
│                                                        │
│ 検出されたメモ: 143件                                  │
│ 対象ファイル: 28個                                     │
│ 推定所要時間: 約5秒                                     │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ オプション                                          │ │
│ │ ☑ 移行前にバックアップを作成                       │ │
│ │ ☑ 移行後に旧ファイルを削除                         │ │
│ │ ☐ ドライラン（実際には変更しない）                 │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ [キャンセル]                     [プレビュー] [実行]  │
└────────────────────────────────────────────────────────┘
```

#### 5.1.4 移行プレビュー画面

「プレビュー」ボタンをクリックすると表示：

```
┌────────────────────────────────────────────────────────┐
│ 移行プレビュー                                          │
├────────────────────────────────────────────────────────┤
│ 作成されるファイル:                                     │
│ ✅ memolog/work/2025/10/26.md (12メモ)                │
│ ✅ memolog/work/2025/10/27.md (18メモ)                │
│ ✅ memolog/work/2025/10/28.md (9メモ)                 │
│ ... 他25件                                              │
│                                                        │
│ 削除されるファイル:                                     │
│ ❌ memolog/2025/10/26.md (workカテゴリ部分のみ)       │
│ ❌ memolog/2025/10/27.md (workカテゴリ部分のみ)       │
│ ... 他26件                                              │
│                                                        │
│ バックアップ先:                                         │
│ 📦 memolog-backup-20251028-153022/                    │
│                                                        │
│ [戻る]                                         [実行]  │
└────────────────────────────────────────────────────────┘
```

#### 5.1.5 移行進捗表示

```
┌────────────────────────────────────────────────────────┐
│ 移行中... 仕事カテゴリ                                  │
├────────────────────────────────────────────────────────┤
│ [████████████████████████████░░░░░░] 85%              │
│                                                        │
│ ✓ バックアップ作成完了                                 │
│ ✓ メモ収集完了 (143件)                                │
│ ⏳ ファイル生成中... (24/28)                          │
│                                                        │
│ 推定残り時間: 1秒                                       │
└────────────────────────────────────────────────────────┘
```

#### 5.1.6 移行完了画面

```
┌────────────────────────────────────────────────────────┐
│ 移行完了 ✓                                             │
├────────────────────────────────────────────────────────┤
│ 仕事カテゴリのストレージモード移行が完了しました。      │
│                                                        │
│ 移行結果:                                               │
│ • 移行したメモ: 143件                                  │
│ • 作成したファイル: 28個                                │
│ • 削除したファイル: 28個                                │
│ • 処理時間: 4.2秒                                       │
│                                                        │
│ バックアップ:                                           │
│ 📦 memolog-backup-20251028-153022/                    │
│                                                        │
│ 問題が発生した場合は、このバックアップから復元できます。│
│                                                        │
│ [ログを表示]                                   [閉じる] │
└────────────────────────────────────────────────────────┘
```

---

## 6. パスジェネレーターの変更

### 6.1 PathGeneratorの拡張

```typescript
export class PathGenerator {
    //! ファイルパスを生成する（v0.0.9: storageModeに対応）。
    static generateFilePath(
        rootDirectory: string,
        category: CategoryConfig,  // CategoryConfigを直接受け取る
        saveUnit: SaveUnit,
        date: Date,
        pathFormat?: string
    ): string {
        const format = pathFormat || category.pathFormat || "%Y/%m/%d";

        switch (category.storageMode) {
            case "root":
                // memolog/2025/10/28.md
                return `${rootDirectory}/${this.formatPath(format, date)}.md`;

            case "category-dir":
                // memolog/work/2025/10/28.md
                return `${rootDirectory}/${category.directory}/${this.formatPath(format, date)}.md`;

            case "daily-notes":
                // DailyNotes/2025-10-28.md (Obsidianの設定から取得)
                return this.getDailyNotePath(date);
        }
    }

    //! Daily Notesのパスを取得（Obsidian APIから）。
    private static getDailyNotePath(date: Date): string {
        // Obsidian APIのdailyNotesプラグイン設定を参照
        // 実装時にObsidian.app.vault.adapter経由で取得
    }
}
```

---

## 7. 実装計画

### 7.1 フェーズ1: 型定義とマイグレーション

- [ ] `StorageMode`型の追加
- [ ] `CategoryConfig`に`storageMode`プロパティ追加
- [ ] 後方互換性処理（`migrateSettings`）の実装
- [ ] 既存設定の自動マイグレーション

### 7.2 フェーズ2: PathGenerator対応

- [ ] `PathGenerator.generateFilePath`をstorageMode対応に変更
- [ ] Daily Notes連携の実装
- [ ] 既存コードのパス生成ロジック更新

### 7.3 フェーズ3: StorageMigrationManager実装

- [ ] `StorageMigrationManager`クラス作成
- [ ] `root` → `category-dir` 移行処理
- [ ] `category-dir` → `root` 移行処理
- [ ] タイムスタンプベースのソート処理
- [ ] バックアップ/リストア機能
- [ ] 検証機能

### 7.4 フェーズ4: UI実装

- [ ] カテゴリ設定UIにstorageMode選択を追加
- [ ] データ移行ダイアログの実装
- [ ] 移行プレビュー画面の実装
- [ ] 進捗表示の実装
- [ ] 完了/エラー画面の実装

### 7.5 フェーズ5: テスト

- [ ] StorageMigrationManagerの単体テスト
- [ ] 移行シナリオの統合テスト
- [ ] 大量データでのパフォーマンステスト
- [ ] エラーケースのテスト

### 7.6 フェーズ6: ドキュメント

- [ ] ユーザーマニュアル（移行手順）
- [ ] トラブルシューティングガイド
- [ ] リリースノート

---

## 8. リスク管理

### 8.1 データ損失リスク

**リスク**: 移行処理中のエラーでデータが失われる可能性

**対策**:
- デフォルトでバックアップを作成
- トランザクション的な処理（全て成功するか全て失敗）
- ロールバック機能
- ドライランモード

### 8.2 パフォーマンスリスク

**リスク**: 大量メモの移行に時間がかかる

**対策**:
- バッチ処理（100件ずつ処理）
- 進捗表示
- バックグラウンド処理

### 8.3 互換性リスク

**リスク**: v0.0.8以前の設定が正しく移行されない

**対策**:
- 設定マイグレーション処理
- デフォルト値の明示
- 警告メッセージ

---

## 9. 成功基準

### 9.1 機能要件

- [x] カテゴリごとにストレージモードを設定できる
- [x] 3種類のストレージモード（root, category-dir, daily-notes）をサポート
- [x] 既存メモを新しいストレージモードに移行できる
- [x] タイムスタンプ順でメモが正しく並ぶ
- [x] バックアップ/ロールバック機能が動作する

### 9.2 非機能要件

- [x] 1000件のメモを30秒以内に移行できる
- [x] 移行中にObsidianが固まらない
- [x] メモの総数と内容が移行前後で一致する
- [x] ユーザーに明確なフィードバックを提供する

---

## 10. 用語集

| 用語 | 説明 |
|------|------|
| ストレージモード | カテゴリのファイル保存方式（root/category-dir/daily-notes） |
| ルート保存 | memologルートディレクトリに直接保存する方式 |
| カテゴリディレクトリ | カテゴリ専用ディレクトリに保存する方式 |
| データ移行 | ストレージモード変更時に既存メモを移動する処理 |
| ドライラン | 実際には変更せず、処理結果をプレビューする機能 |

---

## 付録A: 移行処理の疑似コード

```typescript
async function migrate(
    category: CategoryConfig,
    fromMode: StorageMode,
    toMode: StorageMode
): Promise<MigrationResult> {
    // 1. バックアップ作成
    const backupPath = await createBackup([category.directory]);

    try {
        // 2. 全メモを収集
        const allMemos = await collectAllMemos(category, fromMode);

        // 3. タイムスタンプでソート
        allMemos.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // 4. 日付単位でグループ化
        const memosByDate = groupBy(allMemos, memo =>
            memo.timestamp.substring(0, 10) // "2025-10-28"
        );

        // 5. 新しいファイル生成
        const createdFiles: string[] = [];
        for (const [dateStr, memos] of Object.entries(memosByDate)) {
            const date = new Date(dateStr);
            const filePath = PathGenerator.generateFilePath(
                settings.rootDirectory,
                { ...category, storageMode: toMode },
                settings.saveUnit,
                date
            );

            await createFileWithMemos(filePath, category, memos);
            createdFiles.push(filePath);
        }

        // 6. 検証
        const newMemoCount = await countMemos(category, toMode);
        if (newMemoCount !== allMemos.length) {
            throw new Error("メモ数が一致しません");
        }

        // 7. 旧ファイル削除
        const deletedFiles = await deleteOldFiles(category, fromMode);

        return {
            success: true,
            migratedMemoCount: allMemos.length,
            createdFiles,
            deletedFiles,
            errors: [],
            backupPath
        };

    } catch (error) {
        // ロールバック
        await rollback(backupPath, category);
        throw error;
    }
}
```

---

## 付録B: 設定例

### B.1 混在構成の例

```json
{
  "categories": [
    {
      "name": "仕事",
      "directory": "work",
      "storageMode": "category-dir",
      "color": "#3b82f6",
      "icon": "briefcase"
    },
    {
      "name": "個人メモ",
      "directory": "personal",
      "storageMode": "root",
      "color": "#22c55e",
      "icon": "sticky-note"
    },
    {
      "name": "日記",
      "directory": "diary",
      "storageMode": "daily-notes",
      "color": "#f59e0b",
      "icon": "book"
    }
  ]
}
```

この設定により：
- 「仕事」メモは `memolog/work/2025/10/28.md` に保存
- 「個人メモ」は `memolog/2025/10/28.md` に保存
- 「日記」は `DailyNotes/2025-10-28.md` に保存

異なるカテゴリが柔軟に混在可能。

---

## 11. v0.0.9 追加機能

### 11.1 ゴミ箱機能

#### 11.1.1 概要

削除されたメモを一時的に保管し、必要に応じて復元できる機能。

#### 11.1.2 設定項目

```typescript
interface GlobalSettings {
    //! ゴミ箱機能を有効化するか。
    enableTrash: boolean;

    //! ゴミ箱ファイルパス（rootDirectoryからの相対パス、拡張子なし）。
    trashFilePath: string;  // デフォルト: "_trash"

    //! ゴミ箱の保持期間（日数）。
    trashRetentionDays: number;  // デフォルト: 30

    //! ゴミ箱タブを表示するか。
    showTrashTab: boolean;
}
```

#### 11.1.3 ゴミ箱ファイル形式

- ファイル名: `_trash.md` (デフォルト、設定で変更可能)
- 隠しファイル（`.trash.md`）は使用不可（Obsidianで開けないため）
- ゴミ箱ファイルは特別なファイルとして扱われ、パス変換処理の対象外

#### 11.1.4 設定画面

専用の「ゴミ箱」タブを追加:
- ゴミ箱機能の有効化/無効化
- ゴミ箱ファイルパスの設定
- 保持期間の設定
- ゴミ箱タブ表示のON/OFF

### 11.2 パス変換機能の改善

#### 11.2.1 変換ダイアログの機能強化

**バックアップのみ実行ボタン**
- 変換を実行せず、バックアップのみ作成するオプション
- 安全性を重視したユーザー向けの選択肢
- ボタン配置: 「バックアップして変換」→「バックアップのみ」→「バックアップせずに変換」→「キャンセル」

**変換予定の全件表示**
- 従来: 最初の5件のみリスト表示
- 改善: 全件をスクロール可能なテーブル形式で表示
  - 固定ヘッダー（変換前/変換後）
  - 最大高さ400px、縦スクロール対応
  - 各行にパス情報を表示

#### 11.2.2 特別なファイルの除外

**除外対象**
1. `index.md` - rootディレクトリ直下のインデックスファイル
2. `_*.md` - rootディレクトリ直下のアンダースコアで始まるファイル（ゴミ箱ファイルなど）
3. 古いパス書式にマッチしないファイル（日付情報が抽出できないファイル）

**除外ロジック**
- rootディレクトリ直下のファイルのみチェック（サブディレクトリ内は通常通り処理）
- `analyzePath()` と `analyzeMemoSplit()` の両方で実装

#### 11.2.3 Git検出ロジックの修正

**問題**
- 従来の `getAbstractFileByPath(".git")` では隠しファイルを検出できない

**解決策**
```typescript
async isGitRepository(): Promise<boolean> {
    try {
        const adapter = this.app.vault.adapter;
        const gitPath = ".git";

        // ファイルシステムレベルで存在確認
        const exists = await adapter.exists(gitPath);
        if (!exists) return false;

        // ディレクトリタイプの確認
        const stat = await adapter.stat(gitPath);
        return stat?.type === "folder";
    } catch (error) {
        console.error("Failed to check git repository:", error);
        return false;
    }
}
```

### 11.3 設定画面プリセットの拡充

#### 11.3.1 ファイルパス書式プリセット追加

追加プリセット:
- `%C/%Y-%m-%d.md` - カテゴリ/年-月-日.md形式
- `%C/%Y%m%d.md` - カテゴリ/年月日.md形式

用途:
- カテゴリごとにディレクトリを分けつつ、日単位でファイルを管理
- ファイル名のシンプル化（ハイフンあり/なし）

#### 11.3.2 添付ファイル保存先プリセット追加

追加プリセット:
- `./attachments/%Y-%m-%d` - attachments/年-月-日形式（相対パス）
- `./attachments/%Y%m%d` - attachments/年月日形式（相対パス）

用途:
- 日付ごとに添付ファイルをグルーピング
- 相対パスによるメモファイルと同階層での管理

---

## 12. 変更履歴

### 2025-10-30 (午前)
- ゴミ箱機能の実装
- パス変換ダイアログの改善（バックアップのみ実行、全件表示）
- 特別なファイルの除外ロジック追加
- Git検出の修正
- 設定画面プリセットの拡充

### 2025-10-30 (午後)
- ゴミ箱タブへの削除投稿表示機能の修正
  - Vault内の全ファイルから直接読み込むように変更
  - 日付ループの非効率な処理を改善
- ピン留め機能の修正
  - ピン留めタブに投稿が表示されない問題を修正
  - ソート変更時にピン状態が維持されない問題を修正
  - 日付フィルタ適用時もピン留め投稿が表示されるように改善
- カテゴリ設定タブの表示順序変更
  - Allタブ→ピン留めタブ→デフォルトカテゴリ→個別カテゴリの順に変更
- 日付範囲フィルタの修正
  - 「今日」「一週間」ボタン両方OFF時に全期間表示されるように修正
  - button-bar.tsでnullを"all"に変換する処理を追加
  - 初期値を"today"から"all"に変更
- UI改善
  - デフォルトカテゴリ設定画面のアイコン色をカテゴリ色に変更
  - ピン留めタブのラベル「ピン留め」を削除（アイコンのみ表示）
  - ピン留めボタンの透明度を0.6から0.3に変更（より目立たなく）

---

以上、memolog v0.0.9仕様書
