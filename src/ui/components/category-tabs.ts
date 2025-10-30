import { CategoryConfig } from "../../types";
import { setIcon } from "obsidian";

//! カテゴリタブのハンドラー。
interface CategoryTabsHandlers {
	onCategoryChange: (categoryDirectory: string) => void;
}

//! カテゴリタブUI。
export class CategoryTabs {
	private container: HTMLElement;
	private categories: CategoryConfig[];
	private handlers: CategoryTabsHandlers;
	private activeCategory: string; //! アクティブなカテゴリのディレクトリ名。
	private tabElements: Map<string, HTMLElement> = new Map(); //! キーはディレクトリ名。
	private showAllTab: boolean;
	private showTrashTab: boolean;
	private showPinnedTab: boolean;

	constructor(
		container: HTMLElement,
		categories: CategoryConfig[],
		handlers: CategoryTabsHandlers,
		showAllTab = true,
		showTrashTab = false,
		showPinnedTab = true
	) {
		this.container = container;
		this.categories = categories;
		this.handlers = handlers;
		this.showAllTab = showAllTab;
		this.showTrashTab = showTrashTab;
		this.showPinnedTab = showPinnedTab;
		this.activeCategory = categories[0]?.directory || "";
	}

	//! タブを描画する。
	render(activeCategory: string): void {
		this.activeCategory = activeCategory;
		this.container.empty();
		this.tabElements.clear();

		//! タブがない場合は何も表示しない。
		if (this.categories.length === 0) {
			return;
		}

		//! タブコンテナを作成。
		const tabsContainer = this.container.createDiv({ cls: "memolog-category-tabs" });

		//! Allタブを最初に追加（showAllTabがtrueの場合）。
		if (this.showAllTab) {
			const allTab = this.createAllTab(tabsContainer);
			this.tabElements.set("all", allTab);

			//! アクティブなタブをハイライト。
			if (this.activeCategory === "all") {
				allTab.addClass("memolog-category-tab-active");
			}
		}

		//! 各カテゴリのタブを作成（ディレクトリ名が空のものは除外）。
		for (const category of this.categories) {
			//! ディレクトリ名が空の場合はスキップ。
			if (!category.directory || !category.directory.trim()) {
				continue;
			}

			const tab = this.createTab(tabsContainer, category);
			this.tabElements.set(category.directory, tab);

			//! アクティブなタブをハイライト。
			if (category.directory === this.activeCategory) {
				tab.addClass("memolog-category-tab-active");
			}
		}

		//! ピン留めタブを追加（showPinnedTabがtrueの場合）。
		if (this.showPinnedTab) {
			const pinnedTab = this.createPinnedTab(tabsContainer);
			this.tabElements.set("pinned", pinnedTab);

			//! アクティブなタブをハイライト。
			if (this.activeCategory === "pinned") {
				pinnedTab.addClass("memolog-category-tab-active");
			}
		}

		//! ゴミ箱タブを最後に追加（showTrashTabがtrueの場合）。
		if (this.showTrashTab) {
			const trashTab = this.createTrashTab(tabsContainer);
			this.tabElements.set("trash", trashTab);

			//! アクティブなタブをハイライト。
			if (this.activeCategory === "trash") {
				trashTab.addClass("memolog-category-tab-active");
			}
		}
	}

	//! Allタブを作成する。
	private createAllTab(container: HTMLElement): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" });

		//! デフォルトのアクセントカラーを設定。
		tab.style.setProperty("--category-color", "var(--interactive-accent)");

		//! カテゴリ名を追加。
		tab.createDiv({
			cls: "memolog-category-tab-name",
			text: "All",
		});

		//! クリックイベントを設定（ディレクトリ名"all"を渡す）。
		tab.addEventListener("click", () => {
			this.setActiveCategory("all");
			this.handlers.onCategoryChange("all");
		});

		return tab;
	}

	//! ピン留めタブを作成する。
	private createPinnedTab(container: HTMLElement): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" });

		//! ピン留めのカラーを設定（オレンジ系）。
		tab.style.setProperty("--category-color", "#f59e0b");

		//! アイコンを追加。
		const iconEl = tab.createDiv({ cls: "memolog-category-tab-icon" });
		setIcon(iconEl, "pin");


		//! クリックイベントを設定（ディレクトリ名"pinned"を渡す）。
		tab.addEventListener("click", () => {
			this.setActiveCategory("pinned");
			this.handlers.onCategoryChange("pinned");
		});

		return tab;
	}

	//! ゴミ箱タブを作成する。
	private createTrashTab(container: HTMLElement): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" });

		//! ゴミ箱のカラーを設定（グレー系）。
		tab.style.setProperty("--category-color", "#6c757d");

		//! アイコンを追加。
		const iconEl = tab.createDiv({ cls: "memolog-category-tab-icon" });
		setIcon(iconEl, "trash-2");

		//! カテゴリ名を追加。
		tab.createDiv({
			cls: "memolog-category-tab-name",
			text: "ゴミ箱",
		});

		//! クリックイベントを設定（ディレクトリ名"trash"を渡す）。
		tab.addEventListener("click", () => {
			this.setActiveCategory("trash");
			this.handlers.onCategoryChange("trash");
		});

		return tab;
	}

	//! 個別のタブを作成する。
	private createTab(container: HTMLElement, category: CategoryConfig): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" });

		//! カテゴリカラーを設定。
		tab.style.setProperty("--category-color", category.color);

		//! アイコンを追加（category.showIconがtrueの場合のみ、デフォルトはtrue）。
		if ((category.showIcon ?? true) && category.icon) {
			const iconEl = tab.createDiv({ cls: "memolog-category-tab-icon" });
			setIcon(iconEl, category.icon);
		}

		//! カテゴリ名を表示（UIのみ）。
		tab.createDiv({
			cls: "memolog-category-tab-name",
			text: category.name,
		});

		//! クリックイベントを設定（ディレクトリ名を渡す）。
		tab.addEventListener("click", () => {
			this.setActiveCategory(category.directory);
			this.handlers.onCategoryChange(category.directory);
		});

		return tab;
	}

	//! アクティブなカテゴリを設定する。
	setActiveCategory(category: string): void {
		//! 前のアクティブタブを非アクティブ化。
		const prevActive = this.tabElements.get(this.activeCategory);
		if (prevActive) {
			prevActive.removeClass("memolog-category-tab-active");
		}

		//! 新しいアクティブタブをハイライト。
		this.activeCategory = category;
		const newActive = this.tabElements.get(category);
		if (newActive) {
			newActive.addClass("memolog-category-tab-active");
		}
	}

	//! カテゴリリストを更新する。
	updateCategories(categories: CategoryConfig[]): void {
		this.categories = categories;
		this.render(this.activeCategory);
	}

	//! 現在のアクティブカテゴリを取得する。
	getActiveCategory(): string {
		return this.activeCategory;
	}
}
