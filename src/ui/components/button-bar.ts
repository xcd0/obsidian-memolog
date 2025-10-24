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
	private container: HTMLElement;
	private handlers: ButtonBarHandlers;
	private currentOrder: SortOrder = "asc";

	constructor(container: HTMLElement, handlers: ButtonBarHandlers = {}) {
		this.container = container;
		this.handlers = handlers;
	}

	//! ボタンバーを描画する。
	render(initialOrder: SortOrder = "asc"): void {
		//! コンテナをクリア。
		this.container.empty();
		this.currentOrder = initialOrder;

		//! カレンダートグルボタン（ハンバーガーメニュー）。
		const calendarBtn = this.container.createEl("button", {
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

		//! リフレッシュボタン。
		const refreshBtn = this.container.createEl("button", {
			cls: "memolog-btn memolog-refresh-btn",
			attr: { "aria-label": "メモリストを更新" },
		});
		const refreshIcon = refreshBtn.createDiv({ cls: "memolog-btn-icon" });
		setIcon(refreshIcon, "refresh-cw");
		refreshBtn.addEventListener("click", () => {
			if (this.handlers.onRefreshClick) {
				this.handlers.onRefreshClick();
			}
		});

		//! ソート順ボタン。
		const sortBtn = this.container.createEl("button", {
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
