import { setIcon } from "obsidian";

//! カレンダービューのハンドラー。
interface CalendarViewHandlers {
	onDateSelect: (date: Date | null) => void;
}

//! カレンダービューUI。
export class CalendarView {
	private container: HTMLElement;
	private handlers: CalendarViewHandlers;
	private currentMonth: Date;
	private selectedDate: Date | null = null;
	private memoDateCounts: Map<string, number> = new Map();

	//! カレンダーグリッド要素。
	private calendarGrid: HTMLElement | null = null;

	constructor(container: HTMLElement, handlers: CalendarViewHandlers) {
		this.container = container;
		this.handlers = handlers;
		this.currentMonth = new Date();
		//! 月の最初の日に設定。
		this.currentMonth.setDate(1);
		this.currentMonth.setHours(0, 0, 0, 0);
	}

	//! カレンダーを描画する。
	render(): void {
		this.container.empty();

		//! カレンダーコンテナを作成。
		const calendarContainer = this.container.createDiv({ cls: "memolog-calendar" });

		//! ヘッダー(年月とナビゲーション)を作成。
		this.createHeader(calendarContainer);

		//! 曜日ヘッダーを作成。
		this.createWeekdayHeader(calendarContainer);

		//! カレンダーグリッド(日付セル)を作成。
		this.calendarGrid = calendarContainer.createDiv({ cls: "memolog-calendar-grid" });
		this.renderCalendarCells();

		//! 「全て表示」ボタンを作成。
		this.createShowAllButton(calendarContainer);
	}

	//! ヘッダー(年月とナビゲーション)を作成する。
	private createHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: "memolog-calendar-header" });

		//! 前月ボタン。
		const prevButton = header.createDiv({ cls: "memolog-calendar-nav-button" });
		setIcon(prevButton, "chevron-left");
		prevButton.addEventListener("click", () => this.goToPreviousMonth());

		//! 年月表示。
		const monthYear = header.createDiv({ cls: "memolog-calendar-month-year" });
		this.updateHeaderText(monthYear);

		//! 次月ボタン。
		const nextButton = header.createDiv({ cls: "memolog-calendar-nav-button" });
		setIcon(nextButton, "chevron-right");
		nextButton.addEventListener("click", () => this.goToNextMonth());
	}

	//! ヘッダーのテキストを更新する。
	private updateHeaderText(element: HTMLElement): void {
		const year = this.currentMonth.getFullYear();
		const month = this.currentMonth.getMonth() + 1;
		element.setText(`${year}年 ${month}月`);
	}

	//! 曜日ヘッダーを作成する。
	private createWeekdayHeader(container: HTMLElement): void {
		const weekdays = container.createDiv({ cls: "memolog-calendar-weekdays" });
		const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

		for (const dayName of dayNames) {
			weekdays.createDiv({
				cls: "memolog-calendar-weekday",
				text: dayName,
			});
		}
	}

	//! カレンダーセルを描画する。
	private renderCalendarCells(): void {
		if (!this.calendarGrid) {
			return;
		}

		this.calendarGrid.empty();

		const year = this.currentMonth.getFullYear();
		const month = this.currentMonth.getMonth();

		//! 月の最初の日の曜日(0=日曜日)。
		const firstDay = new Date(year, month, 1).getDay();

		//! 月の日数。
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		//! 前月の空白セルを作成。
		for (let i = 0; i < firstDay; i++) {
			this.calendarGrid.createDiv({ cls: "memolog-calendar-cell memolog-calendar-cell-empty" });
		}

		//! 日付セルを作成。
		for (let day = 1; day <= daysInMonth; day++) {
			const date = new Date(year, month, day);
			const cell = this.createDateCell(date);
			this.calendarGrid.appendChild(cell);
		}
	}

	//! 日付セルを作成する。
	private createDateCell(date: Date): HTMLElement {
		const cell = createDiv({ cls: "memolog-calendar-cell" });
		const day = date.getDate();

		//! 日付番号。
		cell.createDiv({
			cls: "memolog-calendar-day-number",
			text: day.toString(),
		});

		//! 今日かどうかをチェック。
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (date.getTime() === today.getTime()) {
			cell.addClass("memolog-calendar-cell-today");
		}

		//! 選択された日付かどうかをチェック。
		if (this.selectedDate && date.getTime() === this.selectedDate.getTime()) {
			cell.addClass("memolog-calendar-cell-selected");
		}

		//! メモ数を取得。
		const dateKey = this.getDateKey(date);
		const memoCount = this.memoDateCounts.get(dateKey) || 0;

		//! メモがある場合はインジケーターを表示。
		if (memoCount > 0) {
			cell.addClass("memolog-calendar-cell-has-memos");
			cell.createDiv({
				cls: "memolog-calendar-memo-indicator",
				text: memoCount.toString(),
			});
		}

		//! クリックイベント。
		cell.addEventListener("click", () => this.selectDate(date));

		return cell;
	}

	//! 「全て表示」ボタンを作成する。
	private createShowAllButton(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: "memolog-calendar-show-all" });
		const button = buttonContainer.createEl("button", {
			cls: "memolog-button",
			text: "全て表示",
		});

		button.addEventListener("click", () => {
			this.selectedDate = null;
			this.render();
			this.handlers.onDateSelect(null);
		});
	}

	//! 前月に移動する。
	private goToPreviousMonth(): void {
		this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
		this.render();
	}

	//! 次月に移動する。
	private goToNextMonth(): void {
		this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
		this.render();
	}

	//! 日付を選択する。
	private selectDate(date: Date): void {
		this.selectedDate = new Date(date.getTime());
		this.selectedDate.setHours(0, 0, 0, 0);
		this.render();
		this.handlers.onDateSelect(this.selectedDate);
	}

	//! 日付をキー文字列に変換する。
	private getDateKey(date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	//! メモの日付カウントを更新する。
	updateMemoCounts(memoTimestamps: string[]): void {
		this.memoDateCounts.clear();

		for (const timestamp of memoTimestamps) {
			const date = new Date(timestamp);
			const dateKey = this.getDateKey(date);
			const count = this.memoDateCounts.get(dateKey) || 0;
			this.memoDateCounts.set(dateKey, count + 1);
		}

		//! カレンダーを再描画。
		if (this.calendarGrid) {
			this.renderCalendarCells();
		}
	}

	//! 選択された日付を取得する。
	getSelectedDate(): Date | null {
		return this.selectedDate;
	}

	//! 選択された日付をクリアする。
	clearSelection(): void {
		this.selectedDate = null;
		this.render();
	}
}
