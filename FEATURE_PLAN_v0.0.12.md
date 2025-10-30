# memolog v0.0.12 機能追加計画

## 概要

v0.0.11でコード品質とテストカバレッジを向上させた後、v0.0.12ではユーザビリティ改善とファイル管理の柔軟性向上を実施する。

## 目標

- 設定画面のUI/UX改善
- ファイルパス書式の選択肢追加
- 保存単位の柔軟性向上
- ユーザーフィードバックに基づく改善

## v0.0.11からの引継ぎ

### 前提条件
- v0.0.11でリファクタリング完了
- テストカバレッジ90%以上達成
- アーキテクチャドキュメント整備済み

### 技術的基盤
- memo-manager.ts の分割完了
- path-migrator.ts のテスト完備
- ヘルパー関数パターンの確立

## v0.0.12 機能追加項目

### 1. ファイルパス書式の追加

#### 1.1 新規書式: `%Y%m%d-%C.md`

**目的**: 日付とカテゴリを組み合わせたファイル命名規則の提供

**書式仕様**:
- `%Y%m%d`: 年月日 (例: 20251030)
- `-`: 区切り文字
- `%C`: カテゴリ名
- `.md`: 拡張子

**具体例**:
```
work カテゴリの場合:
  20251030-work.md
  20251031-work.md

personal カテゴリの場合:
  20251030-personal.md
  20251031-personal.md
```

**実装箇所**:
- `src/types/settings.ts`: `PathFormat` 型に追加
- `src/ui/settings-tab.ts`: 設定画面のドロップダウンに追加
- `src/utils/path-generator.ts`: 書式処理の追加
- `test/path-generator.test.ts`: テストケース追加

**期待される効果**:
- カテゴリ別にファイルが分かれるため、視認性向上
- 日付順ソートが容易
- ファイル数の管理がしやすい

#### 1.2 実装詳細

**PathFormat型の拡張**:
```typescript
// src/types/settings.ts
export type PathFormat =
  | "%Y-%m-%d.md"     // 既存
  | "%Y/%m/%d.md"    // 既存
  | "%Y-%m.md"       // 既存
  | "%Y-W%W.md"      // 既存
  | "%Y.md"          // 既存
  | "%Y%m%d-%C.md"   // 新規追加
  | "custom";        // 既存
```

**設定画面の選択肢**:
```typescript
// src/ui/settings-tab.ts
const pathFormatOptions = [
  { value: "%Y-%m-%d.md", label: "日別 (2025-10-30.md)" },
  { value: "%Y%m%d-%C.md", label: "日別+カテゴリ (20251030-work.md)" }, // 新規
  { value: "%Y-%m.md", label: "月別 (2025-10.md)" },
  { value: "%Y-W%W.md", label: "週別 (2025-W43.md)" },
  { value: "%Y.md", label: "年別 (2025.md)" },
  { value: "%Y/%m/%d.md", label: "階層別 (2025/10/30.md)" },
  { value: "custom", label: "カスタム" },
];
```

**path-generatorの修正**:
```typescript
// src/utils/path-generator.ts
static generateCustomPath(
  rootDir: string,
  category: string,
  pathFormat: string,
  useDirectoryCategory: boolean,
  date: Date = new Date()
): string {
  // %Cをカテゴリ名に置換
  const categoryReplaced = pathFormat.replace(/%C/g, category);

  // 既存のformatTimestampロジックを適用
  const formatted = formatTimestamp(date.toISOString(), categoryReplaced);

  // ...
}
```

**テストケース追加**:
```typescript
// test/path-generator.test.ts
describe("generateCustomPath", () => {
  test("%Y%m%d-%C.md 形式", () => {
    const result = PathGenerator.generateCustomPath(
      "memolog",
      "work",
      "%Y%m%d-%C.md",
      false,
      new Date(2025, 9, 30)
    );
    expect(result).toBe("memolog/20251030-work.md");
  });

  test("%Y%m%d-%C.md 形式 (カテゴリ: personal)", () => {
    const result = PathGenerator.generateCustomPath(
      "memolog",
      "personal",
      "%Y%m%d-%C.md",
      false,
      new Date(2025, 9, 30)
    );
    expect(result).toBe("memolog/20251030-personal.md");
  });
});
```

### 2. 設定画面のUI改善

#### 2.1 ラジオボタンの選択肢の並び順最適化

**目的**: より使いやすい順序に並び替え

