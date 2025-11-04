# memolog 仕様書 v0.0.10 - コード品質向上とドキュメント整備

最終更新: 2025-10-30
バージョン: v0.0.10（開発中）

---

## 1. 概要

v0.0.10では、新機能の追加は行わず、v0.1.0に向けた既存機能のブラッシュアップに専念する。

### 1.1 背景

v0.0.9までの開発で、主要機能の実装が完了した。しかし、以下の問題が残っている：

- ESLintエラーが61件存在
- ドキュメントが最新の実装に追いついていない
- 開発方針が明確でない

v0.0.10では、これらの問題を解決し、v0.1.0（最初の安定版）に向けた基盤を整える。

### 1.2 主な変更点

1. **コード品質の向上**
   - ESLintエラーの大幅削減（61件→41件）
   - TypeScriptの型安全性向上
   - 不要なコードの削除

2. **ドキュメント整備**
   - TODO.mdの更新（v0.0.10の方針明記）
   - README.mdの更新
   - 本仕様書（SPEC_v0.0.10.md）の作成

3. **開発方針の明確化**
   - v0.1.0に向けたロードマップ策定
   - 新機能追加は行わない方針の明確化

---

## 2. ESLintエラー修正の詳細

### 2.1 修正済みのエラー (20件)

#### 2.1.1 ESLint auto-fixで修正 (18件)

- const宣言の適正化 (2件)
- エスケープ文字の削除 (4件)
- 不要な型アサーションの削除 (約10件)
- その他の自動修正可能なエラー

**修正箇所**:

- `src/ui/sidebar.ts`: `let endDate` → `const endDate`
- `src/utils/path-generator.ts`: `let fileName` → `const fileName`
- `src/ui/settings-tab.ts`: 不要なエスケープ文字の削除
- `test/memo-manager.test.ts`: 不要な型アサーションの削除

#### 2.1.2 手動修正 (2件)

**不要なasyncの削除**:

- `src/core/settings.ts:44`: `findSettingsFile()`のasync削除
  ```typescript
  // Before
  private async findSettingsFile(...): Promise<string | null>

  // After
  private findSettingsFile(...): string | null
  ```

- `src/utils/backup-manager.ts:179`: `listBackups()`のasync削除
  ```typescript
  // Before
  async listBackups(...): Promise<TFile[]>

  // After
  listBackups(...): TFile[]
  ```

**Floating Promiseの修正**:

- `src/ui/settings-tab.ts:1177`: voidキーワードでラップ
  ```typescript
  // Before
  this.plugin.settingsManager.updateGlobalSettings({...}).then(...)

  // After
  void this.plugin.settingsManager.updateGlobalSettings({...}).then(...)
  ```

### 2.2 残存エラー (41件)

#### 2.2.1 Promise処理エラー (~40件)

**問題**: イベントハンドラー内でasync関数を使用しているため、Promiseが返されている

**場所**:

- `src/ui/settings-tab.ts`: 約30件
- `src/ui/sidebar.ts`: 2件
- `src/ui/components/memo-card.ts`: 数件

**例**:

```typescript
// エラーが出るコード
.onChange(async (value) => {
    await this.plugin.settingsManager.updateGlobalSettings({...});
});

// 修正案
.onChange((value) => {
    void this.plugin.settingsManager.updateGlobalSettings({...});
});
```

**対応方針**:

- 機能的には問題がないため、v0.0.10では対応を保留
- v0.0.11以降で段階的に修正

#### 2.2.2 Unsafeな操作 (8件)

**問題**: `any`型の値に対する操作で型安全性が保証されない

**場所**:

- `test/error-handler.test.ts`: 6件（テストコード）
- `src/ui/sidebar.ts`: 2件（Obsidian API使用箇所）

**例**:

```typescript
// sidebar.ts:1615-1622
;(this.app as any).commands.executeCommandById(commandId)
;(this.app as any).workspace.openTabById(tabId)
```

**対応方針**:

- テストコードのエラーは実害がないため無視
- Obsidian APIの型定義不足によるものは、API側の改善を待つ

---

## 3. ドキュメント整備の詳細

### 3.1 TODO.md

**更新内容**:

- v0.0.10セクションを追加
- 開発方針を明記: 「v0.1.0に向けた既存機能のブラッシュアップ。新機能の追加は行わず、v0.0.9の機能の未熟な部分を改善」
- ESLint修正の進捗を記録
- ドキュメント整備タスクを追加

### 3.2 README.md

**更新内容**:

