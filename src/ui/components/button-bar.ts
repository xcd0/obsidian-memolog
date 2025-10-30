import { SortOrder } from "../../types";
import { setIcon } from "obsidian";

//! 日付範囲フィルターの種類。
export type DateRangeFilter = "all" | "week" | "today" | null;

//! ボタンバーのイベントハンドラー。
export interface ButtonBarHandlers {
	//! ソート順変更時のハンドラー。
	onSortOrderChange?: (order: SortOrder) => void;

	//! カレンダーボタンクリック時のハンドラー。
	onCalendarClick?: () => void;

	//! 検索ボタンクリック時のハンドラー。
	onSearchClick?: () => void;

	//! 設定ボタンクリック時のハンドラー。
	onSettingsClick?: () => void;

	//! リフレッシュボタンクリック時のハンドラー。
	onRefreshClick?: () => void;

	//! 日付範囲フィルター変更時のハンドラー。
	onDateRangeChange?: (filter: DateRangeFilter) => void;
}

//! ボタンバーコンポーネント。
export class ButtonBar {
	private handlers: ButtonBarHandlers;
	private currentOrder: SortOrder = "asc";
	private currentDateRange: DateRangeFilter = "all";
	private dateRangeButtons: Map<DateRangeFilter, HTMLElement> = new Map();

	constructor(_container: HTMLElement, handlers: ButtonBarHandlers = {}) {
		this.handlers = handlers;
	}

	//! インラインボタンを描画する（カテゴリタブと同じ行に配置）。
	renderInline(
		initialOrder: SortOrder = "asc",
		hamburgerContainer: HTMLElement,
		dateRangeContainer: HTMLElement,
		searchContainer: HTMLElement,
		settingsContainer: HTMLElement,
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

		//! 日付範囲フィルターボタン。
		dateRangeContainer.empty();
		this.dateRangeButtons.clear();

		const dateRangeFilters: Array<{ filter: DateRangeFilter; label: string }> = [
			{ filter: "today", label: "今日" },
			{ filter: "week", label: "一週間" },
		];

		for (const { filter, label } of dateRangeFilters) {
			const btn = dateRangeContainer.createEl("button", {
				cls: "memolog-btn memolog-date-range-btn",
				attr: { "aria-label": label },
			});

			//! ボタンのラベルを設定。
			btn.setText(label);

			//! デフォルトで「今日」をアクティブに。
			if (filter === this.currentDateRange) {
				btn.addClass("memolog-date-range-btn-active");
			}

			btn.addEventListener("click", () => {
				this.setDateRange(filter);
			});

			this.dateRangeButtons.set(filter, btn);
		}

		//! 検索ボタン。
		searchContainer.empty();
		const searchBtn = searchContainer.createEl("button", {
			cls: "memolog-btn memolog-search-toggle-btn",
			attr: { "aria-label": "検索を開く" },
		});
		const searchIcon = searchBtn.createDiv({ cls: "memolog-btn-icon" });
		setIcon(searchIcon, "search");
		searchBtn.addEventListener("click", () => {
			if (this.handlers.onSearchClick) {
				this.handlers.onSearchClick();
			}
		});

		//! 設定ボタン。
		settingsContainer.empty();
		const settingsBtn = settingsContainer.createEl("button", {
			cls: "memolog-btn memolog-settings-toggle-btn",
			attr: { "aria-label": "設定を開く" },
		});
		const settingsIcon = settingsBtn.createDiv({ cls: "memolog-btn-icon" });
		setIcon(settingsIcon, "settings");
		settingsBtn.addEventListener("click", () => {
			if (this.handlers.onSettingsClick) {
				this.handlers.onSettingsClick();
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

	//! 日付範囲フィルターを設定する。
	private setDateRange(filter: DateRangeFilter): void {
		//! 既に選択されている場合はOFFにする（全てOFF状態にする）。
		if (this.currentDateRange === filter) {
			this.currentDateRange = null;
			this.updateDateRangeButtons();
			if (this.handlers.onDateRangeChange) {
				this.handlers.onDateRangeChange(null);
			}
			return;
		}

		//! 新しいフィルターを設定。
		this.currentDateRange = filter;
		this.updateDateRangeButtons();

		if (this.handlers.onDateRangeChange) {
			this.handlers.onDateRangeChange(filter);
		}
	}

	//! 日付範囲ボタンの表示を更新する。
	private updateDateRangeButtons(): void {
		for (const [filter, btn] of this.dateRangeButtons) {
			if (filter === this.currentDateRange) {
				btn.addClass("memolog-date-range-btn-active");
			} else {
				btn.removeClass("memolog-date-range-btn-active");
			}
		}
	}

	//! 日付範囲フィルターをクリアする（外部から呼び出し可能）。
	public clearDateRange(): void {
		this.currentDateRange = null;
		this.updateDateRangeButtons();
	}
}
