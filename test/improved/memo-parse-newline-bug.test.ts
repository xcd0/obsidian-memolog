import { memoToText, parseMetadata, parseTextToMemo } from "../../src/core/memo-helpers"
import { MemoEntry } from "../../src/types"
import { createTestMemo } from "../helpers/memo-test-helpers"
import { TEST_DATE_2025_10_31 } from "../helpers/test-constants"

/**
 * メモパース問題 - テンプレートに改行が含まれる場合のバグ修正(TDD)
 *
 * 問題:
 * テンプレートに改行(\n)が含まれる場合、parseMetadata() と parseTextToMemo() が
 * 正しくパースできない。
 *
 * 原因:
 * 正規表現 /template: ([^,]+?)(?:,|$)/ がカンマまでしかマッチせず、
 * JSONエンコードされた文字列全体を取得できない。
 *
 * 期待される動作:
 * template: "# %Y-%m-%d %H:%M:%S\n{{content}}" のように改行を含むテンプレートも
 * 正しくパースできること。
 *
 * TDD手順:
 * 1. Red: 失敗するテストを書く(このファイル)
 * 2. Green: 最小限の修正でテストを通す
 * 3. Refactor: コードを改善する
 */

describe("メモパース - 改行を含むテンプレート(TDD)", () => {
	describe("ステップ1: Red - 再現テストを作成", () => {
		it("改行を含むテンプレートをparseMetadataで正しくパースできる", () => {
			// Arrange: 改行を含むテンプレートを持つメモテキスト。
			const memoText =
				`<!-- memo-id: test-id-001, timestamp: 2025-10-31T12:00:00.000Z, category: "work", template: "# %Y-%m-%d %H:%M:%S\\n{{content}}" -->
# 2025-10-31 12:00:00
テストメモ
`

			// Act: メタデータをパース。
			const metadata = parseMetadata(memoText)

			// Assert: テンプレートが正しくパースされることを検証。
			expect(metadata.template).toBe("# %Y-%m-%d %H:%M:%S\n{{content}}")
			expect(metadata.id).toBe("test-id-001")
			expect(metadata.category).toBe("work")
		})

		it("改行を含むテンプレートをparseTextToMemoで正しくパースできる", () => {
			// Arrange: 改行を含むテンプレートを持つメモ。
			// ! 実際のmemoToTextで生成されたテキストを使用。
			const testMemo: MemoEntry = createTestMemo(
				"test-id-002",
				TEST_DATE_2025_10_31,
				"テストメモ内容",
				"work",
				"# %Y-%m-%d %H:%M:%S\n{{content}}",
			)
			const memoText = memoToText(testMemo)

			// Act: メモをパース。
			const memo = parseTextToMemo(memoText, "work")

			// Assert: テンプレートとコンテンツが正しくパースされることを検証。
			expect(memo).not.toBeNull()
			expect(memo?.template).toBe("# %Y-%m-%d %H:%M:%S\n{{content}}")
			expect(memo?.id).toBe("test-id-002")
			expect(memo?.content).toBe("テストメモ内容")
		})

		it("複数の改行を含むテンプレートもパースできる", () => {
			// Arrange: 複数の改行を含むテンプレート。
			const memoText =
				`<!-- memo-id: test-id-003, timestamp: 2025-10-31T12:00:00.000Z, category: "work", template: "# %Y-%m-%d\\n## %H:%M:%S\\n{{content}}" -->
# 2025-10-31
## 12:00:00
複数改行テスト
`

			// Act: メタデータをパース。
			const metadata = parseMetadata(memoText)

			// Assert: 複数の改行が保持されることを検証。
			expect(metadata.template).toBe("# %Y-%m-%d\n## %H:%M:%S\n{{content}}")
		})

		it("カンマを含むテンプレートもパースできる", () => {
			// Arrange: カンマと改行を含むテンプレート。
			const memoText =
				`<!-- memo-id: test-id-004, timestamp: 2025-10-31T12:00:00.000Z, category: "work", template: "Date: %Y-%m-%d, Time: %H:%M\\n{{content}}" -->
Date: 2025-10-31, Time: 12:00
カンマテスト
`

			// Act: メタデータをパース。
			const metadata = parseMetadata(memoText)

			// Assert: カンマが保持されることを検証。
			expect(metadata.template).toBe("Date: %Y-%m-%d, Time: %H:%M\n{{content}}")
		})
	})

	describe("ステップ2: パースと生成の往復テスト", () => {
		it("memoToText -> parseTextToMemo の往復でデータが保持される", () => {
			// Arrange: 改行を含むテンプレートを持つメモ。
			const originalMemo: MemoEntry = createTestMemo(
				"round-trip-001",
				TEST_DATE_2025_10_31,
				"往復テスト内容",
				"work",
				"# %Y-%m-%d %H:%M:%S\n{{content}}",
			)

			// Act: メモをテキストに変換し、再度パース。
			const memoText = memoToText(originalMemo)
			const parsedMemo = parseTextToMemo(memoText, "work")

			// Assert: 往復後もデータが保持されることを検証。
			expect(parsedMemo).not.toBeNull()
			expect(parsedMemo?.id).toBe(originalMemo.id)
			expect(parsedMemo?.timestamp).toBe(originalMemo.timestamp)
			expect(parsedMemo?.category).toBe(originalMemo.category)
			expect(parsedMemo?.template).toBe(originalMemo.template)
			expect(parsedMemo?.content).toBe(originalMemo.content)
		})

		it("複雑なテンプレートの往復でもデータが保持される", () => {
			// Arrange: 複雑なテンプレート。
			const complexTemplate = `# [%Y-%m-%d] Log
Time: %H:%M:%S
---
{{content}}
---
End of memo`

			const originalMemo: MemoEntry = createTestMemo(
				"complex-001",
				TEST_DATE_2025_10_31,
				"複雑なテンプレートテスト",
				"work",
				complexTemplate,
			)

			// Act: 往復。
			const memoText = memoToText(originalMemo)
			const parsedMemo = parseTextToMemo(memoText, "work")

			// Assert: テンプレートが完全に保持されることを検証。
			expect(parsedMemo?.template).toBe(complexTemplate)
			expect(parsedMemo?.content).toBe(originalMemo.content)
		})
	})

	describe("ステップ3: エッジケースのテスト", () => {
		it("エスケープ文字を含むテンプレートをパースできる", () => {
			// Arrange: JSONエスケープ文字を含むテンプレート。
			const memoText =
				`<!-- memo-id: test-id-005, timestamp: 2025-10-31T12:00:00.000Z, category: "work", template: "Quote: \\"Hello\\", Tab:\\t, Newline:\\n{{content}}" -->
Quote: "Hello", Tab:	, Newline:
エスケープテスト
`

			// Act: メタデータをパース。
			const metadata = parseMetadata(memoText)

			// Assert: エスケープ文字が正しく解釈されることを検証。
			expect(metadata.template).toBe("Quote: \"Hello\", Tab:\t, Newline:\n{{content}}")
		})

		it("空のテンプレートもパースできる", () => {
			// Arrange: 空のテンプレート。
			const memoText = `<!-- memo-id: test-id-006, timestamp: 2025-10-31T12:00:00.000Z, category: "work", template: "" -->
空テンプレートテスト
`

			// Act: メタデータをパース。
			const metadata = parseMetadata(memoText)

			// Assert: 空文字列として取得されることを検証。
			expect(metadata.template).toBe("")
		})

		it("テンプレートがない場合はundefinedを返す", () => {
			// Arrange: テンプレートなしのメモ。
			const memoText = `<!-- memo-id: test-id-007, timestamp: 2025-10-31T12:00:00.000Z, category: "work" -->
テンプレートなし
`

			// Act: メタデータをパース。
			const metadata = parseMetadata(memoText)

			// Assert: undefinedが返されることを検証。
			expect(metadata.template).toBeUndefined()
		})
	})

	describe("ステップ4: 実際のユーザーデータでのテスト", () => {
		it("実際のバグケース: template with newline が正しくパースされる", () => {
			// Arrange: 実際にバグが発生したメモテキスト。
			const actualBugCase =
				`<!-- memo-id: 019a2db1-4161-7538-b87e-f0f69c7ee4a4, timestamp: 2025-10-29T01:59:42.689Z, category: "work", template: "# %Y-%m-%d %H:%M:%S\\n{{content}}" -->
# 2025-10-29 10:59:42
qwert
`

			// Act: メモをパース。
			const parsedMemo = parseTextToMemo(actualBugCase, "work")

			// Assert: 正しくパースされることを検証。
			expect(parsedMemo).not.toBeNull()
			expect(parsedMemo?.id).toBe("019a2db1-4161-7538-b87e-f0f69c7ee4a4")
			expect(parsedMemo?.timestamp).toBe("2025-10-29T01:59:42.689Z")
			expect(parsedMemo?.template).toBe("# %Y-%m-%d %H:%M:%S\n{{content}}")
			expect(parsedMemo?.content).toBe("qwert")
		})
	})
})
