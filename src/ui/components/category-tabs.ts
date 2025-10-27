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
	private showIcons: boolean;

	constructor(
		container: HTMLElement,
		categories: CategoryConfig[],
		handlers: CategoryTabsHandlers,
		showIcons = true
	) {
		this.container = container;
		this.categories = categories;
		this.handlers = handlers;
		this.activeCategory = categories[0]?.name || "";
		this.showIcons = showIcons;
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

	//! 個別のタブを作成する。
	private createTab(container: HTMLElement, category: CategoryConfig): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" });

		//! カテゴリカラーを設定。
		tab.style.setProperty("--category-color", category.color);

		//! アイコンを追加（showIconsがtrueの場合のみ）。
		if (this.showIcons && category.icon) {
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