**現状の課題**:
- 使用頻度の高い選択肢が分散している
- 論理的なグループ化が不十分

**改善案**:

**ファイルパス書式の並び順**:
```
1. 日別 (2025-10-30.md)          ← 最も一般的
2. 日別+カテゴリ (20251030-work.md) ← 新規追加、日別の派生
3. 月別 (2025-10.md)             ← 次に一般的
4. 週別 (2025-W43.md)            ← 特殊な用途
5. 年別 (2025.md)                ← レアケース
6. 階層別 (2025/10/30.md)        ← ディレクトリ構造派
7. カスタム                       ← 高度なユーザー向け
```

**保存位置の並び順**:
```
1. 上に追加 (top)    ← デフォルト推奨
2. 下に追加 (bottom) ← 時系列順
```

**ソート順の並び順**:
```
1. 新しい順 (desc)   ← デフォルト推奨
2. 古い順 (asc)      ← 時系列順
```

#### 2.2 実装詳細

**設定画面の再構成**:
```typescript
// src/ui/settings-tab.ts

// ファイルパス書式セクション
new Setting(containerEl)
  .setName("ファイルパス書式")
  .setDesc("メモを保存するファイル名の形式を選択してください")
  .addDropdown((dropdown) => {
    dropdown
      .addOption("%Y-%m-%d.md", "日別 (2025-10-30.md)")
      .addOption("%Y%m%d-%C.md", "日別+カテゴリ (20251030-work.md)")
      .addOption("%Y-%m.md", "月別 (2025-10.md)")
      .addOption("%Y-W%W.md", "週別 (2025-W43.md)")
      .addOption("%Y.md", "年別 (2025.md)")
      .addOption("%Y/%m/%d.md", "階層別 (2025/10/30.md)")
      .addOption("custom", "カスタム")
      .setValue(this.plugin.settings.pathFormat)
      .onChange(async (value) => {
        this.plugin.settings.pathFormat = value as PathFormat;
        await this.plugin.saveSettings();
        this.display(); // 再描画
      });
  });

// カスタム書式入力欄 (pathFormat === "custom" の場合のみ表示)
if (this.plugin.settings.pathFormat === "custom") {
  new Setting(containerEl)
    .setName("カスタム書式")
    .setDesc("利用可能な書式: %Y(年), %m(月), %d(日), %W(週), %C(カテゴリ)")
    .addText((text) => {
      text
        .setPlaceholder("例: %Y/%C/%m-%d.md")
        .setValue(this.plugin.settings.customPathFormat || "")
        .onChange(async (value) => {
          this.plugin.settings.customPathFormat = value;
          await this.plugin.saveSettings();
        });
    });
}
```

**ヘルプテキストの追加**:
```typescript
// 各書式の説明を追加
const pathFormatDescriptions = {
  "%Y-%m-%d.md": "1日1ファイル。最も一般的な形式です。",
  "%Y%m%d-%C.md": "1日1カテゴリ1ファイル。カテゴリ別に管理したい場合に便利です。",
  "%Y-%m.md": "1ヶ月1ファイル。月単位でメモをまとめたい場合に。",
  "%Y-W%W.md": "1週間1ファイル。週次レビューに便利です。",
  "%Y.md": "1年1ファイル。長期的な記録向けです。",
  "%Y/%m/%d.md": "階層構造。Vault内を整理したい場合に。",
  "custom": "独自の書式を定義できます。高度なユーザー向けです。",
};
```

### 3. 保存単位の追加

#### 3.1 新規保存単位: 「1投稿毎」

**目的**: メモごとに個別ファイルとして保存する選択肢の提供

**仕様**:
- 各メモが独立したファイルになる
- ファイル名にメモIDまたはタイムスタンプを含める
- 小規模なメモ管理に適している

**ファイル命名規則**:
```
オプション1: メモID基準
  {rootDir}/{category}/{memo-id}.md

オプション2: タイムスタンプ基準
  {rootDir}/{category}/{timestamp}.md
  例: memolog/work/2025-10-30-143045.md

オプション3: 日時+カテゴリ+連番
  {rootDir}/{category}/{date}-{seq}.md
  例: memolog/work/2025-10-30-001.md
```

**推奨**: オプション2 (タイムスタンプ基準) を採用

#### 3.2 実装詳細

