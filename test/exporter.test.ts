import { Exporter, ExportFormat, ExportOptions } from "../src/core/exporter"
import { MemoEntry } from "../src/types"

// ! JSON エクスポート結果の型定義。
interface ExportedJSON {
	exportDate: string
	totalMemos: number
	options: {
		startDate?: string
		endDate?: string
		categories?: string[]
	}
	memos: MemoEntry[]
}

describe("Exporter", () => {
	const sampleMemos: MemoEntry[] = [
		{
			id: "1",
			category: "work",
			timestamp: "2025-01-20T10:00:00Z",
			content: "会議の議事録",
			attachments: ["meeting-notes.pdf"],
		},
		{
			id: "2",
			category: "work",
			timestamp: "2025-01-21T14:30:00Z",
			content: "バグ修正のメモ",
		},
		{
			id: "3",
			category: "hobby",
			timestamp: "2025-01-22T18:00:00Z",
			content: "読書記録",
		},
	]

	describe("Markdown形式エクスポート", () => {
		test("Markdown形式でエクスポートできる", () => {
			const options: ExportOptions = {
				format: ExportFormat.MARKDOWN,
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.content).toContain("# Memolog Export")
			expect(result.content).toContain("## work")
			expect(result.content).toContain("## hobby")
			expect(result.content).toContain("会議の議事録")
			expect(result.count).toBe(3)
		})

		test("添付ファイルを含むMarkdownをエクスポートできる", () => {
			const options: ExportOptions = {
				format: ExportFormat.MARKDOWN,
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.content).toContain("Attachments:")
			expect(result.content).toContain("meeting-notes.pdf")
		})

		test("タイトルなしでエクスポートできる", () => {
			const options: ExportOptions = {
				format: ExportFormat.MARKDOWN,
				includeTitle: false,
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.content).not.toContain("# Memolog Export")
		})
	})

	describe("JSON形式エクスポート", () => {
		test("JSON形式でエクスポートできる", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
			}

			const result = Exporter.export(sampleMemos, options)

			const data = JSON.parse(result.content) as ExportedJSON

			expect(data.totalMemos).toBe(3)
			expect(data.memos).toHaveLength(3)
			expect(data.memos[0]).toHaveProperty("id")
			expect(data.memos[0]).toHaveProperty("category")
			expect(data.memos[0]).toHaveProperty("timestamp")
			expect(data.memos[0]).toHaveProperty("content")
		})

		test("JSONに添付ファイル情報が含まれる", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
			}

			const result = Exporter.export(sampleMemos, options)

			const data = JSON.parse(result.content) as ExportedJSON

			expect(data.memos[0].attachments).toContain("meeting-notes.pdf")
		})
	})

	describe("CSV形式エクスポート", () => {
		test("CSV形式でエクスポートできる", () => {
			const options: ExportOptions = {
				format: ExportFormat.CSV,
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.content).toContain("ID,Category,Timestamp,Content,Attachments")
			expect(result.content).toContain("1,work")
			expect(result.content).toContain("会議の議事録")
		})

		test("CSVのエスケープ処理が正しい", () => {
			const memosWithComma: MemoEntry[] = [
				{
					id: "test",
					category: "work",
					timestamp: "2025-01-20T10:00:00Z",
					content: "カンマ,を含む,内容",
				},
			]

			const options: ExportOptions = {
				format: ExportFormat.CSV,
			}

			const result = Exporter.export(memosWithComma, options)

			// ! カンマを含む内容はダブルクォートで囲まれる。
			expect(result.content).toContain("\"カンマ,を含む,内容\"")
		})
	})

	describe("フィルタリング", () => {
		test("日付範囲でフィルタリングできる", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
				startDate: "2025-01-21",
				endDate: "2025-01-22",
			}

			const result = Exporter.export(sampleMemos, options)

			const data = JSON.parse(result.content) as ExportedJSON

			expect(data.totalMemos).toBe(2)
		})

		test("カテゴリでフィルタリングできる", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
				categories: ["work"],
			}

			const result = Exporter.export(sampleMemos, options)

			const data = JSON.parse(result.content) as ExportedJSON

			expect(data.totalMemos).toBe(2)
			expect(data.memos.every((m: MemoEntry) => m.category === "work")).toBe(true)
		})

		test("複合フィルタリングができる", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
				startDate: "2025-01-20",
				endDate: "2025-01-21",
				categories: ["work"],
			}

			const result = Exporter.export(sampleMemos, options)

			const data = JSON.parse(result.content) as ExportedJSON

			expect(data.totalMemos).toBe(2)
		})
	})

	describe("ファイル名生成", () => {
		test("デフォルトのファイル名を生成できる", () => {
			const options: ExportOptions = {
				format: ExportFormat.MARKDOWN,
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.filename).toContain("memolog-export")
			expect(result.filename).toMatch(/\.md$/)
		})

		test("カテゴリ指定時のファイル名を生成できる", () => {
			const options: ExportOptions = {
				format: ExportFormat.MARKDOWN,
				categories: ["work"],
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.filename).toContain("work")
		})

		test("日付範囲指定時のファイル名を生成できる", () => {
			const options: ExportOptions = {
				format: ExportFormat.MARKDOWN,
				startDate: "2025-01-20",
				endDate: "2025-01-22",
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.filename).toContain("2025-01-20-to-2025-01-22")
		})

		test("JSON形式のファイル名に.json拡張子が付く", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.filename).toMatch(/\.json$/)
		})

		test("CSV形式のファイル名に.csv拡張子が付く", () => {
			const options: ExportOptions = {
				format: ExportFormat.CSV,
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.filename).toMatch(/\.csv$/)
		})
	})

	describe("ソート", () => {
		test("エクスポート結果がタイムスタンプ昇順でソートされる", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
			}

			const result = Exporter.export(sampleMemos, options)

			const data = JSON.parse(result.content) as ExportedJSON

			for (let i = 0; i < data.memos.length - 1; i++) {
				const current = new Date(data.memos[i].timestamp)
				const next = new Date(data.memos[i + 1].timestamp)
				expect(current.getTime()).toBeLessThanOrEqual(next.getTime())
			}
		})
	})

	describe("エクスポート結果", () => {
		test("エクスポート結果にcount情報が含まれる", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.count).toBe(3)
		})

		test("フィルタリング後のcount情報が正しい", () => {
			const options: ExportOptions = {
				format: ExportFormat.JSON,
				categories: ["work"],
			}

			const result = Exporter.export(sampleMemos, options)

			expect(result.count).toBe(2)
		})
	})
})
