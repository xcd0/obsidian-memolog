// ! memologタグを管理するクラス。

// ! タグペアの情報。
export interface TagPair {
	// ! カテゴリ名。
	category: string

	// ! startタグの位置（行番号）。
	startLine: number

	// ! endタグの位置（行番号）。
	endLine: number

	// ! startタグとendタグの間の内容。
	content: string
}

// ! メタデータ情報。
export interface MetadataInfo {
	// ! テンプレートフォーマット。
	format?: string

	// ! ソート順。
	order?: "asc" | "desc"

	// ! タイムスタンプ。
	timestamp?: string
}

// ! memologタグを管理するクラス。
export class TagManager {
	// ! startタグの正規表現パターン。
	private static readonly START_TAG_PATTERN = /<!--\s*memolog:\s*start\s+category="([^"]+)"\s*-->/

	// ! endタグの正規表現パターン。
	private static readonly END_TAG_PATTERN = /<!--\s*memolog:\s*end\s*-->/

	// ! メタデータタグの正規表現パターン。
	private static readonly METADATA_TAG_PATTERN = /<!--\s*memolog:\s*(\{[^}]+\})\s*-->/

	// ! startタグを生成する。
	static createStartTag(category: string): string {
		return `<!-- memolog: start category="${category}" -->`
	}

	// ! endタグを生成する。
	static createEndTag(): string {
		return `<!-- memolog: end -->`
	}

	// ! メタデータタグを生成する。
	static createMetadataTag(metadata: MetadataInfo): string {
		return `<!-- memolog: ${JSON.stringify(metadata)} -->`
	}

	// ! ファイル内容からすべてのタグペアを抽出する。
	static parseTagPairs(content: string): TagPair[] {
		const lines = content.split("\n")
		const pairs: TagPair[] = []
		const stack: Array<{ category: string; line: number }> = []

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			// ! startタグを検出。
			const startMatch = line.match(TagManager.START_TAG_PATTERN)
			if (startMatch) {
				stack.push({ category: startMatch[1], line: i })
				continue
			}

			// ! endタグを検出。
			const endMatch = line.match(TagManager.END_TAG_PATTERN)
			if (endMatch) {
				const start = stack.pop()
				if (start) {
					const pairContent = lines.slice(start.line + 1, i).join("\n")
					pairs.push({
						category: start.category,
						startLine: start.line,
						endLine: i,
						content: pairContent,
					})
				}
			}
		}

		return pairs
	}

	// ! タグペアの整合性をチェックする（強化版）。
	static validateTagPairs(content: string): { valid: boolean; errors: string[]; warnings: string[] } {
		const lines = content.split("\n")
		const errors: string[] = []
		const warnings: string[] = []
		const stack: Array<{ category: string; line: number }> = []
		const categories = new Set<string>()

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			// ! startタグを検出。
			const startMatch = line.match(TagManager.START_TAG_PATTERN)
			if (startMatch) {
				const category = startMatch[1]

				// ! 重複カテゴリチェック。
				if (categories.has(category)) {
					warnings.push(`Line ${i + 1}: duplicate category "${category}"`)
				}
				categories.add(category)

				stack.push({ category, line: i })
				continue
			}

			// ! endタグを検出。
			const endMatch = line.match(TagManager.END_TAG_PATTERN)
			if (endMatch) {
				if (stack.length === 0) {
					errors.push(`Line ${i + 1}: end tag without matching start tag`)
				} else {
					stack.pop()
				}
			}
		}

		// ! 未閉鎖のstartタグをチェック。
		for (const openTag of stack) {
			errors.push(
				`Line ${openTag.line + 1}: unclosed start tag for category "${openTag.category}"`,
			)
		}

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		}
	}

	// ! カテゴリ属性をパースする。
	static parseCategoryAttribute(line: string): string | null {
		const match = line.match(TagManager.START_TAG_PATTERN)
		return match ? match[1] : null
	}

	// ! メタデータをパースする。
	static parseMetadata(line: string): MetadataInfo | null {
		const match = line.match(TagManager.METADATA_TAG_PATTERN)
		if (match) {
			try {
				return JSON.parse(match[1]) as MetadataInfo
			} catch (error) {
				console.error("Failed to parse metadata:", error)
				return null
			}
		}
		return null
	}

	// ! 特定カテゴリのタグペアを取得する。
	static findTagPairByCategory(content: string, category: string): TagPair | null {
		const pairs = TagManager.parseTagPairs(content)
		return pairs.find(pair => pair.category === category) || null
	}

	// ! ファイルにタグペアが存在するかチェックする。
	static hasTagPairs(content: string): boolean {
		return (
			TagManager.START_TAG_PATTERN.test(content) &&
			TagManager.END_TAG_PATTERN.test(content)
		)
	}

	// ! タグペアを初期化する（存在しない場合に挿入）。
	static initializeTagPair(content: string, category: string, metadata?: MetadataInfo): string {
		// ! 既に該当カテゴリのタグペアが存在する場合は何もしない。
		if (TagManager.findTagPairByCategory(content, category)) {
			return content
		}

		const startTag = TagManager.createStartTag(category)
		const endTag = TagManager.createEndTag()
		const metadataTag = metadata ? TagManager.createMetadataTag(metadata) + "\n" : ""

		// ! ファイル末尾に追加。
		const newContent = content.trim()
			? `${content}\n\n${metadataTag}${startTag}\n${endTag}\n`
			: `${metadataTag}${startTag}\n${endTag}\n`

		return newContent
	}

	// ! 壊れたタグペアを自動修復する。
	static repairTagPairs(content: string): { content: string; repaired: boolean; fixes: string[] } {
		const validation = TagManager.validateTagPairs(content)
		const fixes: string[] = []
		let repaired = false

		// ! エラーがない場合は何もしない。
		if (validation.valid) {
			return { content, repaired: false, fixes: [] }
		}

		const lines = content.split("\n")
		const stack: Array<{ category: string; line: number }> = []
		const newLines: string[] = []

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			// ! startタグを検出。
			const startMatch = line.match(TagManager.START_TAG_PATTERN)
			if (startMatch) {
				stack.push({ category: startMatch[1], line: i })
				newLines.push(line)
				continue
			}

			// ! endタグを検出。
			const endMatch = line.match(TagManager.END_TAG_PATTERN)
			if (endMatch) {
				if (stack.length === 0) {
					// ! 孤立したendタグを削除。
					fixes.push(`Removed orphaned end tag at line ${i + 1}`)
					repaired = true
					continue
				} else {
					stack.pop()
					newLines.push(line)
				}
				continue
			}

			newLines.push(line)
		}

		// ! 未閉鎖のstartタグにendタグを追加。
		for (const openTag of stack) {
			newLines.push(TagManager.createEndTag())
			fixes.push(`Added missing end tag for category "${openTag.category}"`)
			repaired = true
		}

		return {
			content: newLines.join("\n"),
			repaired,
			fixes,
		}
	}

	// ! 全てのタグペアを取得する（複数カテゴリ対応）。
	static getAllTagPairs(content: string): Map<string, TagPair> {
		const pairs = TagManager.parseTagPairs(content)
		const pairMap = new Map<string, TagPair>()

		for (const pair of pairs) {
			pairMap.set(pair.category, pair)
		}

		return pairMap
	}
}