**型定義の拡張**:
```typescript
// src/types/settings.ts
export type SaveUnit =
  | "daily"      // 既存: 1日1ファイル
  | "monthly"    // 既存: 1ヶ月1ファイル
  | "weekly"     // 既存: 1週間1ファイル
  | "yearly"     // 既存: 1年1ファイル
  | "per-memo";  // 新規: 1投稿毎
```

**設定画面の追加**:
```typescript
// src/ui/settings-tab.ts
new Setting(containerEl)
  .setName("保存単位")
  .setDesc("メモをどの単位でファイルにまとめるか選択してください")
  .addDropdown((dropdown) => {
    dropdown
      .addOption("daily", "1日1ファイル")
      .addOption("per-memo", "1投稿毎") // 新規追加
      .addOption("weekly", "1週間1ファイル")
      .addOption("monthly", "1ヶ月1ファイル")
      .addOption("yearly", "1年1ファイル")
      .setValue(this.plugin.settings.saveUnit)
      .onChange(async (value) => {
        this.plugin.settings.saveUnit = value as SaveUnit;
        await this.plugin.saveSettings();
      });
  });
```

**path-generatorの拡張**:
```typescript
// src/utils/path-generator.ts
static generateMemoPath(
  rootDir: string,
  category: string,
  saveUnit: SaveUnit,
  pathFormat: string,
  timestamp: string
): string {
  if (saveUnit === "per-memo") {
    // タイムスタンプからファイル名を生成
    const date = new Date(timestamp);
    const fileName = formatTimestamp(
      timestamp,
      "%Y-%m-%d-%H%M%S.md"
    );

    if (useDirectoryCategory) {
      return `${rootDir}/${category}/${fileName}`;
    } else {
      return `${rootDir}/${fileName}`;
    }
  }

  // 既存のロジック
  return this.generateCustomPath(
    rootDir,
    category,
    pathFormat,
    useDirectoryCategory,
    new Date(timestamp)
  );
}
```

**memo-managerの対応**:
```typescript
// src/core/memo-manager.ts (リファクタリング後)
async addMemo(content: string, ...): Promise<void> {
  const memo = this.createMemo(content, ...);

  // 保存単位に応じたファイルパス生成
  const filePath = PathGenerator.generateMemoPath(
    this.settings.rootDirectory,
    memo.category,
    this.settings.saveUnit,
    this.settings.pathFormat,
    memo.timestamp
  );

  if (this.settings.saveUnit === "per-memo") {
    // 1投稿毎の場合は新規ファイル作成
    const memoText = memoToText(memo, this.settings.template);
    await this.vaultHandler.createFile(filePath, memoText);
  } else {
    // 既存ロジック: ファイルに追記
    await this.appendMemoToFile(filePath, memo);
  }
}
```

**テストケース追加**:
```typescript
// test/path-generator.test.ts
describe("generateMemoPath", () => {
  describe("per-memo 保存単位", () => {
    test("タイムスタンプベースのファイル名生成", () => {
      const timestamp = "2025-10-30T14:30:45.000Z";
      const result = PathGenerator.generateMemoPath(
        "memolog",
        "work",
        "per-memo",
        "%Y-%m-%d.md",
        timestamp
      );
      expect(result).toMatch(/^memolog\/work\/\d{4}-\d{2}-\d{2}-\d{6}\.md$/);
    });
  });
});
```

#### 3.3 注意事項

**パフォーマンス**:
- 1投稿毎の場合、ファイル数が急増する可能性
- ファイルシステムのパフォーマンス影響を考慮

**移行**:
- 既存ユーザーが保存単位を変更した場合のマイグレーション
- path-migratorの拡張が必要

**推奨事項**:
- 設定画面に「ファイル数が多くなる可能性があります」という警告を表示
- デフォルトは "daily" のまま維持

### 4. 設定画面のその他の改善

#### 4.1 ビジュアル改善

**セクションの明確化**:
```typescript
// 各セクションに見出しを追加
containerEl.createEl("h3", { text: "ファイル管理" });
// ファイルパス書式、保存単位などの設定

containerEl.createEl("h3", { text: "メモ表示" });
// ソート順、保存位置などの設定

containerEl.createEl("h3", { text: "カテゴリ管理" });
// カテゴリ設定
```

**説明文の充実**:
- 各設定項目に具体例を追加
- 初心者にも分かりやすい表現

