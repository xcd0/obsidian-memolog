import { ItemView, WorkspaceLeaf, Notice, TFile, setIcon, EventRef } from "obsidian";
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
	private calendarAreaEl: HTMLElement | null = null;
	private memoList: MemoList | null = null;
	private inputForm: InputForm | null = null;
	private buttonBar: ButtonBar | null = null;

	//! UI要素への参照。
	private listAreaEl: HTMLElement | null = null;
	private inputAreaEl: HTMLElement | null = null;

	//! 現在の状態。
	private currentCategory: string = ""; //! ディレクトリ名を保存（"all"は特別扱い）。
	private currentOrder: SortOrder = "asc";
	private selectedDate: Date | null = null;
	private calendarVisible: boolean = false;

	//! メモデータ。
	private memos: MemoEntry[] = [];

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

		//! メインコンテナを作成。
		container.addClass("memolog-container");

		//! カテゴリタブ領域を作成（ハンバーガーメニューとソートボタンも含む）。
		const categoryTabsArea = this.createCategoryTabsArea(container);

		//! カレンダー領域を作成。
		const calendarArea = this.createCalendarArea(container);

		//! メモ表示領域を作成。
		const listArea = this.createMemoListArea(container);
		this.listAreaEl = listArea;

		//! 入力欄を作成。
		const inputArea = this.createInputArea(container);
		this.inputAreaEl = inputArea;

		//! コンポーネントを初期化。
		this.initializeComponents(categoryTabsArea, calendarArea, listArea, inputArea);

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

	//! カテゴリタブ領域を作成する（ハンバーガーメニュー、設定ボタン、ソートボタンも含む）。
	private createCategoryTabsArea(container: HTMLElement): HTMLElement {
		const categoryTabsArea = container.createDiv({ cls: "memolog-category-tabs-area" });

		//! 内部コンテナ（flexレイアウト）。
		const innerContainer = categoryTabsArea.createDiv({ cls: "memolog-category-tabs-container" });

		//! ハンバーガーメニューボタン。
		innerContainer.createDiv({ cls: "memolog-hamburger-btn" });

		//! カテゴリタブコンテナ。
		const tabsContainer = innerContainer.createDiv({ cls: "memolog-category-tabs-wrapper" });

		//! 設定ボタン。
		innerContainer.createDiv({ cls: "memolog-settings-btn" });

		//! ソート順ボタン。
		innerContainer.createDiv({ cls: "memolog-sort-btn-wrapper" });

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
		listAreaEl: HTMLElement,
		inputAreaEl: HTMLElement
	): void {
		//! 設定を取得。
		const settings = this.plugin.settingsManager.getGlobalSettings();

		//! カテゴリタブエリアの親要素を取得してボタンを配置。
		const categoryTabsContainer = categoryTabsAreaEl.parentElement;
		if (categoryTabsContainer) {
			const hamburgerBtn = categoryTabsContainer.querySelector(
				".memolog-hamburger-btn"
			) as HTMLElement;
			const settingsBtn = categoryTabsContainer.querySelector(
				".memolog-settings-btn"
			) as HTMLElement;
			const sortBtnWrapper = categoryTabsContainer.querySelector(
				".memolog-sort-btn-wrapper"
			) as HTMLElement;

			//! ボタンバーを初期化（ハンバーガー、設定、ソートボタン）。
			this.buttonBar = new ButtonBar(categoryTabsContainer, {
				onSortOrderChange: (order) => this.handleSortOrderChange(order),
				onCalendarClick: () => this.toggleCalendar(),
				onSettingsClick: () => this.openSettings(),
			});
			this.buttonBar.renderInline(this.currentOrder, hamburgerBtn, settingsBtn, sortBtnWrapper);
		}

		//! カテゴリタブを初期化。
		if (settings.categories.length > 0) {
			this.categoryTabs = new CategoryTabs(
				categoryTabsAreaEl,
				settings.categories,
				{
					onCategoryChange: (categoryDirectory) => void this.handleCategoryChange(categoryDirectory),
				},
				settings.showAllTab
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

		//! メモリストを初期化。
		this.memoList = new MemoList(
			listAreaEl,
			this.memos,
			{
				onDelete: (memoId) => void this.handleDelete(memoId),
				onSaveEdit: (memoId, newContent) => void this.handleSaveEdit(memoId, newContent),
				onAddToDailyNote: (memo) => void this.handleAddToDailyNote(memo),
				onImagePaste: (file) => this.handleImagePaste(file),
			},
			settings.enableDailyNotes,
			"" //! メモのMarkdownレンダリング用ソースパス（空文字列でVaultルートを指定）。
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

			//! "all"が選択されている場合は全カテゴリのメモを読み込む。
			if (this.currentCategory === "all") {
				this.memos = [];
				const processedFiles = new Set<string>(); //! 処理済みファイルパスを記録。

				for (const cat of settings.categories) {
					const filePath = settings.pathFormat
						? PathGenerator.generateCustomPath(
								settings.rootDirectory,
								cat.directory,
								settings.pathFormat,
								settings.useDirectoryCategory
							)
						: PathGenerator.generateFilePath(
								settings.rootDirectory,
								cat.directory,
								settings.saveUnit,
								settings.useDirectoryCategory
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
				//! 特定のカテゴリのメモを読み込む（currentCategoryはディレクトリ名）。
				const categoryDirectory = this.currentCategory;

				//! ファイルパスを生成。
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

			//! 日付でフィルタリング。
			let displayMemos = this.memos;
			if (this.selectedDate) {
				displayMemos = this.filterMemosByDate(this.memos, this.selectedDate);
			}

			//! メモリストを更新。
			if (this.memoList) {
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

			//! 添付ファイル保存先を決定。
			let attachmentDir: string;
			if (settings.attachmentPath.startsWith("./")) {
				//! ./で始まる場合: 投稿ファイルのディレクトリからの相対パス。
				//! 現在のメモが保存されるディレクトリを取得。
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
				//! ファイルパスからディレクトリパスを取得。
				const memoDir = memoFilePath.substring(0, memoFilePath.lastIndexOf("/"));
				//! ./を除去して相対パスを結合。
				const relativePath = settings.attachmentPath.substring(2);
				attachmentDir = `${memoDir}/${relativePath}`;
			} else if (settings.attachmentPath.startsWith("/")) {
				//! /で始まる場合: ルートディレクトリからの相対パス。
				//! /を除去してルートディレクトリと結合。
				const relativePath = settings.attachmentPath.substring(1);
				attachmentDir = `${settings.rootDirectory}/${relativePath}`;
			} else {
				//! それ以外: そのままルートディレクトリからの相対パスとして扱う。
				attachmentDir = `${settings.rootDirectory}/${settings.attachmentPath}`;
			}

			//! 添付ファイルディレクトリを作成。
			const dirExists = this.memoManager.vaultHandler.fileExists(attachmentDir);
			if (!dirExists) {
				await this.memoManager.vaultHandler.createFolder(attachmentDir);
			}

			//! ファイル名を生成（タイムスタンプ + 拡張子）。
			const timestamp = Date.now();
			const extension = file.name.split(".").pop() || "png";
			const fileName = `pasted-image-${timestamp}.${extension}`;
			const filePath = `${attachmentDir}/${fileName}`;

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

			//! デバッグ: 設定を確認。
			console.log("[memolog DEBUG] Settings:", {
				rootDirectory: settings.rootDirectory,
				categoryDirectory,
				pathFormat: settings.pathFormat,
				saveUnit: settings.saveUnit,
				useDirectoryCategory: settings.useDirectoryCategory,
			});

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

			//! デバッグ: 生成されたファイルパスを確認。
			console.log("[memolog DEBUG] Generated filePath:", filePath);

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

			//! デバッグ: メモ追加前のディレクトリ確認。
			const dirPath = filePath.split("/").slice(0, -1).join("/");
			console.log("[memolog DEBUG] Parent directory path:", dirPath);
			console.log(
				"[memolog DEBUG] Directory exists:",
				this.memoManager.vaultHandler.folderExists(dirPath)
			);

			//! メモを追加（categoryDirectoryをカテゴリとして保存）。
			console.log("[memolog DEBUG] Calling addMemo...");
			const result = await this.memoManager.addMemo(
				filePath,
				categoryDirectory,
				content,
				this.currentOrder,
				settings.memoTemplate,
				copiedAttachments
			);
			console.log("[memolog DEBUG] addMemo result:", result);

			//! デバッグ: ファイルが作成されたか確認。
			console.log(
				"[memolog DEBUG] File exists after addMemo:",
				this.memoManager.vaultHandler.fileExists(filePath)
			);

			//! メモリストを再読み込み。
			await this.loadMemos();

			new Notice("メモを追加しました");
		} catch (error) {
			console.error("[memolog DEBUG] メモ追加エラー:", error);
			if (error instanceof Error) {
				console.error("[memolog DEBUG] Error message:", error.message);
				console.error("[memolog DEBUG] Error stack:", error.stack);
			}
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
			const filePath = settings.pathFormat
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

	//! メモ編集保存処理。
	private async handleSaveEdit(memoId: string, newContent: string): Promise<void> {
		try {
			//! 設定を取得。
			const settings = this.plugin.settingsManager.getGlobalSettings();
			const category = this.currentCategory || settings.defaultCategory;

			//! ファイルパスを生成。
			const filePath = settings.pathFormat
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

			//! メモを更新。
			const updated = await this.memoManager.updateMemo(
				filePath,
				category,
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

	//! ソート順変更処理。
	private handleSortOrderChange(order: SortOrder): void {
		console.log("[memolog DEBUG] handleSortOrderChange called with order:", order);
		console.log("[memolog DEBUG] Current memos count:", this.memos.length);
		this.currentOrder = order;

		//! メモをソート。
		this.sortMemos();
		console.log("[memolog DEBUG] After sort, first memo:", this.memos[0]?.timestamp);
		console.log("[memolog DEBUG] After sort, last memo:", this.memos[this.memos.length - 1]?.timestamp);

		if (this.memoList) {
			console.log("[memolog DEBUG] Calling memoList.updateMemos");
			this.memoList.updateMemos(this.memos);
			//! 最新メモが表示されるようにスクロール。
			this.memoList.scrollToLatest(this.currentOrder);
		} else {
			console.log("[memolog DEBUG] memoList is null/undefined");
		}

		//! 入力エリアの位置を更新。
		this.updateInputAreaPosition();
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
