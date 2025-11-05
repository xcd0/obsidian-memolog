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

describe("MemoManager - カスケード削除", () => {
	let app: MockApp
	let memoManager: MemoManager

	beforeEach(() => {
		app = createMockApp()
		memoManager = new MemoManager(app as never)
	})

	test("親メモを削除すると子メモも削除される（v0.0.16: 親は削除マーカー、子は削除）", async () => {
		const fileContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ

<!-- memo-id: child, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
子メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! 親メモを削除。
		await memoManager.deleteMemoWithDescendants("test.md", "work", "parent")

		// ! 書き込まれた内容を確認。
		const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! v0.0.16: 親メモは削除マーカーに変換され、子メモは完全削除される。
		expect(writtenContent).toContain("memo-id: parent")
		expect(writtenContent).toContain("permanently-deleted: \"true\"")
		expect(writtenContent).toContain("[削除済み]")
		expect(writtenContent).not.toContain("親メモ")
		expect(writtenContent).not.toContain("memo-id: child")
		expect(writtenContent).not.toContain("子メモ")
	})

	test("孫メモまで含めて再帰的に削除される（v0.0.16: 親は削除マーカー、子孫は削除）", async () => {
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
ルート

<!-- memo-id: child, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:30
子

<!-- memo-id: grandchild, timestamp: 2025-11-04T11:00:00+09:00, category: "work", parent-id: child -->
## 2025-11-04 11:00
孫
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! ルートメモを削除。
		await memoManager.deleteMemoWithDescendants("test.md", "work", "root")

		// ! 書き込まれた内容を確認。
		const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! v0.0.16: 親メモは削除マーカーに変換され、子孫は完全削除される。
		expect(writtenContent).toContain("memo-id: root")
		expect(writtenContent).toContain("permanently-deleted: \"true\"")
		expect(writtenContent).toContain("[削除済み]")
		expect(writtenContent).not.toContain("memo-id: child")
		expect(writtenContent).not.toContain("memo-id: grandchild")
	})

	test("複数の子メモを持つ親を削除するとすべての子が削除される（v0.0.16: 親は削除マーカー）", async () => {
		const fileContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親

<!-- memo-id: child1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
子1

<!-- memo-id: child2, timestamp: 2025-11-04T10:45:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:45
子2

<!-- memo-id: child3, timestamp: 2025-11-04T11:00:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 11:00
子3
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! 親メモを削除。
		await memoManager.deleteMemoWithDescendants("test.md", "work", "parent")

		// ! 書き込まれた内容を確認。
		const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! v0.0.16: 親メモは削除マーカーに変換され、子は完全削除される。
		expect(writtenContent).toContain("memo-id: parent")
		expect(writtenContent).toContain("permanently-deleted: \"true\"")
		expect(writtenContent).not.toContain("memo-id: child1")
		expect(writtenContent).not.toContain("memo-id: child2")
		expect(writtenContent).not.toContain("memo-id: child3")
	})

	test("子メモだけを削除しても親メモは残る", async () => {
		const fileContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ

<!-- memo-id: child, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
子メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! 子メモを削除。
		await memoManager.deleteMemoWithDescendants("test.md", "work", "child")

		// ! 書き込まれた内容を確認。
		const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! 親メモは残っている。
		expect(writtenContent).toContain("memo-id: parent")
		expect(writtenContent).toContain("親メモ")

		// ! 子メモは削除されている。
		expect(writtenContent).not.toContain("memo-id: child")
		expect(writtenContent).not.toContain("子メモ")
	})

	test("子孫を持たないメモを削除してもエラーにならない", async () => {
		const fileContent = `<!-- memo-id: single, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
単独メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! 単独メモを削除。
		await memoManager.deleteMemoWithDescendants("test.md", "work", "single")

		// ! 書き込まれた内容を確認。
		const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! メモが削除されている。
		expect(writtenContent).not.toContain("memo-id: single")
		expect(writtenContent).not.toContain("単独メモ")
	})

	test("カスケード削除後にスレッドインデックスが無効化される", async () => {
		const fileContent = `<!-- memo-id: parent, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
親メモ

<!-- memo-id: child, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: parent -->
## 2025-11-04 10:30
子メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! スレッドインデックスマネージャーのclearメソッドをスパイ。
		const clearSpy = jest.spyOn(memoManager.threadIndexManager, "clear")

		// ! 親メモを削除。
		await memoManager.deleteMemoWithDescendants("test.md", "work", "parent")

		// ! clearが呼ばれた。
		expect(clearSpy).toHaveBeenCalled()
	})

	test("複雑なツリー構造でもすべての子孫が削除される（v0.0.16: 親は削除マーカー）", async () => {
		const fileContent = `<!-- memo-id: root, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
ルート

<!-- memo-id: child1, timestamp: 2025-11-04T10:10:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:10
子1

<!-- memo-id: child2, timestamp: 2025-11-04T10:20:00+09:00, category: "work", parent-id: root -->
## 2025-11-04 10:20
子2

<!-- memo-id: grandchild1-1, timestamp: 2025-11-04T10:30:00+09:00, category: "work", parent-id: child1 -->
## 2025-11-04 10:30
孫1-1

<!-- memo-id: grandchild1-2, timestamp: 2025-11-04T10:40:00+09:00, category: "work", parent-id: child1 -->
## 2025-11-04 10:40
孫1-2

<!-- memo-id: grandchild2-1, timestamp: 2025-11-04T10:50:00+09:00, category: "work", parent-id: child2 -->
## 2025-11-04 10:50
孫2-1

<!-- memo-id: other, timestamp: 2025-11-04T11:00:00+09:00, category: "work" -->
## 2025-11-04 11:00
別のメモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! ルートメモを削除。
		await memoManager.deleteMemoWithDescendants("test.md", "work", "root")

		// ! 書き込まれた内容を確認。
		const writtenContent = (app.vault.modify.mock.calls[0] as unknown[])[1] as string

		// ! v0.0.16: ルートメモは削除マーカーに変換され、子孫は完全削除される。
		expect(writtenContent).toContain("memo-id: root")
		expect(writtenContent).toContain("permanently-deleted: \"true\"")
		expect(writtenContent).not.toContain("memo-id: child1")
		expect(writtenContent).not.toContain("memo-id: child2")
		expect(writtenContent).not.toContain("memo-id: grandchild1-1")
		expect(writtenContent).not.toContain("memo-id: grandchild1-2")
		expect(writtenContent).not.toContain("memo-id: grandchild2-1")

		// ! 別のメモは残っている。
		expect(writtenContent).toContain("memo-id: other")
		expect(writtenContent).toContain("別のメモ")
	})

	test("削除対象のメモが存在しない場合はfalseを返す", async () => {
		const fileContent = `<!-- memo-id: existing, timestamp: 2025-11-04T10:00:00+09:00, category: "work" -->
## 2025-11-04 10:00
既存メモ
`
		app.vault.read.mockResolvedValue(fileContent)

		// ! 存在しないメモを削除しようとする。
		const result = await memoManager.deleteMemoWithDescendants(
			"test.md",
			"work",
			"non-existent",
		)

		// ! falseが返される。
		expect(result).toBe(false)
	})
})
