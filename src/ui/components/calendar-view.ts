//! カレンダービューのハンドラー。
interface CalendarViewHandlers {
	onDateSelect: (date: Date | null) => void;
}

//! カレンダービューUI。
export class CalendarView {
	private container: HTMLElement;
	private handlers: CalendarViewHandlers;
	private selectedDate: Date | null = null;
	private memoDateCounts: Map<string, number> = new Map();

	constructor(container: HTMLElement, handlers: CalendarViewHandlers) {
		this.container = container;
		this.handlers = handlers;
	}

	//! カレンダーを描画する（複数月表示）。
	render(): void {
		this.container.empty();

		//! 前月・当月・翌月の3ヶ月を生成。
		const today = new Date();
		const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

		//! 前月。
		const prevMonth = new Date(currentMonth);
		prevMonth.setMonth(prevMonth.getMonth() - 1);
		this.renderMonth(prevMonth);

		//! 当月。
		this.renderMonth(currentMonth);

		//! 翌月。
		const nextMonth = new Date(currentMonth);
		nextMonth.setMonth(nextMonth.getMonth() + 1);
		this.renderMonth(nextMonth);

		//! 「全て表示」ボタンを作成。
		this.createShowAllButton(this.container);
	}

	//! 1ヶ月分のカレンダーを描画する。
	private renderMonth(monthDate: Date): void {
		//! 月コンテナを作成。
		const monthContainer = this.container.createDiv({ cls: "memolog-calendar-month" });

		//! 年月ヘッダー（ナビゲーションボタンなし）。
		const header = monthContainer.createDiv({ cls: "memolog-calendar-month-header" });
		const year = monthDate.getFullYear();
		const month = monthDate.getMonth() + 1;
		header.setText(`${year}年 ${month}月`);

		//! 曜日ヘッダーを作成。
		this.createWeekdayHeader(monthContainer);

		//! カレンダーグリッド(日付セル)を作成。
		const grid = monthContainer.createDiv({ cls: "memolog-calendar-grid" });
		this.renderMonthCells(grid, monthDate);
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

	//! 指定月のカレンダーセルを描画する。
	private renderMonthCells(grid: HTMLElement, monthDate: Date): void {
		grid.empty();

		const year = monthDate.getFullYear();
		const month = monthDate.getMonth();

		//! 月の最初の日の曜日(0=日曜日)。
		const firstDay = new Date(year, month, 1).getDay();

		//! 月の日数。
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		//! 前月の空白セルを作成。
		for (let i = 0; i < firstDay; i++) {
			grid.createDiv({ cls: "memolog-calendar-cell memolog-calendar-cell-empty" });
		}

		//! 日付セルを作成。
		for (let day = 1; day <= daysInMonth; day++) {
			const date = new Date(year, month, day);
			const cell = this.createDateCell(date);
			grid.appendChild(cell);
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
		console.log(`[memolog DEBUG] CalendarView.updateMemoCounts: Received ${memoTimestamps.length} timestamps`);
		this.memoDateCounts.clear();

		for (const timestamp of memoTimestamps) {
			const date = new Date(timestamp);
			const dateKey = this.getDateKey(date);
			const count = this.memoDateCounts.get(dateKey) || 0;
			this.memoDateCounts.set(dateKey, count + 1);
		}

		console.log(`[memolog DEBUG] CalendarView.updateMemoCounts: Date counts map:`, Array.from(this.memoDateCounts.entries()));

		//! カレンダーを再描画（複数月対応）。
		this.render();
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
