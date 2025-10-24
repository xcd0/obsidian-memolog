import { SortOrder } from "../../types";
import { setIcon } from "obsidian";

//! ボタンバーのイベントハンドラー。
export interface ButtonBarHandlers {
	//! ソート順変更時のハンドラー。
	onSortOrderChange?: (order: SortOrder) => void;

	//! カレンダーボタンクリック時のハンドラー。
	onCalendarClick?: () => void;

	//! 設定ボタンクリック時のハンドラー。
	onSettingsClick?: () => void;

	//! リフレッシュボタンクリック時のハンドラー。
	onRefreshClick?: () => void;
}

//! ボタンバーコンポーネント。
export class ButtonBar {
	private handlers: ButtonBarHandlers;
	private currentOrder: SortOrder = "asc";

	constructor(_container: HTMLElement, handlers: ButtonBarHandlers = {}) {
		this.handlers = handlers;
	}

	//! インラインボタンを描画する（カテゴリタブと同じ行に配置）。
	renderInline(
		initialOrder: SortOrder = "asc",
		hamburgerContainer: HTMLElement,
		sortContainer: HTMLElement
	): void {
		this.currentOrder = initialOrder;

		//! ハンバーガーメニューボタン。
		hamburgerContainer.empty();
		const calendarBtn = hamburgerContainer.createEl("button", {
			cls: "memolog-btn memolog-calendar-toggle-btn",
			attr: { "aria-label": "カレンダー表示切り替え" },
		});
		const calendarIcon = calendarBtn.createDiv({ cls: "memolog-btn-icon" });
		setIcon(calendarIcon, "menu");
		calendarBtn.addEventListener("click", () => {
			if (this.handlers.onCalendarClick) {
				this.handlers.onCalendarClick();
			}
		});

		//! ソート順ボタン。
		sortContainer.empty();
		const sortBtn = sortContainer.createEl("button", {
			cls: "memolog-btn memolog-sort-btn",
			attr: { "aria-label": this.getSortButtonAriaLabel(this.currentOrder) },
		});
		const sortIcon = sortBtn.createDiv({ cls: "memolog-btn-icon" });
		this.updateSortIcon(sortIcon, this.currentOrder);
		sortBtn.addEventListener("click", () => {
			this.toggleSortOrder(sortIcon);
		});
	}

	//! ソート順を切り替える。
	private toggleSortOrder(iconElement: HTMLElement): void {
		this.currentOrder = this.currentOrder === "asc" ? "desc" : "asc";
		this.updateSortIcon(iconElement, this.currentOrder);

		if (this.handlers.onSortOrderChange) {
			this.handlers.onSortOrderChange(this.currentOrder);
		}
	}

	//! ソートアイコンを更新する。
	private updateSortIcon(iconElement: HTMLElement, order: SortOrder): void {
		iconElement.empty();
		const iconName = order === "asc" ? "arrow-up-narrow-wide" : "arrow-down-wide-narrow";
		setIcon(iconElement, iconName);
	}

	//! ソートボタンのaria-labelを取得する。
	private getSortButtonAriaLabel(order: SortOrder): string {
		return order === "asc" ? "昇順でソート" : "降順でソート";
	}

	//! 現在のソート順を取得する。
	getCurrentOrder(): SortOrder {
		return this.currentOrder;
	}

	//! ソート順を設定する。
	setOrder(order: SortOrder): void {
		this.currentOrder = order;
		//! ボタンテキストを更新（再描画が必要）。
	}
}
