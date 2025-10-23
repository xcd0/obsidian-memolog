//! 入力フォームのイベントハンドラー。
export interface InputFormHandlers {
	//! 送信時のハンドラー。
	onSubmit?: (content: string) => void;
}

//! 入力フォームコンポーネント。
export class InputForm {
	private container: HTMLElement;
	private handlers: InputFormHandlers;
	private textarea: HTMLTextAreaElement | null = null;

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

		//! 送信ボタン。
		const submitBtn = this.container.createEl("button", {
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

	//! 送信処理。
	private handleSubmit(): void {
		if (!this.textarea) return;

		const content = this.textarea.value.trim();
		if (content && this.handlers.onSubmit) {
			this.handlers.onSubmit(content);
			this.clear();
		}
	}

	//! 入力欄をクリアする。
	clear(): void {
		if (this.textarea) {
			this.textarea.value = "";
		}
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
