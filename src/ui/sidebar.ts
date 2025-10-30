import { ItemView, WorkspaceLeaf, Notice, TFile, setIcon, EventRef } from "obsidian";
import MemologPlugin from "../../main";
import { MemoEntry, SortOrder } from "../types";
import { MemoManager } from "../core/memo-manager";
import { MemoList } from "./components/memo-list";
import { InputForm } from "./components/input-form";
import { ButtonBar } from "./components/button-bar";
import { CategoryTabs } from "./components/category-tabs";
import { CalendarView } from "./components/calendar-view";
import { SearchBar } from "./components/search-bar";
import { SearchEngine, SearchQuery } from "../core/search-engine";
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
	private calendarAreaEl: HTMLElement | null = null;
	private searchBar: SearchBar | null = null;
	private memoList: MemoList | null = null;
	private inputForm: InputForm | null = null;
	private buttonBar: ButtonBar | null = null;

	//! UI要素への参照。
	private listAreaEl: HTMLElement | null = null;
	private inputAreaEl: HTMLElement | null = null;
	private searchAreaEl: HTMLElement | null = null;

	//! 現在の状態。
	private currentCategory: string = ""; //! ディレクトリ名を保存（"all"は特別扱い）。
	private currentOrder: SortOrder = "asc";
	private selectedDate: Date | null = null;
	private currentDateRange: import("./components/button-bar").DateRangeFilter = "all"; //! 日付範囲フィルター。
	private calendarVisible: boolean = false;
	private searchVisible: boolean = false;
	private currentSearchQuery: SearchQuery | null = null;
	private showCompletedTodos: boolean = false; //! 完了済みTODOの表示状態（一時的）。

	//! メモデータ。
	private memos: MemoEntry[] = [];

	//! UI要素への参照（TODOボタン用）。
	private todoToggleBtn: HTMLElement | null = null;

	//! ファイル変更監視用のイベントリファレンス。
	private fileModifyRef: EventRef | null = null;

	//! loadMemos()のロック（並行実行を防ぐ）。
	private isLoadingMemos: boolean = false;

	//! カレンダー用メモカウントキャッシュ（ファイルパス → { 更新日時, タイムスタンプ配列 }）。
	private memoCountCache: Map<string, { mtime: number; timestamps: string[] }> = new Map();

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

		//! 設定からソート順を読み込む。
		const settings = this.plugin.settingsManager.getGlobalSettings();
		this.currentOrder = settings.order;

		//! メインコンテナを作成。
		container.addClass("memolog-container");

		//! カテゴリタブ領域を作成（ハンバーガーメニューとソートボタンも含む）。
		const categoryTabsArea = this.createCategoryTabsArea(container);

		//! カレンダー領域を作成。
		const calendarArea = this.createCalendarArea(container);

		//! 検索バー領域を作成。
		const searchArea = this.createSearchArea(container);
		this.searchAreaEl = searchArea;

		//! メモ表示領域を作成。
		const listArea = this.createMemoListArea(container);
		this.listAreaEl = listArea;

		//! 入力欄を作成。
		const inputArea = this.createInputArea(container);
		this.inputAreaEl = inputArea;

		//! コンポーネントを初期化。
		this.initializeComponents(categoryTabsArea, calendarArea, searchArea, listArea, inputArea);

		//! 初期レイアウトを設定。
		this.updateInputAreaPosition();

		//! 初期データを読み込む。
		await this.loadMemos();

		//! ファイル変更イベントリスナーを登録。
		this.registerFileWatcher();
	}

	//! ビューを閉じたときの処理。
	// eslint-disable-next-line @typescript-eslint/require-await
	override async onClose(): Promise<void> {
		//! ファイル変更イベントリスナーを解除。
		this.unregisterFileWatcher();

		//! キャッシュをクリア。
		this.memoCountCache.clear();

		//! クリーンアップ処理。
		this.containerEl.empty();
	}

	//! カテゴリタブ領域を作成する（ハンバーガーメニュー、検索ボタン、設定ボタン、ソートボタンも含む）。
	private createCategoryTabsArea(container: HTMLElement): HTMLElement {
		const categoryTabsArea = container.createDiv({ cls: "memolog-category-tabs-area" });

		//! 1行目: ツールバー（ハンバーガー、日付範囲フィルター、検索バー、検索ボタン、設定、ソート）。
		const topRow = categoryTabsArea.createDiv({ cls: "memolog-toolbar-row" });

		//! ハンバーガーメニューボタン。
		topRow.createDiv({ cls: "memolog-hamburger-btn" });

		//! 日付範囲フィルターボタン。
		topRow.createDiv({ cls: "memolog-date-range-filters" });

		//! 検索バー配置用の空白エリア（SearchBarコンポーネントがここに入る）。
		topRow.createDiv({ cls: "memolog-search-bar-placeholder" });

		//! TODO完了済み表示切り替えボタン（TODOリストカテゴリの場合のみ表示）。
		topRow.createDiv({ cls: "memolog-todo-toggle-btn" });

		//! 検索ボタン。
		topRow.createDiv({ cls: "memolog-search-btn" });

		//! 設定ボタン。
		topRow.createDiv({ cls: "memolog-settings-btn" });

		//! ソート順ボタン。
		topRow.createDiv({ cls: "memolog-sort-btn-wrapper" });

		//! 2行目: タブコンテナ。
		const tabsRow = categoryTabsArea.createDiv({ cls: "memolog-tabs-row" });
		const tabsContainer = tabsRow.createDiv({ cls: "memolog-category-tabs-wrapper" });

		return tabsContainer;
	}

	//! カレンダー領域を作成する（ドロワーメニュー）。
	private createCalendarArea(container: HTMLElement): HTMLElement {
		//! ドロワーオーバーレイ（背景）。
		const drawerOverlay = container.createDiv({ cls: "memolog-drawer-overlay" });
		drawerOverlay.style.display = "none";

		//! ドロワーコンテンツ（左からスライドイン）。
		const drawerContent = drawerOverlay.createDiv({ cls: "memolog-drawer-content" });

		//! ドロワーヘッダー。
		const drawerHeader = drawerContent.createDiv({ cls: "memolog-drawer-header" });
		drawerHeader.createDiv({ cls: "memolog-drawer-title", text: "カレンダー" });
		const closeBtn = drawerHeader.createDiv({ cls: "memolog-drawer-close-btn" });
		setIcon(closeBtn, "x");
		closeBtn.addEventListener("click", () => this.toggleCalendar());

		//! カレンダーコンテンツエリア（スクロール可能）。
		const calendarArea = drawerContent.createDiv({ cls: "memolog-drawer-calendar-area" });

		//! オーバーレイ背景クリックで閉じる。
		drawerOverlay.addEventListener("click", (e) => {
			if (e.target === drawerOverlay) {
				this.toggleCalendar();
			}
		});

		this.calendarAreaEl = drawerOverlay;
		return calendarArea;
	}

	//! 検索バー領域を作成する。
	private createSearchArea(container: HTMLElement): HTMLElement {
		const searchArea = container.createDiv({ cls: "memolog-search-area" });
		searchArea.style.display = "none";
		return searchArea;
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
		calendarAreaEl: HTMLElement,
		searchAreaEl: HTMLElement,
		listAreaEl: HTMLElement,
		inputAreaEl: HTMLElement
	): void {
		//! 設定を取得。
		const settings = this.plugin.settingsManager.getGlobalSettings();

		//! カテゴリタブエリアを取得してボタンを配置。
		const categoryTabsArea = this.containerEl.querySelector(".memolog-category-tabs-area") as HTMLElement;
		if (categoryTabsArea) {
			const hamburgerBtn = categoryTabsArea.querySelector(
				".memolog-hamburger-btn"
			) as HTMLElement;
			const dateRangeFilters = categoryTabsArea.querySelector(
				".memolog-date-range-filters"
			) as HTMLElement;
			const searchBtn = categoryTabsArea.querySelector(
				".memolog-search-btn"
			) as HTMLElement;
			const settingsBtn = categoryTabsArea.querySelector(
				".memolog-settings-btn"
			) as HTMLElement;
			const sortBtnWrapper = categoryTabsArea.querySelector(
				".memolog-sort-btn-wrapper"
			) as HTMLElement;
			const todoToggleBtn = categoryTabsArea.querySelector(
				".memolog-todo-toggle-btn"
			) as HTMLElement;

			//! TODO完了済み表示切り替えボタンを初期化。
			this.todoToggleBtn = todoToggleBtn;
			this.initializeTodoToggleButton(todoToggleBtn);

			//! ボタンバーを初期化（ハンバーガー、日付範囲フィルター、検索、設定、ソートボタン）。
			this.buttonBar = new ButtonBar(categoryTabsArea, {
				onSortOrderChange: (order) => this.handleSortOrderChange(order),
				onCalendarClick: () => this.toggleCalendar(),
				onSearchClick: () => this.toggleSearch(),
				onSettingsClick: () => this.openSettings(),
				onDateRangeChange: (filter) => this.handleDateRangeChange(filter),
			});
			this.buttonBar.renderInline(this.currentOrder, hamburgerBtn, dateRangeFilters, searchBtn, settingsBtn, sortBtnWrapper);
		}

		//! カテゴリタブを初期化。
		if (settings.categories.length > 0) {
			this.categoryTabs = new CategoryTabs(
				categoryTabsAreaEl,
				settings.categories,
				{
					onCategoryChange: (categoryDirectory) => void this.handleCategoryTabChange(categoryDirectory),
				},
				settings.showAllTab,
				settings.showTrashTab,
				settings.showPinnedTab
			);
			//! defaultCategoryからディレクトリ名を取得。
			const defaultCategoryConfig = settings.categories.find(
				(c) => c.directory === settings.defaultCategory
			);
			this.currentCategory = defaultCategoryConfig?.directory || settings.categories[0].directory;
			this.categoryTabs.render(this.currentCategory);
		} else {
			//! カテゴリが設定されていない場合はデフォルトカテゴリのディレクトリ名を使用。
			const defaultCategoryConfig = settings.categories.find(
				(c) => c.directory === settings.defaultCategory
			);
			this.currentCategory = defaultCategoryConfig?.directory || settings.defaultCategory;
		}

		//! カレンダーを初期化。
		this.calendarView = new CalendarView(calendarAreaEl, {
			onDateSelect: (date) => void this.handleDateSelect(date),
		});
		this.calendarView.render();

		//! 検索バーを初期化。
		this.searchBar = new SearchBar(searchAreaEl, {
			onSearch: (query) => void this.handleSearch(query),
			onClear: () => void this.handleSearchClear(),
		});
		this.searchBar.render();

		//! カテゴリリストを検索バーに設定。
		if (settings.categories.length > 0) {
			const categoryNames = settings.categories.map((c) => c.directory);
			this.searchBar.setCategories(categoryNames);
		}

		//! メモリストを初期化。
		this.memoList = new MemoList(
			this.app,
			listAreaEl,
			this.memos,
			{
				onDelete: (memoId) => void this.handleDelete(memoId),
				onSaveEdit: (memoId, newContent) => void this.handleSaveEdit(memoId, newContent),
				onAddToDailyNote: (memo) => void this.handleAddToDailyNote(memo),
				onImagePaste: (file) => this.handleImagePaste(file),
				onCategoryChange: (memoId, newCategory) => void this.handleCategoryChange(memoId, newCategory),
				onTodoToggle: (memoId, completed) => void this.handleTodoToggle(memoId, completed),
				onRestore: (memoId) => void this.handleRestore(memoId),
				onPinToggle: (memoId, isPinned) => void this.handlePinToggle(memoId, isPinned),
			},
			settings.enableDailyNotes,
			"", //! メモのMarkdownレンダリング用ソースパス（空文字列でVaultルートを指定）。
			settings.categories,
			false, //! 初期状態ではゴミ箱表示ではない。
			settings.pinnedMemoIds
		);
		this.memoList.render();

		//! 入力フォームを初期化。
		this.inputForm = new InputForm(inputAreaEl, {
			onSubmit: (content, attachments) => void this.handleSubmit(content, attachments),
			onImagePaste: (file) => this.handleImagePaste(file),
		});
		this.inputForm.render();
	}

	//! メモを読み込む。
	private async loadMemos(): Promise<void> {
		//! 既に読み込み中の場合はスキップ。
		if (this.isLoadingMemos) {
			return;
		}

		this.isLoadingMemos = true;

		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();

			//! ゴミ箱タブとピン留めタブの場合は入力フォームを非表示に、それ以外は表示。
			if (this.inputAreaEl) {
				this.inputAreaEl.style.display =
					this.currentCategory === "trash" || this.currentCategory === "pinned" ? "none" : "";
			}

			//! "pinned"が選択されている場合はピン留めメモのみ読み込む。
			if (this.currentCategory === "pinned") {
				//! 全メモから読み込み。
				const allMemos = await this.loadMemosForDateRange(undefined, undefined);

				//! ピン留めメモのみ抽出。
				this.memos = allMemos.filter((memo) => settings.pinnedMemoIds.includes(memo.id));

				this.sortMemos();
			} else if (this.currentCategory === "trash") {
				//! "trash"が選択されている場合は全カテゴリから削除フラグ付きメモを読み込む。
				//! 全期間のメモを読み込む。
				const allMemos = await this.loadMemosForDateRange();
				//! 削除フラグが付いているメモのみフィルタリング（trashedAtが存在するメモ）。
				this.memos = allMemos.filter((memo: MemoEntry) => memo.trashedAt);

				this.sortMemos();
			} else if (this.currentCategory === "all") {
				//! 日付範囲フィルターが設定されている場合は、そのフィルターに応じて読み込む。
				if (this.currentDateRange && this.currentDateRange !== "all") {
					let startDate: string | undefined;
					let endDate: string | undefined;

					if (this.currentDateRange === "today") {
						//! 今日のメモのみ。
						const today = new Date();
						const todayStr = today.toISOString().split("T")[0];
						startDate = todayStr;
						endDate = todayStr;
					} else if (this.currentDateRange === "week") {
						//! 過去一週間。
						const today = new Date();
						const weekAgo = new Date(today);
						weekAgo.setDate(today.getDate() - 7);
						startDate = weekAgo.toISOString().split("T")[0];
						endDate = today.toISOString().split("T")[0];
					}
					//! "all"の場合はstartDate, endDateともにundefinedのまま（全期間）。

					this.memos = await this.loadMemosForDateRange(startDate, endDate);
					this.sortMemos();
				} else if (this.selectedDate) {
					//! カレンダーで日付が選択されている場合は、その日付のメモを読み込む。
					this.memos = [];
					const processedFiles = new Set<string>(); //! 処理済みファイルパスを記録。

					for (const cat of settings.categories) {
						const filePath = settings.pathFormat
							? PathGenerator.generateCustomPath(
									settings.rootDirectory,
									cat.directory,
									settings.pathFormat,
									settings.useDirectoryCategory,
									this.selectedDate
								)
							: PathGenerator.generateFilePath(
									settings.rootDirectory,
									cat.directory,
									settings.saveUnit,
									settings.useDirectoryCategory,
									this.selectedDate
								);

						//! 既に処理済みのファイルはスキップ（重複読み込み防止）。
						if (processedFiles.has(filePath)) {
							continue;
						}
						processedFiles.add(filePath);

						const fileExists = this.memoManager.vaultHandler.fileExists(filePath);

						if (fileExists) {
							//! useDirectoryCategoryの設定に関わらず、ファイル全体を読み込む。
							//! getMemos()でカテゴリフィルタリングを行わない（空文字を渡す）。
							const fileContent = await this.memoManager.vaultHandler.readFile(filePath);
							const memoTexts = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());
							for (const text of memoTexts) {
								const memo = this.memoManager["parseTextToMemo"](text, "");
								if (memo) {
									this.memos.push(memo);
								}
							}
						}
					}

					//! ソート順に応じて並べ替え。
					this.sortMemos();
				} else {
					//! 日付範囲フィルターもカレンダー選択もない場合は、「全期間」と同じ挙動。
					this.memos = await this.loadMemosForDateRange();
					this.sortMemos();
				}
			} else {
				//! 特定のカテゴリのメモを読み込む（currentCategoryはディレクトリ名）。
				const categoryDirectory = this.currentCategory;

				//! 日付範囲フィルターが設定されている場合は、その範囲のメモを読み込む。
				if (this.currentDateRange && !this.selectedDate) {
					const allMemos: MemoEntry[] = [];

					//! 日付範囲を計算。
					let startDate: Date;
					let endDate: Date = new Date();

					if (this.currentDateRange === "today") {
						startDate = new Date();
					} else if (this.currentDateRange === "week") {
						startDate = new Date();
						startDate.setDate(endDate.getDate() - 7);
					} else {
						//! "all"の場合は、過去2年分のデータを読み込む（パフォーマンス考慮）。
						startDate = new Date();
						startDate.setFullYear(endDate.getFullYear() - 2);
					}

					//! 日付範囲内の各日付に対してファイルを読み込む。
					const currentDate = new Date(startDate);
					while (currentDate <= endDate) {
						const filePath = settings.pathFormat
							? PathGenerator.generateCustomPath(
									settings.rootDirectory,
									categoryDirectory,
									settings.pathFormat,
									settings.useDirectoryCategory,
									currentDate
								)
							: PathGenerator.generateFilePath(
									settings.rootDirectory,
									categoryDirectory,
									settings.saveUnit,
									settings.useDirectoryCategory,
									currentDate
								);

						//! ファイルが存在する場合のみ読み込む。
						if (this.memoManager.vaultHandler.fileExists(filePath)) {
							const memos = await this.memoManager.getMemos(filePath, categoryDirectory);
							allMemos.push(...memos);
						}

						//! 次の日へ。
						currentDate.setDate(currentDate.getDate() + 1);
					}

					this.memos = allMemos;
					this.sortMemos();
				} else {
					//! カレンダーで日付が選択されている場合、またはフィルターが未設定の場合。
					const targetDate = this.selectedDate || new Date();
					const filePath = settings.pathFormat
						? PathGenerator.generateCustomPath(
								settings.rootDirectory,
								categoryDirectory,
								settings.pathFormat,
								settings.useDirectoryCategory,
								targetDate
							)
						: PathGenerator.generateFilePath(
								settings.rootDirectory,
								categoryDirectory,
								settings.saveUnit,
								settings.useDirectoryCategory,
								targetDate
							);

					//! ファイルが存在するか確認。
					const fileExists = this.memoManager.vaultHandler.fileExists(filePath);

					if (fileExists) {
						//! メモを読み込む。
						this.memos = await this.memoManager.getMemos(filePath, categoryDirectory);

						//! ソート順に応じて並べ替え。
						this.sortMemos();
					} else {
						//! ファイルが存在しない場合は空配列。
						this.memos = [];
					}
				}
			}

			//! 日付でフィルタリング。
			let displayMemos = this.memos;
			if (this.selectedDate) {
				displayMemos = this.filterMemosByDate(this.memos, this.selectedDate);
			}

			//! 検索クエリが存在する場合は検索フィルターを適用。
			if (this.currentSearchQuery) {
				const result = SearchEngine.search(displayMemos, this.currentSearchQuery);
				displayMemos = result.matches;
			}

			//! ゴミ箱タブの場合は削除されたメモのみ表示、それ以外は削除されていないメモのみ表示。
			if (this.currentCategory === "trash") {
				//! ゴミ箱タブ: trashedAtが存在するメモのみ表示。
				displayMemos = displayMemos.filter((memo) => memo.trashedAt);
			} else {
				//! 通常タブ: trashedAtが存在しないメモのみ表示。
				displayMemos = displayMemos.filter((memo) => !memo.trashedAt);
			}

			//! ピン留めメモを追加（日付フィルタを無視、allタブ以外はカテゴリフィルタを適用）。
			if (settings.pinnedMemoIds.length > 0 && this.currentCategory !== "trash") {
				//! 全メモから読み込み。
				const allMemos = await this.loadMemosForDateRange(undefined, undefined);

				//! ピン留めメモを抽出（削除されていないメモのみ）。
				const pinnedMemos = allMemos.filter((memo) =>
					settings.pinnedMemoIds.includes(memo.id) && !memo.trashedAt
				);

				//! allタブ以外の場合はカテゴリフィルタを適用。
				const filteredPinnedMemos =
					this.currentCategory === "all"
						? pinnedMemos
						: pinnedMemos.filter((memo) => memo.category === this.currentCategory);

				//! displayMemosに既に含まれているメモは除外。
				const displayMemoIds = new Set(displayMemos.map((m) => m.id));
				const uniquePinnedMemos = filteredPinnedMemos.filter(
					(memo) => !displayMemoIds.has(memo.id)
				);

				//! ピン留めメモを先頭に追加。
				displayMemos = [...uniquePinnedMemos, ...displayMemos];
			}

			//! TODOリストカテゴリで、そのカテゴリが選択されている場合、完了済みメモを条件付きで非表示にする。
			if (this.currentCategory !== "all") {
				const settings = this.plugin.settingsManager.getGlobalSettings();
				const categoryConfig = settings.categories.find((c) => c.directory === this.currentCategory);
				if (categoryConfig?.useTodoList && !this.showCompletedTodos) {
					//! showCompletedTodosがfalseの場合のみ、チェック済み（content が - [x] で始まる）のメモを除外。
					displayMemos = displayMemos.filter((m) => !/^-\s*\[x\]\s+/.test(m.content));
				}
			}

			//! TODO完了済み表示ボタンの表示/非表示を更新。
			this.updateTodoToggleButtonVisibility();

			//! メモリストを更新。
			if (this.memoList) {
				//! ゴミ箱表示フラグを設定。
				this.memoList.setIsTrash(this.currentCategory === "trash");
				//! ピン留めIDリストを更新。
				this.memoList.updatePinnedMemoIds(settings.pinnedMemoIds);
				this.memoList.updateMemos(displayMemos);
				//! 最新メモが表示されるようにスクロール。
				this.memoList.scrollToLatest(this.currentOrder);
			}

			//! カレンダーのメモカウントを更新（全カテゴリのメモを集計）。
			if (this.calendarView) {
				const timestamps = await this.getAllMemoTimestamps();
				this.calendarView.updateMemoCounts(timestamps);
			}
		} catch (error) {
			console.error("メモ読み込みエラー:", error);
			new Notice("メモの読み込みに失敗しました");
			this.memos = [];
		} finally {
			this.isLoadingMemos = false;
		}
	}

	//! 全カテゴリのメモのタイムスタンプを取得する（カレンダー用、キャッシュ機構付き）。
	private async getAllMemoTimestamps(): Promise<string[]> {
		const settings = this.plugin.settingsManager.getGlobalSettings();
		const timestamps: string[] = [];

		//! Vault内の全てのMarkdownファイルを取得。
		const allFiles = this.app.vault.getMarkdownFiles();

		//! rootDirectory配下のファイルのみをフィルタリング。
		const memologFiles = allFiles.filter((file) => file.path.startsWith(settings.rootDirectory + "/"));

		for (const file of memologFiles) {
			const filePath = file.path;

			//! ファイルの更新日時を取得。
			const currentMtime = file.stat.mtime;

			//! キャッシュをチェック。
			const cached = this.memoCountCache.get(filePath);
			if (cached && cached.mtime === currentMtime) {
				//! キャッシュが有効な場合はキャッシュを使用。
				timestamps.push(...cached.timestamps);
				continue;
			}

			//! キャッシュが無効またはない場合はファイルを読み込む。
			const fileContent = await this.memoManager.vaultHandler.readFile(filePath);
			const memoTexts = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());
			const fileTimestamps: string[] = [];

			for (const text of memoTexts) {
				const memo = this.memoManager["parseTextToMemo"](text, "");
				if (memo) {
					fileTimestamps.push(memo.timestamp);
				}
			}

			//! キャッシュを更新。
			this.memoCountCache.set(filePath, {
				mtime: currentMtime,
				timestamps: fileTimestamps,
			});

			timestamps.push(...fileTimestamps);
		}

		return timestamps;
	}

	//! ファイル変更イベントリスナーを登録する。
	private registerFileWatcher(): void {
		this.fileModifyRef = this.app.metadataCache.on("changed", (file: TFile) => {
			void this.handleFileModified(file);
		});
	}

	//! ファイル変更イベントリスナーを解除する。
	private unregisterFileWatcher(): void {
		if (this.fileModifyRef) {
			this.app.metadataCache.offref(this.fileModifyRef);
			this.fileModifyRef = null;
		}
	}

	//! ファイルが変更されたときの処理。
	private async handleFileModified(file: TFile): Promise<void> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();

			//! 変更されたファイルがmemologの管理下にあるか確認。
			if (!file.path.startsWith(settings.rootDirectory)) {
				return;
			}

			//! .mdファイルでない場合は無視。
			if (!file.path.endsWith(".md")) {
				return;
			}

			//! メモを再読み込み。
			await this.loadMemos();
		} catch (error) {
			console.error("ファイル変更処理エラー:", error);
		}
	}

	//! 日付でメモをフィルタリングする（ローカルタイムゾーンの日付で比較）。
	private filterMemosByDate(memos: MemoEntry[], date: Date): MemoEntry[] {
		//! ターゲット日付の年月日を取得。
		const targetYear = date.getFullYear();
		const targetMonth = date.getMonth();
		const targetDay = date.getDate();

		const filtered = memos.filter((memo) => {
			//! メモのタイムスタンプをローカル日付に変換。
			const memoDate = new Date(memo.timestamp);
			const memoYear = memoDate.getFullYear();
			const memoMonth = memoDate.getMonth();
			const memoDay = memoDate.getDate();

			return targetYear === memoYear && targetMonth === memoMonth && targetDay === memoDay;
		});

		return filtered;
	}

	//! メモをソートする。
	private sortMemos(): void {
		this.memos.sort((a, b) => {
			const timeA = new Date(a.timestamp).getTime();
			const timeB = new Date(b.timestamp).getTime();
			return this.currentOrder === "asc" ? timeA - timeB : timeB - timeA;
		});
	}

	//! カテゴリタブ変更処理。
	private async handleCategoryTabChange(category: string): Promise<void> {
		this.currentCategory = category;
		await this.loadMemos();
	}

	//! 日付選択処理。
	private async handleDateSelect(date: Date | null): Promise<void> {
		this.selectedDate = date;
		await this.loadMemos();
	}

	//! Daily Noteに追加処理。
	private async handleAddToDailyNote(memo: MemoEntry): Promise<void> {
		try {
			//! Daily Noteのパスを取得。
			const memoDate = new Date(memo.timestamp);
			const dailyNotePath = this.getDailyNotePath(memoDate);

			//! Daily Noteを開く（存在しない場合は作成）。
			let dailyNote = this.app.vault.getAbstractFileByPath(dailyNotePath);

			if (!dailyNote) {
				//! Daily Noteが存在しない場合は作成。
				const dailyNoteContent = `# ${this.formatDateForDailyNote(memoDate)}\n\n`;
				dailyNote = await this.app.vault.create(dailyNotePath, dailyNoteContent);
			}

			if (dailyNote && dailyNote instanceof TFile) {
				//! 既存の内容を読み込む。
				const existingContent = await this.app.vault.read(dailyNote);

				//! メモを追加するテキストを作成。
				const memoText = this.formatMemoForDailyNote(memo);

				//! ファイル末尾に追加。
				const newContent = `${existingContent}\n${memoText}`;
				await this.app.vault.modify(dailyNote, newContent);

				//! Daily Noteを開く。
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(dailyNote);

				new Notice("Daily Noteに追加しました");
			}
		} catch (error) {
			console.error("Daily Note追加エラー:", error);
			new Notice("Daily Noteへの追加に失敗しました");
		}
	}

	//! Daily Noteのパスを取得する。
	private getDailyNotePath(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");

		//! デフォルトのDaily Notesフォーマット（YYYY-MM-DD.md）。
		return `Daily Notes/${year}-${month}-${day}.md`;
	}

	//! 日付をDaily Note用にフォーマットする。
	private formatDateForDailyNote(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	//! メモをDaily Note用にフォーマットする。
	private formatMemoForDailyNote(memo: MemoEntry): string {
		const timestamp = new Date(memo.timestamp);
		const hours = timestamp.getHours().toString().padStart(2, "0");
		const minutes = timestamp.getMinutes().toString().padStart(2, "0");

		let text = `## ${hours}:${minutes}\n\n${memo.content}\n`;

		//! 添付ファイルがある場合は追加。
		if (memo.attachments && memo.attachments.length > 0) {
			text += "\n### 添付ファイル\n\n";
			for (const attachment of memo.attachments) {
				text += `![[${attachment}]]\n`;
			}
		}

		return text;
	}

	//! 画像ペースト処理（画像を保存してMarkdownリンクを返す）。
	private async handleImagePaste(file: File): Promise<string | null> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();
			const category = this.currentCategory || settings.defaultCategory;

			//! 現在のメモが保存されるパスを取得（添付ファイルパスの計算に必要）。
			const memoFilePath = settings.pathFormat
				? PathGenerator.generateCustomPath(
						settings.rootDirectory,
						category,
						settings.pathFormat,
						settings.useDirectoryCategory
					)
				: PathGenerator.generateFilePath(
						settings.rootDirectory,
						category,
						settings.saveUnit,
						settings.useDirectoryCategory
					);

			//! PathGeneratorを使用して添付ファイルの完全なパスを生成。
			const filePath = PathGenerator.generateAttachmentPath(
				settings.rootDirectory,
				memoFilePath,
				settings.attachmentPath,
				settings.attachmentNameFormat,
				file.name
			);

			//! 添付ファイルディレクトリを作成。
			const attachmentDir = filePath.substring(0, filePath.lastIndexOf("/"));
			const dirExists = this.memoManager.vaultHandler.folderExists(attachmentDir);
			if (!dirExists) {
				await this.memoManager.vaultHandler.createFolder(attachmentDir);
			}

			//! ファイルを保存。
			const arrayBuffer = await file.arrayBuffer();
			await this.memoManager.vaultHandler.createBinaryFile(filePath, arrayBuffer);

			//! 標準Markdown形式で画像リンクを生成（alt属性は空）。
			const markdownLink = `![](${filePath})`;

			return markdownLink;
		} catch (error) {
			console.error("Failed to save pasted image:", error);
			new Notice("画像の保存に失敗しました");
			return null;
		}
	}

	//! メモ送信処理。
	private async handleSubmit(content: string, attachmentNames: string[]): Promise<void> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();

			//! "all"が選択されている場合はデフォルトカテゴリのディレクトリ名を取得。
			let categoryDirectory = this.currentCategory;
			if (categoryDirectory === "all") {
				const defaultCategoryConfig = settings.categories.find(
					(c) => c.directory === settings.defaultCategory
				);
				categoryDirectory = defaultCategoryConfig?.directory || settings.defaultCategory;
			}

			//! ファイルパスを生成（directoryを使用）。
			const filePath = settings.pathFormat
				? PathGenerator.generateCustomPath(
						settings.rootDirectory,
						categoryDirectory,
						settings.pathFormat,
						settings.useDirectoryCategory
					)
				: PathGenerator.generateFilePath(
						settings.rootDirectory,
						categoryDirectory,
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

			//! 現在のカテゴリのTODOリスト設定を取得。
			const categoryConfig = settings.categories.find((c) => c.directory === categoryDirectory);
			const useTodoList = categoryConfig?.useTodoList ?? false;

			//! メモを追加（categoryDirectoryをカテゴリとして保存）。
			await this.memoManager.addMemo(
				filePath,
				categoryDirectory,
				content,
				this.currentOrder,
				settings.memoTemplate,
				copiedAttachments,
				undefined,
				undefined,
				useTodoList
			);

			//! メモリストを再読み込み。
			await this.loadMemos();

			new Notice("メモを追加しました");
		} catch (error) {
			console.error("メモ追加エラー:", error);
			if (error instanceof Error) {
				console.error("Error message:", error.message);
				console.error("Error stack:", error.stack);
			}
			new Notice("メモの追加に失敗しました");
		}
	}

	//! メモ削除処理。
	private async handleDelete(memoId: string): Promise<void> {
		try {
			//! 対象のメモを検索。
			const memo = this.memos.find((m) => m.id === memoId);
			if (!memo) {
				new Notice("メモが見つかりませんでした");
				return;
			}

			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();

			let deleted = false;

			//! ゴミ箱タブからの削除の場合は完全削除（元ファイルから削除）。
			if (this.currentCategory === "trash") {
				//! メモのタイムスタンプから日付とファイルパスを取得。
				const memoDate = new Date(memo.timestamp);
				const filePath = settings.pathFormat
					? PathGenerator.generateCustomPath(
							settings.rootDirectory,
							memo.category,
							settings.pathFormat,
							settings.useDirectoryCategory,
							memoDate
						)
					: PathGenerator.generateFilePath(
							settings.rootDirectory,
							memo.category,
							settings.saveUnit,
							settings.useDirectoryCategory,
							memoDate
						);
				deleted = await this.memoManager.deleteMemo(filePath, memo.category, memoId);
			} else {
				//! 通常のカテゴリからの削除。
				//! メモのタイムスタンプから日付を取得。
				const memoDate = new Date(memo.timestamp);

				//! ファイルパスを生成（メモのタイムスタンプとカテゴリを使用）。
				const filePath = settings.pathFormat
					? PathGenerator.generateCustomPath(
							settings.rootDirectory,
							memo.category,
							settings.pathFormat,
							settings.useDirectoryCategory,
							memoDate
						)
					: PathGenerator.generateFilePath(
							settings.rootDirectory,
							memo.category,
							settings.saveUnit,
							settings.useDirectoryCategory,
							memoDate
						);

				//! ゴミ箱機能が有効な場合はゴミ箱に移動、無効な場合は完全削除。
				if (settings.enableTrash) {
					//! ゴミ箱に移動（削除フラグを追加）。
					deleted = await this.memoManager.moveToTrash(
						filePath,
						memo.category,
						memoId,
						settings.rootDirectory
					);
				} else {
					//! 完全削除。
					deleted = await this.memoManager.deleteMemo(filePath, memo.category, memoId);
				}
			}

			if (deleted) {
				//! メモリストを再読み込み。
				await this.loadMemos();
			}
		} catch (error) {
			console.error("メモ削除エラー:", error);
			new Notice("メモの削除に失敗しました");
		}
	}

	//! メモ復活処理。
	private async handleRestore(memoId: string): Promise<void> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();

			//! ゴミ箱から復活。
			const restored = await this.memoManager.restoreFromTrash(
				memoId,
				settings.rootDirectory,
				settings.pathFormat,
				settings.saveUnit,
				settings.useDirectoryCategory
			);

			if (restored) {
				//! メモリストを再読み込み。
				await this.loadMemos();
			}
		} catch (error) {
			console.error("メモ復活エラー:", error);
			new Notice("メモの復活に失敗しました");
		}
	}

	//! ピン留めトグル処理。
	private async handlePinToggle(memoId: string, isPinned: boolean): Promise<void> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();

			//! ピン留め状態を更新。
			let pinnedMemoIds = [...settings.pinnedMemoIds];
			if (isPinned) {
				//! ピン留め追加。
				if (!pinnedMemoIds.includes(memoId)) {
					pinnedMemoIds.push(memoId);
				}
			} else {
				//! ピン留め解除。
				pinnedMemoIds = pinnedMemoIds.filter((id) => id !== memoId);
			}

			//! 設定を保存。
			await this.plugin.settingsManager.updateGlobalSettings({
				pinnedMemoIds,
			});

			//! メモリストを再描画（ピン留め状態を反映）。
			await this.loadMemos();
		} catch (error) {
			console.error("ピン留めエラー:", error);
			new Notice("ピン留めの変更に失敗しました");
		}
	}

	//! メモ編集保存処理。
	private async handleSaveEdit(memoId: string, newContent: string): Promise<void> {
		try {
			//! 対象のメモを検索。
			const memo = this.memos.find((m) => m.id === memoId);
			if (!memo) {
				new Notice("メモが見つかりませんでした");
				return;
			}

			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();

			//! メモのタイムスタンプから日付を取得。
			const memoDate = new Date(memo.timestamp);

			//! ファイルパスを生成（メモのタイムスタンプとカテゴリを使用）。
			const filePath = settings.pathFormat
				? PathGenerator.generateCustomPath(
						settings.rootDirectory,
						memo.category,
						settings.pathFormat,
						settings.useDirectoryCategory,
						memoDate
					)
				: PathGenerator.generateFilePath(
						settings.rootDirectory,
						memo.category,
						settings.saveUnit,
						settings.useDirectoryCategory,
						memoDate
					);

			//! メモを更新。
			const updated = await this.memoManager.updateMemo(
				filePath,
				memo.category,
				memoId,
				newContent
			);

			if (updated) {
				//! メモリストを再読み込み。
				await this.loadMemos();
			} else {
				new Notice("メモの更新に失敗しました");
			}
		} catch (error) {
			console.error("メモ更新エラー:", error);
			new Notice("メモの更新に失敗しました");
		}
	}

	//! カテゴリ変更処理。
	private async handleCategoryChange(memoId: string, newCategory: string): Promise<void> {
		try {
			//! 対象のメモを検索。
			const memo = this.memos.find((m) => m.id === memoId);
			if (!memo) {
				new Notice("メモが見つかりませんでした");
				return;
			}

			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();
			const oldCategory = memo.category;

			//! 同じカテゴリの場合は何もしない。
			if (oldCategory === newCategory) {
				return;
			}

			//! 日付を取得（メモのタイムスタンプから）。
			const memoDate = new Date(memo.timestamp);

			//! 古いカテゴリのファイルパスを生成。
			const oldFilePath = settings.pathFormat
				? PathGenerator.generateCustomPath(
						settings.rootDirectory,
						oldCategory,
						settings.pathFormat,
						settings.useDirectoryCategory,
						memoDate
					)
				: PathGenerator.generateFilePath(
						settings.rootDirectory,
						oldCategory,
						settings.saveUnit,
						settings.useDirectoryCategory,
						memoDate
					);

			//! 新しいカテゴリのファイルパスを生成。
			const newFilePath = settings.pathFormat
				? PathGenerator.generateCustomPath(
						settings.rootDirectory,
						newCategory,
						settings.pathFormat,
						settings.useDirectoryCategory,
						memoDate
					)
				: PathGenerator.generateFilePath(
						settings.rootDirectory,
						newCategory,
						settings.saveUnit,
						settings.useDirectoryCategory,
						memoDate
					);

			//! 古いファイルからメモを削除。
			const deleted = await this.memoManager.deleteMemo(oldFilePath, oldCategory, memoId);

			if (!deleted) {
				new Notice("メモの削除に失敗しました");
				return;
			}

			//! 新しいファイルにメモを追加（既存のID、タイムスタンプ、テンプレートを保持）。
			await this.memoManager.addMemo(
				newFilePath,
				newCategory,
				memo.content,
				this.currentOrder,
				memo.template || settings.memoTemplate,
				memo.attachments || [],
				memo.id,
				memo.timestamp
			);

			//! メモリストを再読み込み。
			await this.loadMemos();

			new Notice("カテゴリを変更しました");
		} catch (error) {
			console.error("カテゴリ変更エラー:", error);
			new Notice("カテゴリの変更に失敗しました");
		}
	}

	//! TODO完了状態変更処理。
	private async handleTodoToggle(memoId: string, completed: boolean): Promise<void> {
		try {
			//! 対象のメモを検索。
			const memo = this.memos.find((m) => m.id === memoId);
			if (!memo) {
				new Notice("メモが見つかりませんでした");
				return;
			}

			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();
			const memoDate = new Date(memo.timestamp);

			//! ファイルパスを生成。
			const filePath = settings.pathFormat
				? PathGenerator.generateCustomPath(
						settings.rootDirectory,
						memo.category,
						settings.pathFormat,
						settings.useDirectoryCategory,
						memoDate
					)
				: PathGenerator.generateFilePath(
						settings.rootDirectory,
						memo.category,
						settings.saveUnit,
						settings.useDirectoryCategory,
						memoDate
					);

			//! TODO完了状態を更新。
			await this.memoManager.updateTodoCompleted(filePath, memo.category, memoId, completed);

			//! メモリストを再読み込み。
			await this.loadMemos();
		} catch (error) {
			console.error("TODO状態変更エラー:", error);
			new Notice("TODO状態の変更に失敗しました");
		}
	}

	//! ソート順変更処理。
	private async handleSortOrderChange(order: SortOrder): Promise<void> {
		this.currentOrder = order;

		//! メモを再読み込みして、ピン留めメモも含めて正しく表示する。
		await this.loadMemos();

		//! 入力エリアの位置を更新。
		this.updateInputAreaPosition();

		//! 設定に保存。
		void this.plugin.settingsManager.updateGlobalSettings({
			order: order,
		});
	}

	//! 日付範囲フィルター変更処理。
	private async handleDateRangeChange(filter: import("./components/button-bar").DateRangeFilter): Promise<void> {
		this.currentDateRange = filter;
		//! カレンダーの選択をクリア。
		this.selectedDate = null;
		await this.loadMemos();
	}

	//! サイドバーを更新する。
	public refresh(): void {
		void this.onOpen();
	}

	//! ソート順に応じて入力エリアの位置を更新する。
	private updateInputAreaPosition(): void {
		if (!this.listAreaEl || !this.inputAreaEl) {
			return;
		}

		const parent = this.listAreaEl.parentElement;
		if (!parent) {
			return;
		}

		if (this.currentOrder === "desc") {
			//! 降順: 入力エリアをメモリストの前に配置。
			parent.insertBefore(this.inputAreaEl, this.listAreaEl);
			//! 降順用のクラスを追加。
			this.inputAreaEl.addClass("memolog-input-area-order-desc");
		} else {
			//! 昇順: 入力エリアをメモリストの後に配置。
			if (this.listAreaEl.nextSibling !== this.inputAreaEl) {
				parent.insertBefore(this.inputAreaEl, this.listAreaEl.nextSibling);
			}
			//! 降順用のクラスを削除。
			this.inputAreaEl.removeClass("memolog-input-area-order-desc");
		}
	}

	//! カレンダーの表示/非表示を切り替える。
	private toggleCalendar(): void {
		this.calendarVisible = !this.calendarVisible;
		if (this.calendarAreaEl) {
			this.calendarAreaEl.style.display = this.calendarVisible ? "block" : "none";
		}
	}

	//! 検索バーの表示/非表示を切り替える。
	private toggleSearch(): void {
		this.searchVisible = !this.searchVisible;
		if (this.searchAreaEl) {
			this.searchAreaEl.style.display = this.searchVisible ? "block" : "none";
		}
		//! 検索バーを表示した時にフォーカスを当てる。
		if (this.searchVisible && this.searchBar) {
			setTimeout(() => {
				if (this.searchBar) {
					this.searchBar.focus();
				}
			}, 100);
		}
	}

	//! TODO完了済み表示切り替えボタンを初期化する。
	private initializeTodoToggleButton(container: HTMLElement): void {
		//! 初期状態では非表示。
		container.style.display = "none";

		//! ボタンを作成。
		const btn = container.createEl("button", {
			cls: "memolog-btn memolog-btn-todo-toggle",
			attr: { "aria-label": "完了済みTODOを表示" },
		});
		setIcon(btn, "square-check-big");

		//! クリックイベント。
		btn.addEventListener("click", () => {
			this.showCompletedTodos = !this.showCompletedTodos;
			this.updateTodoToggleButtonState();
			void this.loadMemos();
		});
	}

	//! TODO完了済み表示ボタンの状態を更新する。
	private updateTodoToggleButtonState(): void {
		if (!this.todoToggleBtn) return;

		const btn = this.todoToggleBtn.querySelector("button");
		if (!btn) return;

		//! アイコンとaria-labelを更新。
		btn.empty();
		if (this.showCompletedTodos) {
			setIcon(btn, "square-check");
			btn.setAttribute("aria-label", "完了済みTODOを非表示");
			btn.addClass("memolog-btn-active");
		} else {
			setIcon(btn, "square-check-big");
			btn.setAttribute("aria-label", "完了済みTODOを表示");
			btn.removeClass("memolog-btn-active");
		}
	}

	//! TODO完了済み表示ボタンの表示/非表示を更新する。
	private updateTodoToggleButtonVisibility(): void {
		if (!this.todoToggleBtn) return;

		//! 現在のカテゴリがTODOリストカテゴリかチェック。
		const settings = this.plugin.settingsManager.getGlobalSettings();
		const categoryConfig = settings.categories.find((c) => c.directory === this.currentCategory);
		const isTodoCategory = categoryConfig?.useTodoList ?? false;

		//! TODOリストカテゴリの場合のみ表示。
		this.todoToggleBtn.style.display = isTodoCategory ? "" : "none";

		//! カテゴリが切り替わったら状態をリセット。
		if (!isTodoCategory && this.showCompletedTodos) {
			this.showCompletedTodos = false;
			this.updateTodoToggleButtonState();
		}
	}

	//! 検索処理。
	private async handleSearch(query: SearchQuery): Promise<void> {
		this.currentSearchQuery = query;

		//! 日付範囲が指定されている場合は、日付範囲ボタンをクリアする。
		if (query.startDate || query.endDate) {
			this.currentDateRange = null;
			if (this.buttonBar) {
				this.buttonBar.clearDateRange();
			}
		}

		//! 日付範囲が指定されている場合は、その範囲のメモを読み込む。
		let memosToSearch: MemoEntry[] = [];

		if (query.startDate || query.endDate) {
			//! 日付範囲からメモを読み込む。
			memosToSearch = await this.loadMemosForDateRange(query.startDate, query.endDate);
		} else {
			//! 日付範囲が指定されていない場合は現在のメモを使用。
			memosToSearch = this.memos;
		}

		//! 検索を実行。
		const result = SearchEngine.search(memosToSearch, query);

		//! 検索結果を表示。
		if (this.memoList) {
			this.memoList.updateMemos(result.matches);
		}
	}

	//! 日付範囲のメモを読み込む。
	private async loadMemosForDateRange(
		startDateStr?: string,
		endDateStr?: string
	): Promise<MemoEntry[]> {
		const settings = this.plugin.settingsManager.getGlobalSettings();
		const allMemos: MemoEntry[] = [];
		const processedFiles = new Set<string>();

		//! 開始日と終了日を決定。
		const startDate = startDateStr ? new Date(startDateStr) : new Date(0);
		const endDate = endDateStr
			? new Date(endDateStr + "T23:59:59.999")
			: new Date(Date.now() + 86400000);

		//! 日付範囲内の各日付に対してファイルを読み込む。
		const currentDate = new Date(startDate);
		currentDate.setHours(0, 0, 0, 0);

		while (currentDate <= endDate) {
			//! 検索対象のカテゴリを決定。
			//! "all", "pinned", "trash"の場合は全カテゴリを検索。
			const categoriesToSearch =
				this.currentCategory === "all" || this.currentCategory === "pinned" || this.currentCategory === "trash"
					? settings.categories
					: [{ directory: this.currentCategory }];

			for (const cat of categoriesToSearch) {
				const filePath = settings.pathFormat
					? PathGenerator.generateCustomPath(
							settings.rootDirectory,
							cat.directory,
							settings.pathFormat,
							settings.useDirectoryCategory,
							currentDate
						)
					: PathGenerator.generateFilePath(
							settings.rootDirectory,
							cat.directory,
							settings.saveUnit,
							settings.useDirectoryCategory,
							currentDate
						);

				//! 既に処理済みのファイルはスキップ。
				if (processedFiles.has(filePath)) {
					continue;
				}
				processedFiles.add(filePath);

				//! ファイルが存在する場合は読み込む。
				const fileExists = this.memoManager.vaultHandler.fileExists(filePath);

				if (fileExists) {
					const fileContent = await this.memoManager.vaultHandler.readFile(filePath);
					const memoTexts = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());
					for (const text of memoTexts) {
						const memo = this.memoManager["parseTextToMemo"](text, "");
						if (memo) {
							allMemos.push(memo);
						}
					}
				}
			}

			//! 次の日付へ。
			currentDate.setDate(currentDate.getDate() + 1);
		}

		return allMemos;
	}

	//! 検索クリア処理。
	private async handleSearchClear(): Promise<void> {
		this.currentSearchQuery = null;

		//! メモリストを再読み込み。
		await this.loadMemos();
	}

	//! 設定画面を開く。
	private openSettings(): void {
		//! Obsidianの設定画面を開くコマンドを実行。
		// @ts-expect-error - Obsidian internal API
		this.app.commands.executeCommandById("app:open-settings");

		//! 設定画面が開くまで少し待ってから、プラグイン設定タブに移動。
		setTimeout(() => {
			// @ts-expect-error - Obsidian internal API
			const settingTab = this.app.setting;
			if (settingTab) {
				settingTab.openTabById(this.plugin.manifest.id);
			}
		}, 100);
	}
}
