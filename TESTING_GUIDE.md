# memolog テストガイド

memologプロジェクトのテスト戦略とガイドラインを説明します。

## 📊 テスト統計 (v0.0.11)

### 全体統計
- **テスト数**: 703件
- **全体カバレッジ**: 91.89%
- **テストスイート**: 27個
- **テストフレームワーク**: Jest + ts-jest

### モジュール別カバレッジ

#### Core (90.78%)
| ファイル | カバレッジ | 関数カバレッジ |
|----------|-----------|---------------|
| tag-manager.ts | 100% | 100% |
| memo-crud-operations.ts | 100% | 100% |
| memo-trash-operations.ts | 100% | 100% |
| memo-query-operations.ts | 100% | 100% |
| template-manager.ts | 98.18% | 100% |
| settings.ts | 97.77% | 100% |
| memo-helpers.ts | 97.93% | 100% |
| exporter.ts | 96.96% | 100% |
| link-manager.ts | 96.66% | 100% |
| search-history.ts | 96.61% | 100% |
| search-engine.ts | 94.44% | 100% |
| cache-manager.ts | 92.5% | 100% |
| error-handler.ts | 99.01% | 100% |
| tag-manager.ts | 88.46% | 84.61% |

#### Core/Cache (100%)
| ファイル | カバレッジ | 関数カバレッジ |
|----------|-----------|---------------|
| lru-cache.ts | 100% | 100% |

#### Utils (95.73%)
| ファイル | カバレッジ | 関数カバレッジ |
|----------|-----------|---------------|
| backup-helpers.ts | 100% | 100% |
| memo-split-operations.ts | 100% | 100% |
| notification-manager.ts | 100% | 100% |
| path-migration-helpers.ts | 100% | 95.45% |
| path-generator.ts | 98.46% | 100% |
| sanitizer.ts | 90.32% | 100% |
| performance.ts | 82.6% | 75% |

#### FS (90%)
| ファイル | カバレッジ | 関数カバレッジ |
|----------|-----------|---------------|
| vault-handler.ts | 90% | 92.3% |

## 🏗️ テスト戦略

### 純粋関数のテスト
I/O操作を含まない純粋関数は、完全なテストカバレッジを目指します。

**例**: `memo-crud-operations.ts`, `memo-query-operations.ts`

```typescript
// 純粋関数のテスト例
describe("createMemoEntry", () => {
  test("基本的なメモエントリを作成", () => {
    const memo = createMemoEntry("work", "Test content");

    expect(memo.category).toBe("work");
    expect(memo.content).toBe("Test content");
    expect(memo.id).toBeDefined();
    expect(memo.timestamp).toBeDefined();
  });

  test("既存IDとタイムスタンプを使用", () => {
    const existingId = "test-id";
    const existingTimestamp = "2025-10-31T10:00:00Z";

    const memo = createMemoEntry(
      "work",
      "Test content",
      existingId,
      existingTimestamp
    );

    expect(memo.id).toBe(existingId);
    expect(memo.timestamp).toBe(existingTimestamp);
  });
});
```

### I/O依存クラスのテスト
ObsidianのApp、Vault APIに依存するクラスは、モック/スタブを使用してテストします。

**例**: `vault-handler.ts`, `cache-manager.ts`

```typescript
// I/O依存クラスのテスト例
describe("CacheManager", () => {
  let app: any;
  let cacheManager: CacheManager;

  beforeEach(() => {
    app = {
      vault: {
        adapter: {
          stat: jest.fn().mockResolvedValue({ mtime: 1000 }),
        },
      },
    };
    cacheManager = new CacheManager(app);
  });

  test("キャッシュにメモを設定", async () => {
    const memos = [{ id: "1", content: "Test" }];
    await cacheManager.setMemos("test.md", memos);

    const cached = await cacheManager.getMemos("test.md");
    expect(cached).toEqual(memos);
  });
});
```

### エッジケースのテスト
各関数のエッジケースを必ずテストします。

- 空の入力（空配列、空文字列）
- null/undefined
- 不正な形式のデータ
- 境界値

```typescript
describe("splitFileIntoMemos", () => {
  test("空のコンテンツを分割", () => {
    const result = splitFileIntoMemos("");
    expect(result).toEqual([]);
  });

  test("メモIDなしのコンテンツを分割", () => {
    const result = splitFileIntoMemos("Just plain text");
    expect(result).toEqual([]);
  });
});
```

