import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import MemologPlugin from "../../main";
import { MemoEntry, SortOrder } from "../types";
import { MemoManager } from "../core/memo-manager";
import { MemoList } from "./components/memo-list";
import { InputForm } from "./components/input-form";
import { ButtonBar } from "./components/button-bar";
import { CategoryTabs } from "./components/category-tabs";
import { CalendarView } from "./components/calendar-view";
import { PathGenerator } from "../utils/path-generator";

//! サイドバーのビュータイプ。
export const VIEW_TYPE_MEMOLOG = "memolog-sidebar";

//! memologサイドバーUI。
export class MemologSidebar extends ItemView {
	//! プラグインインスタンス。
	private _plugin: MemologPlugin;

	//! メモマネージャー（将来ファイル保存時に使用）。
	private _memoManager: MemoManager;

	//! UIコンポーネント。
	private categoryTabs: CategoryTabs | null = null;
	private calendarView: CalendarView | null = null;
	private memoList: MemoList | null = null;
	private inputForm: InputForm | null = null;
	private buttonBar: ButtonBar | null = null;

	//! 現在の状態。
	private currentCategory: string = "";
	private currentOrder: SortOrder = "asc";
	private selectedDate: Date | null = null;

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

		//! カテゴリタブ領域を作成。
		const categoryTabsArea = this.createCategoryTabsArea(container);

		//! ヘッダー部分を作成。
		const header = this.createHeader(container);

		//! カレンダー領域を作成。
		const calendarArea = this.createCalendarArea(container);

		//! メモ表示領域を作成。
		const listArea = this.createMemoListArea(container);

		//! 入力欄を作成。
		const inputArea = this.createInputArea(container);

		//! コンポーネントを初期化。
		this.initializeComponents(categoryTabsArea, header, calendarArea, listArea, inputArea);

