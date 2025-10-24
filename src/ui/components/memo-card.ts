import { MemoEntry } from "../../types";

//! メモカードのイベントハンドラー。
export interface MemoCardHandlers {
	//! 削除ボタンクリック時のハンドラー。
	onDelete?: (memoId: string) => void;

	//! 編集ボタンクリック時のハンドラー。
	onEdit?: (memoId: string) => void;

	//! 編集保存時のハンドラー。
	onSaveEdit?: (memoId: string, newContent: string) => void;

	//! Daily Noteに追加ボタンクリック時のハンドラー。
	onAddToDailyNote?: (memo: MemoEntry) => void;
}

//! メモカードコンポーネント。
export class MemoCard {
	private container: HTMLElement;
	private memo: MemoEntry;
	private handlers: MemoCardHandlers;
	private enableDailyNotes: boolean;
	private isEditMode = false;
	private cardElement: HTMLElement | null = null;

	constructor(
		container: HTMLElement,
		memo: MemoEntry,
		handlers: MemoCardHandlers = {},
		enableDailyNotes = false
	) {
		this.container = container;
		this.memo = memo;
		this.handlers = handlers;
		this.enableDailyNotes = enableDailyNotes;
	}

	//! カードを描画する。
	render(): HTMLElement {
		const card = this.container.createDiv({ cls: "memolog-card" });
		this.cardElement = card;

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

		//! Daily Noteに追加ボタン。
		if (this.enableDailyNotes && this.handlers.onAddToDailyNote) {
			const dailyNoteBtn = actions.createEl("button", {
				cls: "memolog-btn memolog-btn-daily-note",
				text: "Daily Noteに追加",
			});
			dailyNoteBtn.addEventListener("click", () => {
				if (this.handlers.onAddToDailyNote) {
					this.handlers.onAddToDailyNote(this.memo);
				}
			});
		}

		//! 編集ボタン。
		const editBtn = actions.createEl("button", {
			cls: "memolog-btn memolog-btn-edit",
			text: "編集",
		});
		editBtn.addEventListener("click", () => {
			this.toggleEditMode();
		});

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
		const contentDiv = card.createDiv({ cls: "memolog-card-content" });

		if (this.isEditMode) {
			//! 編集モード: テキストエリアを表示。
			const textarea = contentDiv.createEl("textarea", {
				cls: "memolog-card-edit-textarea",
				value: this.memo.content,
			});

			//! 保存・キャンセルボタン。
			const editActions = contentDiv.createDiv({ cls: "memolog-card-edit-actions" });

			const saveBtn = editActions.createEl("button", {
				cls: "memolog-btn memolog-btn-save",
				text: "保存",
			});

			saveBtn.addEventListener("click", () => {
				const newContent = textarea.value.trim();
				if (newContent && this.handlers.onSaveEdit) {
					this.handlers.onSaveEdit(this.memo.id, newContent);
					this.memo.content = newContent;
					this.toggleEditMode();
				}
			});

			const cancelBtn = editActions.createEl("button", {
				cls: "memolog-btn memolog-btn-cancel",
				text: "キャンセル",
			});

			cancelBtn.addEventListener("click", () => {
				this.toggleEditMode();
			});
		} else {
			//! 通常モード: テキストを表示。
			contentDiv.setText(this.memo.content);
		}
	}

	//! 添付ファイルを描画する。
	private renderAttachments(card: HTMLElement): void {
		const attachmentsDiv = card.createDiv({ cls: "memolog-card-attachments" });

		if (!this.memo.attachments || this.memo.attachments.length === 0) {
			return;
		}

		for (const attachment of this.memo.attachments) {
			const attachmentItem = attachmentsDiv.createDiv({ cls: "memolog-attachment" });

			//! 画像ファイルの場合はプレビューを表示。
			if (this.isImageFile(attachment)) {
				const img = attachmentItem.createEl("img", {
					cls: "memolog-attachment-image",
					attr: {
						src: attachment,
						alt: this.getFileName(attachment),
					},
				});

				//! 画像クリックで新しいタブで開く。
				img.addEventListener("click", () => {
					window.open(attachment, "_blank");
				});
			} else {
				//! 画像以外はリンクを表示。
				const link = attachmentItem.createEl("a", {
					cls: "memolog-attachment-link",
					text: this.getFileName(attachment),
					href: attachment,
				});
				link.addEventListener("click", (e) => {
					e.preventDefault();
					window.open(attachment, "_blank");
				});
			}
		}
	}

	//! 画像ファイルかどうかを判定する。
	private isImageFile(path: string): boolean {
		const ext = path.toLowerCase().split(".").pop();
		return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext || "");
	}

	//! ファイル名を取得する。
	private getFileName(path: string): string {
		return path.split("/").pop() || path;
	}

	//! タイムスタンプをフォーマットする。
	private formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);

		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		const hours = date.getHours().toString().padStart(2, "0");
		const minutes = date.getMinutes().toString().padStart(2, "0");

		//! 常に日付+時刻を表示。
		return `${month}-${day} ${hours}:${minutes}`;
	}

	//! 編集モードを切り替える。
	toggleEditMode(): void {
		this.isEditMode = !this.isEditMode;

		//! カードを再描画。
		if (this.cardElement) {
			this.cardElement.empty();

			//! ヘッダーを再描画。
			this.renderHeader(this.cardElement);

			//! 本文を再描画（編集モードに応じて変わる）。
			this.renderContent(this.cardElement);

			//! 添付ファイルを再描画。
			if (this.memo.attachments && this.memo.attachments.length > 0) {
				this.renderAttachments(this.cardElement);
			}
		}
	}
}
