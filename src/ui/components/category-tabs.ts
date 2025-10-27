import { CategoryConfig } from "../../types";
import { setIcon } from "obsidian";

//! カテゴリタブのハンドラー。
interface CategoryTabsHandlers {
	onCategoryChange: (category: string) => void;
}

//! カテゴリタブUI。
export class CategoryTabs {
	private container: HTMLElement;
	private categories: CategoryConfig[];
	private handlers: CategoryTabsHandlers;
	private activeCategory: string;
	private tabElements: Map<string, HTMLElement> = new Map();
	private showAllTab: boolean;

	constructor(
		container: HTMLElement,
		categories: CategoryConfig[],
		handlers: CategoryTabsHandlers,
		showAllTab = true
	) {
		this.container = container;
		this.categories = categories;
		this.handlers = handlers;
		this.showAllTab = showAllTab;
		this.activeCategory = categories[0]?.name || "";
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

		//! 各カテゴリのタブを作成。
		for (const category of this.categories) {
			const tab = this.createTab(tabsContainer, category);
			this.tabElements.set(category.name, tab);

			//! アクティブなタブをハイライト。
			if (category.name === this.activeCategory) {
				tab.addClass("memolog-category-tab-active");
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

		//! クリックイベントを設定。
		tab.addEventListener("click", () => {
			this.setActiveCategory("all");
			this.handlers.onCategoryChange("all");
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

		//! カテゴリ名を追加。
		tab.createDiv({
			cls: "memolog-category-tab-name",
			text: category.name,
		});

		//! クリックイベントを設定。
		tab.addEventListener("click", () => {
			this.setActiveCategory(category.name);
			this.handlers.onCategoryChange(category.name);
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
