import { App, Modal } from "obsidian"

// ! 削除オプション。
export type DeleteOption = "cascade" | "orphan"

// ! 削除オプション選択モーダル。
export class DeleteOptionsModal extends Modal {
	private result: DeleteOption | null = null
	private replyCount: number
	private onSubmit: (result: DeleteOption | null) => void

	constructor(app: App, replyCount: number, onSubmit: (result: DeleteOption | null) => void) {
		super(app)
		this.replyCount = replyCount
		this.onSubmit = onSubmit
	}

	// ! モーダルを開く。
	override onOpen(): void {
		const { contentEl } = this

		contentEl.empty()
		contentEl.addClass("memolog-delete-options-modal")

		// ! タイトル。
		contentEl.createEl("h2", { text: "返信があるメモの削除" })

		// ! 説明文。
		const description = contentEl.createDiv({ cls: "memolog-modal-description" })
		description.createEl("p", {
			text: `このメモには${this.replyCount}件の返信があります。削除方法を選択してください。`,
		})

		// ! オプション1: すべて削除。
		const option1 = contentEl.createDiv({ cls: "memolog-modal-option" })
		const option1Btn = option1.createEl("button", {
			cls: "memolog-modal-button memolog-modal-button-danger",
			text: "すべて削除",
		})
		option1.createEl("p", {
			cls: "memolog-modal-option-description",
			text: "このメモとすべての返信を削除します",
		})

		option1Btn.addEventListener("click", () => {
			this.result = "cascade"
			this.close()
		})

		// ! オプション2: 子供を親なしに。
		const option2 = contentEl.createDiv({ cls: "memolog-modal-option" })
		const option2Btn = option2.createEl("button", {
			cls: "memolog-modal-button",
			text: "このメモのみ削除",
		})
		option2.createEl("p", {
			cls: "memolog-modal-option-description",
			text: "このメモを削除し、直接の子返信を親なしのメモに変換します",
		})

		option2Btn.addEventListener("click", () => {
			this.result = "orphan"
			this.close()
		})

		// ! キャンセルボタン。
		const cancelBtn = contentEl.createEl("button", {
			cls: "memolog-modal-button memolog-modal-button-cancel",
			text: "キャンセル",
		})

		cancelBtn.addEventListener("click", () => {
			this.result = null
			this.close()
		})
	}

	// ! モーダルを閉じる。
	override onClose(): void {
		const { contentEl } = this
		contentEl.empty()
		this.onSubmit(this.result)
	}
}
