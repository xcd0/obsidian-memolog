import { PathGenerator } from "../src/utils/path-generator"

describe("PathGenerator", () => {
	// ! テスト用の固定日時（ローカルタイム: 2025-10-23 14:30:45）。
	const testDate = new Date(2025, 9, 23, 14, 30, 45)

	describe("generateCustomPath (旧generateFilePathの代替)", () => {
		// ! ルートディレクトリとカテゴリの基本設定。
		const rootDir = "memolog"
		const category = "work"

		describe("日単位フォーマット: %Y-%m-%d", () => {
			it("ディレクトリカテゴリあり: memolog/work/2025-10-23.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10-23.md")
			})

			it("ディレクトリカテゴリなし: memolog/2025-10-23.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d",
					false,
					testDate,
				)
				expect(result).toBe("memolog/2025-10-23.md")
			})
		})

		describe("月単位フォーマット: %Y-%m", () => {
			it("ディレクトリカテゴリあり: memolog/work/2025-10.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10.md")
			})

			it("ディレクトリカテゴリなし: memolog/2025-10.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m",
					false,
					testDate,
				)
				expect(result).toBe("memolog/2025-10.md")
			})
		})
	})

	describe("generateCustomPath", () => {
		const rootDir = "memolog"
		const category = "work"

		describe("カスタムフォーマット", () => {
			it("%Y-%m-%d形式: memolog/work/2025-10-23.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10-23.md")
			})

			it("%Y/%m/%d形式: memolog/work/2025/10/23.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y/%m/%d",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025/10/23.md")
			})

			it("時刻を含む%Y-%m-%d-%H-%M形式", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d-%H-%M",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10-23-14-30.md")
			})

			it("秒まで含む%Y%m%d%H%M%S形式", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y%m%d%H%M%S",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/20251023143045.md")
			})
		})

		describe(".md拡張子の自動付与", () => {
			it(".mdなしのフォーマットに自動付与", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d",
					true,
					testDate,
				)
				expect(result).toMatch(/\.md$/)
			})

			it(".mdありのフォーマットはそのまま", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10-23.md")
			})
		})

		describe("ディレクトリカテゴリ切り替え", () => {
			it("ディレクトリカテゴリあり", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10.md")
			})

			it("ディレクトリカテゴリなし", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m",
					false,
					testDate,
				)
				expect(result).toBe("memolog/2025-10.md")
			})
		})

		describe("%C（カテゴリ名）プレースホルダー", () => {
			it("%C/%Y-%m-%d/memo.md形式: memolog/work/2025-10-23/memo.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%C/%Y-%m-%d/memo.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10-23/memo.md")
			})

			it("%Y-%m-%d/%C.md形式: memolog/2025-10-23/work.md", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d/%C.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/2025-10-23/work.md")
			})

			it("%C/%Y-%m-%d/memo.md形式（useDirectoryCategory=false）でも同じ", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%C/%Y-%m-%d/memo.md",
					false,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10-23/memo.md")
			})

			it("%Y-%m-%d/memo.md（%Cなし、useDirectoryCategory=true）", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d/memo.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10-23/memo.md")
			})

			it("%Y-%m-%d/memo.md（%Cなし、useDirectoryCategory=false）", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d/memo.md",
					false,
					testDate,
				)
				expect(result).toBe("memolog/2025-10-23/memo.md")
			})

			it("%Y-%m-%d.md（%Cなし、useDirectoryCategory=true）", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025-10-23.md")
			})

			it("%Y-%m-%d.md（%Cなし、useDirectoryCategory=false）", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y-%m-%d.md",
					false,
					testDate,
				)
				expect(result).toBe("memolog/2025-10-23.md")
			})

			it("%Y%m%d.md（%Cなし、useDirectoryCategory=true）", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y%m%d.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/20251023.md")
			})

			it("%Y%m%d.md（%Cなし、useDirectoryCategory=false）", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y%m%d.md",
					false,
					testDate,
				)
				expect(result).toBe("memolog/20251023.md")
			})

			it("%Y/%m/%d.md（%Cなし、useDirectoryCategory=true）", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y/%m/%d.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/work/2025/10/23.md")
			})

			it("%Y/%m/%d.md（%Cなし、useDirectoryCategory=false）", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					category,
					"%Y/%m/%d.md",
					false,
					testDate,
				)
				expect(result).toBe("memolog/2025/10/23.md")
			})

			it("複数カテゴリのテスト: hobby", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					"hobby",
					"%C/%Y-%m-%d/memo.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/hobby/2025-10-23/memo.md")
			})

			it("複数カテゴリのテスト: personal", () => {
				const result = PathGenerator.generateCustomPath(
					rootDir,
					"personal",
					"%Y-%m-%d/%C.md",
					true,
					testDate,
				)
				expect(result).toBe("memolog/2025-10-23/personal.md")
			})
		})
	})

	describe("generateAttachmentPath", () => {
		const rootDir = "memolog"
		const memoFilePath = "memolog/work/2025-10-23.md"

		describe("絶対パス指定（/から始まる）", () => {
			it("/attachments形式", () => {
				const result = PathGenerator.generateAttachmentPath(
					rootDir,
					memoFilePath,
					"/attachments",
					"%Y-%m-%d-%s%e",
					"image.png",
					testDate,
				)
				expect(result).toMatch(/^memolog\/attachments\/2025-10-23-\d+\.png$/)
			})

			it("/attachments/%Y-%m-%d形式", () => {
				const result = PathGenerator.generateAttachmentPath(
					rootDir,
					memoFilePath,
					"/attachments/%Y-%m-%d",
					"%s%e",
					"document.pdf",
					testDate,
				)
				expect(result).toMatch(/^memolog\/attachments\/2025-10-23\/\d+\.pdf$/)
			})
		})

		describe("相対パス指定（./から始まる）", () => {
			it("./attachments形式", () => {
				const result = PathGenerator.generateAttachmentPath(
					rootDir,
					memoFilePath,
					"./attachments",
					"%Y-%m-%d-%s%e",
					"photo.jpg",
					testDate,
				)
				expect(result).toMatch(/^memolog\/work\/attachments\/2025-10-23-\d+\.jpg$/)
			})

			it("./files/%Y/%m形式", () => {
				const result = PathGenerator.generateAttachmentPath(
					rootDir,
					memoFilePath,
					"./files/%Y/%m",
					"%f-%s%e",
					"report.docx",
					testDate,
				)
				expect(result).toMatch(/^memolog\/work\/files\/2025\/10\/report-\d+\.docx$/)
			})
		})

		describe("相対パス指定（./なし）", () => {
			it("attachments形式", () => {
				const result = PathGenerator.generateAttachmentPath(
					rootDir,
					memoFilePath,
					"attachments",
					"%s%e",
					"file.txt",
					testDate,
				)
				expect(result).toMatch(/^memolog\/work\/attachments\/\d+\.txt$/)
			})

			it("files/%Y-%m形式", () => {
				const result = PathGenerator.generateAttachmentPath(
					rootDir,
					memoFilePath,
					"files/%Y-%m",
					"%Y%m%d-%s%e",
					"data.csv",
					testDate,
				)
				expect(result).toMatch(/^memolog\/work\/files\/2025-10\/20251023-\d+\.csv$/)
			})
		})
	})

	describe("generateAttachmentName", () => {
		describe("基本的なフォーマット", () => {
			it("%s（タイムスタンプ）のみ", () => {
				const result = PathGenerator.generateAttachmentName("%s", "test.png", testDate)
				expect(result).toMatch(/^\d+$/)
			})

			it("%f（ベース名）のみ", () => {
				const result = PathGenerator.generateAttachmentName("%f", "test.png", testDate)
				expect(result).toBe("test")
			})

			it("%e（拡張子）のみ", () => {
				const result = PathGenerator.generateAttachmentName("%e", "test.png", testDate)
				expect(result).toBe(".png")
			})

			it("%f%e（元のファイル名）", () => {
				const result = PathGenerator.generateAttachmentName("%f%e", "document.pdf", testDate)
				expect(result).toBe("document.pdf")
			})
		})

		describe("日付フォーマット", () => {
			it("%Y-%m-%d形式", () => {
				const result = PathGenerator.generateAttachmentName("%Y-%m-%d", "test.png", testDate)
				expect(result).toBe("2025-10-23")
			})

			it("%Y%m%d形式", () => {
				const result = PathGenerator.generateAttachmentName("%Y%m%d", "test.png", testDate)
				expect(result).toBe("20251023")
			})

			it("%Y-%m-%d-%H-%M-%S形式", () => {
				const result = PathGenerator.generateAttachmentName(
					"%Y-%m-%d-%H-%M-%S",
					"test.png",
					testDate,
				)
				expect(result).toBe("2025-10-23-14-30-45")
			})
		})

		describe("複合フォーマット", () => {
			it("%Y-%m-%d-%s形式", () => {
				const result = PathGenerator.generateAttachmentName(
					"%Y-%m-%d-%s",
					"photo.jpg",
					testDate,
				)
				expect(result).toMatch(/^2025-10-23-\d+$/)
			})

			it("%f-%s%e形式", () => {
				const result = PathGenerator.generateAttachmentName(
					"%f-%s%e",
					"image.png",
					testDate,
				)
				expect(result).toMatch(/^image-\d+\.png$/)
			})

			it("%Y%m%d-%H%M%S-%f%e形式", () => {
				const result = PathGenerator.generateAttachmentName(
					"%Y%m%d-%H%M%S-%f%e",
					"report.pdf",
					testDate,
				)
				expect(result).toMatch(/^20251023-143045-report\.pdf$/)
			})
		})

		describe("拡張子がないファイル", () => {
			it("%f%e形式で拡張子なし", () => {
				const result = PathGenerator.generateAttachmentName("%f%e", "README", testDate)
				expect(result).toBe("README")
			})

			it("%s-%f%e形式で拡張子なし", () => {
				const result = PathGenerator.generateAttachmentName("%s-%f%e", "Makefile", testDate)
				expect(result).toMatch(/^\d+-Makefile$/)
			})
		})

		describe("特殊なファイル名", () => {
			it("複数のドットを含むファイル名", () => {
				const result = PathGenerator.generateAttachmentName(
					"%f%e",
					"archive.tar.gz",
					testDate,
				)
				expect(result).toBe("archive.tar.gz")
			})

			it("ドットで始まるファイル名", () => {
				const result = PathGenerator.generateAttachmentName("%f%e", ".gitignore", testDate)
				expect(result).toBe(".gitignore")
			})
		})
	})
})
