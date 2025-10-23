import { PathGenerator } from "../src/utils/path-generator";

describe("PathGenerator", () => {
	//! テスト用の固定日時（ローカルタイム: 2025-10-23 14:30:45）。
	const testDate = new Date(2025, 9, 23, 14, 30, 45);

	describe("generateFilePath", () => {
		//! ルートディレクトリとカテゴリの基本設定。
		const rootDir = "memolog";
		const category = "work";

		describe("保存単位: day", () => {
			it("ディレクトリカテゴリあり: memolog/work/2025-10-23.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"day",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025-10-23.md");
			});

			it("ディレクトリカテゴリなし: memolog/2025-10-23.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"day",
					false,
					testDate
				);
				expect(result).toBe("memolog/2025-10-23.md");
			});
		});

		describe("保存単位: week", () => {
			it("ディレクトリカテゴリあり: memolog/work/2025-W43.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"week",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025-W43.md");
			});

			it("ディレクトリカテゴリなし: memolog/2025-W43.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"week",
					false,
					testDate
				);
				expect(result).toBe("memolog/2025-W43.md");
			});
		});

		describe("保存単位: month", () => {
			it("ディレクトリカテゴリあり: memolog/work/2025-10.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"month",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025-10.md");
			});

			it("ディレクトリカテゴリなし: memolog/2025-10.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"month",
					false,
					testDate
				);
				expect(result).toBe("memolog/2025-10.md");
			});
		});

		describe("保存単位: year", () => {
			it("ディレクトリカテゴリあり: memolog/work/2025.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"year",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025.md");
			});

			it("ディレクトリカテゴリなし: memolog/2025.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"year",
					false,
					testDate
				);
				expect(result).toBe("memolog/2025.md");
			});
		});

		describe("保存単位: all", () => {
			it("ディレクトリカテゴリあり: memolog/work/work.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"all",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/work.md");
			});

			it("ディレクトリカテゴリなし: memolog/all.md", () => {
				const result = PathGenerator.generateFilePath(
					rootDir,
					category,
					"all",
					false,
					testDate
				);
				expect(result).toBe("memolog/all.md");
			});
		});

		describe("デフォルト動作", () => {
			it("dateパラメータ省略時は現在日時を使用", () => {
				const now = new Date();
				const year = now.getFullYear();
				const month = (now.getMonth() + 1).toString().padStart(2, "0");
				const day = now.getDate().toString().padStart(2, "0");

				const result = PathGenerator.generateFilePath(rootDir, category, "day", false);
				expect(result).toBe(`memolog/${year}-${month}-${day}.md`);
			});
		});
	});

	describe("generateCustomPath", () => {
		const rootDir = "memolog";
		const category = "work";

		describe("カスタムフォーマット", () => {
			it("%Y-%m-%d形式: memolog/work/2025-10-23.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025-10-23.md");
			});

			it("%Y/%m/%d形式: memolog/work/2025/10/23.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y/%m/%d",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025/10/23.md");
			});

			it("時刻を含む%Y-%m-%d-%H-%M形式", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d-%H-%M",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025-10-23-14-30.md");
			});

			it("秒まで含む%Y%m%d%H%M%S形式", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y%m%d%H%M%S",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/20251023143045.md");
			});
		});

		describe(".md拡張子の自動付与", () => {
			it(".mdなしのフォーマットに自動付与", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d",
					true,
					testDate
				);
				expect(result).toMatch(/\.md$/);
			});

			it(".mdありのフォーマットはそのまま", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d.md",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025-10-23.md");
			});
		});

		describe("ディレクトリカテゴリ切り替え", () => {
			it("ディレクトリカテゴリあり", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m",
					true,
					testDate
				);
				expect(result).toBe("memolog/work/2025-10.md");
			});

			it("ディレクトリカテゴリなし", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m",
					false,
					testDate
				);
				expect(result).toBe("memolog/2025-10.md");
			});
		});
	});

	describe("週番号計算", () => {
		//! ISO 8601週番号のテストケース。
		const testCases = [
			{ date: "2025-01-01", week: 1 }, // 水曜日
			{ date: "2025-01-06", week: 2 }, // 月曜日
			{ date: "2025-10-23", week: 43 }, // 木曜日
			{ date: "2025-12-29", week: 1 }, // 月曜日（翌年の週1）
			{ date: "2024-01-01", week: 1 }, // 月曜日
			{ date: "2024-12-30", week: 1 }, // 月曜日（翌年の週1）
		];

		testCases.forEach(({ date, week }) => {
			it(`${date}は週${week}`, () => {
				const testDate = new Date(date);
				const result = PathGenerator.generateFilePath(
					"memolog",
					"test",
					"week",
					false,
					testDate
				);
				const year = testDate.getFullYear();
				const expectedWeek = week.toString().padStart(2, "0");
				expect(result).toBe(`memolog/${year}-W${expectedWeek}.md`);
			});
		});
	});
});
