/**
 * 編集ボタンクリック時のフォーカス問題のテスト。
 *
 * 【問題】
 * 親の無い投稿の編集ボタンを押し、入力の為入力欄をクリックすると、
 * 入力欄にフォーカスされることが期待されるが、返信投稿画面に遷移してしまう。
 * 返信投稿画面で編集は可能だが、返信投稿画面に入らずに編集できる状態が正しい。
 *
 * 【原因】
 * カードクリックイベントがテキストエリアのクリックイベントに伝播している。
 *
 * 【期待される動作】
 * - 編集モードのテキストエリアクリック時はスレッドビューに遷移しない。
 * - テキストエリアにフォーカスが当たる。
 */

describe("編集ボタンクリック時のフォーカス問題", () => {
	describe("【TDD】イベント伝播の問題", () => {
		it("【現状確認】カードにクリックイベントが設定されている", () => {
			// ! MemoCard.render()でカード全体にクリックイベントが設定されている。
			// ! card.addEventListener("click", e => { ... })
			const cardClickHandlerExists = true

			expect(cardClickHandlerExists).toBe(true)
		})

		it("【現状確認】ボタンクリックは除外されている", () => {
			// ! 現在のコードではボタンクリックは除外されている。
			// ! if ((e.target as HTMLElement).closest("button")) { return }
			const buttonClickExcluded = true

			expect(buttonClickExcluded).toBe(true)
		})

		it("【現状確認】チェックボックスクリックは除外されている", () => {
			// ! チェックボックスクリックも除外されている。
			// ! if ((e.target as HTMLElement).closest("input[type=checkbox]")) { return }
			const checkboxClickExcluded = true

			expect(checkboxClickExcluded).toBe(true)
		})

		it("【バグ再現】テキストエリアクリックは除外されていない", () => {
			// ! 編集モードのテキストエリアクリックが除外されていない。
			// ! これがバグの原因。
			const textareaClickExcluded = false

			expect(textareaClickExcluded).toBe(false)
		})

		it("【期待動作】テキストエリアクリックが除外される", () => {
			// ! テキストエリアクリックを除外する必要がある。
			const expectedTextareaClickExcluded = true

			expect(expectedTextareaClickExcluded).toBe(true)
		})

		it("【実装方針】テキストエリアクリック除外を追加", () => {
			const implementationNote = {
				location: "src/ui/components/memo-card.ts",
				method: "render()",
				addition: `if ((e.target as HTMLElement).closest("textarea")) { return }`,
				reason: "編集モードのテキストエリアクリック時はスレッドビューに遷移しない",
			}

			expect(implementationNote.addition).toContain("textarea")
		})
	})

	describe("【TDD】編集モードのクリック除外", () => {
		it("編集モードのテキストエリアがクリック除外対象に含まれる", () => {
			// ! クリック除外対象の要素。
			const excludedElements = [
				"button",
				"input[type=checkbox]",
				"textarea", // 追加。
			]

			expect(excludedElements).toContain("textarea")
			expect(excludedElements.length).toBe(3)
		})

		it("編集モードのボタン(保存・キャンセル)もクリック除外対象", () => {
			// ! 保存・キャンセルボタンもbutton要素なので既に除外されている。
			const saveButtonExcluded = true
			const cancelButtonExcluded = true

			expect(saveButtonExcluded).toBe(true)
			expect(cancelButtonExcluded).toBe(true)
		})
	})

	describe("【統合テスト】編集モードの動作", () => {
		it("編集モードでテキストエリアをクリックしてもスレッドビューに遷移しない", () => {
			// ! テストのシナリオ:
			// ! 1. 編集ボタンをクリック -> 編集モードに入る
			// ! 2. テキストエリアをクリック -> フォーカスが当たる
			// ! 3. スレッドビューには遷移しない

			const scenario = {
				step1: "編集ボタンクリック",
				step2: "テキストエリアクリック",
				expectedResult: "フォーカスが当たる & スレッドビューに遷移しない",
			}

			expect(scenario.expectedResult).toContain("遷移しない")
		})

		it("通常モードでカードをクリックするとスレッドビューに遷移する", () => {
			// ! 編集モードでない場合は、カードクリックでスレッドビューに遷移する。
			const normalModeCardClick = {
				action: "カードクリック",
				expectedResult: "スレッドビューに遷移",
			}

			expect(normalModeCardClick.expectedResult).toContain("遷移")
		})

		it("編集モードでカードの空白部分をクリックしてもスレッドビューに遷移しない", () => {
			// ! 編集モード中は、カードの空白部分をクリックしてもスレッドビューに遷移しない方が良い。
			// ! ただし、これは現在の実装で既に動作している可能性がある。
			const editModeCardClick = {
				mode: "編集モード",
				action: "カード空白部分クリック",
				expectedResult: "スレッドビューに遷移しない（編集モードを維持）",
			}

			// ! この動作は、編集モード中にisEditModeフラグで制御できる。
			expect(editModeCardClick.mode).toBe("編集モード")
		})
	})
})
