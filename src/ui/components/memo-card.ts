import { MemoEntry, CategoryConfig } from "../../types";
import { MarkdownRenderer, Component, setIcon, App, TFile } from "obsidian";

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

	//! 画像ペースト時のハンドラー（Markdownリンクを返す）。
	onImagePaste?: (file: File) => Promise<string | null>;

	//! カテゴリ変更時のハンドラー。
	onCategoryChange?: (memoId: string, newCategory: string) => void;

	//! TODO完了状態変更時のハンドラー。
	onTodoToggle?: (memoId: string, completed: boolean) => void;
}

//! メモカードコンポーネント。
export class MemoCard {
	private app: App;
	private container: HTMLElement;
	private memo: MemoEntry;
	private handlers: MemoCardHandlers;
	private enableDailyNotes: boolean;
	private isEditMode = false;
	private cardElement: HTMLElement | null = null;
	private sourcePath: string;
	private component: Component;
	private categories: CategoryConfig[];
	private useTodoList: boolean;

	constructor(
		app: App,
		container: HTMLElement,
		memo: MemoEntry,
		handlers: MemoCardHandlers = {},
		enableDailyNotes = false,
		sourcePath = "",
		categories: CategoryConfig[] = [],
		useTodoList = false
	) {
		this.app = app;
		this.container = container;
		this.memo = memo;
		this.handlers = handlers;
		this.enableDailyNotes = enableDailyNotes;
		this.sourcePath = sourcePath;
		this.component = new Component();
		this.categories = categories;
		this.useTodoList = useTodoList;
	}

	//! カードを描画する。
	render(): HTMLElement {
		const card = this.container.createDiv({ cls: "memolog-card" });
		this.cardElement = card;

		//! ヘッダー（タイムスタンプとアクション）。
		this.renderHeader(card);

		//! 本文（非同期でレンダリング）。
		void this.renderContent(card);

		//! 添付ファイル。
		if (this.memo.attachments && this.memo.attachments.length > 0) {
			this.renderAttachments(card);
		}

		return card;
	}

	//! ヘッダー部分を描画する。
	private renderHeader(card: HTMLElement): void {
		const header = card.createDiv({ cls: "memolog-card-header" });

		//! 左側エリア（TODOチェックボックス + タイムスタンプ）。
		const leftArea = header.createDiv({ cls: "memolog-card-header-left" });

		//! TODOチェックボックス（useTodoListがtrueの場合のみ）。
		if (this.useTodoList) {
			console.log("[TODO Debug MemoCard] useTodoListがtrue、チェックボックスを作成");
			const checkbox = leftArea.createEl("input", {
				type: "checkbox",
				cls: "memolog-todo-checkbox",
			}) as HTMLInputElement;
			//! contentの先頭が - [x] かどうかで判定。
			const isCompleted = /^-\s*\[x\]\s+/.test(this.memo.content);
			checkbox.checked = isCompleted;
			console.log("[TODO Debug MemoCard] チェックボックス初期状態:", { memoId: this.memo.id, checked: isCompleted, content: this.memo.content.substring(0, 50) });

			checkbox.addEventListener("change", () => {
				console.log("[TODO Debug MemoCard] チェックボックスchangeイベント発火:", { memoId: this.memo.id, checked: checkbox.checked });
				if (this.handlers.onTodoToggle) {
					console.log("[TODO Debug MemoCard] onTodoToggleハンドラーを呼び出し");
					this.handlers.onTodoToggle(this.memo.id, checkbox.checked);
				} else {
					console.log("[TODO Debug MemoCard] onTodoToggleハンドラーが存在しません！");
				}
			});
		} else {
			console.log("[TODO Debug MemoCard] useTodoListがfalse、チェックボックス非表示");
		}

		//! タイムスタンプ。
		const timestamp = this.formatTimestamp(this.memo.timestamp);
		leftArea.createDiv({
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

		//! カテゴリ変更ボタン。
		if (this.categories.length > 0 && this.handlers.onCategoryChange) {
			const categoryBtn = actions.createEl("button", {
				cls: "memolog-btn memolog-btn-category",
				attr: { "aria-label": "カテゴリ変更" },
			});

			//! 現在のカテゴリのアイコンを表示。
			const currentCategory = this.categories.find((cat) => cat.directory === this.memo.category);
			if (currentCategory) {
				setIcon(categoryBtn, currentCategory.icon);
				//! カテゴリの色を反映。
				if (currentCategory.color) {
					categoryBtn.style.color = currentCategory.color;
				}
			} else {
				setIcon(categoryBtn, "folder");
			}

			//! カテゴリ変更メニューを表示。
			categoryBtn.addEventListener("click", (e) => {
				this.showCategoryMenu(categoryBtn, e);
			});
		}

		//! コピーボタン。
		const copyBtn = actions.createEl("button", {
			cls: "memolog-btn memolog-btn-copy",
			attr: { "aria-label": "コピー" },
		});
		setIcon(copyBtn, "copy");
		copyBtn.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(this.memo.content);
				//! アイコンを一時的にチェックマークに変更。
				copyBtn.empty();
				setIcon(copyBtn, "check");
				setTimeout(() => {
					copyBtn.empty();
					setIcon(copyBtn, "copy");
				}, 1500);
			} catch (error) {
				console.error("Failed to copy to clipboard:", error);
			}
		});

