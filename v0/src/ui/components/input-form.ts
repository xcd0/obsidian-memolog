import { setIcon } from "obsidian";

//! 入力フォームのイベントハンドラー。
export interface InputFormHandlers {
	//! 送信時のハンドラー。
	onSubmit?: (content: string, attachments: string[]) => void;
}

//! 入力フォームコンポーネント。
export class InputForm {
	private container: HTMLElement;
	private handlers: InputFormHandlers;
	private textarea: HTMLTextAreaElement | null = null;
	private attachmentsList: HTMLElement | null = null;
	private selectedFiles: File[] = [];

	constructor(container: HTMLElement, handlers: InputFormHandlers = {}) {
		this.container = container;
		this.handlers = handlers;
	}

	//! フォームを描画する。
	render(): void {
		//! コンテナをクリア。
		this.container.empty();

		//! テキストエリア。
		this.textarea = this.container.createEl("textarea", {
			cls: "memolog-input",
			attr: {
				placeholder: "メモを入力...",
				rows: "3",
			},
		});

		//! 添付ファイル一覧。
		this.attachmentsList = this.container.createDiv({ cls: "memolog-attachments-list" });

		//! ボタン群。
		const buttonBar = this.container.createDiv({ cls: "memolog-input-buttons" });

		//! 添付ボタン。
		const attachBtn = buttonBar.createEl("button", {
			cls: "memolog-attach-btn",
		});
		const attachIcon = attachBtn.createDiv({ cls: "memolog-attach-icon" });
		setIcon(attachIcon, "paperclip");
		attachBtn.createSpan({ text: "添付" });

		//! ファイル入力（非表示）。
		const fileInput = buttonBar.createEl("input", {
			type: "file",
			cls: "memolog-file-input",
			attr: {
				multiple: "true",
				accept: "image/*,video/*,audio/*,.pdf,.txt,.md",
			},
		});

		//! 添付ボタンクリックでファイル選択。
		attachBtn.addEventListener("click", () => {
			fileInput.click();
		});

		//! ファイル選択時の処理。
		fileInput.addEventListener("change", () => {
			if (fileInput.files) {
				this.handleFileSelect(fileInput.files);
				fileInput.value = "";
			}
		});

		//! 送信ボタン。
		const submitBtn = buttonBar.createEl("button", {
			cls: "memolog-submit-btn",
			text: "追加",
		});

		//! 送信ボタンのイベント。
		submitBtn.addEventListener("click", () => {
			this.handleSubmit();
		});

		//! Ctrl+Enterで送信。
		this.textarea.addEventListener("keydown", (e) => {
			if (e.ctrlKey && e.key === "Enter") {
				this.handleSubmit();
				e.preventDefault();
			}
		});
	}

	//! ファイル選択処理。
	private handleFileSelect(files: FileList): void {
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (file) {
				this.selectedFiles.push(file);
			}
		}
		this.renderAttachments();
	}

	//! 添付ファイル一覧を描画する。
	private renderAttachments(): void {
		if (!this.attachmentsList) return;

		this.attachmentsList.empty();

		if (this.selectedFiles.length === 0) {
			this.attachmentsList.hide();
			return;
		}

		this.attachmentsList.show();

		for (let i = 0; i < this.selectedFiles.length; i++) {
			const file = this.selectedFiles[i];
			const item = this.attachmentsList.createDiv({ cls: "memolog-attachment-item" });

			//! ファイル名。
			item.createSpan({
				cls: "memolog-attachment-name",
				text: file.name,
			});

			//! 削除ボタン。
			const removeBtn = item.createDiv({ cls: "memolog-attachment-remove" });
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => {
				this.removeFile(i);
			});
		}
	}

	//! ファイルを削除する。
	private removeFile(index: number): void {
		this.selectedFiles.splice(index, 1);
		this.renderAttachments();
	}

	//! 送信処理。
	private handleSubmit(): void {
		if (!this.textarea) return;

		const content = this.textarea.value.trim();
		if (!content && this.selectedFiles.length === 0) {
			return;
		}

		if (this.handlers.onSubmit) {
			//! ファイル名のみを渡す（実際のファイルコピーはsidebarで処理）。
			const attachmentNames = this.selectedFiles.map((f) => f.name);
			this.handlers.onSubmit(content, attachmentNames);
			this.clear();
		}
	}

	//! 入力欄をクリアする。
	clear(): void {
		if (this.textarea) {
			this.textarea.value = "";
		}
		this.selectedFiles = [];
		this.renderAttachments();
	}

	//! 選択されたファイルを取得する。
	getSelectedFiles(): File[] {
		return this.selectedFiles;
	}

	//! 入力欄にフォーカスする。
	focus(): void {
		if (this.textarea) {
			this.textarea.focus();
		}
	}

	//! 入力内容を取得する。
	getValue(): string {
		return this.textarea ? this.textarea.value : "";
	}

	//! 入力内容を設定する。
	setValue(value: string): void {
		if (this.textarea) {
			this.textarea.value = value;
		}
	}
}
