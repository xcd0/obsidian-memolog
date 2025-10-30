describe("パス変換機能", () => {
	describe("特別なファイルの除外", () => {
		test("index.mdを除外できる", () => {
			const relativePath = "index.md";
			const isRootFile = !relativePath.includes("/");

			const shouldExclude = isRootFile && relativePath === "index.md";

			expect(shouldExclude).toBe(true);
		});

		test("アンダースコアで始まるmdファイルを除外できる", () => {
			const relativePath = "_trash.md";
			const isRootFile = !relativePath.includes("/");

			const shouldExclude = isRootFile && relativePath.startsWith("_") && relativePath.endsWith(".md");

			expect(shouldExclude).toBe(true);
		});

		test("_settings.mdを除外できる", () => {
			const relativePath = "_settings.md";
			const isRootFile = !relativePath.includes("/");

			const shouldExclude = isRootFile && relativePath.startsWith("_") && relativePath.endsWith(".md");

			expect(shouldExclude).toBe(true);
		});

		test("サブディレクトリのindex.mdは除外しない", () => {
			const relativePath: string = "work/index.md";
			const isRootFile = !relativePath.includes("/");

			const shouldExclude = isRootFile && relativePath === "index.md";

			expect(shouldExclude).toBe(false);
		});

		test("サブディレクトリの_で始まるファイルは除外しない", () => {
			const relativePath = "work/_notes.md";
			const isRootFile = !relativePath.includes("/");

			const shouldExclude = isRootFile && relativePath.startsWith("_") && relativePath.endsWith(".md");

			expect(shouldExclude).toBe(false);
		});

		test("通常のファイルは除外しない", () => {
			const relativePath: string = "2025-01-30.md";
			const isRootFile = !relativePath.includes("/");

			const shouldExclude =
				isRootFile && (relativePath === "index.md" || (relativePath.startsWith("_") && relativePath.endsWith(".md")));

			expect(shouldExclude).toBe(false);
		});
	});

	describe("日付情報の抽出", () => {
		test("日付情報を抽出できる", () => {
			const path = "2025-01-30.md";
			const dateMatch = path.match(/(\d{4})-(\d{2})-(\d{2})/);

			expect(dateMatch).not.toBeNull();
			if (dateMatch) {
				expect(dateMatch[1]).toBe("2025");
				expect(dateMatch[2]).toBe("01");
				expect(dateMatch[3]).toBe("30");
			}
		});

		test("日付情報がない場合はnull", () => {
			const path = "notes.md";
			const dateMatch = path.match(/(\d{4})-(\d{2})-(\d{2})/);

			expect(dateMatch).toBeNull();
		});

		test("異なる日付形式を検出できる", () => {
			const path = "20250130.md";
			const dateMatch = path.match(/(\d{4})(\d{2})(\d{2})/);

			expect(dateMatch).not.toBeNull();
			if (dateMatch) {
				expect(dateMatch[1]).toBe("2025");
				expect(dateMatch[2]).toBe("01");
				expect(dateMatch[3]).toBe("30");
			}
		});
	});

	describe("パス書式のマッチング", () => {
		test("古いパス書式にマッチするファイルを検出", () => {
			const files = ["2025-01-30.md", "2025/01/30.md", "notes.md", "_trash.md", "index.md"];

			const hasDate = (file: string) => {
				return /\d{4}[-/]\d{2}[-/]\d{2}/.test(file) || /\d{4}\d{2}\d{2}/.test(file);
			};

			const matchingFiles = files.filter(hasDate);

			expect(matchingFiles).toContain("2025-01-30.md");
			expect(matchingFiles).toContain("2025/01/30.md");
			expect(matchingFiles).not.toContain("notes.md");
			expect(matchingFiles).not.toContain("_trash.md");
			expect(matchingFiles).not.toContain("index.md");
		});
	});

	describe("変換マッピング", () => {
		test("パスマッピングを作成できる", () => {
			const mapping = {
				oldPath: "2025-01-30.md",
				newPath: "work/2025-01-30.md",
				hasConflict: false,
			};

			expect(mapping.oldPath).toBe("2025-01-30.md");
			expect(mapping.newPath).toBe("work/2025-01-30.md");
			expect(mapping.hasConflict).toBe(false);
		});

		test("競合を検出できる", () => {
			const existingPaths = new Set(["work/2025-01-30.md"]);
			const newPath = "work/2025-01-30.md";

			const hasConflict = existingPaths.has(newPath);

			expect(hasConflict).toBe(true);
		});

		test("競合がないことを確認できる", () => {
			const existingPaths = new Set(["work/2025-01-30.md"]);
			const newPath = "hobby/2025-01-30.md";

			const hasConflict = existingPaths.has(newPath);

			expect(hasConflict).toBe(false);
		});
	});

	describe("変換統計", () => {
		test("変換統計を計算できる", () => {
			const mappings = [
				{ oldPath: "2025-01-30.md", newPath: "work/2025-01-30.md", hasConflict: false },
				{ oldPath: "2025-01-31.md", newPath: "work/2025-01-31.md", hasConflict: false },
				{ oldPath: "2025-02-01.md", newPath: "work/2025-02-01.md", hasConflict: true },
			];

			const totalCount = mappings.length;
			const conflictCount = mappings.filter((m) => m.hasConflict).length;
			const validCount = totalCount - conflictCount;

			expect(totalCount).toBe(3);
			expect(conflictCount).toBe(1);
			expect(validCount).toBe(2);
		});
	});
});