		//! 編集ボタン。
		const editBtn = actions.createEl("button", {
			cls: "memolog-btn memolog-btn-edit",
			attr: { "aria-label": "編集" },
		});
		setIcon(editBtn, "pencil");
		editBtn.addEventListener("click", () => {
			this.toggleEditMode();
		});

		//! 削除ボタン。
		const deleteBtn = actions.createEl("button", {
			cls: "memolog-btn memolog-btn-delete",
			attr: { "aria-label": "削除" },
		});
		setIcon(deleteBtn, "trash");
		deleteBtn.addEventListener("click", () => {
			if (this.handlers.onDelete) {
				this.handlers.onDelete(this.memo.id);
			}
		});
	}

	//! 本文を描画する。
	private async renderContent(card: HTMLElement): Promise<void> {
		const contentDiv = card.createDiv({ cls: "memolog-card-content" });

		if (this.isEditMode) {
			//! 編集モード: テキストエリアを表示。
			const textarea = contentDiv.createEl("textarea", {
				cls: "memolog-card-edit-textarea",
			});
			//! テキストエリアの値を設定。
			textarea.value = this.memo.content;

			//! 画像ペーストイベント。
			textarea.addEventListener("paste", (e) => {
				void this.handlePaste(e, textarea);
			});

			//! 保存・キャンセルボタン。
			const editActions = contentDiv.createDiv({ cls: "memolog-card-edit-actions" });

			//! キャンセルボタン（左側）。
			const cancelBtn = editActions.createEl("button", {
				cls: "memolog-btn memolog-btn-cancel",
				text: "キャンセル",
			});

			cancelBtn.addEventListener("click", () => {
				this.toggleEditMode();
			});

			//! 保存ボタン（右側）。
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
		} else {
			//! 通常モード: Markdownとしてレンダリング。
			//! Markdown画像リンクをHTMLのimgタグに変換。
			const contentWithImages = this.convertMarkdownImagesToHtml(this.memo.content);
			await MarkdownRenderer.renderMarkdown(
				contentWithImages,
				contentDiv,
				this.sourcePath,
				this.component
			);
		}
	}

	//! Markdown画像リンクをHTMLのimgタグに変換する。
	private convertMarkdownImagesToHtml(content: string): string {
		//! ![alt](path) 形式を <img alt="alt" src="path"> に変換。
		return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
	}

	//! ペースト処理（画像の場合はファイルとして保存）。
	private async handlePaste(e: ClipboardEvent, textarea: HTMLTextAreaElement): Promise<void> {
		try {
			if (!e.clipboardData) {
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
						if (markdownLink) {
							//! カーソル位置にMarkdownリンクを挿入。
							const start = textarea.selectionStart;
							const end = textarea.selectionEnd;
							const currentValue = textarea.value;
							const newValue =
								currentValue.substring(0, start) +
								markdownLink +
								currentValue.substring(end);
							textarea.value = newValue;
							//! カーソル位置を更新。
							const newCursorPos = start + markdownLink.length;
							textarea.setSelectionRange(newCursorPos, newCursorPos);
							textarea.focus();
						}
					}
					break;
				}
			}
		} catch (error) {
			console.error("Failed to handle paste:", error);
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
					void this.openAttachment(attachment);
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
					void this.openAttachment(attachment);
				});
			}
		}
	}

	//! 添付ファイルを開く（モバイル対応）。
	private async openAttachment(attachment: string): Promise<void> {
		//! 外部URLかどうかを判定。
		if (attachment.startsWith("http://") || attachment.startsWith("https://")) {
			//! 外部URLの場合はそのまま開く。
			window.open(attachment, "_blank");
			return;
		}

		//! Vault内のファイルかどうかを判定。
		const file = this.app.vault.getAbstractFileByPath(attachment);
		if (file instanceof TFile) {
			//! Vault内のファイルの場合は新しいタブで開く（モバイル対応）。
			const leaf = this.app.workspace.getLeaf("tab");
			await leaf.openFile(file);
		} else {
			//! Vault内にないファイルパスの場合は、デスクトップのみwindow.openで開く。
			//! モバイルでは適切に処理できない可能性があるが、フォールバックとして提供。
			window.open(attachment, "_blank");
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

		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		const hours = date.getHours().toString().padStart(2, "0");
		const minutes = date.getMinutes().toString().padStart(2, "0");

		//! 常に西暦+日付+時刻を表示。
		return `${year}-${month}-${day} ${hours}:${minutes}`;
	}

	//! カテゴリ変更メニューを表示する。
	private showCategoryMenu(button: HTMLElement, event: MouseEvent): void {
		event.stopPropagation();

		//! 既存のメニューを削除。
		const existingMenu = document.querySelector(".memolog-category-menu");
		if (existingMenu) {
			existingMenu.remove();
		}

		//! メニューを作成。
		const menu = document.body.createDiv({ cls: "memolog-category-menu" });

		//! メニューの位置を設定（ボタンの下）。
		const buttonRect = button.getBoundingClientRect();
		menu.style.position = "absolute";
		menu.style.top = `${buttonRect.bottom + 4}px`;
		menu.style.left = `${buttonRect.left}px`;
		menu.style.zIndex = "1000";

		//! カテゴリ一覧を表示。
		for (const category of this.categories) {
			const item = menu.createDiv({ cls: "memolog-category-menu-item" });

			//! アイコンを表示。
			const icon = item.createDiv({ cls: "memolog-category-menu-icon" });
			setIcon(icon, category.icon);

			//! カテゴリ名を表示。
			item.createSpan({
				cls: "memolog-category-menu-name",
				text: category.name,
			});

			//! 現在のカテゴリにチェックマークを表示。
			if (category.directory === this.memo.category) {
				const check = item.createDiv({ cls: "memolog-category-menu-check" });
				setIcon(check, "check");
			}

			//! クリックでカテゴリを変更。
			item.addEventListener("click", () => {
				if (this.handlers.onCategoryChange) {
					this.handlers.onCategoryChange(this.memo.id, category.directory);
				}
				menu.remove();
			});
		}

		//! メニュー外をクリックしたら閉じる。
		const closeMenu = (e: MouseEvent) => {
			if (!menu.contains(e.target as Node)) {
				menu.remove();
				document.removeEventListener("click", closeMenu);
			}
		};
		setTimeout(() => {
			document.addEventListener("click", closeMenu);
		}, 0);
	}

	//! 編集モードを切り替える。
	toggleEditMode(): void {
		this.isEditMode = !this.isEditMode;

		//! カードを再描画。
		if (this.cardElement) {
			this.cardElement.empty();

			//! ヘッダーを再描画。
			this.renderHeader(this.cardElement);

			//! 本文を再描画（編集モードに応じて変わる）（非同期）。
			void this.renderContent(this.cardElement);

			//! 添付ファイルを再描画。
			if (this.memo.attachments && this.memo.attachments.length > 0) {
				this.renderAttachments(this.cardElement);
			}

			//! 編集モードに入った場合、カード全体が表示されるようにスクロール。
			if (this.isEditMode) {
				//! レンダリング完了を待ってスクロール。
				setTimeout(() => {
					if (this.cardElement) {
						this.cardElement.scrollIntoView({
							behavior: "smooth",
							block: "nearest",
						});
					}
				}, 100);
			}
		}
	}
}
