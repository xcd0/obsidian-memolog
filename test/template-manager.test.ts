import { Template, TemplateManager, TemplateVariables } from "../src/core/template-manager"

describe("TemplateManager", () => {
	let templateManager: TemplateManager

	beforeEach(() => {
		templateManager = new TemplateManager()
	})

	describe("デフォルトテンプレート", () => {
		test("デフォルトテンプレートを取得できる", () => {
			const defaultTemplate = templateManager.getDefaultTemplate()
			expect(defaultTemplate).toBeDefined()
			expect(typeof defaultTemplate).toBe("string")
		})

		test("デフォルトテンプレートを設定できる", () => {
			const newTemplate = "# {{category}}\n{{content}}"
			templateManager.setDefaultTemplate(newTemplate)
			expect(templateManager.getDefaultTemplate()).toBe(newTemplate)
		})

		test("無効なテンプレートを設定しようとするとエラー", () => {
			const invalidTemplate = "{{unclosed"
			expect(() => {
				templateManager.setDefaultTemplate(invalidTemplate)
			}).toThrow()
		})
	})

	describe("テンプレート管理", () => {
		test("テンプレートを追加できる", () => {
			const template: Template = {
				name: "test-template",
				content: "## {{date}}\n{{content}}",
				description: "テストテンプレート",
			}

			templateManager.addTemplate(template)
			const retrieved = templateManager.getTemplate("test-template")

			expect(retrieved).toEqual(template)
		})

		test("全テンプレートを取得できる", () => {
			const template1: Template = {
				name: "template1",
				content: "{{content}}",
			}

			const template2: Template = {
				name: "template2",
				content: "# {{category}}\n{{content}}",
			}

			templateManager.addTemplate(template1)
			templateManager.addTemplate(template2)

			const all = templateManager.getAllTemplates()
			expect(all).toHaveLength(2)
		})

		test("カテゴリ固有のテンプレートを取得できる", () => {
			const workTemplate: Template = {
				name: "work-template",
				content: "{{content}}",
				category: "work",
			}

			templateManager.addTemplate(workTemplate)

			const retrieved = templateManager.getTemplateForCategory("work")
			expect(retrieved).toEqual(workTemplate)
		})

		test("テンプレートを削除できる", () => {
			const template: Template = {
				name: "test-template",
				content: "{{content}}",
			}

			templateManager.addTemplate(template)
			expect(templateManager.getTemplate("test-template")).toBeDefined()

			templateManager.removeTemplate("test-template")
			expect(templateManager.getTemplate("test-template")).toBeUndefined()
		})

		test("無効なテンプレートを追加しようとするとエラー", () => {
			const invalidTemplate: Template = {
				name: "invalid-template",
				content: "{{unclosed",
				description: "無効なテンプレート",
			}

			expect(() => {
				templateManager.addTemplate(invalidTemplate)
			}).toThrow("Invalid template")
		})

		test("閉じ括弧のないテンプレートでエラー", () => {
			const invalidTemplate: Template = {
				name: "invalid-template2",
				content: "{{content",
			}

			expect(() => {
				templateManager.addTemplate(invalidTemplate)
			}).toThrow()
		})
	})

	describe("テンプレート展開", () => {
		test("% 形式の変数を展開できる", () => {
			const template = "%Y-%m-%d"
			const result = TemplateManager.expand(template, {})

			// ! 年-月-日の形式になっている。
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
		})

		test("{{ }} 形式の変数を展開できる", () => {
			const template = "Category: {{category}}\nContent: {{content}}"
			const variables: TemplateVariables = {
				category: "work",
				content: "test content",
			}

			const result = TemplateManager.expand(template, variables)

			expect(result).toContain("Category: work")
			expect(result).toContain("Content: test content")
		})

		test("混在した変数を展開できる", () => {
			const template = "# %Y-%m-%d {{category}}\n{{content}}"
			const variables: TemplateVariables = {
				category: "hobby",
				content: "test memo",
			}

			const result = TemplateManager.expand(template, variables)

			expect(result).toContain("hobby")
			expect(result).toContain("test memo")
			expect(result).toMatch(/\d{4}-\d{2}-\d{2}/)
		})

		test("未定義の変数は空文字列になる", () => {
			const template = "{{undefined_var}}"
			const result = TemplateManager.expand(template, {})

			expect(result).toBe("")
		})
	})

	describe("テンプレート検証", () => {
		test("有効なテンプレートを検証できる", () => {
			const template = "## %Y-%m-%d\n{{content}}"
			const result = TemplateManager.validate(template)

			expect(result.valid).toBe(true)
			expect(result.errors).toHaveLength(0)
		})

		test("閉じ括弧が不足している場合はエラー", () => {
			const template = "{{unclosed"
			const result = TemplateManager.validate(template)

			expect(result.valid).toBe(false)
			expect(result.errors.length).toBeGreaterThan(0)
		})

		test("ネストした括弧はエラー", () => {
			const template = "{{outer {{inner}}}}"
			const result = TemplateManager.validate(template)

			expect(result.valid).toBe(false)
			expect(result.errors).toContain("Nested braces are not allowed")
		})

		test("不明な % 変数は警告", () => {
			const template = "%Y-%m-%d %X"
			const result = TemplateManager.validate(template)

			expect(result.valid).toBe(true) // ! エラーではなく警告。
			expect(result.warnings.length).toBeGreaterThan(0)
		})

		test("使用されている変数リストを取得できる", () => {
			const template = "%Y {{category}} {{content}}"
			const result = TemplateManager.validate(template)

			expect(result.usedVariables).toContain("%Y")
			expect(result.usedVariables).toContain("category")
			expect(result.usedVariables).toContain("content")
		})
	})

	describe("プレビュー", () => {
		test("テンプレートのプレビューを生成できる", () => {
			const template = "## {{date}}\nCategory: {{category}}\n{{content}}"
			const preview = TemplateManager.preview(template)

			expect(preview).toContain("Category: work")
			expect(preview).toContain("サンプルメモの内容")
			expect(preview).toMatch(/\d{4}-\d{2}-\d{2}/)
		})

		test("カスタム変数を使用してプレビューできる", () => {
			const template = "{{custom}}"
			const preview = TemplateManager.preview(template, {
				custom: "custom value",
			})

			expect(preview).toBe("custom value")
		})
	})

	describe("利用可能な変数リスト", () => {
		test("利用可能な変数リストを取得できる", () => {
			const variables = TemplateManager.getAvailableVariables()

			expect(variables.length).toBeGreaterThan(0)
			expect(variables[0]).toHaveProperty("name")
			expect(variables[0]).toHaveProperty("description")
		})
	})
})
