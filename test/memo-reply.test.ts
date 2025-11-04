import { TFile } from "obsidian"
import { MemoManager } from "../src/core/memo-manager"

// ! モックApp型定義。
interface MockApp {
	vault: {
		adapter: {
			stat: jest.Mock
			exists: jest.Mock
			read: jest.Mock
			write: jest.Mock
		}
		getAbstractFileByPath: jest.Mock
		read: jest.Mock
		create: jest.Mock
		modify: jest.Mock
	}
}

// ! MemoManagerのモックセットアップ用ヘルパー。
function createMockApp(): MockApp {
	const mockFile = Object.create(TFile.prototype) as TFile
	mockFile.path = "test.md"
	mockFile.basename = "test"
	mockFile.extension = "md"

	return {
		vault: {
			adapter: {
				stat: jest.fn().mockResolvedValue({ mtime: Date.now() }),
				exists: jest.fn().mockResolvedValue(true),
				read: jest.fn().mockResolvedValue(""),
				write: jest.fn().mockResolvedValue(undefined),
			},
			getAbstractFileByPath: jest.fn().mockReturnValue(mockFile),
			read: jest.fn().mockResolvedValue(""),
			create: jest.fn().mockResolvedValue(mockFile),
			modify: jest.fn().mockResolvedValue(undefined),
		},
	}
}

describe("MemoManager - 返信作成API", () => {
	let app: MockApp
	let memoManager: MemoManager

	beforeEach(() => {
		app = createMockApp()
		memoManager = new MemoManager(app as never)
	})

	test("返信作成時にparentIdが正しく設定される", async () => {
		// ! 親メモを準備。
		const fileContent = `<!-- memo-id: parent-memo, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! 返信を作成。
		const reply = await memoManager.addReply(
			"test.md",
			"work",
			"parent-memo",
			"返信メモ",
		)

		// ! parentIdが設定されている。
		expect(reply.parentId).toBe("parent-memo")
		expect(reply.category).toBe("work")
		expect(reply.content).toBe("返信メモ")
	})

	test("返信作成時にファイルに正しく書き込まれる", async () => {
		const fileContent = `<!-- memo-id: parent-memo, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		await memoManager.addReply("test.md", "work", "parent-memo", "返信メモ")

		// ! modifyが呼ばれた。
		expect(app.vault.modify).toHaveBeenCalled()

		// ! 書き込まれた内容を確認。
		const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! 親メモが含まれている。
		expect(writtenContent).toContain("parent-memo")
		expect(writtenContent).toContain("親メモ")

		// ! 返信メモが含まれている。
		expect(writtenContent).toContain("返信メモ")

		// ! parent-id属性が含まれている。
		expect(writtenContent).toContain("parent-id: parent-memo")
	})

	test("返信作成時にスレッドインデックスが無効化される", async () => {
		const fileContent = `<!-- memo-id: parent-memo, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! スレッドインデックスマネージャーのclearメソッドをスパイ。
		const clearSpy = jest.spyOn(memoManager.threadIndexManager, "clear")

		await memoManager.addReply("test.md", "work", "parent-memo", "返信メモ")

		// ! clearが呼ばれた。
		expect(clearSpy).toHaveBeenCalled()
	})

	test("親メモと異なるカテゴリの返信は作成できない", async () => {
		const fileContent = `<!-- memo-id: parent-memo, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! 親メモのカテゴリはwork、返信のカテゴリはpersonal。
		await expect(
			memoManager.addReply("test.md", "personal", "parent-memo", "返信メモ"),
		).rejects.toThrow()
	})

	test("存在しない親メモへの返信は作成できない", async () => {
		const fileContent = `<!-- memo-id: parent-memo, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! 存在しない親メモID。
		await expect(
			memoManager.addReply("test.md", "work", "non-existent", "返信メモ"),
		).rejects.toThrow()
	})

	test("返信作成後にスレッドツリーが更新される", async () => {
		const initialContent = `<!-- memo-id: parent-memo, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`

		app.vault.read.mockResolvedValueOnce(initialContent) // addReply内での読み込み

		const reply = await memoManager.addReply(
			"test.md",
			"work",
			"parent-memo",
			"返信メモ",
		)

		// ! 書き込まれた内容を取得。
		const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string
		app.vault.read.mockResolvedValue(writtenContent)

		// ! スレッドインデックスを取得。
		const index = await memoManager.getThreadIndex("test.md", "work")

		// ! 親メモがルートに含まれる。
		expect(index.rootIds.has("parent-memo")).toBe(true)

		// ! 親メモの子として返信が登録される。
		const children = index.childrenMap.get("parent-memo")
		expect(children).toBeDefined()
		expect(children).toContain(reply.id)

		// ! 返信の親が正しく設定される。
		expect(index.parentMap.get(reply.id)).toBe("parent-memo")
	})

	test("複数の返信を同じ親メモに追加できる", async () => {
		const initialContent = `<!-- memo-id: parent-memo, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ
`

		// ! 1つ目の返信。
		app.vault.read.mockResolvedValueOnce(initialContent)
		const reply1 = await memoManager.addReply(
			"test.md",
			"work",
			"parent-memo",
			"返信1",
		)

		// ! 1つ目の返信が書き込まれた後の内容。
		const contentAfterReply1 = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! 2つ目の返信。
		app.vault.read.mockResolvedValueOnce(contentAfterReply1)
		const reply2 = await memoManager.addReply(
			"test.md",
			"work",
			"parent-memo",
			"返信2",
		)

		// ! 2つ目の返信が書き込まれた後の内容。
		const contentAfterReply2 = (app.vault.modify.mock.calls[1] as unknown[])[1] as string
		app.vault.read.mockResolvedValue(contentAfterReply2)

		// ! スレッドインデックスを取得。
		const index = await memoManager.getThreadIndex("test.md", "work")

		// ! 親メモの子として2つの返信が登録される。
		const children = index.childrenMap.get("parent-memo")
		expect(children).toBeDefined()
		expect(children).toHaveLength(2)
		expect(children).toContain(reply1.id)
		expect(children).toContain(reply2.id)
	})

	test("返信に対してさらに返信を作成できる（ネスト）", async () => {
		const initialContent = `<!-- memo-id: root-memo, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
ルートメモ
`

		// ! レベル1の返信。
		app.vault.read.mockResolvedValueOnce(initialContent)
		const reply1 = await memoManager.addReply(
			"test.md",
			"work",
			"root-memo",
			"返信レベル1",
		)

		const contentAfterReply1 = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! レベル2の返信（reply1への返信）。
		app.vault.read.mockResolvedValueOnce(contentAfterReply1)
		const reply2 = await memoManager.addReply(
			"test.md",
			"work",
			reply1.id,
			"返信レベル2",
		)

		const contentAfterReply2 = (app.vault.modify.mock.calls[1] as unknown[])[1] as string
		app.vault.read.mockResolvedValue(contentAfterReply2)

		// ! スレッドインデックスを取得。
		const index = await memoManager.getThreadIndex("test.md", "work")

		// ! ルートメモの子孫数を確認。
		expect(index.descendantCountMap.get("root-memo")).toBe(2)

		// ! reply1の親はroot-memo。
		expect(index.parentMap.get(reply1.id)).toBe("root-memo")

		// ! reply2の親はreply1。
		expect(index.parentMap.get(reply2.id)).toBe(reply1.id)

		// ! 深さを確認。
		expect(index.depthMap.get("root-memo")).toBe(0)
		expect(index.depthMap.get(reply1.id)).toBe(1)
		expect(index.depthMap.get(reply2.id)).toBe(2)
	})
})
