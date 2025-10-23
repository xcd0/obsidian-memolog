import { TagManager } from "../src/core/tag-manager";

describe("TagManager", () => {
	describe("createStartTag", () => {
		test("should create a valid start tag", () => {
			const tag = TagManager.createStartTag("work");
			expect(tag).toBe('<!-- memolog: start category="work" -->');
		});
	});

	describe("createEndTag", () => {
		test("should create a valid end tag", () => {
			const tag = TagManager.createEndTag();
			expect(tag).toBe("<!-- memolog: end -->");
		});
	});

	describe("createMetadataTag", () => {
		test("should create a valid metadata tag", () => {
			const metadata = { format: "template", order: "asc" as const };
			const tag = TagManager.createMetadataTag(metadata);
			expect(tag).toContain("memolog:");
			expect(tag).toContain("format");
			expect(tag).toContain("order");
		});
	});

	describe("parseTagPairs", () => {
		test("should parse single tag pair", () => {
			const content = `
Some text
<!-- memolog: start category="work" -->
Memo content
<!-- memolog: end -->
Other text
`;
			const pairs = TagManager.parseTagPairs(content);
			expect(pairs).toHaveLength(1);
			expect(pairs[0].category).toBe("work");
			expect(pairs[0].content).toBe("Memo content");
		});

		test("should parse multiple tag pairs", () => {
			const content = `
<!-- memolog: start category="work" -->
Work content
<!-- memolog: end -->

<!-- memolog: start category="hobby" -->
Hobby content
<!-- memolog: end -->
`;
			const pairs = TagManager.parseTagPairs(content);
			expect(pairs).toHaveLength(2);
			expect(pairs[0].category).toBe("work");
			expect(pairs[1].category).toBe("hobby");
		});

		test("should handle empty content between tags", () => {
			const content = `
<!-- memolog: start category="empty" -->
<!-- memolog: end -->
`;
			const pairs = TagManager.parseTagPairs(content);
			expect(pairs).toHaveLength(1);
			expect(pairs[0].content).toBe("");
		});
	});

	describe("validateTagPairs", () => {
		test("should validate correct tag pairs", () => {
			const content = `
<!-- memolog: start category="work" -->
Content
<!-- memolog: end -->
`;
			const result = TagManager.validateTagPairs(content);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		test("should detect unclosed start tag", () => {
			const content = `
<!-- memolog: start category="work" -->
Content without end tag
`;
			const result = TagManager.validateTagPairs(content);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		test("should detect end tag without start tag", () => {
			const content = `
Content
<!-- memolog: end -->
`;
			const result = TagManager.validateTagPairs(content);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe("findTagPairByCategory", () => {
		test("should find tag pair by category", () => {
			const content = `
<!-- memolog: start category="work" -->
Work content
<!-- memolog: end -->

<!-- memolog: start category="hobby" -->
Hobby content
<!-- memolog: end -->
`;
			const pair = TagManager.findTagPairByCategory(content, "hobby");
			expect(pair).not.toBeNull();
			expect(pair?.category).toBe("hobby");
			expect(pair?.content).toBe("Hobby content");
		});

		test("should return null for non-existent category", () => {
			const content = `
<!-- memolog: start category="work" -->
Work content
<!-- memolog: end -->
`;
			const pair = TagManager.findTagPairByCategory(content, "nonexistent");
			expect(pair).toBeNull();
		});
	});

	describe("hasTagPairs", () => {
		test("should detect presence of tag pairs", () => {
			const content = `
<!-- memolog: start category="work" -->
Content
<!-- memolog: end -->
`;
			expect(TagManager.hasTagPairs(content)).toBe(true);
		});

		test("should return false when no tag pairs", () => {
			const content = "Just plain text";
			expect(TagManager.hasTagPairs(content)).toBe(false);
		});
	});

	describe("initializeTagPair", () => {
		test("should initialize tag pair in empty content", () => {
			const content = "";
			const result = TagManager.initializeTagPair(content, "work");
			expect(result).toContain('<!-- memolog: start category="work" -->');
			expect(result).toContain("<!-- memolog: end -->");
		});

		test("should not duplicate existing tag pair", () => {
			const content = `
<!-- memolog: start category="work" -->
Existing content
<!-- memolog: end -->
`;
			const result = TagManager.initializeTagPair(content, "work");
			expect(result).toBe(content);
		});

		test("should add new category tag pair", () => {
			const content = `
<!-- memolog: start category="work" -->
Work content
<!-- memolog: end -->
`;
			const result = TagManager.initializeTagPair(content, "hobby");
			expect(result).toContain('category="work"');
			expect(result).toContain('category="hobby"');
		});
	});

	describe("repairTagPairs", () => {
		test("should repair orphaned end tag", () => {
			const content = `
Content
<!-- memolog: end -->
`;
			const result = TagManager.repairTagPairs(content);
			expect(result.repaired).toBe(true);
			expect(result.fixes.length).toBeGreaterThan(0);
			expect(result.content).not.toContain("<!-- memolog: end -->");
		});

		test("should add missing end tag", () => {
			const content = `
<!-- memolog: start category="work" -->
Content without end tag
`;
			const result = TagManager.repairTagPairs(content);
			expect(result.repaired).toBe(true);
			expect(result.content).toContain("<!-- memolog: end -->");
			expect(result.fixes).toContain('Added missing end tag for category "work"');
		});

		test("should not modify valid content", () => {
			const content = `
<!-- memolog: start category="work" -->
Valid content
<!-- memolog: end -->
`;
			const result = TagManager.repairTagPairs(content);
			expect(result.repaired).toBe(false);
			expect(result.fixes).toHaveLength(0);
		});
	});

	describe("getAllTagPairs", () => {
		test("should get all tag pairs as map", () => {
			const content = `
<!-- memolog: start category="work" -->
Work content
<!-- memolog: end -->

<!-- memolog: start category="hobby" -->
Hobby content
<!-- memolog: end -->
`;
			const pairMap = TagManager.getAllTagPairs(content);
			expect(pairMap.size).toBe(2);
			expect(pairMap.has("work")).toBe(true);
			expect(pairMap.has("hobby")).toBe(true);
			expect(pairMap.get("work")?.content).toBe("Work content");
			expect(pairMap.get("hobby")?.content).toBe("Hobby content");
		});

		test("should handle empty content", () => {
			const content = "";
			const pairMap = TagManager.getAllTagPairs(content);
			expect(pairMap.size).toBe(0);
		});
	});

	describe("validateTagPairs - enhanced", () => {
		test("should detect duplicate categories", () => {
			const content = `
<!-- memolog: start category="work" -->
First work
<!-- memolog: end -->

<!-- memolog: start category="work" -->
Second work
<!-- memolog: end -->
`;
			const result = TagManager.validateTagPairs(content);
			expect(result.valid).toBe(true); //! ペア自体は正しい。
			expect(result.warnings.length).toBeGreaterThan(0); //! 重複警告。
		});

		test("should return both errors and warnings", () => {
			const content = `
<!-- memolog: start category="work" -->
First work
<!-- memolog: end -->

<!-- memolog: start category="work" -->
Unclosed duplicate
`;
			const result = TagManager.validateTagPairs(content);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.warnings.length).toBeGreaterThan(0);
		});
	});
});
