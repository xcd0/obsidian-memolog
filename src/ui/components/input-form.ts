import { setIcon } from "obsidian";
import { debounce } from "../../utils/performance";
import { getErrorHandler, FileIOError } from "../../core/error-handler";
import { notify } from "../../utils/notification-manager";

//! 入力フォームのイベントハンドラー。
export interface InputFormHandlers {
	//! 送信時のハンドラー。
	onSubmit?: (content: string, attachments: string[]) => void;

	//! 入力変更時のハンドラー（debounce適用済み）。
	onChange?: (content: string) => void;

	//! 画像ペースト時のハンドラー（Markdownリンクを返す）。
	onImagePaste?: (file: File) => Promise<string | null>;
}

//! 入力フォームコンポーネント。
export class InputForm {
	private container: HTMLElement;
	private handlers: InputFormHandlers;
	private textarea: HTMLTextAreaElement | null = null;
	private attachmentsList: HTMLElement | null = null;
	private selectedFiles: File[] = [];
	private errorHandler = getErrorHandler();
	private debouncedOnChange: ((content: string) => void) | null = null;

	constructor(container: HTMLElement, handlers: InputFormHandlers = {}) {
		this.container = container;
		this.handlers = handlers;

		//! onChange ハンドラーにdebounceを適用。
		if (handlers.onChange) {
			this.debouncedOnChange = debounce(handlers.onChange, 300);
		}
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

		//! 添付ボタン（アイコンのみ）。
		const attachBtn = buttonBar.createEl("button", {
			cls: "memolog-attach-btn",
			attr: { "aria-label": "ファイルを添付" },
		});
		const attachIcon = attachBtn.createDiv({ cls: "memolog-attach-icon" });
		setIcon(attachIcon, "paperclip");

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
				void this.handleFileSelect(fileInput.files);
				fileInput.value = "";
			}
		});

		//! 送信ボタン（POSTアイコン）。
		const submitBtn = buttonBar.createEl("button", {
			cls: "memolog-submit-btn",
			attr: { "aria-label": "メモを追加" },
		});
		const submitIcon = submitBtn.createDiv({ cls: "memolog-submit-icon" });
		setIcon(submitIcon, "send");

		//! 送信ボタンのイベント。
		submitBtn.addEventListener("click", () => {
			this.handleSubmit();
		});

		//! Shift+Enterで送信。
		this.textarea.addEventListener("keydown", (e) => {
			if (e.shiftKey && e.key === "Enter") {
				this.handleSubmit();
				e.preventDefault();
			}
		});

		//! 入力変更時のイベント（debounce適用済み）。
		if (this.debouncedOnChange) {
			this.textarea.addEventListener("input", () => {
				if (this.textarea && this.debouncedOnChange) {
					this.debouncedOnChange(this.textarea.value);
				}
			});
		}

		//! 画像ペーストイベント。
		this.textarea.addEventListener("paste", (e) => {
			void this.handlePaste(e);
		});

		//! 添付ファイルリストの初期状態を設定（非表示）。
		this.renderAttachments();
	}

	//! ペースト処理（画像の場合はファイルとして保存）。
	private async handlePaste(e: ClipboardEvent): Promise<void> {
		try {
			if (!e.clipboardData || !this.textarea) {
				return;
			}

			const items = e.clipboardData.items;
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				//! 画像ファイルの場合。
				if (item.type.startsWith("image/")) {
					e.preventDefault();

					const file = item.getAsFile();
					if (!file) {
						continue;
					}

					//! onImagePasteハンドラーを呼び出してMarkdownリンクを取得。
					if (this.handlers.onImagePaste) {
						const markdownLink = await this.handlers.onImagePaste(file);
						if (markdownLink && this.textarea) {
							//! カーソル位置にMarkdownリンクを挿入。
							const start = this.textarea.selectionStart;
							const end = this.textarea.selectionEnd;
							const currentValue = this.textarea.value;
							const newValue =
								currentValue.substring(0, start) +
								markdownLink +
								currentValue.substring(end);
							this.textarea.value = newValue;
							//! カーソル位置を更新。
							const newCursorPos = start + markdownLink.length;
							this.textarea.setSelectionRange(newCursorPos, newCursorPos);
							this.textarea.focus();
						}
					}
					break;
				}
			}
		} catch (error) {
			this.errorHandler.handle(error as Error, {
				context: "InputForm.handlePaste",
			});
		}
	}

	//! ファイル選択処理。
	private async handleFileSelect(files: FileList): Promise<void> {
		try {
			//! ファイルサイズチェック（10MB制限）。
			const MAX_FILE_SIZE = 10 * 1024 * 1024;

			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				if (file) {
					if (file.size > MAX_FILE_SIZE) {
						throw new FileIOError(
							`ファイルサイズが大きすぎます: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
							{ filename: file.name, size: file.size, maxSize: MAX_FILE_SIZE }
						);
					}

					//! 画像ファイルの場合は自動的に保存してMarkdownリンクを挿入。
					if (file.type.startsWith("image/") && this.handlers.onImagePaste && this.textarea) {
						const markdownLink = await this.handlers.onImagePaste(file);
						if (markdownLink) {
							//! カーソル位置にMarkdownリンクを挿入。
							const start = this.textarea.selectionStart;
							const end = this.textarea.selectionEnd;
							const currentValue = this.textarea.value;
							const newValue =
								currentValue.substring(0, start) +
								markdownLink +
								"\n" +
								currentValue.substring(end);
							this.textarea.value = newValue;
							//! カーソル位置を更新。
							const newCursorPos = start + markdownLink.length + 1;
							this.textarea.setSelectionRange(newCursorPos, newCursorPos);
							this.textarea.focus();
						}
					} else {
						//! 画像以外のファイルは添付リストに追加。
						this.selectedFiles.push(file);
					}
				}
			}
			this.renderAttachments();
		} catch (error) {
			this.errorHandler.handle(error as Error, {
				context: "InputForm.handleFileSelect",
			});
		}
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
		try {
			if (!this.textarea) return;

			const content = this.textarea.value.trim();
			if (!content && this.selectedFiles.length === 0) {
				notify.info("メモ内容を入力してください");
				return;
			}

			if (this.handlers.onSubmit) {
				//! ファイル名のみを渡す（実際のファイルコピーはsidebarで処理）。
				const attachmentNames = this.selectedFiles.map((f) => f.name);
				this.handlers.onSubmit(content, attachmentNames);
				this.clear();
			}
		} catch (error) {
			this.errorHandler.handle(error as Error, {
				context: "InputForm.handleSubmit",
			});
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