		//! 初期データを読み込む。
		await this.loadMemos();
	}

	//! ビューを閉じたときの処理。
	// eslint-disable-next-line @typescript-eslint/require-await
	override async onClose(): Promise<void> {
		//! クリーンアップ処理。
		this.containerEl.empty();
	}

	//! カテゴリタブ領域を作成する。
	private createCategoryTabsArea(container: HTMLElement): HTMLElement {
		const categoryTabsArea = container.createDiv({ cls: "memolog-category-tabs-area" });
		return categoryTabsArea;
	}

	//! カレンダー領域を作成する。
	private createCalendarArea(container: HTMLElement): HTMLElement {
		const calendarArea = container.createDiv({ cls: "memolog-calendar-area" });
		return calendarArea;
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
		categoryTabsAreaEl: HTMLElement,
		buttonBarEl: HTMLElement,
		calendarAreaEl: HTMLElement,
		listAreaEl: HTMLElement,
		inputAreaEl: HTMLElement
	): void {
		//! 設定を取得。
		const settings = this.plugin.settingsManager.getGlobalSettings();

		//! カテゴリタブを初期化。
		if (settings.categories.length > 0) {
			this.categoryTabs = new CategoryTabs(categoryTabsAreaEl, settings.categories, {
				onCategoryChange: (category) => void this.handleCategoryChange(category),
			});
			this.currentCategory = settings.defaultCategory || settings.categories[0].name;
			this.categoryTabs.render(this.currentCategory);
		} else {
			//! カテゴリが設定されていない場合はデフォルトカテゴリを使用。
			this.currentCategory = settings.defaultCategory;
		}

		//! ボタンバーを初期化。
		this.buttonBar = new ButtonBar(buttonBarEl, {
			onSortOrderChange: (order) => this.handleSortOrderChange(order),
			onRefreshClick: () => void this.handleRefresh(),
		});
		this.buttonBar.render(this.currentOrder);

		//! カレンダーを初期化。
		this.calendarView = new CalendarView(calendarAreaEl, {
			onDateSelect: (date) => void this.handleDateSelect(date),
		});
		this.calendarView.render();

		//! メモリストを初期化。
		this.memoList = new MemoList(listAreaEl, this.memos, {
			onDelete: (memoId) => void this.handleDelete(memoId),
		});
		this.memoList.render();

		//! 入力フォームを初期化。
		this.inputForm = new InputForm(inputAreaEl, {
			onSubmit: (content, attachments) => void this.handleSubmit(content, attachments),
		});
		this.inputForm.render();
	}

	//! メモを読み込む。
	private async loadMemos(): Promise<void> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();
			const category = this.currentCategory || settings.defaultCategory;

			//! ファイルパスを生成。
			const filePath = PathGenerator.generateFilePath(
				settings.rootDirectory,
				category,
				settings.saveUnit,
				settings.useDirectoryCategory
			);

			//! ファイルが存在するか確認。
			const fileExists = this.memoManager.vaultHandler.fileExists(filePath);

			if (fileExists) {
				//! メモを読み込む。
				this.memos = await this.memoManager.getMemos(filePath, category);

				//! ソート順に応じて並べ替え。
				this.sortMemos();
			} else {
				//! ファイルが存在しない場合は空配列。
				this.memos = [];
			}

			//! 日付でフィルタリング。
			let displayMemos = this.memos;
			if (this.selectedDate) {
				displayMemos = this.filterMemosByDate(this.memos, this.selectedDate);
			}

			//! メモリストを更新。
			if (this.memoList) {
				this.memoList.updateMemos(displayMemos);
			}

			//! カレンダーのメモカウントを更新。
			if (this.calendarView) {
				const timestamps = this.memos.map((memo) => memo.timestamp);
				this.calendarView.updateMemoCounts(timestamps);
			}
		} catch (error) {
			console.error("メモ読み込みエラー:", error);
			new Notice("メモの読み込みに失敗しました");
			this.memos = [];
		}
	}

	//! 日付でメモをフィルタリングする。
	private filterMemosByDate(memos: MemoEntry[], date: Date): MemoEntry[] {
		const targetDate = new Date(date.getTime());
		targetDate.setHours(0, 0, 0, 0);

		const nextDate = new Date(targetDate.getTime());
		nextDate.setDate(nextDate.getDate() + 1);

		return memos.filter((memo) => {
			const memoDate = new Date(memo.timestamp);
			memoDate.setHours(0, 0, 0, 0);
			return memoDate.getTime() === targetDate.getTime();
		});
	}

	//! メモをソートする。
	private sortMemos(): void {
		this.memos.sort((a, b) => {
			const timeA = new Date(a.timestamp).getTime();
			const timeB = new Date(b.timestamp).getTime();
			return this.currentOrder === "asc" ? timeA - timeB : timeB - timeA;
		});
	}

	//! カテゴリ変更処理。
	private async handleCategoryChange(category: string): Promise<void> {
		this.currentCategory = category;
		await this.loadMemos();
	}

	//! 日付選択処理。
	private async handleDateSelect(date: Date | null): Promise<void> {
		this.selectedDate = date;
		await this.loadMemos();
	}

	//! メモ送信処理。
	private async handleSubmit(content: string, attachmentNames: string[]): Promise<void> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();
			const category = this.currentCategory || settings.defaultCategory;

			//! ファイルパスを生成。
			const filePath = PathGenerator.generateFilePath(
				settings.rootDirectory,
				category,
				settings.saveUnit,
				settings.useDirectoryCategory
			);

			//! 添付ファイルをVaultにコピー。
			const copiedAttachments: string[] = [];
			if (attachmentNames.length > 0 && this.inputForm) {
				const selectedFiles = this.inputForm.getSelectedFiles();
				const attachmentDir = `${settings.rootDirectory}/attachments`;

				//! 添付ファイルディレクトリを作成。
				const dirExists = this.memoManager.vaultHandler.fileExists(attachmentDir);
				if (!dirExists) {
					await this.app.vault.createFolder(attachmentDir).catch(() => {
						//! ディレクトリが既に存在する場合は無視。
					});
				}

				//! 各ファイルをコピー。
				for (const file of selectedFiles) {
					const timestamp = Date.now();
					const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
					const targetPath = `${attachmentDir}/${timestamp}_${sanitizedName}`;

					//! ファイルを読み込んでVaultに書き込み。
					const arrayBuffer = await file.arrayBuffer();
					await this.app.vault.createBinary(targetPath, arrayBuffer);

					copiedAttachments.push(targetPath);
				}
			}

			//! メモを追加。
			await this.memoManager.addMemo(
				filePath,
				category,
				content,
				this.currentOrder,
				undefined,
				copiedAttachments
			);

			//! メモリストを再読み込み。
			await this.loadMemos();

			new Notice("メモを追加しました");
		} catch (error) {
			console.error("メモ追加エラー:", error);
			new Notice("メモの追加に失敗しました");
		}
	}

	//! メモ削除処理。
	private async handleDelete(memoId: string): Promise<void> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();
			const category = this.currentCategory || settings.defaultCategory;

			//! ファイルパスを生成。
			const filePath = PathGenerator.generateFilePath(
				settings.rootDirectory,
				category,
				settings.saveUnit,
				settings.useDirectoryCategory
			);

			//! メモを削除。
			const deleted = await this.memoManager.deleteMemo(filePath, category, memoId);

			if (deleted) {
				//! メモリストを再読み込み。
				await this.loadMemos();
				new Notice("メモを削除しました");
			} else {
				new Notice("メモが見つかりませんでした");
			}
		} catch (error) {
			console.error("メモ削除エラー:", error);
			new Notice("メモの削除に失敗しました");
		}
	}

	//! ソート順変更処理。
	private handleSortOrderChange(order: SortOrder): void {
		this.currentOrder = order;

		//! メモをソート。
		this.sortMemos();

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
		void this.onOpen();
	}
}
