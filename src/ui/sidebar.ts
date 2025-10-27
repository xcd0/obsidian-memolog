import { ItemView, WorkspaceLeaf, Notice, TFile, setIcon } from "obsidian";
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

	//! 現在の状態。
	private currentCategory: string = "";
	private currentOrder: SortOrder = "asc";
	private selectedDate: Date | null = null;
	private calendarVisible: boolean = false;

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

		//! カテゴリタブ領域を作成（ハンバーガーメニューとソートボタンも含む）。
		const categoryTabsArea = this.createCategoryTabsArea(container);

		//! カレンダー領域を作成。
		const calendarArea = this.createCalendarArea(container);

		//! メモ表示領域を作成。
		const listArea = this.createMemoListArea(container);

		//! 入力欄を作成。
		const inputArea = this.createInputArea(container);

		//! コンポーネントを初期化。
		this.initializeComponents(categoryTabsArea, calendarArea, listArea, inputArea);

		//! 初期データを読み込む。
		await this.loadMemos();
	}

	//! ビューを閉じたときの処理。
	// eslint-disable-next-line @typescript-eslint/require-await
	override async onClose(): Promise<void> {
		//! クリーンアップ処理。
		this.containerEl.empty();
	}

	//! カテゴリタブ領域を作成する（ハンバーガーメニューとソートボタンも含む）。
	private createCategoryTabsArea(container: HTMLElement): HTMLElement {
		const categoryTabsArea = container.createDiv({ cls: "memolog-category-tabs-area" });

		//! 内部コンテナ（flexレイアウト）。
		const innerContainer = categoryTabsArea.createDiv({ cls: "memolog-category-tabs-container" });

		//! ハンバーガーメニューボタン。
		innerContainer.createDiv({ cls: "memolog-hamburger-btn" });

		//! カテゴリタブコンテナ。
		const tabsContainer = innerContainer.createDiv({ cls: "memolog-category-tabs-wrapper" });

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
			const sortBtnWrapper = categoryTabsContainer.querySelector(
				".memolog-sort-btn-wrapper"
			) as HTMLElement;

			//! ボタンバーを初期化（ハンバーガーとソートボタンのみ）。
			this.buttonBar = new ButtonBar(categoryTabsContainer, {
				onSortOrderChange: (order) => this.handleSortOrderChange(order),
				onCalendarClick: () => this.toggleCalendar(),
			});
			this.buttonBar.renderInline(this.currentOrder, hamburgerBtn, sortBtnWrapper);
		}

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

			//! Obsidian Wikilink形式で画像リンクを生成。
			const markdownLink = `![[${filePath}]]`;

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
			const category = this.currentCategory || settings.defaultCategory;

			//! デバッグ: 設定を確認。
			console.log("[memolog DEBUG] Settings:", {
				rootDirectory: settings.rootDirectory,
				category,
				pathFormat: settings.pathFormat,
				saveUnit: settings.saveUnit,
				useDirectoryCategory: settings.useDirectoryCategory,
			});

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

			//! メモを追加。
			console.log("[memolog DEBUG] Calling addMemo...");
			const result = await this.memoManager.addMemo(
				filePath,
				category,
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

			//! 最新メモが表示されるようにスクロール。
			if (this.memoList) {
				this.memoList.scrollToLatest(this.currentOrder);
			}

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
		} else {
			console.log("[memolog DEBUG] memoList is null/undefined");
		}
	}

	//! サイドバーを更新する。
	public refresh(): void {
		void this.onOpen();
	}

	//! カレンダーの表示/非表示を切り替える。
	private toggleCalendar(): void {
		this.calendarVisible = !this.calendarVisible;
		if (this.calendarAreaEl) {
			this.calendarAreaEl.style.display = this.calendarVisible ? "block" : "none";
		}
	}
}