## 🧪 テストの実行

### 基本的なテスト実行
```bash
# 全テストを実行
npm test

# 特定のファイルをテスト
npm test -- memo-crud-operations.test.ts

# ウォッチモード
npm test -- --watch
```

### カバレッジ計測
```bash
# 全体のカバレッジを計測
npm run test:coverage

# 特定ファイルのカバレッジを計測
npm run test:coverage -- --collectCoverageFrom='src/core/memo-manager.ts'
```

### CI環境でのテスト
GitHub Actionsで自動的に以下を実行：
- 全テストの実行
- カバレッジ計測
- ビルドチェック
- ESLintチェック

## 📝 テスト作成ガイドライン

### 1. テストファイル名
テスト対象ファイル名に `.test.ts` を付けます。

```
src/core/memo-manager.ts  → test/memo-manager.test.ts
src/utils/path-generator.ts → test/path-generator.test.ts
```

### 2. テスト構造
```typescript
describe("モジュール名/クラス名", () => {
  describe("メソッド名/関数名", () => {
    test("具体的な動作の説明", () => {
      // Arrange: テストデータの準備
      const input = "test data";

      // Act: テスト対象の実行
      const result = functionUnderTest(input);

      // Assert: 結果の検証
      expect(result).toBe("expected output");
    });
  });
});
```

### 3. テストケース名
日本語で具体的に記述します。

❌ 悪い例:
```typescript
test("test 1", () => { ... });
test("should work", () => { ... });
```

✅ 良い例:
```typescript
test("メモをカテゴリごとにグループ化", () => { ... });
test("存在しないキーの場合はundefinedを返す", () => { ... });
```

### 4. アサーション
可能な限り具体的なマッチャーを使用します。

```typescript
// 基本的なマッチャー
expect(value).toBe(expected);           // プリミティブ値の比較
expect(object).toEqual(expected);       // オブジェクトの深い比較
expect(array).toHaveLength(3);          // 配列の長さ
expect(value).toBeNull();               // null チェック
expect(value).toBeUndefined();          // undefined チェック
expect(value).toBeDefined();            // 定義済みチェック
expect(value).toBeTruthy();             // truthy チェック
expect(value).toBeFalsy();              // falsy チェック

// 配列・オブジェクト
expect(array).toContain(item);          // 配列に要素が含まれる
expect(obj).toHaveProperty('key');      // プロパティの存在
expect(array).toContainEqual(obj);      // オブジェクトの一致

// 数値
expect(num).toBeGreaterThan(0);         // より大きい
expect(num).toBeLessThan(10);           // より小さい
expect(num).toBeCloseTo(0.3);           // 近似値

// 文字列
expect(str).toMatch(/pattern/);         // 正規表現マッチ
expect(str).toContain("substring");     // 部分文字列

// 関数・例外
expect(fn).toThrow();                   // 例外を投げる
expect(fn).not.toThrow();               // 例外を投げない
```

## 🎯 カバレッジ目標

### 全体目標
- **全体カバレッジ**: 90%以上 ✅ (現在 91.89%)
- **Statement Coverage**: 90%以上
- **Branch Coverage**: 80%以上
- **Function Coverage**: 95%以上

### モジュール別目標
- **純粋関数モジュール**: 100%
- **I/O依存クラス**: 85%以上
- **UI コンポーネント**: カバレッジ計測対象外（手動テスト）

## 🚀 継続的改善

### v0.0.12での改善計画
- path-migrator.ts のカバレッジ向上 (0% → 30-40%)
- memo-manager.ts の直接テスト追加
- パフォーマンステストの追加
- E2Eテストの検討

### テスト駆動開発 (TDD)
新機能追加時は以下の順序で実施：
1. テストケースの作成（Red）
2. 実装（Green）
3. リファクタリング（Refactor）

## 📚 参考資料

- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [Obsidian Plugin Development](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

## 🤝 貢献

テストの追加・改善は大歓迎です！

1. テストを追加したい機能を見つける
2. テストファイルを作成/編集
3. `npm test` で動作確認
4. `npm run test:coverage` でカバレッジ確認
5. Pull Request作成

---

**最終更新**: 2025-10-31
**バージョン**: v0.0.11
