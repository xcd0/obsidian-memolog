import { SortOrder } from "../../types";

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

		//! リフレッシュボタン。
		const refreshBtn = this.container.createEl("button", {
			cls: "memolog-btn",
			text: "更新",
		});
		refreshBtn.addEventListener("click", () => {
			if (this.handlers.onRefreshClick) {
				this.handlers.onRefreshClick();
			}
		});

		//! ソート順ボタン。
		const sortBtn = this.container.createEl("button", {
			cls: "memolog-btn",
			text: this.getSortButtonText(this.currentOrder),
		});
		sortBtn.addEventListener("click", () => {
			this.toggleSortOrder(sortBtn);
		});

		//! カレンダーボタン（将来実装）。
		// const calendarBtn = this.container.createEl("button", {
		// 	cls: "memolog-btn",
		// 	text: "📅",
		// });
		// calendarBtn.addEventListener("click", () => {
		// 	if (this.handlers.onCalendarClick) {
		// 		this.handlers.onCalendarClick();
		// 	}
		// });

		//! 設定ボタン（将来実装）。
		// const settingsBtn = this.container.createEl("button", {
		// 	cls: "memolog-btn",
		// 	text: "⚙️",
		// });
		// settingsBtn.addEventListener("click", () => {
		// 	if (this.handlers.onSettingsClick) {
		// 		this.handlers.onSettingsClick();
		// 	}
		// });
	}

	//! ソート順を切り替える。
	private toggleSortOrder(button: HTMLButtonElement): void {
		this.currentOrder = this.currentOrder === "asc" ? "desc" : "asc";
		button.setText(this.getSortButtonText(this.currentOrder));

		if (this.handlers.onSortOrderChange) {
			this.handlers.onSortOrderChange(this.currentOrder);
		}
	}

	//! ソートボタンのテキストを取得する。
	private getSortButtonText(order: SortOrder): string {
		return order === "asc" ? "昇順" : "降順";
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
