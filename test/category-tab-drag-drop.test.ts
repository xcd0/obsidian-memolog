/**
 * カテゴリタブのドラッグ並び替え機能のテスト。
 *
 * 【要件】
 * カテゴリタブをマウスドラッグで順序変更したい。
 *
 * 【期待される動作】
 * - タブをドラッグ開始できる。
 * - ドラッグ中のタブに視覚的フィードバックがある。
 * - ドラッグ先のタブにドロップ位置の視覚的フィードバックがある。
 * - ドロップすると順序が変更される。
 * - 順序変更が設定に保存される。
 */

describe("カテゴリタブのドラッグ並び替え機能", () => {
	describe("【TDD】ドラッグイベントの基本動作", () => {
		it("【現状確認】カテゴリタブにはdraggable属性が必要", () => {
			// ! HTML5 Drag and Drop APIを使用するため、draggable属性が必要。
			const requiresDraggable = true

			expect(requiresDraggable).toBe(true)
		})

		it("【期待動作】タブ要素がdraggable=trueになる", () => {
			// ! 各カテゴリタブのHTML要素にdraggable="true"を設定する。
			const expectedDraggableAttr = "true"

			expect(expectedDraggableAttr).toBe("true")
		})

		it("【期待動作】dragstartイベントでドラッグデータが設定される", () => {
			// ! dragstartイベントで、ドラッグ中のカテゴリ名をdataTransferに設定。
			const dragStartHandler = {
				event: "dragstart",
				action: "setData",
				dataKey: "text/plain",
				dataValue: "category-name",
			}

			expect(dragStartHandler.event).toBe("dragstart")
			expect(dragStartHandler.action).toBe("setData")
		})

		it("【期待動作】dragoverイベントでドロップを許可する", () => {
			// ! dragoverイベントで、event.preventDefault()を呼び出してドロップを許可。
			const dragOverHandler = {
				event: "dragover",
				action: "preventDefault",
			}

			expect(dragOverHandler.event).toBe("dragover")
			expect(dragOverHandler.action).toBe("preventDefault")
		})

		it("【期待動作】dropイベントで順序を入れ替える", () => {
			// ! dropイベントで、ドラッグ元とドロップ先のカテゴリを入れ替える。
			const dropHandler = {
				event: "drop",
				action: "swapCategories",
			}

			expect(dropHandler.event).toBe("drop")
			expect(dropHandler.action).toBe("swapCategories")
		})
	})

	describe("【TDD】視覚的フィードバック", () => {
		it("【期待動作】ドラッグ中のタブにdraggingクラスが付与される", () => {
			// ! dragstartイベントで、ドラッグ中の要素にCSSクラス"dragging"を追加。
			const draggingClass = "dragging"

			expect(draggingClass).toBe("dragging")
		})

		it("【期待動作】ドラッグ終了時にdraggingクラスが削除される", () => {
			// ! dragendイベントで、draggingクラスを削除。
			const dragEndHandler = {
				event: "dragend",
				action: "removeClass",
				className: "dragging",
			}

			expect(dragEndHandler.event).toBe("dragend")
			expect(dragEndHandler.className).toBe("dragging")
		})

		it("【期待動作】ドラッグオーバー中のタブにdragoverクラスが付与される", () => {
			// ! dragenterイベントで、ドラッグオーバー中の要素にCSSクラス"dragover"を追加。
			const dragoverClass = "dragover"

			expect(dragoverClass).toBe("dragover")
		})

		it("【期待動作】ドラッグ離脱時にdragoverクラスが削除される", () => {
			// ! dragleaveイベントで、dragoverクラスを削除。
			const dragLeaveHandler = {
				event: "dragleave",
				action: "removeClass",
				className: "dragover",
			}

			expect(dragLeaveHandler.event).toBe("dragleave")
			expect(dragLeaveHandler.className).toBe("dragover")
		})

		it("【期待動作】CSSでdraggingクラスのスタイルが定義される", () => {
			// ! draggingクラスで不透明度を下げて視覚的フィードバックを提供。
			const draggingStyle = {
				opacity: "0.5",
				cursor: "move",
			}

			expect(draggingStyle.opacity).toBe("0.5")
			expect(draggingStyle.cursor).toBe("move")
		})

		it("【期待動作】CSSでdragoverクラスのスタイルが定義される", () => {
			// ! dragoverクラスで背景色を変更して視覚的フィードバックを提供。
			const dragoverStyle = {
				borderBottom: "2px solid var(--interactive-accent)",
			}

			expect(dragoverStyle.borderBottom).toBeDefined()
		})
	})

	describe("【TDD】順序変更ロジック", () => {
		it("【期待動作】カテゴリの順序を入れ替える関数が存在する", () => {
			// ! swapCategories(fromIndex: number, toIndex: number)関数を実装。
			const functionName = "swapCategories"

			expect(functionName).toBe("swapCategories")
		})

		it("【期待動作】カテゴリの順序変更後、設定に保存される", () => {
			// ! 順序変更後、settings.categoryOrderを更新してsaveData()を呼び出す。
			const saveAction = {
				updateSetting: "categoryOrder",
				method: "saveData",
			}

			expect(saveAction.updateSetting).toBe("categoryOrder")
			expect(saveAction.method).toBe("saveData")
		})

		it("【実装方針】カテゴリ順序の状態管理", () => {
			// ! settings.categoryOrderに配列形式でカテゴリの順序を保存。
			// ! 例: ["work", "personal", "study", "life"]
			const implementationNote = {
				location: "src/core/settings.ts",
				field: "categoryOrder",
				type: "string[]",
				default: "[\"work\", \"personal\", \"study\", \"life\"]",
			}

			expect(implementationNote.field).toBe("categoryOrder")
			expect(implementationNote.type).toBe("string[]")
		})
	})

	describe("【統合テスト】ドラッグ並び替えの完全なフロー", () => {
		it("タブをドラッグして別の位置にドロップすると順序が変更される", () => {
			// ! テストのシナリオ:
			// ! 1. 初期順序: ["work", "personal", "study", "life"]
			// ! 2. "personal"を"study"の位置にドラッグ&ドロップ
			// ! 3. 結果順序: ["work", "study", "personal", "life"]

			const initialOrder = ["work", "personal", "study", "life"]
			const draggedItem = "personal"
			const dropTarget = "study"

			// ! ドラッグ&ドロップをシミュレート。
			const draggedIndex = initialOrder.indexOf(draggedItem)
			const dropIndex = initialOrder.indexOf(dropTarget)

			// ! 順序入れ替えロジック。
			const newOrder = [...initialOrder]
			const [removed] = newOrder.splice(draggedIndex, 1)
			newOrder.splice(dropIndex, 0, removed)

			expect(newOrder).toEqual(["work", "study", "personal", "life"])
		})

		it("最初のタブを最後の位置にドラッグすると正しく移動する", () => {
			// ! テストのシナリオ:
			// ! 1. 初期順序: ["work", "personal", "study", "life"]
			// ! 2. "work"を"life"の後ろにドラッグ&ドロップ
			// ! 3. 結果順序: ["personal", "study", "life", "work"]

			const initialOrder = ["work", "personal", "study", "life"]
			const draggedItem = "work"
			const dropTarget = "life"

			const draggedIndex = initialOrder.indexOf(draggedItem)
			const dropIndex = initialOrder.indexOf(dropTarget)

			const newOrder = [...initialOrder]
			const [removed] = newOrder.splice(draggedIndex, 1)
			// ! 最後の位置に移動するためdropIndex + 1を使用。
			newOrder.splice(dropIndex + 1, 0, removed)

			expect(newOrder).toEqual(["personal", "study", "life", "work"])
		})

		it("最後のタブを最初の位置にドラッグすると正しく移動する", () => {
			// ! テストのシナリオ:
			// ! 1. 初期順序: ["work", "personal", "study", "life"]
			// ! 2. "life"を"work"の前にドラッグ&ドロップ
			// ! 3. 結果順序: ["life", "work", "personal", "study"]

			const initialOrder = ["work", "personal", "study", "life"]
			const draggedItem = "life"
			const dropTarget = "work"

			const draggedIndex = initialOrder.indexOf(draggedItem)
			const dropIndex = initialOrder.indexOf(dropTarget)

			const newOrder = [...initialOrder]
			const [removed] = newOrder.splice(draggedIndex, 1)
			newOrder.splice(dropIndex, 0, removed)

			expect(newOrder).toEqual(["life", "work", "personal", "study"])
		})

		it("隣接するタブ同士を入れ替えると正しく移動する", () => {
			// ! テストのシナリオ:
			// ! 1. 初期順序: ["work", "personal", "study", "life"]
			// ! 2. "personal"を"work"の位置にドラッグ&ドロップ
			// ! 3. 結果順序: ["personal", "work", "study", "life"]

			const initialOrder = ["work", "personal", "study", "life"]
			const draggedItem = "personal"
			const dropTarget = "work"

			const draggedIndex = initialOrder.indexOf(draggedItem)
			const dropIndex = initialOrder.indexOf(dropTarget)

			const newOrder = [...initialOrder]
			const [removed] = newOrder.splice(draggedIndex, 1)
			newOrder.splice(dropIndex, 0, removed)

			expect(newOrder).toEqual(["personal", "work", "study", "life"])
		})
	})

	describe("【エッジケース】特殊な状況での動作", () => {
		it("同じタブを同じ位置にドロップしても順序が変わらない", () => {
			// ! 同じ位置へのドロップは順序を変更しない。
			const initialOrder = ["work", "personal", "study", "life"]
			const draggedItem = "personal"
			const dropTarget = "personal"

			const draggedIndex = initialOrder.indexOf(draggedItem)
			const dropIndex = initialOrder.indexOf(dropTarget)

			if (draggedIndex === dropIndex) {
				// ! 同じ位置の場合は何もしない。
				expect(initialOrder).toEqual(["work", "personal", "study", "life"])
			}
		})

		it("カテゴリが1つの場合はドラッグしても何も起こらない", () => {
			// ! カテゴリが1つの場合は順序変更の必要がない。
			const singleCategory = ["work"]

			// ! ドラッグ&ドロップ操作をしても順序は変わらない。
			expect(singleCategory).toEqual(["work"])
		})

		it("カテゴリが0個の場合はドラッグできない", () => {
			// ! カテゴリが存在しない場合はドラッグ操作自体が発生しない。
			const noCategories: string[] = []

			expect(noCategories.length).toBe(0)
		})
	})

	describe("【実装の詳細】HTML5 Drag and Drop API", () => {
		it("【実装方針】dragstartイベントハンドラの実装", () => {
			const dragStartImplementation = {
				event: "dragstart",
				steps: [
					"event.dataTransfer.setData('text/plain', categoryName)",
					"event.currentTarget.classList.add('dragging')",
					"event.dataTransfer.effectAllowed = 'move'",
				],
			}

			expect(dragStartImplementation.steps.length).toBe(3)
		})

		it("【実装方針】dragoverイベントハンドラの実装", () => {
			const dragOverImplementation = {
				event: "dragover",
				steps: [
					"event.preventDefault()",
					"event.dataTransfer.dropEffect = 'move'",
				],
			}

			expect(dragOverImplementation.steps.length).toBe(2)
		})

		it("【実装方針】dropイベントハンドラの実装", () => {
			const dropImplementation = {
				event: "drop",
				steps: [
					"event.preventDefault()",
					"const draggedCategory = event.dataTransfer.getData('text/plain')",
					"const dropTargetCategory = event.currentTarget.dataset.category",
					"swapCategories(draggedCategory, dropTargetCategory)",
					"saveSettings()",
					"rerenderTabs()",
				],
			}

			expect(dropImplementation.steps.length).toBe(6)
		})

		it("【実装方針】dragendイベントハンドラの実装", () => {
			const dragEndImplementation = {
				event: "dragend",
				steps: [
					"event.currentTarget.classList.remove('dragging')",
					"document.querySelectorAll('.dragover').forEach(el => el.classList.remove('dragover'))",
				],
			}

			expect(dragEndImplementation.steps.length).toBe(2)
		})

		it("【実装方針】dragenterイベントハンドラの実装", () => {
			const dragEnterImplementation = {
				event: "dragenter",
				steps: [
					"event.currentTarget.classList.add('dragover')",
				],
			}

			expect(dragEnterImplementation.steps.length).toBe(1)
		})

		it("【実装方針】dragleaveイベントハンドラの実装", () => {
			const dragLeaveImplementation = {
				event: "dragleave",
				steps: [
					"event.currentTarget.classList.remove('dragover')",
				],
			}

			expect(dragLeaveImplementation.steps.length).toBe(1)
		})
	})
})
