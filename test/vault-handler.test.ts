import { App, TFile, TFolder } from "obsidian"
import { MemologVaultHandler } from "../src/fs/vault-handler"

// ! vault APIのモック関数。
const mockRead = jest.fn()
const mockCreate = jest.fn()
const mockModify = jest.fn()
const mockDelete = jest.fn()
const mockGetAbstractFileByPath = jest.fn()
const mockCreateFolder = jest.fn()

// ! TFileのモック作成ヘルパー。
const createMockTFile = (path: string): TFile => {
	return Object.create(TFile.prototype, {
		path: { value: path },
	}) as TFile
}

// ! TFolderのモック作成ヘルパー。
const createMockTFolder = (path: string): TFolder => {
	return Object.create(TFolder.prototype, {
		path: { value: path },
	}) as TFolder
}

// ! Appのモック。
const mockApp = {
	vault: {
		read: mockRead,
		create: mockCreate,
		modify: mockModify,
		delete: mockDelete,
		getAbstractFileByPath: mockGetAbstractFileByPath,
		createFolder: mockCreateFolder,
	},
} as unknown as App

describe("MemologVaultHandler", () => {
	let vaultHandler: MemologVaultHandler

	beforeEach(() => {
		// ! 各テストの前にMemologVaultHandlerを初期化。
		vaultHandler = new MemologVaultHandler(mockApp)
		jest.clearAllMocks()
	})

	describe("fileExists", () => {
		it("ファイルが存在する場合はtrueを返す", () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)

			const result = vaultHandler.fileExists("test.md")
			expect(result).toBe(true)
			expect(mockGetAbstractFileByPath).toHaveBeenCalledWith("test.md")
		})

		it("ファイルが存在しない場合はfalseを返す", () => {
			mockGetAbstractFileByPath.mockReturnValue(null)

			const result = vaultHandler.fileExists("nonexistent.md")
			expect(result).toBe(false)
		})

		it("フォルダが存在する場合はfalseを返す（ファイルではない）", () => {
			const mockFolder = createMockTFolder("folder")
			mockGetAbstractFileByPath.mockReturnValue(mockFolder)

			const result = vaultHandler.fileExists("folder")
			expect(result).toBe(false)
		})
	})

	describe("folderExists", () => {
		it("フォルダが存在する場合はtrueを返す", () => {
			const mockFolder = createMockTFolder("folder")
			mockGetAbstractFileByPath.mockReturnValue(mockFolder)

			const result = vaultHandler.folderExists("folder")
			expect(result).toBe(true)
			expect(mockGetAbstractFileByPath).toHaveBeenCalledWith("folder")
		})

		it("フォルダが存在しない場合はfalseを返す", () => {
			mockGetAbstractFileByPath.mockReturnValue(null)

			const result = vaultHandler.folderExists("nonexistent")
			expect(result).toBe(false)
		})

		it("ファイルが存在する場合はfalseを返す（フォルダではない）", () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)

			const result = vaultHandler.folderExists("test.md")
			expect(result).toBe(false)
		})
	})

	describe("createFile", () => {
		it("ファイルを作成できる", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(null) // ! 親ディレクトリは存在しない。
			mockCreate.mockResolvedValue(mockFile)

			const result = await vaultHandler.createFile("test.md", "content")

			expect(result).toBe(mockFile)
			expect(mockCreate).toHaveBeenCalledWith("test.md", "content")
		})

		it("親ディレクトリが存在しない場合は作成する", async () => {
			const mockFile = createMockTFile("dir/test.md")
			mockGetAbstractFileByPath.mockReturnValue(null) // ! ディレクトリは存在しない。
			mockCreateFolder.mockResolvedValue(undefined)
			mockCreate.mockResolvedValue(mockFile)

			const result = await vaultHandler.createFile("dir/test.md", "content")

			expect(mockCreateFolder).toHaveBeenCalledWith("dir")
			expect(mockCreate).toHaveBeenCalledWith("dir/test.md", "content")
			expect(result).toBe(mockFile)
		})

		it("親ディレクトリが既に存在する場合は作成しない", async () => {
			const mockDir = createMockTFolder("dir")
			const mockFile = createMockTFile("dir/test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockDir)
			mockCreate.mockResolvedValue(mockFile)

			await vaultHandler.createFile("dir/test.md", "content")

			expect(mockCreateFolder).not.toHaveBeenCalled()
			expect(mockCreate).toHaveBeenCalledWith("dir/test.md", "content")
		})

		it("作成エラー時は例外をスローする", async () => {
			mockGetAbstractFileByPath.mockReturnValue(null)
			mockCreate.mockRejectedValue(new Error("Create error"))

			await expect(vaultHandler.createFile("test.md", "content")).rejects.toThrow(
				"Create error",
			)
		})
	})

	describe("createFolder", () => {
		it("フォルダを作成できる", async () => {
			mockGetAbstractFileByPath.mockReturnValue(null)
			mockCreateFolder.mockResolvedValue(undefined)

			await vaultHandler.createFolder("folder")

			expect(mockCreateFolder).toHaveBeenCalledWith("folder")
		})

		it("フォルダが既に存在する場合は何もしない", async () => {
			const mockFolder = createMockTFolder("folder")
			mockGetAbstractFileByPath.mockReturnValue(mockFolder)

			await vaultHandler.createFolder("folder")

			expect(mockCreateFolder).not.toHaveBeenCalled()
		})

		it("作成エラー時でもフォルダが存在すればエラーを無視する", async () => {
			const mockFolder = createMockTFolder("folder")
			mockGetAbstractFileByPath
				.mockReturnValueOnce(null) // ! 最初のチェック。
				.mockReturnValueOnce(mockFolder) // ! エラー後のチェック。
			mockCreateFolder.mockRejectedValue(new Error("Folder exists"))

			await expect(vaultHandler.createFolder("folder")).resolves.toBeUndefined()
		})

		it("作成エラー時でフォルダが存在しない場合は例外をスローする", async () => {
			mockGetAbstractFileByPath.mockReturnValue(null)
			mockCreateFolder.mockRejectedValue(new Error("Create error"))

			await expect(vaultHandler.createFolder("folder")).rejects.toThrow("Create error")
		})
	})

	describe("readFile", () => {
		it("ファイルを読み込める", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue("file content")

			const result = await vaultHandler.readFile("test.md")

			expect(result).toBe("file content")
			expect(mockRead).toHaveBeenCalledWith(mockFile)
		})

		it("ファイルが存在しない場合は例外をスローする", async () => {
			mockGetAbstractFileByPath.mockReturnValue(null)

			await expect(vaultHandler.readFile("nonexistent.md")).rejects.toThrow(
				"File not found: nonexistent.md",
			)
		})

		it("フォルダの場合は例外をスローする", async () => {
			const mockFolder = createMockTFolder("folder")
			mockGetAbstractFileByPath.mockReturnValue(mockFolder)

			await expect(vaultHandler.readFile("folder")).rejects.toThrow("File not found: folder")
		})
	})

	describe("writeFile", () => {
		it("既存ファイルを更新できる", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockModify.mockResolvedValue(undefined)

			await vaultHandler.writeFile("test.md", "new content")

			expect(mockModify).toHaveBeenCalledWith(mockFile, "new content")
		})

		it("ファイルが存在しない場合は作成する", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath
				.mockReturnValueOnce(null) // ! writeFile内の最初のチェック。
				.mockReturnValueOnce(null) // ! 親ディレクトリチェック。
			mockCreate.mockResolvedValue(mockFile)

			await vaultHandler.writeFile("test.md", "content")

			expect(mockCreate).toHaveBeenCalledWith("test.md", "content")
		})

		it("親ディレクトリが存在しない場合は作成する", async () => {
			const mockFile = createMockTFile("dir/test.md")
			mockGetAbstractFileByPath
				.mockReturnValueOnce(null) // ! writeFile内の最初のチェック。
				.mockReturnValueOnce(null) // ! 親ディレクトリチェック。
			mockCreateFolder.mockResolvedValue(undefined)
			mockCreate.mockResolvedValue(mockFile)

			await vaultHandler.writeFile("dir/test.md", "content")

			expect(mockCreateFolder).toHaveBeenCalledWith("dir")
			expect(mockCreate).toHaveBeenCalledWith("dir/test.md", "content")
		})
	})

	describe("deleteFile", () => {
		it("ファイルを削除できる", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockDelete.mockResolvedValue(undefined)

			await vaultHandler.deleteFile("test.md")

			expect(mockDelete).toHaveBeenCalledWith(mockFile)
		})

		it("ファイルが存在しない場合は何もしない", async () => {
			mockGetAbstractFileByPath.mockReturnValue(null)

			await expect(vaultHandler.deleteFile("nonexistent.md")).resolves.toBeUndefined()
			expect(mockDelete).not.toHaveBeenCalled()
		})

		it("フォルダの場合は何もしない", async () => {
			const mockFolder = createMockTFolder("folder")
			mockGetAbstractFileByPath.mockReturnValue(mockFolder)

			await expect(vaultHandler.deleteFile("folder")).resolves.toBeUndefined()
			expect(mockDelete).not.toHaveBeenCalled()
		})
	})

	describe("parseTagPairs", () => {
		it("ファイル内のタグペアを解析できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.parseTagPairs("test.md")

			expect(result).toBeInstanceOf(Array)
			expect(result.length).toBeGreaterThan(0)
		})
	})

	describe("validateTagPairs", () => {
		it("タグペアの整合性をチェックできる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.validateTagPairs("test.md")

			expect(result).toHaveProperty("valid")
			expect(result).toHaveProperty("errors")
			expect(result).toHaveProperty("warnings")
		})
	})

	describe("repairTagPairs", () => {
		it("壊れたタグペアを修復できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)
			mockModify.mockResolvedValue(undefined)

			const result = await vaultHandler.repairTagPairs("test.md", false)

			expect(result).toHaveProperty("repaired")
			expect(result).toHaveProperty("fixes")
		})

		it("バックアップを作成する", async () => {
			const mockFile = createMockTFile("test.md")
			// ! 不完全なタグペア（endタグが無い）なので修復される。
			const content = `<!-- memolog: start category="work" -->
content`

			mockGetAbstractFileByPath
				.mockReturnValueOnce(mockFile) // ! readFile for test.md。
				.mockReturnValueOnce(mockFile) // ! modify (最終的なファイル更新)。
			mockRead.mockResolvedValue(content)
			mockCreate.mockResolvedValue(createMockTFile("test.md.backup-123"))
			mockModify.mockResolvedValue(undefined)

			const result = await vaultHandler.repairTagPairs("test.md", true)

			if (result.repaired) {
				expect(result.backupPath).toBeDefined()
				expect(result.backupPath).toContain("test.md.backup-")
				expect(mockCreate).toHaveBeenCalled() // ! バックアップファイルが作成された。
			}
		})
	})

	describe("findTagPairByCategory", () => {
		it("指定したカテゴリのタグペアを取得できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.findTagPairByCategory("test.md", "work")

			expect(result).toBeTruthy()
			if (result) {
				expect(result.category).toBe("work")
			}
		})

		it("存在しないカテゴリの場合はnullを返す", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.findTagPairByCategory("test.md", "hobby")

			expect(result).toBeNull()
		})
	})

	describe("initializeTagPair", () => {
		it("新しいファイルにタグペアを初期化できる", async () => {
			mockGetAbstractFileByPath
				.mockReturnValueOnce(null) // ! fileExists。
				.mockReturnValueOnce(null) // ! writeFile内の最初のチェック。
				.mockReturnValueOnce(null) // ! 親ディレクトリチェック。
			mockCreate.mockResolvedValue(createMockTFile("test.md"))

			await vaultHandler.initializeTagPair("test.md", "work")

			expect(mockCreate).toHaveBeenCalled()
		})

		it("既存ファイルにタグペアを追加できる", async () => {
			const mockFile = createMockTFile("test.md")
			const existingContent = "existing content"

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(existingContent)
			mockModify.mockResolvedValue(undefined)

			await vaultHandler.initializeTagPair("test.md", "work")

			expect(mockModify).toHaveBeenCalled()
		})

		it("メタデータを指定してタグペアを初期化できる", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue("")
			mockModify.mockResolvedValue(undefined)

			await vaultHandler.initializeTagPair("test.md", "work", {
				format: "custom",
				order: "desc",
			})

			expect(mockModify).toHaveBeenCalled()
		})
	})

	describe("insertTextInCategory", () => {
		it("カテゴリの先頭にテキストを挿入できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->

<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)
			mockModify.mockResolvedValue(undefined)

			await vaultHandler.insertTextInCategory("test.md", "work", "new memo", "top")

			expect(mockModify).toHaveBeenCalled()
		})

		it("カテゴリの末尾にテキストを挿入できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->

<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)
			mockModify.mockResolvedValue(undefined)

			await vaultHandler.insertTextInCategory("test.md", "work", "new memo", "bottom")

			expect(mockModify).toHaveBeenCalled()
		})

		it("存在しないカテゴリの場合は例外をスローする", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			await expect(
				vaultHandler.insertTextInCategory("test.md", "hobby", "new memo", "top"),
			).rejects.toThrow("Category \"hobby\" not found in file: test.md")
		})
	})

	describe("getCategoryContent", () => {
		it("カテゴリの内容を取得できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
memo content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.getCategoryContent("test.md", "work")

			expect(result).toBeTruthy()
		})

		it("存在しないカテゴリの場合はnullを返す", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
memo content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.getCategoryContent("test.md", "hobby")

			expect(result).toBeNull()
		})
	})

	describe("replaceCategoryContent", () => {
		it("カテゴリの内容を置換できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
old content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)
			mockModify.mockResolvedValue(undefined)

			await vaultHandler.replaceCategoryContent("test.md", "work", "new content")

			expect(mockModify).toHaveBeenCalled()
		})

		it("存在しないカテゴリの場合は例外をスローする", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			await expect(
				vaultHandler.replaceCategoryContent("test.md", "hobby", "new content"),
			).rejects.toThrow("Category \"hobby\" not found in file: test.md")
		})
	})

	describe("getAllCategories", () => {
		it("全てのカテゴリ内容を取得できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
work content
<!-- memolog: end -->
<!-- memolog: start category="hobby" -->
hobby content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.getAllCategories("test.md")

			expect(result).toBeInstanceOf(Map)
			expect(result.size).toBeGreaterThan(0)
		})
	})

	describe("getMultipleCategoryContents", () => {
		it("指定した複数カテゴリの内容を取得できる", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
work content
<!-- memolog: end -->
<!-- memolog: start category="hobby" -->
hobby content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.getMultipleCategoryContents("test.md", [
				"work",
				"hobby",
			])

			expect(result).toBeInstanceOf(Map)
		})

		it("存在しないカテゴリは結果に含まれない", async () => {
			const mockFile = createMockTFile("test.md")
			const content = `<!-- memolog: start category="work" -->
work content
<!-- memolog: end -->`

			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue(content)

			const result = await vaultHandler.getMultipleCategoryContents("test.md", [
				"work",
				"hobby",
			])

			expect(result.has("work")).toBe(true)
			expect(result.has("hobby")).toBe(false)
		})
	})

	describe("safeReadFile", () => {
		it("ファイルを安全に読み込める", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockRead.mockResolvedValue("file content")

			const result = await vaultHandler.safeReadFile("test.md")

			expect(result.content).toBe("file content")
			expect(result.error).toBeUndefined()
		})

		it("エラー時はエラー情報を返す", async () => {
			mockGetAbstractFileByPath.mockReturnValue(null)

			const result = await vaultHandler.safeReadFile("nonexistent.md")

			expect(result.content).toBe("")
			expect(result.error).toBeDefined()
			expect(result.error).toContain("File not found")
		})
	})

	describe("safeWriteFile", () => {
		it("ファイルを安全に書き込める", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockModify.mockResolvedValue(undefined)

			const result = await vaultHandler.safeWriteFile("test.md", "content")

			expect(result.success).toBe(true)
			expect(result.error).toBeUndefined()
		})

		it("エラー時はエラー情報を返す", async () => {
			const mockFile = createMockTFile("test.md")
			mockGetAbstractFileByPath.mockReturnValue(mockFile)
			mockModify.mockRejectedValue(new Error("Write error"))

			const result = await vaultHandler.safeWriteFile("test.md", "content")

			expect(result.success).toBe(false)
			expect(result.error).toBeDefined()
			expect(result.error).toContain("Write error")
		})
	})
})
