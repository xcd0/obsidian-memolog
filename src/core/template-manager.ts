// ! テンプレート管理機能。

import { ValidationError } from "./error-handler"

// ! テンプレート定義。
export interface Template {
	// ! テンプレート名。
	name: string

	// ! テンプレート内容。
	content: string

	// ! テンプレート説明。
	description?: string

	// ! カテゴリ固有テンプレートかどうか。
	category?: string
}

// ! テンプレート変数。
export interface TemplateVariables {
	// ! 日付関連。
	year?: string
	month?: string
	day?: string
	hour?: string
	minute?: string
	second?: string
	date?: string // ! フルフォーマット日付。
	time?: string // ! 時刻。

	// ! メモ関連。
	category?: string
	content?: string
	id?: string

	// ! カスタム変数。
	[key: string]: string | undefined
}

// ! テンプレート検証結果。
export interface TemplateValidationResult {
	// ! 有効かどうか。
	valid: boolean

	// ! エラーメッセージ。
	errors: string[]

	// ! 警告メッセージ。
	warnings: string[]

	// ! 使用されている変数リスト。
	usedVariables: string[]
}

// ! テンプレートマネージャー。
export class TemplateManager {
	private templates: Map<string, Template> = new Map()
	private defaultTemplate: string = "## %Y-%m-%d %H:%M\n{{content}}"

	// ! デフォルトテンプレートを設定する。
	setDefaultTemplate(template: string): void {
		const validation = TemplateManager.validate(template)
		if (!validation.valid) {
			throw new ValidationError("Invalid template", {
				errors: validation.errors,
			})
		}
		this.defaultTemplate = template
	}

	// ! デフォルトテンプレートを取得する。
	getDefaultTemplate(): string {
		return this.defaultTemplate
	}

	// ! テンプレートを追加する。
	addTemplate(template: Template): void {
		const validation = TemplateManager.validate(template.content)
		if (!validation.valid) {
			throw new ValidationError(`Invalid template: ${template.name}`, {
				errors: validation.errors,
			})
		}
		this.templates.set(template.name, template)
	}

	// ! テンプレートを取得する。
	getTemplate(name: string): Template | undefined {
		return this.templates.get(name)
	}

	// ! 全テンプレートを取得する。
	getAllTemplates(): Template[] {
		return Array.from(this.templates.values())
	}

	// ! カテゴリ固有のテンプレートを取得する。
	getTemplateForCategory(category: string): Template | undefined {
		return Array.from(this.templates.values()).find(t => t.category === category)
	}

	// ! テンプレートを削除する。
	removeTemplate(name: string): boolean {
		return this.templates.delete(name)
	}