**プレビュー機能**:
```typescript
// ファイルパス書式のプレビュー表示
new Setting(containerEl)
  .setName("プレビュー")
  .setDesc(
    "現在の設定での保存先: " +
    PathGenerator.generateCustomPath(
      this.plugin.settings.rootDirectory,
      "work",
      this.plugin.settings.pathFormat,
      this.plugin.settings.useDirectoryCategory,
      new Date()
    )
  );
```

#### 4.2 バリデーション追加

**カスタム書式のバリデーション**:
```typescript
// 無効な書式の検出
function validatePathFormat(format: string): boolean {
  // 必須の拡張子チェック
  if (!format.endsWith(".md")) {
    return false;
  }

  // 無効な文字のチェック
  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(format)) {
    return false;
  }

  return true;
}
```

**リアルタイムフィードバック**:
```typescript
.onChange(async (value) => {
  if (this.plugin.settings.pathFormat === "custom") {
    if (!validatePathFormat(value)) {
      // エラー表示
      this.setDesc("⚠️ 無効な書式です。.mdで終わる必要があります。");
      return;
    }
  }
  // 保存処理
});
```

## 実装計画

### フェーズ1: ファイルパス書式の追加 (優先度: 高)

**作業内容**:
1. `PathFormat` 型に `%Y%m%d-%C.md` を追加
2. 設定画面のドロップダウンに選択肢追加
3. `path-generator.ts` の拡張
4. テストケース追加 (10個)

**期間**: 1-2日

### フェーズ2: 設定画面のUI改善 (優先度: 中)

**作業内容**:
1. 選択肢の並び順最適化
2. セクション見出しの追加
3. 説明文の充実
4. プレビュー機能の追加

**期間**: 2-3日

### フェーズ3: 保存単位「1投稿毎」の追加 (優先度: 高)

**作業内容**:
1. `SaveUnit` 型の拡張
2. `path-generator.ts` の `generateMemoPath()` 実装
3. `memo-manager.ts` の対応
4. テストケース追加 (15個)
5. ドキュメント更新

**期間**: 3-4日

### フェーズ4: バリデーションとエラーハンドリング (優先度: 中)

**作業内容**:
1. カスタム書式のバリデーション
2. エラーメッセージの改善
3. エッジケースのテスト

**期間**: 1-2日

### フェーズ5: ドキュメントとリリース準備 (優先度: 低)

**作業内容**:
1. README.md の更新
2. CHANGELOG.md の作成
3. マイグレーションガイドの作成
4. リリースノートの作成

**期間**: 1-2日

## テスト計画

### 新規テストケース

**ファイルパス書式**:
- `%Y%m%d-%C.md` 形式の生成 (5ケース)
- カテゴリ名のエッジケース (5ケース)

**保存単位**:
- `per-memo` の基本動作 (10ケース)
- タイムスタンプ生成 (5ケース)

**設定画面**:
- バリデーション (10ケース)
- プレビュー表示 (5ケース)

**合計**: 約40個のテストケース追加

### 既存テストの拡張

- `path-generator.test.ts`: 20ケース追加
- `memo-manager.test.ts`: 15ケース追加 (リファクタリング後)
- `settings.test.ts`: 5ケース追加

## 完了条件

1. ✅ `%Y%m%d-%C.md` 書式が正常に動作
2. ✅ 設定画面の選択肢が最適化された順序
3. ✅ 「1投稿毎」保存単位が正常に動作
4. ✅ すべてのテストがパス (548個 → 590個+)
5. ✅ テストカバレッジが90%以上を維持
6. ✅ ドキュメントが更新済み
7. ✅ ビルドとCI/CDが正常動作

## リスクと対策

### リスク1: ファイル数の急増

**対策**:
- 設定画面に警告文を表示
- デフォルト設定は変更しない
- ドキュメントで推奨設定を明記

### リスク2: 既存ユーザーの混乱

**対策**:
- マイグレーションガイドの作成
- デフォルト設定の維持
- リリースノートで変更点を明確化

### リスク3: パフォーマンス低下

**対策**:
- ファイル数の上限チェック
- パフォーマンステストの追加
- 必要に応じて最適化

## v0.0.13への引継ぎ

v0.0.12で未達成の場合:
- マイグレーション機能の強化
- バックアップ機能の改善
- 検索機能の強化

---

**作成日**: 2025-10-30
**対象バージョン**: v0.0.12
**前バージョン**: v0.0.11 (予定: カバレッジ90%+, 650テスト)
