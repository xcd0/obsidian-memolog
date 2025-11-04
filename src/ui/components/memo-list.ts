import { MemoEntry, SortOrder, CategoryConfig, ViewMode } from "../../types";
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
	private collapsedThreads: Set<string>;
	private viewMode: ViewMode; //! ビューモード（メイン/スレッド表示）。v0.0.14で追加。

	constructor(
		app: App,
		container: HTMLElement,
		memos: MemoEntry[] = [],
		handlers: MemoCardHandlers = {},
		sourcePath = "",
		categories: CategoryConfig[] = [],
		isTrash = false,
		pinnedMemoIds: string[] = [],
		collapsedThreads: string[] = [],
		viewMode: ViewMode = "main" //! デフォルトはメインビュー。
	) {
		this.app = app;
		this.container = container;
		this.memos = memos;
		this.handlers = handlers;
		this.sourcePath = sourcePath;
		this.categories = categories;
		this.isTrash = isTrash;
		this.pinnedMemoIds = pinnedMemoIds;
		this.collapsedThreads = new Set(collapsedThreads);
		this.viewMode = viewMode;
	}

	//! メモリストを描画する。
	render(): void {
		//! コンテナをクリア。
		this.container.empty();

		//! ビューモードに応じてメモをフィルタリング。
		const displayMemos =
			this.viewMode === "main" ? this.memos.filter((m) => !m.parentId) : this.memos;

		//! メモが空の場合はプレースホルダーを表示。
		if (displayMemos.length === 0) {
			this.renderPlaceholder();
			return;
		}

		//! parentIdからthreadDepthを計算するためのマップを作成。
		const depthMap = this.calculateThreadDepths();

		//! 折りたたまれたスレッドの子孫メモのIDセットを作成。
		const hiddenMemoIds = this.calculateHiddenMemos();

		//! 各メモをカードとして描画。
		for (const memo of displayMemos) {
			//! 折りたたまれたスレッドの子孫は表示しない。
			if (hiddenMemoIds.has(memo.id)) {
				continue;
			}

			//! ピン留め状態を確認。
			const isPinned = this.pinnedMemoIds.includes(memo.id);

			//! スレッド深さを取得。
			const threadDepth = depthMap.get(memo.id) || 0;

			//! 返信数を取得（MemoEntryのreplyCountプロパティを使用）。
			const replyCount = memo.replyCount || 0;

			//! 折りたたみ状態を確認。
			const isCollapsed = this.collapsedThreads.has(memo.id);

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
				replyCount,
				isCollapsed
			);
			card.render();
		}
	}

	//! 折りたたまれたスレッドの子孫メモのIDセットを計算する。
	private calculateHiddenMemos(): Set<string> {
		const hiddenIds = new Set<string>();

		//! parentMapを構築。
		const parentMap = new Map<string, string>();
		const childrenMap = new Map<string, string[]>();

		for (const memo of this.memos) {
			if (memo.parentId) {
				parentMap.set(memo.id, memo.parentId);

				const siblings = childrenMap.get(memo.parentId) || [];
				siblings.push(memo.id);
				childrenMap.set(memo.parentId, siblings);
			}
		}

		//! 折りたたまれたスレッドの全子孫を収集。
		for (const collapsedId of this.collapsedThreads) {
			//! BFSで子孫を探索。
			const queue = [collapsedId];
			let head = 0;

			while (head < queue.length) {
				const currentId = queue[head++];
				const children = childrenMap.get(currentId) || [];

				for (const childId of children) {
					hiddenIds.add(childId);
					queue.push(childId);
				}
			}
		}

		return hiddenIds;
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

	//! 折りたたみ状態を更新する。
	updateCollapsedThreads(collapsedThreads: string[]): void {
		this.collapsedThreads = new Set(collapsedThreads);
	}

	//! 折りたたみ状態のトグル。
	toggleCollapsed(memoId: string): void {
		if (this.collapsedThreads.has(memoId)) {
			this.collapsedThreads.delete(memoId);
		} else {
			this.collapsedThreads.add(memoId);
		}
	}

	//! 折りたたみ状態を取得する。
	getCollapsedThreads(): string[] {
		return Array.from(this.collapsedThreads);
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

	//! ビューモードを設定する。v0.0.14で追加。
	setViewMode(viewMode: ViewMode): void {
		this.viewMode = viewMode;
		this.render();
	}
}
