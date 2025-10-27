import { MemoEntry, SortOrder } from "../../types";
import { MemoCard, MemoCardHandlers } from "./memo-card";

//! メモリストコンポーネント。
export class MemoList {
	private container: HTMLElement;
	private memos: MemoEntry[];
	private handlers: MemoCardHandlers;
	private enableDailyNotes: boolean;
	private sourcePath: string;

	constructor(
		container: HTMLElement,
		memos: MemoEntry[] = [],
		handlers: MemoCardHandlers = {},
		enableDailyNotes = false,
		sourcePath = ""
	) {
		this.container = container;
		this.memos = memos;
		this.handlers = handlers;
		this.enableDailyNotes = enableDailyNotes;
		this.sourcePath = sourcePath;
	}

	//! メモリストを描画する。
	render(): void {
		//! コンテナをクリア。
		this.container.empty();

		//! メモが空の場合はプレースホルダーを表示。
		if (this.memos.length === 0) {
			this.renderPlaceholder();
			return;
		}

		//! 各メモをカードとして描画。
		for (const memo of this.memos) {
			const card = new MemoCard(
				this.container,
				memo,
				this.handlers,
				this.enableDailyNotes,
				this.sourcePath
			);
			card.render();
		}
	}

	//! プレースホルダーを表示する。
	private renderPlaceholder(): void {
		this.container.createDiv({
			cls: "memolog-placeholder",
			text: "メモがまだありません",
		});
	}

	//! メモリストを更新する。
	updateMemos(memos: MemoEntry[]): void {
		console.log("[memolog DEBUG] MemoList.updateMemos called with", memos.length, "memos");
		console.log("[memolog DEBUG] First memo:", memos[0]?.timestamp);
		console.log("[memolog DEBUG] Last memo:", memos[memos.length - 1]?.timestamp);
		this.memos = memos;
		this.render();
		console.log("[memolog DEBUG] MemoList.render completed");
	}

	//! メモを追加する。
	addMemo(memo: MemoEntry): void {
		this.memos.push(memo);
		this.render();
	}

	//! メモを削除する。
	removeMemo(memoId: string): void {
		this.memos = this.memos.filter((m) => m.id !== memoId);
		this.render();
	}

	//! メモリストをクリアする。
	clear(): void {
		this.memos = [];
		this.render();
	}

	//! 最新のメモが表示される位置にスクロールする。
	scrollToLatest(order: SortOrder): void {
		//! レンダリング完了を待つ。
		setTimeout(() => {
			if (order === "asc") {
				//! 昇順の場合、最新メモは最下部にあるので最下部にスクロール。
				this.container.scrollTop = this.container.scrollHeight;
			} else {
				//! 降順の場合、最新メモは最上部にあるので最上部にスクロール。
				this.container.scrollTop = 0;
			}
		}, 0);
	}
}