	// ! テンプレートを展開する。
	static expand(template: string, variables: TemplateVariables): string {
		let result = template

		// ! 日付変数を自動生成。
		const now = new Date()

		// ! 月名と曜日の配列。
		const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
		const dayNames = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"]
		const dayNamesShort = ["日", "月", "火", "水", "木", "金", "土"]

		const autoVariables: TemplateVariables = {
			year: now.getFullYear().toString(),
			month: (now.getMonth() + 1).toString().padStart(2, "0"),
			day: now.getDate().toString().padStart(2, "0"),
			hour: now.getHours().toString().padStart(2, "0"),
			minute: now.getMinutes().toString().padStart(2, "0"),
			second: now.getSeconds().toString().padStart(2, "0"),
			date: now.toISOString().split("T")[0],
			time: now.toTimeString().split(" ")[0],
			...variables,
		}

		// ! % 形式の変数を置換 (%Y, %m, %d, 等)。
		result = result
			.replace(/%Y/g, autoVariables.year || "")
			.replace(/%y/g, autoVariables.year?.slice(-2) || "")
			.replace(/%m/g, autoVariables.month || "")
			.replace(/%B/g, monthNames[now.getMonth()])
			.replace(/%b/g, monthNames[now.getMonth()])
			.replace(/%d/g, autoVariables.day || "")
			.replace(/%A/g, dayNames[now.getDay()])
			.replace(/%a/g, dayNamesShort[now.getDay()])
			.replace(/%u/g, (now.getDay() === 0 ? 7 : now.getDay()).toString())
			.replace(/%H/g, autoVariables.hour || "")
			.replace(/%I/g, (now.getHours() % 12 || 12).toString().padStart(2, "0"))
			.replace(/%M/g, autoVariables.minute || "")
			.replace(/%S/g, autoVariables.second || "")
			.replace(/%s/g, Math.floor(now.getTime() / 1000).toString())

		// ! {{ }} 形式の変数を置換。
		result = result.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
			return autoVariables[varName as keyof TemplateVariables] || ""
		})

		return result
	}

	// ! テンプレートを検証する。
	static validate(template: string): TemplateValidationResult {
		const errors: string[] = []
		const warnings: string[] = []
		const usedVariables: string[] = []

		// ! 閉じ括弧のチェック。
		const openCount = (template.match(/\{\{/g) || []).length
		const closeCount = (template.match(/\}\}/g) || []).length
		if (openCount !== closeCount) {
			errors.push("Unmatched braces: {{ and }} count mismatch")
		}

		// ! {{}} 変数を抽出。
		const bracketVars = template.match(/\{\{(\w+)\}\}/g)
		if (bracketVars) {
			for (const match of bracketVars) {
				const varName = match.slice(2, -2)
				if (!usedVariables.includes(varName)) {
					usedVariables.push(varName)
				}
			}
		}

		// ! % 変数を抽出。
		const percentVars = template.match(/%[YymdHMSBbAaus]/g)
		if (percentVars) {
			for (const match of percentVars) {
				if (!usedVariables.includes(match)) {
					usedVariables.push(match)
				}
			}
		}

		// ! 不明な % 変数をチェック。
		const unknownPercent = template.match(/%[^YymdHMSBbAausI\s]/g)
		if (unknownPercent) {
			warnings.push(
				`Unknown percent variables: ${unknownPercent.join(", ")}`,
			)
		}

		// ! ネストした{{ }}をチェック。
		if (/\{\{[^}]*\{\{/.test(template)) {
			errors.push("Nested braces are not allowed")
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
			usedVariables,
		}
	}

	// ! テンプレートプレビューを生成する。
	static preview(template: string, variables?: TemplateVariables): string {
		const sampleVariables: TemplateVariables = {
			category: "work",
			content: "サンプルメモの内容",
			id: "sample-id-12345",
			...variables,
		}

		return TemplateManager.expand(template, sampleVariables)
	}

	// ! 利用可能な変数リストを取得する。
	static getAvailableVariables(): { name: string; description: string }[] {
		return [
			{ name: "%Y", description: "年 (4桁)" },
			{ name: "%m", description: "月 (2桁)" },
			{ name: "%d", description: "日 (2桁)" },
			{ name: "%H", description: "時 (2桁)" },
			{ name: "%M", description: "分 (2桁)" },
			{ name: "%S", description: "秒 (2桁)" },
			{ name: "{{year}}", description: "年 (4桁)" },
			{ name: "{{month}}", description: "月 (2桁)" },
			{ name: "{{day}}", description: "日 (2桁)" },
			{ name: "{{hour}}", description: "時 (2桁)" },
			{ name: "{{minute}}", description: "分 (2桁)" },
			{ name: "{{second}}", description: "秒 (2桁)" },
			{ name: "{{date}}", description: "日付 (YYYY-MM-DD)" },
			{ name: "{{time}}", description: "時刻 (HH:MM:SS)" },
			{ name: "{{category}}", description: "カテゴリ名" },
			{ name: "{{content}}", description: "メモ内容" },
			{ name: "{{id}}", description: "メモID" },
		]
	}
}
