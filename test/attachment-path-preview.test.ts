// ! 添付ファイル保存先プレビュー表示のテスト。
// ! settings-tab.tsのupdateAttachmentPathPreview関数の動作を検証する。

import { PathGenerator } from "../src/utils/path-generator"

describe("添付ファイル保存先プレビュー表示", () => {
	// ! テスト用の固定日時。
	const testDate = new Date(2025, 10, 11, 15, 30, 45) // 2025-11-11 15:30:45

	// ! プレビュー生成ロジックを再現する関数。
	const generateAttachmentPathPreview = (
		attachmentPathFormat: string,
		rootDirectory: string,
		pathFormat: string,
		categoryDirectory: string,
		useDirectoryCategory: boolean,
		date: Date,
	): string => {
		// ! 日付フォーマット展開用のヘルパー関数。
		const expandDateFormat = (str: string): string => {
			const year = date.getFullYear()
			const month = (date.getMonth() + 1).toString().padStart(2, "0")
			const day = date.getDate().toString().padStart(2, "0")
			const hour = date.getHours().toString().padStart(2, "0")
			const minute = date.getMinutes().toString().padStart(2, "0")
			const second = date.getSeconds().toString().padStart(2, "0")

			return str
				.replace(/%Y/g, year.toString())
				.replace(/%m/g, month)
				.replace(/%d/g, day)
				.replace(/%H/g, hour)
				.replace(/%M/g, minute)
				.replace(/%S/g, second)
		}

		// ! メモファイルのパスを生成。
		const memoPath = PathGenerator.generateCustomPath(
			rootDirectory,
			categoryDirectory,
			pathFormat,
			useDirectoryCategory,
			date,
		)

		// ! 添付ファイルの保存先パスを計算。
		let attachmentPath: string
		if (attachmentPathFormat.startsWith("./")) {
			// ! 相対パス: メモファイルと同じディレクトリからの相対パス。
			const memoDir = memoPath.substring(0, memoPath.lastIndexOf("/"))
			const relativePath = attachmentPathFormat.substring(2) // "./" を除去。
			const expandedPath = expandDateFormat(relativePath)
			attachmentPath = `${memoDir}/${expandedPath}`
		} else if (attachmentPathFormat.startsWith("/")) {
			// ! 絶対パス: ルートディレクトリからの絶対パス。
			const absolutePath = attachmentPathFormat.substring(1) // "/" を除去。
			const expandedPath = expandDateFormat(absolutePath)
			attachmentPath = `${rootDirectory}/${expandedPath}`
		} else {
			// ! その他: そのまま表示。
			attachmentPath = expandDateFormat(attachmentPathFormat)
		}

		return attachmentPath
	}

	describe("相対パス指定（./から始まる）- メモファイルのディレクトリ基準", () => {
		const rootDir = "hoge/hoge"
		const category = "work"

		it("pathFormat=%Y/%m/%d.md, attachmentPath=./attachments", () => {
			const preview = generateAttachmentPathPreview(
				"./attachments",
				rootDir,
				"%Y/%m/%d.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: hoge/hoge/2025/11/11.md
			// ! メモファイルのディレクトリ: hoge/hoge/2025/11
			// ! 添付ファイル: hoge/hoge/2025/11/attachments
			expect(preview).toBe("hoge/hoge/2025/11/attachments")
		})

		it("pathFormat=%Y-%m-%d.md, attachmentPath=./attachments", () => {
			const preview = generateAttachmentPathPreview(
				"./attachments",
				rootDir,
				"%Y-%m-%d.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: hoge/hoge/2025-11-11.md
			// ! メモファイルのディレクトリ: hoge/hoge
			// ! 添付ファイル: hoge/hoge/attachments
			expect(preview).toBe("hoge/hoge/attachments")
		})

		it("pathFormat=%Y/%m/%d.md, attachmentPath=./attachments/%Y", () => {
			const preview = generateAttachmentPathPreview(
				"./attachments/%Y",
				rootDir,
				"%Y/%m/%d.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: hoge/hoge/2025/11/11.md
			// ! メモファイルのディレクトリ: hoge/hoge/2025/11
			// ! 添付ファイル: hoge/hoge/2025/11/attachments/2025
			expect(preview).toBe("hoge/hoge/2025/11/attachments/2025")
		})

		it("pathFormat=%Y/%m/%d.md（useDirectoryCategory=true）, attachmentPath=./attachments", () => {
			const preview = generateAttachmentPathPreview(
				"./attachments",
				rootDir,
				"%Y/%m/%d.md",
				category,
				true,
				testDate,
			)
			// ! メモファイル: hoge/hoge/work/2025/11/11.md
			// ! メモファイルのディレクトリ: hoge/hoge/work/2025/11
			// ! 添付ファイル: hoge/hoge/work/2025/11/attachments
			expect(preview).toBe("hoge/hoge/work/2025/11/attachments")
		})
	})

	describe("絶対パス指定（/から始まる）- ルートディレクトリ基準", () => {
		const rootDir = "hoge/hoge"
		const category = "work"

		it("pathFormat=%Y/%m/%d.md, attachmentPath=/attachments", () => {
			const preview = generateAttachmentPathPreview(
				"/attachments",
				rootDir,
				"%Y/%m/%d.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: hoge/hoge/2025/11/11.md
			// ! 添付ファイル: hoge/hoge/attachments（ルートディレクトリ基準）
			expect(preview).toBe("hoge/hoge/attachments")
		})

		it("pathFormat=%Y-%m-%d.md, attachmentPath=/attachments", () => {
			const preview = generateAttachmentPathPreview(
				"/attachments",
				rootDir,
				"%Y-%m-%d.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: hoge/hoge/2025-11-11.md
			// ! 添付ファイル: hoge/hoge/attachments（ルートディレクトリ基準）
			expect(preview).toBe("hoge/hoge/attachments")
		})

		it("pathFormat=%Y/%m/%d.md, attachmentPath=/attachments/%Y", () => {
			const preview = generateAttachmentPathPreview(
				"/attachments/%Y",
				rootDir,
				"%Y/%m/%d.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: hoge/hoge/2025/11/11.md
			// ! 添付ファイル: hoge/hoge/attachments/2025（ルートディレクトリ基準）
			expect(preview).toBe("hoge/hoge/attachments/2025")
		})

		it("pathFormat=%Y/%m/%d.md（useDirectoryCategory=true）, attachmentPath=/attachments", () => {
			const preview = generateAttachmentPathPreview(
				"/attachments",
				rootDir,
				"%Y/%m/%d.md",
				category,
				true,
				testDate,
			)
			// ! メモファイル: hoge/hoge/work/2025/11/11.md
			// ! 添付ファイル: hoge/hoge/attachments（ルートディレクトリ基準、カテゴリは含まない）
			expect(preview).toBe("hoge/hoge/attachments")
		})
	})

	describe("相対パスと絶対パスの違いを明確に検証", () => {
		const rootDir = "memolog"
		const category = "default"
		const pathFormat = "%Y/%m/%d.md"

		it("./attachments: メモファイルのディレクトリに作成される", () => {
			const preview = generateAttachmentPathPreview(
				"./attachments",
				rootDir,
				pathFormat,
				category,
				false,
				testDate,
			)
			// ! メモファイル: memolog/2025/11/11.md
			// ! メモファイルのディレクトリ: memolog/2025/11 (11.mdはファイル名)
			// ! 添付ファイル: memolog/2025/11/attachments
			expect(preview).toBe("memolog/2025/11/attachments")
		})

		it("/attachments: ルートディレクトリに作成される", () => {
			const preview = generateAttachmentPathPreview(
				"/attachments",
				rootDir,
				pathFormat,
				category,
				false,
				testDate,
			)
			// ! メモファイル: memolog/2025/11/11.md
			// ! 添付ファイル: memolog/attachments（ルート直下）
			expect(preview).toBe("memolog/attachments")
		})
	})

	describe("異なるpathFormatでの相対パスの挙動", () => {
		const rootDir = "vault/memolog"
		const category = "work"

		it("pathFormat=%Y%m%d.md（フラット構造）+ ./attachments", () => {
			const preview = generateAttachmentPathPreview(
				"./attachments",
				rootDir,
				"%Y%m%d.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: vault/memolog/20251111.md
			// ! メモファイルのディレクトリ: vault/memolog
			// ! 添付ファイル: vault/memolog/attachments
			expect(preview).toBe("vault/memolog/attachments")
		})

		it("pathFormat=%Y/%m/%d.md（階層構造）+ ./attachments", () => {
			const preview = generateAttachmentPathPreview(
				"./attachments",
				rootDir,
				"%Y/%m/%d.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: vault/memolog/2025/11/11.md
			// ! メモファイルのディレクトリ: vault/memolog/2025/11 (11.mdはファイル名)
			// ! 添付ファイル: vault/memolog/2025/11/attachments
			expect(preview).toBe("vault/memolog/2025/11/attachments")
		})

		it("pathFormat=%Y/%m.md（月単位）+ ./attachments", () => {
			const preview = generateAttachmentPathPreview(
				"./attachments",
				rootDir,
				"%Y/%m.md",
				category,
				false,
				testDate,
			)
			// ! メモファイル: vault/memolog/2025/11.md
			// ! メモファイルのディレクトリ: vault/memolog/2025
			// ! 添付ファイル: vault/memolog/2025/attachments
			expect(preview).toBe("vault/memolog/2025/attachments")
		})
	})
})
