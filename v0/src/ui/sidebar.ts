import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import MemologPlugin from "../../main";
import { MemoEntry, SortOrder } from "../types";
import { MemoManager } from "../core/memo-manager";
import { MemoList } from "./components/memo-list";
import { InputForm } from "./components/input-form";
import { ButtonBar } from "./components/button-bar";

//! サイドバーのビュータイプ。
export const VIEW_TYPE_MEMOLOG = "memolog-sidebar";

//! memologサイドバーUI。
export class MemologSidebar extends ItemView {
	//! プラグインインスタンス。
	private _plugin: MemologPlugin;

	//! メモマネージャー（将来ファイル保存時に使用）。
	private _memoManager: MemoManager;

	//! UIコンポーネント。
	private memoList: MemoList | null = null;
	private inputForm: InputForm | null = null;
	private buttonBar: ButtonBar | null = null;

	//! 現在のソート順。
	private currentOrder: SortOrder = "asc";

	//! メモデータ。
	private memos: MemoEntry[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: MemologPlugin) {
		super(leaf);
		this._plugin = plugin;
		this._memoManager = new MemoManager(this.app);
	}

	//! プラグインインスタンスを取得する。
	get plugin(): MemologPlugin {
		return this._plugin;
	}

	//! メモマネージャーを取得する。
	get memoManager(): MemoManager {
		return this._memoManager;
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
		const header = this.createHeader(container);

		//! メモ表示領域を作成。
		const listArea = this.createMemoListArea(container);

		//! 入力欄を作成。
		const inputArea = this.createInputArea(container);

		//! コンポーネントを初期化。
		this.initializeComponents(header, listArea, inputArea);

		//! 初期データを読み込む。
		await this.loadMemos();
	}

	//! ビューを閉じたときの処理。
	override async onClose(): Promise<void> {
		//! クリーンアップ処理。
		this.containerEl.empty();
	}

	//! ヘッダー部分を作成する。
	private createHeader(container: HTMLElement): HTMLElement {
		const header = container.createDiv({ cls: "memolog-header" });

		//! タイトル。
		const title = header.createDiv({ cls: "memolog-title" });
		title.setText("memolog");

		//! ボタン群。
		const buttonBarEl = header.createDiv({ cls: "memolog-button-bar" });

		return buttonBarEl;
	}

	//! メモ表示領域を作成する。
	private createMemoListArea(container: HTMLElement): HTMLElement {
		const listArea = container.createDiv({ cls: "memolog-list-area" });
		return listArea;
	}

	//! 入力欄を作成する。
	private createInputArea(container: HTMLElement): HTMLElement {
		const inputArea = container.createDiv({ cls: "memolog-input-area" });
		return inputArea;
	}

	//! コンポーネントを初期化する。
	private initializeComponents(
		buttonBarEl: HTMLElement,
		listAreaEl: HTMLElement,
		inputAreaEl: HTMLElement
	): void {
		//! ボタンバーを初期化。
		this.buttonBar = new ButtonBar(buttonBarEl, {
			onSortOrderChange: (order) => this.handleSortOrderChange(order),
			onRefreshClick: () => this.handleRefresh(),
		});
		this.buttonBar.render(this.currentOrder);

		//! メモリストを初期化。
		this.memoList = new MemoList(listAreaEl, this.memos, {
			onDelete: (memoId) => this.handleDelete(memoId),
		});
		this.memoList.render();

		//! 入力フォームを初期化。
		this.inputForm = new InputForm(inputAreaEl, {
			onSubmit: (content) => this.handleSubmit(content),
		});
		this.inputForm.render();
	}

	//! メモを読み込む。
	private async loadMemos(): Promise<void> {
		//! TODO: 実際のファイルからメモを読み込む。
		//! 現在はダミーデータ。
		this.memos = [];

		if (this.memoList) {
			this.memoList.updateMemos(this.memos);
		}
	}

	//! メモ送信処理。
	private async handleSubmit(content: string): Promise<void> {
		try {
			//! TODO: 実際のファイルに保存する処理を実装。
			//! 現在はダミー実装。
			const newMemo: MemoEntry = {
				id: Date.now().toString(),
				category: "default",
				timestamp: new Date().toISOString(),
				content,
			};

			this.memos.push(newMemo);

			if (this.memoList) {
				this.memoList.updateMemos(this.memos);
			}

			new Notice("メモを追加しました");
		} catch (error) {
			console.error("メモ追加エラー:", error);
			new Notice("メモの追加に失敗しました");
		}
	}

	//! メモ削除処理。
	private async handleDelete(memoId: string): Promise<void> {
		try {
			//! TODO: 実際のファイルから削除する処理を実装。
			this.memos = this.memos.filter((m) => m.id !== memoId);

			if (this.memoList) {
				this.memoList.updateMemos(this.memos);
			}

			new Notice("メモを削除しました");
		} catch (error) {
			console.error("メモ削除エラー:", error);
			new Notice("メモの削除に失敗しました");
		}
	}

	//! ソート順変更処理。
	private handleSortOrderChange(order: SortOrder): void {
		this.currentOrder = order;

		//! メモをソート。
		this.memos.sort((a, b) => {
			const timeA = new Date(a.timestamp).getTime();
			const timeB = new Date(b.timestamp).getTime();
			return order === "asc" ? timeA - timeB : timeB - timeA;
		});

		if (this.memoList) {
			this.memoList.updateMemos(this.memos);
		}
	}

	//! リフレッシュ処理。
	private async handleRefresh(): Promise<void> {
		await this.loadMemos();
		new Notice("メモリストを更新しました");
	}

	//! サイドバーを更新する。
	public refresh(): void {
		this.onOpen();
	}
}
