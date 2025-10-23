import { ItemView, WorkspaceLeaf } from "obsidian";
import MemologPlugin from "../../main";

//! サイドバーのビュータイプ。
export const VIEW_TYPE_MEMOLOG = "memolog-sidebar";

//! memologサイドバーUI。
export class MemologSidebar extends ItemView {
	//! プラグインインスタンス（将来使用予定）。
	private _plugin: MemologPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: MemologPlugin) {
		super(leaf);
		this._plugin = plugin;
	}

	//! プラグインインスタンスを取得する。
	get plugin(): MemologPlugin {
		return this._plugin;
	}

	//! ビュータイプを返す。
	override getViewType(): string {
		return VIEW_TYPE_MEMOLOG;
	}

	//! 表示名を返す。
	override getDisplayText(): string {
		return "memolog";
	}

	//! アイコンを返す。
	override getIcon(): string {
		return "file-text";
	}

	//! ビューを開いたときの処理。
	override async onOpen(): Promise<void> {
		const container = this.containerEl;

		//! コンテナをクリア。
		container.empty();

		//! メインコンテナを作成。
		container.addClass("memolog-container");

		//! ヘッダー部分を作成。
		this.createHeader(container);

		//! メモ表示領域を作成。
		this.createMemoListArea(container);

		//! 入力欄を作成。
		this.createInputArea(container);
	}

	//! ビューを閉じたときの処理。
	override async onClose(): Promise<void> {
		//! クリーンアップ処理。
		this.containerEl.empty();
	}

	//! ヘッダー部分を作成する。
	private createHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: "memolog-header" });

		//! タイトル。
		const title = header.createDiv({ cls: "memolog-title" });
		title.setText("memolog");

		//! ボタン群（後で実装）。
		const buttonBar = header.createDiv({ cls: "memolog-button-bar" });
		buttonBar.createEl("span", { text: "[ボタン群]" });
	}

	//! メモ表示領域を作成する。
	private createMemoListArea(container: HTMLElement): void {
		const listArea = container.createDiv({ cls: "memolog-list-area" });

		//! プレースホルダー。
		listArea.createEl("div", {
			cls: "memolog-placeholder",
			text: "メモがまだありません",
		});
	}

	//! 入力欄を作成する。
	private createInputArea(container: HTMLElement): void {
		const inputArea = container.createDiv({ cls: "memolog-input-area" });

		//! テキストエリア。
		const textarea = inputArea.createEl("textarea", {
			cls: "memolog-input",
			attr: {
				placeholder: "メモを入力...",
				rows: "3",
			},
		});

		//! 送信ボタン。
		const submitBtn = inputArea.createEl("button", {
			cls: "memolog-submit-btn",
			text: "追加",
		});

		//! 送信ボタンのイベント。
		submitBtn.addEventListener("click", () => {
			const content = textarea.value.trim();
			if (content) {
				this.handleSubmit(content);
				textarea.value = "";
			}
		});

		//! Ctrl+Enterで送信。
		textarea.addEventListener("keydown", (e) => {
			if (e.ctrlKey && e.key === "Enter") {
				const content = textarea.value.trim();
				if (content) {
					this.handleSubmit(content);
					textarea.value = "";
				}
			}
		});
	}

	//! メモ送信処理。
	private async handleSubmit(content: string): Promise<void> {
		console.log("メモを追加:", content);
		//! TODO: MemoManagerを使ってメモを保存する。
		//! TODO: メモリストを更新する。
	}

	//! サイドバーを更新する。
	public refresh(): void {
		this.onOpen();
	}
}
