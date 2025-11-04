import { MemoEntry, SortOrder, CategoryConfig } from "../../types";
import { MemoCard, MemoCardHandlers } from "./memo-card";
import { App } from "obsidian";

//! メモリストコンポーネント。
export class MemoList {
	private app: App;
	private container: HTMLElement;
	private memos: MemoEntry[];
	private handlers: MemoCardHandlers;
	private sourcePath: string;
	private categories: CategoryConfig[];
	private isTrash: boolean;
	private pinnedMemoIds: string[];

	constructor(
		app: App,
		container: HTMLElement,
		memos: MemoEntry[] = [],
		handlers: MemoCardHandlers = {},
		sourcePath = "",
		categories: CategoryConfig[] = [],
		isTrash = false,
		pinnedMemoIds: string[] = []
	) {
		this.app = app;
		this.container = container;
		this.memos = memos;
		this.handlers = handlers;
		this.sourcePath = sourcePath;
		this.categories = categories;
		this.isTrash = isTrash;
		this.pinnedMemoIds = pinnedMemoIds;
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

		//! parentIdからthreadDepthを計算するためのマップを作成。
		const depthMap = this.calculateThreadDepths();

		//! 各メモをカードとして描画。
		for (const memo of this.memos) {
			//! ピン留め状態を確認。
			const isPinned = this.pinnedMemoIds.includes(memo.id);

			//! スレッド深さを取得。
			const threadDepth = depthMap.get(memo.id) || 0;

			//! 返信数を取得（MemoEntryのreplyCountプロパティを使用）。
			const replyCount = memo.replyCount || 0;

			const card = new MemoCard(
				this.app,
				this.container,
				memo,
				this.handlers,
				this.sourcePath,
				this.categories,
				this.isTrash,
				isPinned,
				threadDepth,
				replyCount
			);
			card.render();
		}
	}

	//! parentIdからthreadDepthを計算する。
	private calculateThreadDepths(): Map<string, number> {
		const depthMap = new Map<string, number>();
		const parentMap = new Map<string, string>();

		//! parentMapを構築。
		for (const memo of this.memos) {
			if (memo.parentId) {
				parentMap.set(memo.id, memo.parentId);
			}
		}

		//! 各メモの深さを計算。
		for (const memo of this.memos) {
			let depth = 0;
			let currentId = memo.id;
			const visited = new Set<string>();

			//! 親を辿って深さを計算（循環参照を防ぐ）。
			while (parentMap.has(currentId)) {
				const parentId = parentMap.get(currentId);
				if (!parentId || visited.has(parentId)) {
					break;
				}
				visited.add(parentId);
				currentId = parentId;
				depth++;

				//! 安全のため、深さが100を超えたら打ち切り。
				if (depth > 100) {
					break;
				}
			}

			depthMap.set(memo.id, depth);
		}

		return depthMap;
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
		this.memos = memos;
		this.render();
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

	//! ゴミ箱表示フラグを設定する。
	setIsTrash(isTrash: boolean): void {
		this.isTrash = isTrash;
	}

	//! ピン留めIDリストを更新する。
	updatePinnedMemoIds(pinnedMemoIds: string[]): void {
		this.pinnedMemoIds = pinnedMemoIds;
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
