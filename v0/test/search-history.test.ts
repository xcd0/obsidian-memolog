import { SearchHistory, SearchHistoryEntry } from "../src/core/search-history";
import { SearchQuery } from "../src/core/search-engine";

describe("SearchHistory", () => {
	let searchHistory: SearchHistory;

	beforeEach(() => {
		searchHistory = new SearchHistory(10);
	});

	describe("履歴追加", () => {
		test("検索履歴を追加できる", () => {
			const query: SearchQuery = { text: "test" };
			searchHistory.addEntry(query, 5);

			expect(searchHistory.size).toBe(1);
			const history = searchHistory.getHistory();
			expect(history[0].query.text).toBe("test");
			expect(history[0].resultCount).toBe(5);
		});

		test("複数の検索履歴を追加できる", () => {
			searchHistory.addEntry({ text: "test1" }, 3);
			searchHistory.addEntry({ text: "test2" }, 7);
			searchHistory.addEntry({ text: "test3" }, 2);

			expect(searchHistory.size).toBe(3);
		});

		test("同じクエリを追加すると既存のものが削除される", () => {
			searchHistory.addEntry({ text: "test" }, 5);
			searchHistory.addEntry({ text: "test" }, 10);

			expect(searchHistory.size).toBe(1);
			const history = searchHistory.getHistory();
			expect(history[0].resultCount).toBe(10);
		});

		test("最大サイズを超えると古いものが削除される", () => {
			const smallHistory = new SearchHistory(3);

			smallHistory.addEntry({ text: "test1" }, 1);
			smallHistory.addEntry({ text: "test2" }, 2);
			smallHistory.addEntry({ text: "test3" }, 3);
			smallHistory.addEntry({ text: "test4" }, 4);

			expect(smallHistory.size).toBe(3);
			const history = smallHistory.getHistory();
			expect(history[0].query.text).toBe("test4");
		});
	});

	describe("履歴取得", () => {
		beforeEach(() => {
			searchHistory.addEntry({ text: "test1" }, 5);
			searchHistory.addEntry({ text: "test2" }, 3);
			searchHistory.addEntry({ text: "test3" }, 8);
		});

		test("全ての履歴を取得できる", () => {
			const history = searchHistory.getHistory();
			expect(history).toHaveLength(3);
		});

		test("制限付きで履歴を取得できる", () => {
			const history = searchHistory.getHistory(2);
			expect(history).toHaveLength(2);
			expect(history[0].query.text).toBe("test3");
		});

		test("IDで特定のエントリを取得できる", () => {
			const history = searchHistory.getHistory();
			const entry = searchHistory.getEntry(history[0].id);

			expect(entry).not.toBeNull();
			expect(entry?.query.text).toBe("test3");
		});

		test("存在しないIDはnullを返す", () => {
			const entry = searchHistory.getEntry("nonexistent");
			expect(entry).toBeNull();
		});
	});

	describe("履歴削除", () => {
		beforeEach(() => {
			searchHistory.addEntry({ text: "test1" }, 5);
			searchHistory.addEntry({ text: "test2" }, 3);
			searchHistory.addEntry({ text: "test3" }, 8);
		});

		test("履歴をクリアできる", () => {
			searchHistory.clear();
			expect(searchHistory.size).toBe(0);
		});

		test("特定のエントリを削除できる", () => {
			const history = searchHistory.getHistory();
			const removed = searchHistory.removeEntry(history[0].id);

			expect(removed).toBe(true);
			expect(searchHistory.size).toBe(2);
		});

		test("存在しないエントリの削除はfalseを返す", () => {
			const removed = searchHistory.removeEntry("nonexistent");
			expect(removed).toBe(false);
		});
	});

	describe("頻繁な検索", () => {
		test("頻繁に使用される検索を取得できる", () => {
			searchHistory.addEntry({ text: "test1" }, 5);
			searchHistory.addEntry({ text: "test2" }, 3);
			searchHistory.addEntry({ text: "test1" }, 7);
			searchHistory.addEntry({ text: "test1" }, 2);

			const frequent = searchHistory.getFrequentQueries(2);
			expect(frequent).toHaveLength(2);
			expect(frequent[0].query.text).toBe("test1");
		});
	});

	describe("最近の検索", () => {
		test("最近の検索を取得できる", () => {
			searchHistory.addEntry({ text: "test1" }, 5);
			searchHistory.addEntry({ text: "test2" }, 3);
			searchHistory.addEntry({ text: "test3" }, 8);

			const recent = searchHistory.getRecentQueries(2);
			expect(recent).toHaveLength(2);
			expect(recent[0].query.text).toBe("test3");
		});
	});

	describe("インポート/エクスポート", () => {
		test("履歴をエクスポートできる", () => {
			searchHistory.addEntry({ text: "test1" }, 5);
			searchHistory.addEntry({ text: "test2" }, 3);

			const exported = searchHistory.export();
			expect(exported).toBeTruthy();

			const parsed = JSON.parse(exported) as SearchHistoryEntry[];
			expect(parsed).toHaveLength(2);
		});

		test("履歴をインポートできる", () => {
			const data: SearchHistoryEntry[] = [
				{
					id: "test-1",
					query: { text: "imported" },
					timestamp: new Date().toISOString(),
					resultCount: 10,
				},
			];

			const success = searchHistory.import(JSON.stringify(data));
			expect(success).toBe(true);
			expect(searchHistory.size).toBe(1);
		});

		test("無効なJSONのインポートは失敗する", () => {
			const success = searchHistory.import("invalid json");
			expect(success).toBe(false);
		});

		test("無効な形式のインポートは失敗する", () => {
			const success = searchHistory.import(JSON.stringify({ invalid: true }));
			expect(success).toBe(false);
		});
	});

	describe("統計情報", () => {
		test("統計情報を取得できる", () => {
			searchHistory.addEntry({ text: "test1" }, 5);
			searchHistory.addEntry({ text: "test2" }, 3);
			searchHistory.addEntry({ text: "test1" }, 7);

			const stats = searchHistory.getStatistics();

			//! 同じクエリは重複排除されるので2件。
			expect(stats.totalSearches).toBe(2);
			expect(stats.uniqueQueries).toBe(2);
			expect(stats.averageResults).toBeGreaterThan(0);
			expect(stats.mostFrequentQuery).not.toBeNull();
		});

		test("空の履歴の統計情報", () => {
			const stats = searchHistory.getStatistics();

			expect(stats.totalSearches).toBe(0);
			expect(stats.uniqueQueries).toBe(0);
			expect(stats.averageResults).toBe(0);
			expect(stats.mostFrequentQuery).toBeNull();
		});
	});

	describe("最大サイズ設定", () => {
		test("最大サイズを変更できる", () => {
			searchHistory.setMaxSize(5);
			expect(searchHistory.maxSize).toBe(5);
		});

		test("最大サイズを小さくすると履歴が切り詰められる", () => {
			for (let i = 0; i < 10; i++) {
				searchHistory.addEntry({ text: `test${i}` }, i);
			}

			searchHistory.setMaxSize(5);
			expect(searchHistory.size).toBe(5);
		});

		test("最大サイズは1未満にできない", () => {
			expect(() => {
				searchHistory.setMaxSize(0);
			}).toThrow();
		});
	});

	describe("複合検索クエリ", () => {
		test("複雑な検索クエリを扱える", () => {
			const query: SearchQuery = {
				text: "test",
				startDate: "2025-01-01",
				endDate: "2025-01-31",
				categories: ["work", "hobby"],
				caseSensitive: true,
			};

			searchHistory.addEntry(query, 10);

			const history = searchHistory.getHistory();
			expect(history[0].query).toEqual(query);
		});

		test("同じ複合クエリは重複排除される", () => {
			const query: SearchQuery = {
				text: "test",
				categories: ["work"],
			};

			searchHistory.addEntry(query, 5);
			searchHistory.addEntry(query, 10);

			expect(searchHistory.size).toBe(1);
		});
	});
});
