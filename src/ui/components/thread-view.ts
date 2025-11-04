import { App, setIcon } from "obsidian"
import { CategoryConfig, MemoEntry } from "../../types"
import { MemoCard, MemoCardHandlers } from "./memo-card"

// ! ThreadViewハンドラー型定義。
export interface ThreadViewHandlers extends MemoCardHandlers {
	// ! メインビューに戻る。
	onBack?: () => void

	// ! 子メモをクリックしてフォーカスを変更。
	onThreadCardClick?: (memoId: string) => void

	// ! 親メモに遷移。
	onNavigateToParent?: (parentId: string) => void
}

// ! スレッドビューコンポーネント。v0.0.14で追加。
export class ThreadView {
	private app: App
	private container: HTMLElement
	private memos: MemoEntry[]
	private focusedMemoId: string
	private handlers: ThreadViewHandlers
	private sourcePath: string
	private categories: CategoryConfig[]

	// ! UI要素への参照。
	private headerEl: HTMLElement | null = null
	private contentEl: HTMLElement | null = null

	constructor(
		app: App,
		container: HTMLElement,
		memos: MemoEntry[] = [],
		focusedMemoId: string,
		handlers: ThreadViewHandlers = {},
		sourcePath = "",
		categories: CategoryConfig[] = [],
	) {
		this.app = app
		this.container = container
		this.memos = memos
		this.focusedMemoId = focusedMemoId
		this.handlers = handlers
		this.sourcePath = sourcePath
		this.categories = categories
	}

	// ! スレッドビューを描画する。
	render(): void {
		// ! コンテナをクリア。
		this.container.empty()

		// ! ヘッダーエリア（戻るボタン + 親メモナビゲーション）を作成。
		this.renderHeader()

		// ! コンテンツエリアを作成。
		this.contentEl = this.container.createDiv({ cls: "memolog-thread-content" })

		// ! フォーカスメモを取得。
		const focusedMemo = this.memos.find(m => m.id === this.focusedMemoId)
		if (!focusedMemo) {
			this.renderNotFound()
			return
		}

		// ! スレッドツリーを描画。
		this.renderThreadTree(focusedMemo)
	}

	// ! ヘッダーを描画する（戻るボタンのみ）。v0.0.15で親メモへボタンを削除。
	private renderHeader(): void {
		this.headerEl = this.container.createDiv({ cls: "memolog-thread-header" })

		// ! 戻るボタン（アイコンのみ）。2世代以降の場合は親スレッド表示に戻る。
		const backBtn = this.headerEl.createDiv({ cls: "memolog-thread-back-btn" })
		setIcon(backBtn, "arrow-left")
		backBtn.addEventListener("click", () => {
			const focusedMemo = this.memos.find(m => m.id === this.focusedMemoId)
			// ! フォーカスメモに親がいる場合、親のスレッド表示に遷移。
			if (focusedMemo?.parentId && this.handlers.onNavigateToParent) {
				this.handlers.onNavigateToParent(focusedMemo.parentId)
			} else if (this.handlers.onBack) {
				// ! 親がいない場合はメインビューに戻る。
				this.handlers.onBack()
			}
		})
	}

	// ! スレッドツリーを描画する（フォーカスメモ + その返信）。
	private renderThreadTree(focusedMemo: MemoEntry): void {
		if (!this.contentEl) return

		// ! フォーカスメモを強調表示して描画。
		this.renderFocusedMemo(focusedMemo)

		// ! フォーカスメモの返信を階層表示。
		this.renderReplies(this.focusedMemoId, 0)
	}

	// ! フォーカスメモを描画する（強調表示）。
	private renderFocusedMemo(memo: MemoEntry): void {
		if (!this.contentEl) return

		const focusedContainer = this.contentEl.createDiv({ cls: "memolog-thread-focused" })

		// ! MemoCardHandlersを構築。
		const cardHandlers: MemoCardHandlers = { ...this.handlers }
		// ! ThreadView専用ハンドラーを除外。
		delete (cardHandlers as ThreadViewHandlers).onBack
		delete (cardHandlers as ThreadViewHandlers).onThreadCardClick
		delete (cardHandlers as ThreadViewHandlers).onNavigateToParent

		// ! フォーカスメモが2世代以降（親がいる）場合、カテゴリ変更ボタンを非表示。v0.0.15で追加。
		const hideCategoryButton = memo.parentId !== null && memo.parentId !== undefined

		const card = new MemoCard(
			this.app,
			focusedContainer,
			memo,
			cardHandlers,
			this.sourcePath,
			this.categories,
			false, // ! ゴミ箱ではない。
			false, // ! ピン留めなし。
			0, // ! スレッド深さ0。
			memo.replyCount || 0,
			hideCategoryButton,
		)
		card.render()
	}

	// ! 返信を再帰的に描画する。
	private renderReplies(parentId: string, depth: number): void {
		if (!this.contentEl) return

		// ! 親メモの子を取得し、時系列昇順でソート。v0.0.15で追加。
		const children = this.memos
			.filter(m => m.parentId === parentId)
			.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

		for (const child of children) {
			const replyContainer = this.contentEl.createDiv({
				cls: "memolog-thread-reply",
			})

			// ! クリックイベントを追加。
			replyContainer.addEventListener("click", e => {
				// ! ボタンクリックは除外。
				if ((e.target as HTMLElement).closest("button")) {
					return
				}
				if (this.handlers.onThreadCardClick) {
					this.handlers.onThreadCardClick(child.id)
				}
			})

			// ! MemoCardHandlersを構築。
			const cardHandlers: MemoCardHandlers = {
				...this.handlers,
			}
			// ! ThreadView専用ハンドラーを除外。
			delete (cardHandlers as ThreadViewHandlers).onBack
			delete (cardHandlers as ThreadViewHandlers).onThreadCardClick
			delete (cardHandlers as ThreadViewHandlers).onNavigateToParent

			// ! スレッド表示では返信にカテゴリ変更ボタンを表示しない。v0.0.15で追加。
			const hideCategoryButton = true

			const card = new MemoCard(
				this.app,
				replyContainer,
				child,
				cardHandlers,
				this.sourcePath,
				this.categories,
				false, // ! ゴミ箱ではない。
				false, // ! ピン留めなし。
				depth + 1, // ! インデント深さ。
				child.replyCount || 0,
				hideCategoryButton,
			)
			card.render()

			// ! 再帰的に子の返信を描画。
			this.renderReplies(child.id, depth + 1)
		}
	}

	// ! メモが見つからない場合のメッセージを表示。
	private renderNotFound(): void {
		if (!this.contentEl) return

		this.contentEl.createDiv({
			cls: "memolog-thread-not-found",
			text: "メモが見つかりません",
		})
	}

	// ! クリーンアップ。
	destroy(): void {
		this.container.empty()
	}

	// ! メモリストを更新する。
	updateMemos(memos: MemoEntry[]): void {
		this.memos = memos
		this.render()
	}

	// ! フォーカスメモIDを変更する。
	setFocusedMemoId(memoId: string): void {
		this.focusedMemoId = memoId
		this.render()
	}
}
