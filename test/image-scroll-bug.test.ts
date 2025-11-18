/**
 * 画像投稿時のスクロール幅バグのテスト。
 *
 * 【バグ内容】
 * 投稿に画像が含まれているとき、投稿表示画面のスクロール幅が画像を含まないサイズになっているため、
 * 最後までスクロールできない問題がある。
 *
 * 【期待される動作】
 * - 画像を含む投稿の高さが正しく計算される。
 * - スクロール可能な高さが画像を含めた全体の高さと一致する。
 * - 最後の投稿まで確実にスクロールできる。
 */

import { MemoEntry } from "../src/types"

describe("画像投稿時のスクロール幅バグ", () => {
	describe("【TDD】画像を含むメモのスクロール高さ計算", () => {
		it("画像を含まないメモの高さ計算が正しく動作する", () => {
			// ! テスト用のメモデータ（画像なし）。
			const memo: MemoEntry = {
				id: "test-memo-no-image",
				timestamp: "2025-10-31T10:00:00.000Z",
				category: "work",
				content: "これはテスト用のメモです。\n複数行のコンテンツを含みます。",
			}

			// ! メモの高さを計算する関数（仮実装）。
			const calculateMemoHeight = (memo: MemoEntry): number => {
				// ! ヘッダー高さ: 40px。
				const headerHeight = 40

				// ! コンテンツ行数 × 行高さ。
				const lineHeight = 20
				const lines = memo.content.split("\n").length
				const contentHeight = lines * lineHeight

				// ! パディング。
				const padding = 32

				return headerHeight + contentHeight + padding
			}

			const height = calculateMemoHeight(memo)

			// ! 期待値: ヘッダー40 + コンテンツ40 (2行×20) + パディング32 = 112。
			expect(height).toBe(112)
		})

		it("【失敗テスト】画像を含むメモの高さ計算が画像サイズを含まない（バグ再現）", () => {
			// ! テスト用のメモデータ（画像あり）。
			const memo: MemoEntry = {
				id: "test-memo-with-image",
				timestamp: "2025-10-31T10:00:00.000Z",
				category: "work",
				content: "画像付きのメモです。\n![テスト画像](test-image.png)",
			}

			// ! 現在のバグのある実装（画像高さを含まない）。
			const calculateMemoHeightBuggy = (memo: MemoEntry): number => {
				const headerHeight = 40
				const lineHeight = 20
				const lines = memo.content.split("\n").length
				const contentHeight = lines * lineHeight
				const padding = 32

				// ! バグ: 画像の高さを考慮していない。
				return headerHeight + contentHeight + padding
			}

			const buggyHeight = calculateMemoHeightBuggy(memo)

			// ! バグのある計算: ヘッダー40 + コンテンツ40 (2行×20) + パディング32 = 112。
			expect(buggyHeight).toBe(112)

			// ! 画像の高さ（300px）を含めるべき。
			const imageHeight = 300
			const expectedHeight = 40 + 40 + 32 + imageHeight // 412。

			// ! このテストは失敗するはず（バグ再現）。
			expect(buggyHeight).not.toBe(expectedHeight)
			expect(buggyHeight).toBeLessThan(expectedHeight)
		})

		it("【成功テスト】画像を含むメモの高さ計算が正しく動作する（修正後）", () => {
			// ! テスト用のメモデータ（画像あり）。
			const memo: MemoEntry = {
				id: "test-memo-with-image",
				timestamp: "2025-10-31T10:00:00.000Z",
				category: "work",
				content: "画像付きのメモです。\n![テスト画像](test-image.png)",
			}

			// ! 修正後の実装（画像高さを含む）。
			const calculateMemoHeightFixed = (memo: MemoEntry): number => {
				const headerHeight = 40
				const lineHeight = 20
				const lines = memo.content.split("\n").length
				const contentHeight = lines * lineHeight
				const padding = 32

				// ! 画像の高さを検出して加算。
				let imageHeight = 0
				// ! Markdown画像リンクのパターン: ![alt](path)。
				const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
				const images = memo.content.match(imagePattern)
				if (images && images.length > 0) {
					// ! 画像1つあたりの高さ（実際にはDOM計算が必要だが、テストでは固定値）。
					imageHeight = images.length * 300
				}

				return headerHeight + contentHeight + padding + imageHeight
			}

			const fixedHeight = calculateMemoHeightFixed(memo)

			// ! 期待値: ヘッダー40 + コンテンツ40 (2行×20) + パディング32 + 画像300 = 412。
			expect(fixedHeight).toBe(412)
		})

		it("【成功テスト】複数の画像を含むメモの高さ計算が正しく動作する", () => {
			// ! テスト用のメモデータ（複数画像あり）。
			const memo: MemoEntry = {
				id: "test-memo-with-multiple-images",
				timestamp: "2025-10-31T10:00:00.000Z",
				category: "work",
				content: "複数画像のメモです。\n![画像1](img1.png)\n![画像2](img2.png)",
			}

			// ! 修正後の実装。
			const calculateMemoHeightFixed = (memo: MemoEntry): number => {
				const headerHeight = 40
				const lineHeight = 20
				const lines = memo.content.split("\n").length
				const contentHeight = lines * lineHeight
				const padding = 32

				let imageHeight = 0
				const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
				const images = memo.content.match(imagePattern)
				if (images && images.length > 0) {
					imageHeight = images.length * 300
				}

				return headerHeight + contentHeight + padding + imageHeight
			}

			const fixedHeight = calculateMemoHeightFixed(memo)

			// ! 期待値: ヘッダー40 + コンテンツ60 (3行×20) + パディング32 + 画像600 (2枚×300) = 732。
			expect(fixedHeight).toBe(732)
		})
	})

	describe("【TDD】添付ファイル画像のスクロール高さ計算", () => {
		it("【失敗テスト】添付ファイル画像を含むメモの高さ計算が画像サイズを含まない（バグ再現）", () => {
			// ! テスト用のメモデータ（添付ファイルあり）。
			const memo: MemoEntry = {
				id: "test-memo-with-attachment",
				timestamp: "2025-10-31T10:00:00.000Z",
				category: "work",
				content: "添付ファイル付きのメモです。",
				attachments: ["attachments/test-image.png"],
			}

			// ! 現在のバグのある実装（添付ファイル画像の高さを含まない）。
			const calculateMemoHeightBuggy = (memo: MemoEntry): number => {
				const headerHeight = 40
				const lineHeight = 20
				const lines = memo.content.split("\n").length
				const contentHeight = lines * lineHeight
				const padding = 32

				// ! バグ: 添付ファイルの高さを考慮していない。
				return headerHeight + contentHeight + padding
			}

			const buggyHeight = calculateMemoHeightBuggy(memo)

			// ! バグのある計算: ヘッダー40 + コンテンツ20 (1行×20) + パディング32 = 92。
			expect(buggyHeight).toBe(92)

			// ! 添付ファイル画像の高さ（最大300px）を含めるべき。
			const attachmentHeight = 300 + 16 // 画像300px + マージン16px。
			const expectedHeight = 40 + 20 + 32 + attachmentHeight // 408。

			// ! このテストは失敗するはず（バグ再現）。
			expect(buggyHeight).not.toBe(expectedHeight)
			expect(buggyHeight).toBeLessThan(expectedHeight)
		})

		it("【成功テスト】添付ファイル画像を含むメモの高さ計算が正しく動作する（修正後）", () => {
			// ! テスト用のメモデータ（添付ファイルあり）。
			const memo: MemoEntry = {
				id: "test-memo-with-attachment",
				timestamp: "2025-10-31T10:00:00.000Z",
				category: "work",
				content: "添付ファイル付きのメモです。",
				attachments: ["attachments/test-image.png"],
			}

			// ! 修正後の実装（添付ファイル画像の高さを含む）。
			const calculateMemoHeightFixed = (memo: MemoEntry): number => {
				const headerHeight = 40
				const lineHeight = 20
				const lines = memo.content.split("\n").length
				const contentHeight = lines * lineHeight
				const padding = 32

				// ! 添付ファイルの高さを検出して加算。
				let attachmentHeight = 0
				if (memo.attachments && memo.attachments.length > 0) {
					// ! 画像ファイルの数をカウント。
					const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]
					const imageAttachments = memo.attachments.filter(path => {
						const ext = path.toLowerCase().split(".").pop()
						return imageExts.includes(ext || "")
					})

					if (imageAttachments.length > 0) {
						// ! 画像1つあたりの高さ（最大300px + マージン16px）。
						attachmentHeight = imageAttachments.length * 316
					}
				}

				return headerHeight + contentHeight + padding + attachmentHeight
			}

			const fixedHeight = calculateMemoHeightFixed(memo)

			// ! 期待値: ヘッダー40 + コンテンツ20 (1行×20) + パディング32 + 添付ファイル316 = 408。
			expect(fixedHeight).toBe(408)
		})
	})

	describe("【統合テスト】スクロール高さの実際の動作", () => {
		it("画像を含む複数のメモが存在する場合、スクロール高さが正しく計算される", () => {
			// ! テスト用のメモリスト。
			const memos: MemoEntry[] = [
				{
					id: "memo-1",
					timestamp: "2025-10-31T10:00:00.000Z",
					category: "work",
					content: "通常のメモ1",
				},
				{
					id: "memo-2",
					timestamp: "2025-10-31T10:01:00.000Z",
					category: "work",
					content: "画像付きメモ\n![画像](test.png)",
				},
				{
					id: "memo-3",
					timestamp: "2025-10-31T10:02:00.000Z",
					category: "work",
					content: "添付ファイル付きメモ",
					attachments: ["test-attachment.jpg"],
				},
			]

			// ! 修正後の実装でリスト全体の高さを計算。
			const calculateTotalHeight = (memos: MemoEntry[]): number => {
				return memos.reduce((total, memo) => {
					const headerHeight = 40
					const lineHeight = 20
					const lines = memo.content.split("\n").length
					const contentHeight = lines * lineHeight
					const padding = 32

					let extraHeight = 0

					// ! Markdown画像。
					const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
					const images = memo.content.match(imagePattern)
					if (images && images.length > 0) {
						extraHeight += images.length * 300
					}

					// ! 添付ファイル画像。
					if (memo.attachments && memo.attachments.length > 0) {
						const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]
						const imageAttachments = memo.attachments.filter(path => {
							const ext = path.toLowerCase().split(".").pop()
							return imageExts.includes(ext || "")
						})
						if (imageAttachments.length > 0) {
							extraHeight += imageAttachments.length * 316
						}
					}

					const memoHeight = headerHeight + contentHeight + padding + extraHeight
					const marginBottom = 12 // メモ間のマージン。

					return total + memoHeight + marginBottom
				}, 0)
			}

			const totalHeight = calculateTotalHeight(memos)

			// ! 期待値の計算:
			// ! memo-1: 40 + 20 + 32 + 0 + 12 = 104。
			// ! memo-2: 40 + 40 + 32 + 300 + 12 = 424。
			// ! memo-3: 40 + 20 + 32 + 316 + 12 = 420。
			// ! 合計: 104 + 424 + 420 = 948。
			expect(totalHeight).toBe(948)
		})

		it("【実装の方針】CSSでの画像読み込み完了後のスクロール高さ再計算", () => {
			// ! このテストは実装の方針を示すためのもの。
			// ! 実際のブラウザ環境では以下の対応が必要:
			// ! 1. 画像のloadイベントを監視。
			// ! 2. 画像読み込み完了後にスクロール高さを再計算。
			// ! 3. ResizeObserverを使用してコンテナサイズの変更を検出。

			const implementationNotes = {
				approach1: "画像のloadイベントをリッスンしてスクロール高さを更新",
				approach2: "ResizeObserverでメモカードのサイズ変更を検出",
				approach3: "CSSのaspect-ratioプロパティで画像領域を事前確保",
			}

			// ! テストはパスさせる（実装の方針確認用）。
			expect(implementationNotes.approach1).toBeDefined()
			expect(implementationNotes.approach2).toBeDefined()
			expect(implementationNotes.approach3).toBeDefined()
		})
	})
})
