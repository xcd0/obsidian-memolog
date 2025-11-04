import { SearchEngine, SearchQuery } from "../src/core/search-engine"
import { MemoEntry } from "../src/types"

describe("SearchEngine", () => {
	const sampleMemos: MemoEntry[] = [
		{
			id: "1",
			category: "work",
			timestamp: "2025-01-20T10:00:00Z",
			content: "プロジェクト会議の議事録",
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
			content: "読書記録: TypeScript入門",
		},
		{
			id: "4",
			category: "hobby",
			timestamp: "2025-01-23T09:00:00Z",
			content: "映画鑑賞メモ",
		},
	]

	describe("テキスト検索", () => {
		test("全文検索ができる", () => {
			const query: SearchQuery = {
				text: "メモ",
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(2)
			expect(result.matches[0].id).toBe("2")
			expect(result.matches[1].id).toBe("4")
		})

		test("大文字小文字を区別しない検索（デフォルト）", () => {
			const query: SearchQuery = {
				text: "TYPESCRIPT",
				caseSensitive: false,
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(1)
			expect(result.matches[0].id).toBe("3")
		})

		test("大文字小文字を区別する検索", () => {
			const query: SearchQuery = {
				text: "TYPESCRIPT",
				caseSensitive: true,
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(0)
		})

		test("検索テキストが空の場合は全件返す", () => {
			const query: SearchQuery = {
				text: "",
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(4)
		})
	})

	describe("日付範囲検索", () => {
		test("開始日を指定して検索できる", () => {
			const query: SearchQuery = {
				startDate: "2025-01-22",
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(2)
			expect(result.matches[0].id).toBe("3")
			expect(result.matches[1].id).toBe("4")
		})

		test("終了日を指定して検索できる", () => {
			const query: SearchQuery = {
				endDate: "2025-01-21",
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(2)
			expect(result.matches[0].id).toBe("1")
			expect(result.matches[1].id).toBe("2")
		})

		test("開始日と終了日を指定して検索できる", () => {
			const query: SearchQuery = {
				startDate: "2025-01-21",
				endDate: "2025-01-22",
			}

			const result = SearchEngine.search(sampleMemos, query)

			// ! 2025-01-21T14:30と2025-01-22T18:00の2件。
			expect(result.matches).toHaveLength(2)
			expect(result.matches[0].id).toBe("2")
			expect(result.matches[1].id).toBe("3")
		})
	})

	describe("カテゴリフィルタ", () => {
		test("カテゴリで絞り込みができる", () => {
			const query: SearchQuery = {
				categories: ["work"],
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(2)
			expect(result.matches.every(m => m.category === "work")).toBe(true)
		})

		test("複数カテゴリで絞り込みができる", () => {
			const query: SearchQuery = {
				categories: ["work", "hobby"],
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(4)
		})
	})

	describe("複合検索", () => {
		test("テキスト + カテゴリで検索できる", () => {
			const query: SearchQuery = {
				text: "メモ",
				categories: ["hobby"],
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(1)
			expect(result.matches[0].id).toBe("4")
		})

		test("テキスト + 日付範囲で検索できる", () => {
			const query: SearchQuery = {
				text: "メモ",
				startDate: "2025-01-23",
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.matches).toHaveLength(1)
			expect(result.matches[0].id).toBe("4")
		})
	})

	describe("ハイライト", () => {
		test("マッチ位置を取得できる", () => {
			const content = "これはテストメモです。メモは重要です。"
			const positions = SearchEngine.getMatchPositions(content, "メモ")

			expect(positions).toHaveLength(2)
			expect(positions[0]).toEqual({ start: 6, end: 8 })
			expect(positions[1]).toEqual({ start: 11, end: 13 })
		})

		test("マッチ部分をハイライトできる", () => {
			const content = "TypeScript is great"
			const highlighted = SearchEngine.highlightMatches(content, "Type")

			expect(highlighted).toContain("<mark>Type</mark>")
		})

		test("複数マッチをすべてハイライトできる", () => {
			const content = "メモメモメモ"
			const highlighted = SearchEngine.highlightMatches(content, "メモ")

			const markCount = (highlighted.match(/<mark>/g) || []).length
			expect(markCount).toBe(3)
		})
	})

	describe("日付範囲プリセット", () => {
		test("今日のプリセットを取得できる", () => {
			const range = SearchEngine.getDateRangePreset("today")

			expect(range.startDate).toBeDefined()
			expect(range.endDate).toBeDefined()
		})

		test("過去7日のプリセットを取得できる", () => {
			const range = SearchEngine.getDateRangePreset("week")

			const start = new Date(range.startDate)
			const end = new Date(range.endDate)
			const diffMs = end.getTime() - start.getTime()
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

			// ! 今日を含めて7日間（today, today-1, ..., today-6）。
			// ! startDate = today - 6日、endDate = today なので、差は6日。
			expect(diffDays).toBe(6)
		})

		test("過去30日のプリセットを取得できる", () => {
			const range = SearchEngine.getDateRangePreset("month")

			expect(range.startDate).toBeDefined()
			expect(range.endDate).toBeDefined()
		})

		test("過去1年のプリセットを取得できる", () => {
			const range = SearchEngine.getDateRangePreset("year")

			expect(range.startDate).toBeDefined()
			expect(range.endDate).toBeDefined()
		})
	})

	describe("検索結果メタデータ", () => {
		test("検索結果に所要時間が含まれる", () => {
			const query: SearchQuery = {
				text: "test",
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.duration).toBeGreaterThanOrEqual(0)
			expect(typeof result.duration).toBe("number")
		})

		test("検索結果に総検索対象数が含まれる", () => {
			const query: SearchQuery = {
				text: "test",
			}

			const result = SearchEngine.search(sampleMemos, query)

			expect(result.totalSearched).toBe(4)
		})
	})

	describe("複数ファイル検索", () => {
		test("複数ファイルのメモを統合して検索できる", () => {
			const memosByFile = new Map<string, MemoEntry[]>()
			memosByFile.set("file1.md", [sampleMemos[0], sampleMemos[1]])
			memosByFile.set("file2.md", [sampleMemos[2], sampleMemos[3]])

			const query: SearchQuery = {
				text: "メモ",
			}

			const result = SearchEngine.searchMultiple(memosByFile, query)

			expect(result.matches).toHaveLength(2)
			expect(result.totalSearched).toBe(4)
		})
	})
})
