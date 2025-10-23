import { MemoEntry } from "../../types";

//! メモカードのイベントハンドラー。
export interface MemoCardHandlers {
	//! 削除ボタンクリック時のハンドラー。
	onDelete?: (memoId: string) => void;

	//! 編集ボタンクリック時のハンドラー。
	onEdit?: (memoId: string) => void;
}

//! メモカードコンポーネント。
export class MemoCard {
	private container: HTMLElement;
	private memo: MemoEntry;
	private handlers: MemoCardHandlers;

	constructor(container: HTMLElement, memo: MemoEntry, handlers: MemoCardHandlers = {}) {
		this.container = container;
		this.memo = memo;
		this.handlers = handlers;
	}

	//! カードを描画する。
	render(): HTMLElement {
		const card = this.container.createDiv({ cls: "memolog-card" });

		//! ヘッダー（タイムスタンプとアクション）。
		this.renderHeader(card);

		//! 本文。
		this.renderContent(card);

		//! 添付ファイル。
		if (this.memo.attachments && this.memo.attachments.length > 0) {
			this.renderAttachments(card);
		}

		return card;
	}

	//! ヘッダー部分を描画する。
	private renderHeader(card: HTMLElement): void {
		const header = card.createDiv({ cls: "memolog-card-header" });

		//! タイムスタンプ。
		const timestamp = this.formatTimestamp(this.memo.timestamp);
		header.createDiv({
			cls: "memolog-card-timestamp",
			text: timestamp,
		});

		//! アクションボタン。
		const actions = header.createDiv({ cls: "memolog-card-actions" });

		//! 編集ボタン（将来実装）。
		// const editBtn = actions.createEl("button", {
		// 	cls: "memolog-btn",
		// 	text: "編集",
		// });
		// editBtn.addEventListener("click", () => {
		// 	if (this.handlers.onEdit) {
		// 		this.handlers.onEdit(this.memo.id);
		// 	}
		// });

		//! 削除ボタン。
		const deleteBtn = actions.createEl("button", {
			cls: "memolog-btn memolog-btn-delete",
			text: "削除",
		});
		deleteBtn.addEventListener("click", () => {
			if (this.handlers.onDelete) {
				this.handlers.onDelete(this.memo.id);
			}
		});
	}

	//! 本文を描画する。
	private renderContent(card: HTMLElement): void {
		card.createDiv({
			cls: "memolog-card-content",
			text: this.memo.content,
		});
	}

	//! 添付ファイルを描画する。
	private renderAttachments(card: HTMLElement): void {
		const attachmentsDiv = card.createDiv({ cls: "memolog-card-attachments" });

		const attachmentText = `添付: ${this.memo.attachments?.join(", ") ?? ""}`;
		attachmentsDiv.setText(attachmentText);
	}

	//! タイムスタンプをフォーマットする。
	private formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);

		//! 相対時間表示（例: "5分前", "2時間前", "3日前"）。
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) {
			return "たった今";
		} else if (minutes < 60) {
			return `${minutes}分前`;
		} else if (hours < 24) {
			return `${hours}時間前`;
		} else if (days < 7) {
			return `${days}日前`;
		} else {
			//! 7日以上前は絶対時間表示。
			return this.formatAbsoluteTimestamp(date);
		}
	}

	//! 絶対時間をフォーマットする。
	private formatAbsoluteTimestamp(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		const hours = date.getHours().toString().padStart(2, "0");
		const minutes = date.getMinutes().toString().padStart(2, "0");

		return `${year}-${month}-${day} ${hours}:${minutes}`;
	}
}
