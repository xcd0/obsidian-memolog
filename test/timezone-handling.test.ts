import { App, TFile } from "obsidian"
import { MemoManager } from "../src/core/memo-manager"

// ! タイムゾーン処理のテスト。
// !
// ! 仕様:
// ! 1. 新規投稿時: 投稿者のローカルタイムゾーンに合わせたタイムスタンプを保存
// ! 2. 表示時: 表示しているユーザーのローカルタイムゾーンでフィルタリング

// ! TFileのモック作成ヘルパー。
const createMockTFile = (path: string): TFile => {
	return Object.create(TFile.prototype, {
		path: { value: path },
	}) as TFile
}

describe("タイムゾーン処理", () => {
	let mockApp: App
	let memoManager: MemoManager
	const filePath = "memolog/work/2025-10-31.md"

	beforeEach(() => {
		// ! vault APIのモック作成。
		const mockRead = jest.fn()
		const mockWrite = jest.fn()
		const mockModify = jest.fn()
		const mockGetAbstractFileByPath = jest.fn()
		const mockStat = jest.fn()

		mockApp = {
			vault: {
				read: mockRead,
				modify: mockModify,
				getAbstractFileByPath: mockGetAbstractFileByPath,
				adapter: {
					exists: jest.fn(),
					read: jest.fn(),
					write: mockWrite,
					remove: jest.fn(),
					list: jest.fn(),
					stat: mockStat,
				},
			},
		} as unknown as App

		// ! TFileのモックを作成。
		const mockFile = createMockTFile(filePath)
		mockGetAbstractFileByPath.mockReturnValue(mockFile)

		// ! ファイルのstatを返す。
		mockStat.mockResolvedValue({
			mtime: Date.now(),
			ctime: Date.now(),
			size: 0,
		})

		// ! 空のファイルとして初期化。
		mockRead.mockResolvedValue("")

		memoManager = new MemoManager(mockApp) // ! ファイルが存在すると仮定。
		;(mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(true)
		;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue("")
	})

	describe("新規投稿時のタイムスタンプ", () => {
		it("【新仕様】新規投稿がISO 8601形式(タイムゾーンオフセット付き)で保存されること", async () => {
			// ! シナリオ:
			// ! - ユーザーA (GMT+9、日本) が 2025-10-31 14:30:00 JST に投稿
			// !
			// ! 期待される動作:
			// ! - タイムスタンプは ISO 8601 形式でタイムゾーンオフセット付きで保存される
			// ! - 旧形式: 2025-10-31T05:30:00.000Z (UTC形式、Z終端)
			// ! - 新形式: 2025-10-31T14:30:00.000+09:00 (タイムゾーンオフセット付き)
			// !
			// ! これにより:
			// ! - 投稿者がどのタイムゾーンで投稿したかが分かる (+09:00)
			// ! - ローカル時刻が直接分かる (14:30)
			// ! - UTC時刻への変換も可能 (JavaScriptが自動変換)

			// ! モックの現在時刻を設定（テスト実行時の実際の時刻を使用）。
			const now = new Date()
			const localTimeStr = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
			console.log("=== 新規投稿テスト (ISO形式、タイムゾーンオフセット付き) ===")
			console.log("テスト実行時刻 (ローカル):", localTimeStr)
			console.log("テスト実行時刻 (UTC):", now.toISOString())

			// ! タイムゾーンオフセットを取得 (分単位)。
			const offsetMinutes = -now.getTimezoneOffset() // ! 日本は-540分 -> +540分 = +9時間。
			const offsetHours = Math.floor(offsetMinutes / 60)
			const offsetMins = Math.abs(offsetMinutes % 60)
			const offsetStr = `${offsetHours >= 0 ? "+" : ""}${String(offsetHours).padStart(2, "0")}:${
				String(offsetMins).padStart(2, "0")
			}`
			console.log("タイムゾーンオフセット:", offsetStr)

			// ! メモを追加。
			await memoManager.addMemo(filePath, "work", "テストメモ", "asc")

			// ! vault.modifyが呼ばれたことを確認。
			// eslint-disable-next-line @typescript-eslint/unbound-method
			const modifyMock = mockApp.vault.modify as jest.Mock<Promise<void>, [unknown, string]>
			expect(modifyMock.mock.calls.length).toBeGreaterThan(0)

			// ! 保存されたコンテンツを取得。
			const savedContent = modifyMock.mock.calls[0][1]
			console.log("保存されたコンテンツ:", savedContent)

			// ! タイムスタンプを抽出。
			const timestampMatch = savedContent.match(/timestamp: ([^,]+),/)
			expect(timestampMatch).not.toBeNull()

			if (!timestampMatch) throw new Error("Timestamp not found")
			const savedTimestamp = timestampMatch[1]
			console.log("保存されたタイムスタンプ:", savedTimestamp)

			// ! 【新仕様】タイムゾーンオフセット付きのISO 8601形式であることを確認。
			// ! 形式: 2025-10-31T14:30:00.000+09:00 (末尾が +09:00 など)
			expect(savedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/)

			// ! 【新仕様の検証】タイムゾーンオフセットが含まれていることを確認。
			if (offsetStr !== "+00:00") {
				// ! UTC以外のタイムゾーンの場合、オフセットが含まれるべき。
				expect(savedTimestamp).toContain(offsetStr)
				console.log("✓ タイムゾーンオフセットが含まれています:", offsetStr)
			} else {
				// ! UTCタイムゾーンの場合、+00:00が含まれるべき。
				expect(savedTimestamp).toContain("+00:00")
				console.log("✓ UTCタイムゾーンオフセットが含まれています: +00:00")
			}

			// ! 保存されたタイムスタンプをDateオブジェクトに変換。
			const savedDate = new Date(savedTimestamp)
			const savedLocalTime = savedDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
			console.log("保存されたタイムスタンプ (ローカル):", savedLocalTime)

			// ! 現在時刻との差が数秒以内であることを確認（投稿時刻として妥当）。
			const timeDiff = Math.abs(savedDate.getTime() - now.getTime())
			expect(timeDiff).toBeLessThan(5000) // ! 5秒以内。

			console.log("✓ ISO 8601形式(タイムゾーンオフセット付き)で保存されています")
		})

		it("【新仕様】新規投稿がUTC形式(Z終端)ではないことを確認", async () => {
			// ! シナリオ:
			// ! - 旧形式(UTC形式、Z終端)で保存されないことを確認する
			// !
			// ! 期待される動作:
			// ! - タイムスタンプは Z で終わらない (UTC形式ではない)
			// ! - タイムゾーンオフセット(+09:00など)で終わる

			console.log("=== 新規投稿テスト (UTC形式でないことを確認) ===")

			// ! メモを追加。
			await memoManager.addMemo(filePath, "work", "テストメモ", "asc")

			// ! vault.modifyが呼ばれたことを確認。
			// eslint-disable-next-line @typescript-eslint/unbound-method
			const modifyMock = mockApp.vault.modify as jest.Mock<Promise<void>, [unknown, string]>
			expect(modifyMock.mock.calls.length).toBeGreaterThan(0)

			// ! 保存されたコンテンツを取得。
			const savedContent = modifyMock.mock.calls[0][1]

			// ! タイムスタンプを抽出。
			const timestampMatch = savedContent.match(/timestamp: ([^,]+),/)
			expect(timestampMatch).not.toBeNull()

			if (!timestampMatch) throw new Error("Timestamp not found")
			const savedTimestamp = timestampMatch[1]
			console.log("保存されたタイムスタンプ:", savedTimestamp)

			// ! 【新仕様の検証】UTC形式(Z終端)ではないことを確認。
			expect(savedTimestamp).not.toMatch(/Z$/)
			console.log("✓ UTC形式(Z終端)ではありません")

			// ! タイムゾーンオフセットで終わることを確認。
			expect(savedTimestamp).toMatch(/[+-]\d{2}:\d{2}$/)
			console.log("✓ タイムゾーンオフセット形式で終わっています")
		})

		it("異なるタイムゾーンのユーザーが同時刻に投稿した場合、異なるUTC時刻が保存されること", () => {
			// ! シナリオ:
			// ! - ユーザーA (GMT+9) が 2025-10-31 14:30:00 JST に投稿
			// !   -> UTC: 2025-10-31 05:30:00 UTC
			// ! - ユーザーB (GMT+0) が 2025-10-31 14:30:00 GMT に投稿
			// !   -> UTC: 2025-10-31 14:30:00 UTC
			// !
			// ! 期待される動作:
			// ! - 両方とも「14:30に投稿した」という事実が保持される
			// ! - UTC時刻としては9時間の差がある

			// ! ユーザーAの投稿（GMT+9）。
			const userALocalTime = new Date("2025-10-31T14:30:00+09:00")
			const userAUtcTime = userALocalTime.toISOString()

			console.log("=== 異なるタイムゾーンのユーザーテスト ===")
			console.log("ユーザーA (GMT+9):")
			console.log("  ローカル時刻: 2025-10-31 14:30:00 JST")
			console.log("  UTC時刻:", userAUtcTime)

			// ! ユーザーBの投稿（GMT+0）。
			const userBLocalTime = new Date("2025-10-31T14:30:00Z")
			const userBUtcTime = userBLocalTime.toISOString()

			console.log("ユーザーB (GMT+0):")
			console.log("  ローカル時刻: 2025-10-31 14:30:00 GMT")
			console.log("  UTC時刻:", userBUtcTime)

			// ! UTC時刻が9時間異なることを確認。
			const timeDiff = userBLocalTime.getTime() - userALocalTime.getTime()
			const hoursDiff = timeDiff / (1000 * 60 * 60)
			expect(hoursDiff).toBe(9)

			console.log("時差:", hoursDiff, "時間")

			// ! 【重要な仕様】
			// ! - 各ユーザーは自分のローカル時刻で投稿する
			// ! - タイムスタンプはUTC形式で保存されるが、投稿者のローカル時刻が反映される
			// ! - これにより、各ユーザーが「いつ投稿したか」という情報が正確に保持される
		})
	})

	describe("表示時のフィルタリング", () => {
		it("【仕様2】表示ユーザーのローカルタイムゾーンでフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - GMT+9のユーザーAが 2025-10-29 08:45 JST に投稿
			// !   -> UTC: 2025-10-28 23:45 UTC
			// ! - GMT+9のユーザーBが「10/29のメモ」を見る
			// !
			// ! 期待される動作:
			// ! - ユーザーBのローカルタイムゾーン (GMT+9) で10/29のメモとして表示される
			// ! - UTC時刻が10/28であっても、ローカル時刻が10/29なら表示される

			// ! テストデータ: 2025-10-28T23:45:37.050Z (UTC) = 2025-10-29 08:45 (JST)。
			const testMemoContent =
				`<!-- memo-id: test-id-1, timestamp: 2025-10-28T23:45:37.050Z, category: "work", template: "{{content}}" -->
テストメモ（10/29朝）
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(testMemoContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(testMemoContent)

			// ! メモを取得。
			const allMemos = await memoManager.getMemos(filePath, "work")
			expect(allMemos).toHaveLength(1)

			const memo = allMemos[0]
			console.log("=== 表示時のフィルタリングテスト ===")
			console.log("メモのUTC時刻:", memo.timestamp)

			// ! メモのローカル時刻を計算（GMT+9）。
			const memoDate = new Date(memo.timestamp)
			const memoLocalTime = memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
			console.log("メモのローカル時刻 (GMT+9):", memoLocalTime)

			// ! ユーザーBが「10/29のメモ」を見る場合のフィルター範囲。
			// ! GMT+9での10/29 00:00〜23:59 を UTC時刻で表現。
			const startDate = new Date("2025-10-29T00:00:00.000+09:00") // ! GMT+9の10/29 00:00 = UTC 10/28 15:00。
			const endDate = new Date("2025-10-29T23:59:59.999+09:00") // ! GMT+9の10/29 23:59 = UTC 10/29 14:59。

			console.log("フィルター範囲 (ローカル):")
			console.log("  開始:", startDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
			console.log("  終了:", endDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
			console.log("フィルター範囲 (UTC):")
			console.log("  開始:", startDate.toISOString())
			console.log("  終了:", endDate.toISOString())

			// ! フィルタリング。
			const isInRange = memoDate >= startDate && memoDate <= endDate
			console.log("メモがフィルター範囲内か:", isInRange)

			// ! 【期待される動作】
			// ! - ユーザーBのローカルタイムゾーン (GMT+9) で10/29として表示される
			expect(isInRange).toBe(true)
		})

		it("異なるタイムゾーンのユーザーが同じメモを見た場合、異なる日付として表示される可能性があること", () => {
			// ! シナリオ:
			// ! - GMT+9のユーザーAが 2025-10-29 00:30 JST に投稿
			// !   -> UTC: 2025-10-28 15:30 UTC
			// ! - GMT+9のユーザーBが見る: 10/29のメモとして表示
			// ! - GMT-8のユーザーCが見る: 10/28のメモとして表示
			// !
			// ! 期待される動作:
			// ! - 各ユーザーは自分のローカルタイムゾーンで日付を判断する
			// ! - 同じメモでも、表示されるユーザーのタイムゾーンによって「今日」かどうかが変わる

			// ! テストデータ: 2025-10-28T15:30:00.000Z (UTC)。
			const testTimestamp = "2025-10-28T15:30:00.000Z"
			const utcDate = new Date(testTimestamp)

			console.log("=== 異なるタイムゾーンでの表示テスト ===")
			console.log("UTC時刻:", testTimestamp)

			// ! GMT+9 (日本) での表示。
			const jstTime = utcDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
			console.log("GMT+9での表示:", jstTime)

			// ! GMT-8 (太平洋時間) での表示。
			const pstTime = utcDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
			console.log("GMT-8での表示:", pstTime)

			// ! 日付のみを抽出。
			const jstDateOnly = utcDate
				.toLocaleString("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })
				.split(",")[0]
			const pstDateOnly = utcDate
				.toLocaleString("en-US", {
					timeZone: "America/Los_Angeles",
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
				})
				.split(",")[0]

			console.log("GMT+9での日付:", jstDateOnly) // ! 10/29/2025。
			console.log("GMT-8での日付:", pstDateOnly) // ! 10/28/2025。

			// ! 異なる日付として表示されることを確認。
			expect(jstDateOnly).not.toBe(pstDateOnly)

			// ! 【重要な仕様】
			// ! - タイムゾーンが異なるユーザーは、同じメモを異なる日付として見る可能性がある
			// ! - これは正常な動作であり、各ユーザーのローカルタイムゾーンが尊重される
		})

		it("「今日」フィルターは、表示ユーザーのローカルタイムゾーンの「今日」を基準とすること", async () => {
			// ! シナリオ:
			// ! - 現在時刻: 2025-10-31 02:00 JST (GMT+9)
			// !   -> UTC: 2025-10-30 17:00 UTC
			// ! - GMT+9のユーザーが「今日」フィルターを適用
			// ! - UTC時刻が10/30のメモでも、ローカル時刻が10/31なら表示される
			// !
			// ! 期待される動作:
			// ! - 「今日」= 表示ユーザーのローカルタイムゾーンでの今日
			// ! - UTC時刻ベースではなく、ローカル時刻ベースで判定

			// ! 現在時刻を設定（GMT+9の10/31 02:00）。
			const now = new Date("2025-10-31T02:00:00+09:00")
			console.log("=== 「今日」フィルターテスト ===")
			console.log("現在時刻 (GMT+9):", now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
			console.log("現在時刻 (UTC):", now.toISOString())

			// ! テストメモ: 2025-10-30T17:30:00.000Z (UTC) = 2025-10-31 02:30 JST。
			const testMemoContent =
				`<!-- memo-id: test-id-2, timestamp: 2025-10-30T17:30:00.000Z, category: "work", template: "{{content}}" -->
テストメモ（10/31深夜）
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(testMemoContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(testMemoContent)

			// ! メモを取得。
			const allMemos = await memoManager.getMemos(filePath, "work")
			expect(allMemos).toHaveLength(1)

			const memo = allMemos[0]
			const memoDate = new Date(memo.timestamp)
			const memoLocalTime = memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
			console.log("メモのローカル時刻 (GMT+9):", memoLocalTime)

			// ! 「今日」フィルターの範囲（ローカルタイムゾーン）。
			const startDate = new Date(now)
			startDate.setHours(0, 0, 0, 0) // ! 10/31 00:00 JST = 10/30 15:00 UTC。
			const endDate = new Date(now)
			endDate.setHours(23, 59, 59, 999) // ! 10/31 23:59 JST = 10/31 14:59 UTC。

			console.log("「今日」の範囲 (ローカル):")
			console.log("  開始:", startDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
			console.log("  終了:", endDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
			console.log("「今日」の範囲 (UTC):")
			console.log("  開始:", startDate.toISOString())
			console.log("  終了:", endDate.toISOString())

			// ! フィルタリング。
			const isInRange = memoDate >= startDate && memoDate <= endDate
			console.log("メモが「今日」の範囲内か:", isInRange)

			// ! 【期待される動作】
			// ! - UTC時刻が10/30でも、ローカル時刻が10/31なら「今日」として表示される
			expect(isInRange).toBe(true)

			// ! 【重要な仕様確認】
			// ! - `new Date().setHours(0, 0, 0, 0)` はローカルタイムゾーンの0時を設定する
			// ! - `new Date(utcTimestamp)` はUTC時刻として解釈される
			// ! - 両方をDateオブジェクトとして比較すると、内部ではUTCミリ秒で比較される
			// ! - つまり、ローカルタイムゾーンを考慮したフィルタリングが実現される
		})
	})

	describe("タイムゾーン変換の正確性", () => {
		it("夏時間 (DST) の切り替え時にも正確にフィルタリングできること", () => {
			// ! シナリオ:
			// ! - アメリカの夏時間切り替え時（3月第2日曜日、11月第1日曜日）
			// ! - 2025年3月9日 02:00に時計が3:00になる（1時間進む）
			// !
			// ! 期待される動作:
			// ! - 夏時間の切り替えがあっても、タイムスタンプは正確に保存される
			// ! - フィルタリングも正確に動作する

			// ! 夏時間切り替え前: 2025-03-09 01:30 PST (UTC-8) = 2025-03-09 09:30 UTC。
			const beforeDST = new Date("2025-03-09T09:30:00.000Z")
			const beforeDSTLocal = beforeDST.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })

			// ! 夏時間切り替え後: 2025-03-09 03:30 PDT (UTC-7) = 2025-03-09 10:30 UTC。
			const afterDST = new Date("2025-03-09T10:30:00.000Z")
			const afterDSTLocal = afterDST.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })

			console.log("=== 夏時間 (DST) テスト ===")
			console.log("切り替え前 (PST, UTC-8):")
			console.log("  UTC:", beforeDST.toISOString())
			console.log("  ローカル:", beforeDSTLocal)
			console.log("切り替え後 (PDT, UTC-7):")
			console.log("  UTC:", afterDST.toISOString())
			console.log("  ローカル:", afterDSTLocal)

			// ! 【重要な仕様】
			// ! - JavaScriptのDateオブジェクトは、ブラウザのタイムゾーン設定を自動的に考慮する
			// ! - 夏時間の切り替えも自動的に処理される
			// ! - タイムスタンプはUTC形式で保存されるため、夏時間の影響を受けない

			// ! 1時間の差があることを確認（実際の時間経過は1時間だが、ローカル時刻は2時間進んでいる）。
			const timeDiffMs = afterDST.getTime() - beforeDST.getTime()
			const timeDiffHours = timeDiffMs / (1000 * 60 * 60)
			expect(timeDiffHours).toBe(1)

			console.log("実際の時間経過:", timeDiffHours, "時間")
		})

		it("異なる日付表記形式でも正確にパースできること", () => {
			// ! シナリオ:
			// ! - ISO 8601形式のタイムスタンプが正確にパースされる
			// ! - タイムゾーンオフセット付き、なし、両方とも正確に扱える
			// !
			// ! 期待される動作:
			// ! - "2025-10-31T14:30:00.000Z" (UTC)
			// ! - "2025-10-31T14:30:00+09:00" (GMT+9)
			// ! - 両方とも正確にDateオブジェクトに変換される

			const utcFormat = "2025-10-31T14:30:00.000Z"
			const jstFormat = "2025-10-31T14:30:00+09:00"

			const utcDate = new Date(utcFormat)
			const jstDate = new Date(jstFormat)

			console.log("=== 日付表記形式テスト ===")
			console.log("UTC形式:", utcFormat)
			console.log("  パース結果 (UTC):", utcDate.toISOString())
			console.log("JST形式:", jstFormat)
			console.log("  パース結果 (UTC):", jstDate.toISOString())

			// ! タイムゾーンオフセットを考慮して、両方とも正確にパースされることを確認。
			const timeDiffHours = (utcDate.getTime() - jstDate.getTime()) / (1000 * 60 * 60)
			expect(timeDiffHours).toBe(9) // ! 9時間の差。

			console.log("時差:", timeDiffHours, "時間")

			// ! 【重要な仕様】
			// ! - ISO 8601形式はタイムゾーン情報を含むことができる
			// ! - JavaScriptは自動的にUTCに変換して内部保持する
			// ! - これにより、異なるタイムゾーンのタイムスタンプを正確に比較できる
		})
	})

	describe("後方互換性: UTC形式(Z終端)のタイムスタンプ", () => {
		it("【互換性】UTC形式のタイムスタンプを適切に解析できること", async () => {
			// ! シナリオ:
			// ! - 旧形式(UTC形式、Z終端)で保存されたメモを読み込む
			// ! - 2025-10-28T23:45:37.050Z (UTC) = 2025-10-29 08:45:37 (JST)
			// !
			// ! 期待される動作:
			// ! - UTC形式のタイムスタンプが正確にパースされる
			// ! - 表示ユーザーのローカルタイムゾーンでフィルタリングされる

			console.log("=== UTC形式の互換性テスト ===")

			// ! 旧形式のメモデータ。
			const utcMemoContent =
				`<!-- memo-id: test-utc-1, timestamp: 2025-10-28T23:45:37.050Z, category: "work", template: "{{content}}" -->
テストメモ（UTC形式）
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(utcMemoContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(utcMemoContent)

			// ! メモを取得。
			const allMemos = await memoManager.getMemos(filePath, "work")
			expect(allMemos).toHaveLength(1)

			const memo = allMemos[0]
			console.log("UTC形式のタイムスタンプ:", memo.timestamp)

			// ! メモのローカル時刻を計算（GMT+9）。
			const memoDate = new Date(memo.timestamp)
			const memoLocalTime = memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
			console.log("ローカル時刻 (GMT+9):", memoLocalTime)

			// ! 【期待される動作】UTC形式でもDateオブジェクトとして正確にパースされる。
			expect(memoDate.getTime()).toBe(new Date("2025-10-28T23:45:37.050Z").getTime())

			// ! 10/29の「今日」フィルターで表示されることを確認。
			// ! GMT+9での10/29 00:00〜23:59 を UTC時刻で表現。
			const startDate = new Date("2025-10-29T00:00:00.000+09:00")
			const endDate = new Date("2025-10-29T23:59:59.999+09:00")

			const isInRange = memoDate >= startDate && memoDate <= endDate
			console.log("10/29の「今日」フィルターで表示されるか:", isInRange)

			expect(isInRange).toBe(true)
		})

		it("【互換性】UTC形式のメモが「今日」フィルターで正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - 複数のUTC形式メモ（今日、昨日、明日）を用意
			// ! - 「今日」フィルターを適用
			// !
			// ! 期待される動作:
			// ! - 今日のメモのみが表示される

			console.log("=== UTC形式の「今日」フィルターテスト ===")

			const now = new Date()
			const yesterday = new Date(now)
			yesterday.setDate(now.getDate() - 1)
			const tomorrow = new Date(now)
			tomorrow.setDate(now.getDate() + 1)

			// ! UTC形式のメモデータ。
			const utcMemosContent =
				`<!-- memo-id: test-utc-yesterday, timestamp: ${yesterday.toISOString()}, category: "work" -->
昨日のメモ（UTC形式）

<!-- memo-id: test-utc-today, timestamp: ${now.toISOString()}, category: "work" -->
今日のメモ（UTC形式）

<!-- memo-id: test-utc-tomorrow, timestamp: ${tomorrow.toISOString()}, category: "work" -->
明日のメモ（UTC形式）
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(utcMemosContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(utcMemosContent)

			// ! メモを取得。
			const allMemos = await memoManager.getMemos(filePath, "work")
			console.log("全メモ数:", allMemos.length)
			expect(allMemos).toHaveLength(3)

			// ! 「今日」フィルター。
			const startDate = new Date()
			startDate.setHours(0, 0, 0, 0)
			const endDate = new Date()
			endDate.setHours(23, 59, 59, 999)

			const todayMemos = allMemos.filter(memo => {
				const memoDate = new Date(memo.timestamp)
				return memoDate >= startDate && memoDate <= endDate
			})

			console.log("今日のメモ数:", todayMemos.length)
			console.log("今日のメモID:", todayMemos.map(m => m.id))

			// ! 今日のメモのみが表示される。
			expect(todayMemos).toHaveLength(1)
			expect(todayMemos[0].id).toBe("test-utc-today")
		})

		it("【互換性】UTC形式のメモが「一週間」フィルターで正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - 複数のUTC形式メモ（8日前、6日前、3日前、今日）を用意
			// ! - 「一週間」フィルターを適用（過去7日間）
			// !
			// ! 期待される動作:
			// ! - 過去7日間のメモのみが表示される（8日前のメモは除外）

			console.log("=== UTC形式の「一週間」フィルターテスト ===")

			const now = new Date()
			const eightDaysAgo = new Date(now)
			eightDaysAgo.setDate(now.getDate() - 8)
			const sixDaysAgo = new Date(now)
			sixDaysAgo.setDate(now.getDate() - 6)
			const threeDaysAgo = new Date(now)
			threeDaysAgo.setDate(now.getDate() - 3)

			// ! UTC形式のメモデータ。
			const utcMemosContent = `<!-- memo-id: test-utc-8days, timestamp: ${eightDaysAgo.toISOString()}, category: "work" -->
8日前のメモ（UTC形式）

<!-- memo-id: test-utc-6days, timestamp: ${sixDaysAgo.toISOString()}, category: "work" -->
6日前のメモ（UTC形式）

<!-- memo-id: test-utc-3days, timestamp: ${threeDaysAgo.toISOString()}, category: "work" -->
3日前のメモ（UTC形式）

<!-- memo-id: test-utc-today-week, timestamp: ${now.toISOString()}, category: "work" -->
今日のメモ（UTC形式）
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(utcMemosContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(utcMemosContent)

			// ! メモを取得。
			const allMemos = await memoManager.getMemos(filePath, "work")
			console.log("全メモ数:", allMemos.length)
			expect(allMemos).toHaveLength(4)

			// ! 「一週間」フィルター（過去7日間）。
			const startDate = new Date()
			startDate.setDate(now.getDate() - 7)
			startDate.setHours(0, 0, 0, 0)
			const endDate = new Date()
			endDate.setHours(23, 59, 59, 999)

			const weekMemos = allMemos.filter(memo => {
				const memoDate = new Date(memo.timestamp)
				return memoDate >= startDate && memoDate <= endDate
			})

			console.log("一週間のメモ数:", weekMemos.length)
			console.log("一週間のメモID:", weekMemos.map(m => m.id))

			// ! 過去7日間のメモのみが表示される（8日前のメモは除外）。
			expect(weekMemos).toHaveLength(3)
			expect(weekMemos.map(m => m.id)).toEqual(["test-utc-6days", "test-utc-3days", "test-utc-today-week"])
		})

		it("【エッジケース】UTC形式のメモが日付の境界（0:00:00）付近で正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - 今日の0:00:00、昨日の23:59:59、今日の23:59:59のメモを用意
			// ! - 「今日」フィルターを適用
			// !
			// ! 期待される動作:
			// ! - 今日の範囲内のメモのみが表示される

			console.log("=== UTC形式の境界値テスト ===")

			// ! 今日の0:00:00。
			const todayStart = new Date()
			todayStart.setHours(0, 0, 0, 0)

			// ! 昨日の23:59:59.999。
			const yesterdayEnd = new Date(todayStart)
			yesterdayEnd.setTime(todayStart.getTime() - 1)

			// ! 今日の23:59:59.999。
			const todayEnd = new Date()
			todayEnd.setHours(23, 59, 59, 999)

			// ! 明日の0:00:00。
			const tomorrowStart = new Date(todayEnd)
			tomorrowStart.setTime(todayEnd.getTime() + 1)

			// ! UTC形式のメモデータ。
			const utcMemosContent =
				`<!-- memo-id: test-utc-yesterday-end, timestamp: ${yesterdayEnd.toISOString()}, category: "work" -->
昨日の最後（UTC形式）

<!-- memo-id: test-utc-today-start, timestamp: ${todayStart.toISOString()}, category: "work" -->
今日の最初（UTC形式）

<!-- memo-id: test-utc-today-end, timestamp: ${todayEnd.toISOString()}, category: "work" -->
今日の最後（UTC形式）

<!-- memo-id: test-utc-tomorrow-start, timestamp: ${tomorrowStart.toISOString()}, category: "work" -->
明日の最初（UTC形式）
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(utcMemosContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(utcMemosContent)

			// ! メモを取得。
			const allMemos = await memoManager.getMemos(filePath, "work")
			console.log("全メモ数:", allMemos.length)
			expect(allMemos).toHaveLength(4)

			// ! 「今日」フィルター。
			const startDate = new Date()
			startDate.setHours(0, 0, 0, 0)
			const endDate = new Date()
			endDate.setHours(23, 59, 59, 999)

			const todayMemos = allMemos.filter(memo => {
				const memoDate = new Date(memo.timestamp)
				return memoDate >= startDate && memoDate <= endDate
			})

			console.log("今日のメモ数:", todayMemos.length)
			console.log("今日のメモID:", todayMemos.map(m => m.id))

			// ! 今日の範囲内のメモのみが表示される。
			expect(todayMemos).toHaveLength(2)
			expect(todayMemos.map(m => m.id)).toEqual(["test-utc-today-start", "test-utc-today-end"])
		})

		it("【エッジケース】UTC形式のメモが月の境界を跨ぐ場合でも正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - 2025-10-31T23:59:59.999Z (UTC) = 2025-11-01 08:59:59 (JST)
			// ! - 2025-11-01T00:00:00.000Z (UTC) = 2025-11-01 09:00:00 (JST)
			// !
			// ! 期待される動作:
			// ! - どちらも11/1のメモとしてフィルタリングされる（JST基準）

			console.log("=== UTC形式の月境界テスト ===")

			// ! 10/31の23:59:59.999 (UTC) = 11/1の8:59:59 (JST)。
			const oct31End = new Date("2025-10-31T23:59:59.999Z")
			// ! 11/1の0:00:00 (UTC) = 11/1の9:00:00 (JST)。
			const nov1Start = new Date("2025-11-01T00:00:00.000Z")

			const utcMemosContent = `<!-- memo-id: test-utc-oct31-end, timestamp: ${oct31End.toISOString()}, category: "work" -->
10/31最後のメモ（UTC形式）

<!-- memo-id: test-utc-nov1-start, timestamp: ${nov1Start.toISOString()}, category: "work" -->
11/1最初のメモ（UTC形式）
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(utcMemosContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(utcMemosContent)

			const allMemos = await memoManager.getMemos(filePath, "work")
			expect(allMemos).toHaveLength(2)

			// ! 11/1の「今日」フィルター（JST基準）。
			// ! GMT+9での11/1 00:00〜23:59 を UTC時刻で表現。
			const startDate = new Date("2025-11-01T00:00:00.000+09:00") // ! 2025-11-01 00:00:00 JST = 2025-10-31 15:00:00 UTC。
			const endDate = new Date("2025-11-01T23:59:59.999+09:00") // ! 2025-11-01 23:59:59 JST = 2025-11-01 14:59:59 UTC。

			console.log("フィルター範囲 (JST):")
			console.log("  開始:", startDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
			console.log("  終了:", endDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
			console.log("フィルター範囲 (UTC):")
			console.log("  開始:", startDate.toISOString())
			console.log("  終了:", endDate.toISOString())

			const nov1Memos = allMemos.filter(memo => {
				const memoDate = new Date(memo.timestamp)
				return memoDate >= startDate && memoDate <= endDate
			})

			console.log("11/1のメモ数:", nov1Memos.length)
			console.log("11/1のメモID:", nov1Memos.map(m => m.id))

			// ! どちらも11/1のメモとして表示される。
			expect(nov1Memos).toHaveLength(2)
			expect(nov1Memos.map(m => m.id)).toEqual(["test-utc-oct31-end", "test-utc-nov1-start"])
		})
	})

	describe("複数タイムゾーンのISO形式タイムスタンプ", () => {
		it("【ISO形式】GMT+9のタイムスタンプが正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - 2025-10-29T08:45:00.000+09:00 (JST) = 2025-10-28T23:45:00.000Z (UTC)
			// !
			// ! 期待される動作:
			// ! - JST基準で10/29のメモとして表示される

			console.log("=== GMT+9 ISO形式テスト ===")

			const jstMemoContent = `<!-- memo-id: test-iso-jst, timestamp: 2025-10-29T08:45:00.000+09:00, category: "work" -->
JSTメモ
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(jstMemoContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(jstMemoContent)

			const allMemos = await memoManager.getMemos(filePath, "work")
			expect(allMemos).toHaveLength(1)

			const memo = allMemos[0]
			console.log("JSTタイムスタンプ:", memo.timestamp)

			const memoDate = new Date(memo.timestamp)
			console.log("UTC時刻:", memoDate.toISOString())
			console.log("JST時刻:", memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))

			// ! 10/29の「今日」フィルター（JST基準）。
			// ! GMT+9での10/29 00:00〜23:59 を UTC時刻で表現。
			const startDate = new Date("2025-10-29T00:00:00.000+09:00")
			const endDate = new Date("2025-10-29T23:59:59.999+09:00")

			const isInRange = memoDate >= startDate && memoDate <= endDate
			console.log("10/29の「今日」フィルターで表示されるか:", isInRange)

			expect(isInRange).toBe(true)
		})

		it("【ISO形式】GMT-8のタイムスタンプが正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - 2025-10-28T08:45:00.000-08:00 (PST) = 2025-10-28T16:45:00.000Z (UTC) = 2025-10-29T01:45:00 (JST)
			// !
			// ! 期待される動作:
			// ! - JST基準で10/29のメモとして表示される

			console.log("=== GMT-8 ISO形式テスト ===")

			const pstMemoContent = `<!-- memo-id: test-iso-pst, timestamp: 2025-10-28T08:45:00.000-08:00, category: "work" -->
PSTメモ
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(pstMemoContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(pstMemoContent)

			const allMemos = await memoManager.getMemos(filePath, "work")
			expect(allMemos).toHaveLength(1)

			const memo = allMemos[0]
			console.log("PSTタイムスタンプ:", memo.timestamp)

			const memoDate = new Date(memo.timestamp)
			console.log("UTC時刻:", memoDate.toISOString())
			console.log("JST時刻:", memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))

			// ! 10/29の「今日」フィルター（JST基準）。
			// ! GMT+9での10/29 00:00〜23:59 を UTC時刻で表現。
			const startDate = new Date("2025-10-29T00:00:00.000+09:00")
			const endDate = new Date("2025-10-29T23:59:59.999+09:00")

			const isInRange = memoDate >= startDate && memoDate <= endDate
			console.log("10/29の「今日」フィルターで表示されるか:", isInRange)

			expect(isInRange).toBe(true)
		})

		it("【ISO形式】GMT+0のタイムスタンプが正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - 2025-10-28T23:45:00.000+00:00 (GMT) = 2025-10-28T23:45:00.000Z (UTC) = 2025-10-29T08:45:00 (JST)
			// !
			// ! 期待される動作:
			// ! - JST基準で10/29のメモとして表示される

			console.log("=== GMT+0 ISO形式テスト ===")

			const gmtMemoContent = `<!-- memo-id: test-iso-gmt, timestamp: 2025-10-28T23:45:00.000+00:00, category: "work" -->
GMTメモ
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(gmtMemoContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(gmtMemoContent)

			const allMemos = await memoManager.getMemos(filePath, "work")
			expect(allMemos).toHaveLength(1)

			const memo = allMemos[0]
			console.log("GMTタイムスタンプ:", memo.timestamp)

			const memoDate = new Date(memo.timestamp)
			console.log("UTC時刻:", memoDate.toISOString())
			console.log("JST時刻:", memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))

			// ! 10/29の「今日」フィルター（JST基準）。
			// ! GMT+9での10/29 00:00〜23:59 を UTC時刻で表現。
			const startDate = new Date("2025-10-29T00:00:00.000+09:00")
			const endDate = new Date("2025-10-29T23:59:59.999+09:00")

			const isInRange = memoDate >= startDate && memoDate <= endDate
			console.log("10/29の「今日」フィルターで表示されるか:", isInRange)

			expect(isInRange).toBe(true)
		})

		it("【ISO形式】複数タイムゾーンのメモを混在させて「今日」フィルターで正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - JST, PST, GMT, UTCの4つのタイムゾーンのメモを混在
			// ! - すべて同じ日(10/29 JST基準)に投稿されたメモ
			// !
			// ! 期待される動作:
			// ! - すべてのメモが10/29のメモとして表示される

			console.log("=== 複数タイムゾーン混在テスト ===")

			const mixedMemoContent =
				`<!-- memo-id: test-iso-jst-1, timestamp: 2025-10-29T08:00:00.000+09:00, category: "work" -->
JSTメモ(8:00)

<!-- memo-id: test-iso-pst-1, timestamp: 2025-10-28T16:00:00.000-08:00, category: "work" -->
PSTメモ(16:00) = JST 2025-10-29 09:00

<!-- memo-id: test-iso-gmt-1, timestamp: 2025-10-29T00:00:00.000+00:00, category: "work" -->
GMTメモ(0:00) = JST 2025-10-29 09:00

<!-- memo-id: test-iso-utc-1, timestamp: 2025-10-28T23:00:00.000Z, category: "work" -->
UTCメモ(23:00) = JST 2025-10-29 08:00
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(mixedMemoContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(mixedMemoContent)

			const allMemos = await memoManager.getMemos(filePath, "work")
			console.log("全メモ数:", allMemos.length)
			expect(allMemos).toHaveLength(4)

			// ! 各メモのJST時刻を表示。
			allMemos.forEach(memo => {
				const memoDate = new Date(memo.timestamp)
				const jstTime = memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
				console.log(`${memo.id}: ${memo.timestamp} -> JST: ${jstTime}`)
			})

			// ! 10/29の「今日」フィルター（JST基準）。
			// ! GMT+9での10/29 00:00〜23:59 を UTC時刻で表現。
			const startDate = new Date("2025-10-29T00:00:00.000+09:00")
			const endDate = new Date("2025-10-29T23:59:59.999+09:00")

			console.log("フィルター範囲 (JST):")
			console.log("  開始:", startDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))
			console.log("  終了:", endDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }))

			const todayMemos = allMemos.filter(memo => {
				const memoDate = new Date(memo.timestamp)
				return memoDate >= startDate && memoDate <= endDate
			})

			console.log("10/29のメモ数:", todayMemos.length)
			console.log("10/29のメモID:", todayMemos.map(m => m.id))

			// ! すべてのメモが10/29のメモとして表示される。
			expect(todayMemos).toHaveLength(4)
			expect(todayMemos.map(m => m.id)).toEqual([
				"test-iso-jst-1",
				"test-iso-pst-1",
				"test-iso-gmt-1",
				"test-iso-utc-1",
			])
		})

		it("【ISO形式】複数タイムゾーンのメモを混在させて「一週間」フィルターで正しくフィルタリングされること", async () => {
			// ! シナリオ:
			// ! - 8日前、6日前、3日前、今日のメモを複数タイムゾーンで作成
			// ! - 「一週間」フィルターを適用
			// !
			// ! 期待される動作:
			// ! - 過去7日間のメモのみが表示される

			console.log("=== 複数タイムゾーンの「一週間」フィルターテスト ===")

			const now = new Date()
			const eightDaysAgo = new Date(now)
			eightDaysAgo.setDate(now.getDate() - 8)
			const sixDaysAgo = new Date(now)
			sixDaysAgo.setDate(now.getDate() - 6)
			const threeDaysAgo = new Date(now)
			threeDaysAgo.setDate(now.getDate() - 3)

			// ! タイムゾーンオフセットを取得。
			const offsetMinutes = -now.getTimezoneOffset()
			const offsetHours = Math.floor(offsetMinutes / 60)
			const offsetMins = Math.abs(offsetMinutes % 60)
			const offsetStr = `${offsetHours >= 0 ? "+" : ""}${String(offsetHours).padStart(2, "0")}:${
				String(offsetMins).padStart(2, "0")
			}`

			// ! ローカルISO形式に変換するヘルパー。
			const toLocalISO = (date: Date): string => {
				const year = date.getFullYear()
				const month = String(date.getMonth() + 1).padStart(2, "0")
				const day = String(date.getDate()).padStart(2, "0")
				const hours = String(date.getHours()).padStart(2, "0")
				const minutes = String(date.getMinutes()).padStart(2, "0")
				const seconds = String(date.getSeconds()).padStart(2, "0")
				const ms = String(date.getMilliseconds()).padStart(3, "0")
				return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${offsetStr}`
			}

			const mixedMemoContent =
				`<!-- memo-id: test-iso-week-8days, timestamp: ${eightDaysAgo.toISOString()}, category: "work" -->
8日前のメモ（UTC形式）

<!-- memo-id: test-iso-week-6days, timestamp: ${toLocalISO(sixDaysAgo)}, category: "work" -->
6日前のメモ（ローカルISO形式）

<!-- memo-id: test-iso-week-3days, timestamp: ${threeDaysAgo.toISOString()}, category: "work" -->
3日前のメモ（UTC形式）

<!-- memo-id: test-iso-week-today, timestamp: ${toLocalISO(now)}, category: "work" -->
今日のメモ（ローカルISO形式）
`
			;(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(mixedMemoContent)
			;(mockApp.vault.read as jest.Mock).mockResolvedValue(mixedMemoContent)

			const allMemos = await memoManager.getMemos(filePath, "work")
			console.log("全メモ数:", allMemos.length)
			expect(allMemos).toHaveLength(4)

			// ! 「一週間」フィルター（過去7日間）。
			const startDate = new Date()
			startDate.setDate(now.getDate() - 7)
			startDate.setHours(0, 0, 0, 0)
			const endDate = new Date()
			endDate.setHours(23, 59, 59, 999)

			const weekMemos = allMemos.filter(memo => {
				const memoDate = new Date(memo.timestamp)
				return memoDate >= startDate && memoDate <= endDate
			})

			console.log("一週間のメモ数:", weekMemos.length)
			console.log("一週間のメモID:", weekMemos.map(m => m.id))

			// ! 過去7日間のメモのみが表示される（8日前のメモは除外）。
			expect(weekMemos).toHaveLength(3)
			expect(weekMemos.map(m => m.id)).toEqual([
				"test-iso-week-6days",
				"test-iso-week-3days",
				"test-iso-week-today",
			])
		})
	})
})
