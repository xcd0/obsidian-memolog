import { App } from "obsidian"
import { MemoEntry } from "../../types"

// ! 削除済みメモのプレースホルダーコンポーネント。
// ! v0.0.16で追加。
export class DeletedMemoPlaceholder {
	// private app: App // ! 将来の拡張用に保持（現在は未使用）。
	private container: HTMLElement
	private memo: MemoEntry
	private canRestore: boolean
	private onRestore?: (memoId: string) => void
	private threadDepth: number

	constructor(
		app: App,
		container: HTMLElement,
		memo: MemoEntry,
		canRestore: boolean,
		onRestore?: (memoId: string) => void,
		threadDepth = 0,
	) {
		// this.app = app // ! 将来の拡張用に保持（現在は未使用）。
		void app // ! 未使用警告を回避。
		this.container = container
		this.memo = memo
		this.canRestore = canRestore
		this.onRestore = onRestore
		this.threadDepth = threadDepth
	}

	// ! プレースホルダーを描画する。
	render(): HTMLElement {
		const placeholder = this.container.createDiv({ cls: "memolog-deleted-placeholder" })

		// ! スレッド深さに応じてインデントを適用。
		if (this.threadDepth > 0) {
			placeholder.style.marginLeft = `${this.threadDepth * 20}px`
			placeholder.classList.add(`thread-depth-${this.threadDepth}`)
		}

		// ! プレースホルダーのコンテンツ。
		const content = placeholder.createDiv({ cls: "deleted-placeholder-content" })

		// ! 削除済みテキスト。
		content.createSpan({
			cls: "deleted-placeholder-text",
			text: "[削除済み]",
		})

		// ! 復元可能な場合のみ復元ボタンを表示。
		if (this.canRestore && this.onRestore) {
			const restoreButton = content.createEl("button", {
				cls: "deleted-placeholder-restore-button",
				text: "復元",
			})

			restoreButton.addEventListener("click", e => {
				e.stopPropagation()
				if (this.onRestore) {
					this.onRestore(this.memo.id)
				}
			})
		} else {
			// ! 復元不可の場合はその旨を表示。
			content.createSpan({
				cls: "deleted-placeholder-note",
				text: " (復元できません)",
			})
		}

		return placeholder
	}
}
