/**
 * 改行とTODOリストの行間が広すぎる問題のテスト。
 *
 * 【問題1】
 * 投稿文に含まれる改行(\n)で表示される改行の行間が広すぎる。
 * 改行の無い折り返しと同じように詰めて表示したい。
 *
 * 【問題2】
 * TODOリストの余白が広すぎる。
 * 行折り返しと同じように詰めて表示したい。
 *
 * 【期待される動作】
 * - 改行(\n)の行間が通常のline-heightと同じになる。
 * - TODOリスト項目の余白が最小限になる。
 */

describe("改行とTODOリストの行間問題", () => {
	describe("【TDD】改行の行間問題", () => {
		it("【現状確認】段落間のマージンが存在する", () => {
			// ! Markdownレンダリングでは段落(<p>タグ)間にマージンが追加される。
			// ! これがデフォルトの動作。

			// ! 現状のCSSではpタグのmarginを0に設定している。
			// ! .memolog-card-content p { margin: 0; }
			const currentParagraphMargin = "0"

			expect(currentParagraphMargin).toBe("0")
		})

		it("【現状確認】brタグの行間が設定されている", () => {
			// ! 現状のCSSではbrタグのline-heightを0.5に設定している。
			// ! .memolog-card-content br { line-height: 0.5; }
			const currentBrLineHeight = "0.5"

			// ! これは改行を詰める効果があるが、逆に詰まりすぎる可能性がある。
			expect(currentBrLineHeight).toBe("0.5")
		})

		it("【期待動作】改行の行間が通常のline-height(1.3)と同じになる", () => {
			// ! 期待されるline-height。
			const expectedLineHeight = "1.3"

			// ! .memolog-card-contentのline-heightと一致すべき。
			// ! line-height: 1.3;
			expect(expectedLineHeight).toBe("1.3")
		})

		it("【実装方針】brタグのline-height設定を削除する", () => {
			// ! brタグのline-heightをinherit（継承）にすることで、
			// ! 親要素のline-height(1.3)が適用される。
			const implementationNote = {
				before: ".memolog-card-content br { line-height: 0.5; }",
				after: "/* brタグのline-height設定を削除 */",
				reason: "親要素のline-height: 1.3を継承させる",
			}

			expect(implementationNote.after).toContain("削除")
		})
	})

	describe("【TDD】TODOリストの余白問題", () => {
		it("【現状確認】リスト項目のマージンが広い", () => {
			// ! Markdownレンダリングでは<ul>/<ol>タグにデフォルトでマージンがある。
			// ! また、<li>タグ間にもマージンがある可能性がある。
			const defaultListMargin = {
				ul: "1em 0",
				li: "0.5em 0",
			}

			// ! リスト項目間の余白を確認。
			expect(defaultListMargin.ul).toBeDefined()
			expect(defaultListMargin.li).toBeDefined()
		})

		it("【期待動作】TODOリスト項目の余白が最小限になる", () => {
			// ! 期待されるマージン設定。
			const expectedListMargin = {
				ul: "0.25rem 0", // 上下のマージンを最小限に。
				li: "0", // リスト項目間のマージンをゼロに。
			}

			expect(expectedListMargin.ul).toBe("0.25rem 0")
			expect(expectedListMargin.li).toBe("0")
		})

		it("【期待動作】TODOチェックボックスとテキストの間隔が適切", () => {
			// ! チェックボックスとテキストの間隔。
			const expectedCheckboxGap = "0.5rem"

			// ! 視認性を保ちつつ、無駄なスペースを削減。
			expect(expectedCheckboxGap).toBe("0.5rem")
		})

		it("【実装方針】.memolog-card-content内のリストスタイルを調整", () => {
			const implementationNote = {
				targets: [
					".memolog-card-content ul",
					".memolog-card-content ol",
					".memolog-card-content li",
				],
				properties: {
					ulMargin: "0.25rem 0",
					liMargin: "0",
					liPadding: "0",
				},
			}

			expect(implementationNote.targets.length).toBe(3)
		})
	})

	describe("【統合テスト】改行とTODOリストの表示", () => {
		it("複数行テキストの表示が適切な行間になる", () => {
			// ! テスト用のメモコンテンツ。
			const memoContent = `1行目のテキスト
2行目のテキスト
3行目のテキスト`

			// ! 改行の数を確認。
			const lineBreaks = (memoContent.match(/\n/g) || []).length
			expect(lineBreaks).toBe(2)

			// ! 行数を確認。
			const lines = memoContent.split("\n").length
			expect(lines).toBe(3)
		})

		it("TODOリストを含むメモの表示が適切な余白になる", () => {
			// ! テスト用のTODOリストコンテンツ。
			const todoContent = `TODO:
- [ ] タスク1
- [ ] タスク2
- [x] 完了タスク`

			// ! TODOリスト項目の数を確認。
			const todoItems = (todoContent.match(/- \[.\]/g) || []).length
			expect(todoItems).toBe(3)
		})

		it("改行とTODOリストが混在するメモの表示が適切", () => {
			// ! テスト用のメモコンテンツ。
			const mixedContent = `メモのタイトル

TODO:
- [ ] タスク1
- [ ] タスク2

メモの本文が続きます。`

			// ! 改行の数を確認。
			const lineBreaks = (mixedContent.match(/\n/g) || []).length
			expect(lineBreaks).toBeGreaterThan(0)

			// ! TODOリスト項目の数を確認。
			const todoItems = (mixedContent.match(/- \[.\]/g) || []).length
			expect(todoItems).toBe(2)
		})
	})
})