- バージョンを v0.0.9 → v0.0.10 に更新
- v0.0.10の主な変更点を追加:
  - コード品質向上
  - ドキュメント整備
  - テスト結果

### 3.3 SPEC_v0.0.10.md（本ドキュメント）

**作成目的**:

- v0.0.10の開発方針を明確に記録
- ESLintエラー修正の詳細を文書化
- 残存する問題と対応方針を明記
- 将来の開発者への引き継ぎ資料

---

## 4. テスト結果

### 4.1 テストスイート

```
Test Suites: 18 passed, 18 total
Tests:       392 passed, 392 total
Snapshots:   0 total
Time:        ~3-6s
```

### 4.2 カバレッジ

```
Statements   : 66.98%
Branches     : 59.24%
Functions    : 75.08%
Lines        : 67.21%
```

**主要コンポーネントのカバレッジ**:

- core: 85.45% statements, 74.6% branches
- fs: 90% statements, 74.28% branches
- utils: 29.48% statements（backup-manager、path-migratorが未テスト）

### 4.3 ビルド

- TypeScriptコンパイル: 成功
- esbuild: 成功
- main.js生成: 正常

---

## 5. v0.1.0に向けたロードマップ

### 5.1 v0.0.10（現在）

**目標**: コード品質向上とドキュメント整備

- [x] ESLintエラーの大幅削減
- [x] ドキュメントの更新
- [ ] 残存エラーの対応方針策定

### 5.2 v0.0.11（予定）

**目標**: 残存ESLintエラーの解消

- [ ] Promise処理エラーの修正（段階的）
- [ ] Unsafeな操作の削減
- [ ] テストカバレッジの向上（目標: 70%以上）

### 5.3 v0.0.12～v0.0.14（予定）

**目標**: UX改善と安定性向上

- [ ] UI/UXの細かい改善
- [ ] パフォーマンスの最適化
- [ ] エッジケースのバグ修正
- [ ] ユーザーフィードバックへの対応

### 5.4 v0.1.0（目標）

**目標**: 最初の安定版リリース

- [ ] ESLintエラー0件
- [ ] テストカバレッジ70%以上
- [ ] ドキュメント完全版
- [ ] 既知のバグ0件
- [ ] パフォーマンスの最適化完了

---

## 6. 開発方針

### 6.1 基本原則

1. **品質優先**: 新機能よりも既存機能の品質向上を優先
2. **段階的改善**: 一度に全てを修正せず、段階的にリファクタリング
3. **後方互換性**: 既存ユーザーの設定やデータを壊さない
4. **ドキュメント重視**: コードの変更は必ずドキュメントに反映

### 6.2 コーディング規約

- TypeScript strictモード準拠
- ESLint推奨設定に準拠（一部例外を除く）
- 日本語コメントの使用
- 型安全性の確保

### 6.3 テスト戦略

- 新機能追加時は必ずテストを追加
- カバレッジ70%を目標
- 重要な機能は統合テストも実施

---

## 7. 既知の問題と制約

### 7.1 技術的負債

1. **Promise処理エラー**: イベントハンドラー内の非同期処理が適切に処理されていない
   - 影響: ESLintエラーが出るが、機能的には問題なし
   - 対応: v0.0.11以降で修正予定

2. **Obsidian API型定義の不足**: 一部のAPIで`any`型を使用
   - 影響: 型安全性が低下
   - 対応: Obsidian公式の型定義改善を待つ

3. **テストカバレッジ不足**: backup-manager、path-migratorが未テスト
   - 影響: これらの機能のバグ発見が遅れる可能性
   - 対応: v0.0.11以降でテスト追加予定

### 7.2 設計上の制約

1. **Obsidian APIへの依存**: Obsidian APIの変更に脆弱
2. **マークダウンファイル形式への依存**: HTMLコメントタグを使用した独自形式
3. **パフォーマンス**: 大量メモ（1000件以上）での動作検証が不十分

---

## 8. 変更履歴

### 2025-10-30

- v0.0.10の開発開始
- ESLintエラー修正 (61件→41件)
- ドキュメント整備
  - TODO.mdの更新
  - README.mdの更新
  - SPEC_v0.0.10.mdの作成

---

## 9. まとめ

v0.0.10では、新機能の追加を控え、既存機能の品質向上に専念した。ESLintエラーを大幅に削減し、ドキュメントを整備することで、v0.1.0（最初の安定版）に向けた基盤を整えることができた。

次バージョン（v0.0.11）では、残存するPromise処理エラーの解消とテストカバレッジの向上に取り組む予定である。

---

以上、memolog v0.0.10仕様書
