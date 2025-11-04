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

	// ! スレッド表示での投稿(返信として投稿)。v0.0.15で追加。
	onThreadSubmit?: (content: string, parentId: string) => Promise<void>
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
	private collapsedThreads: Set<string>

	// ! UI要素への参照。
	private headerEl: HTMLElement | null = null
	private contentEl: HTMLElement | null = null
	private inputAreaEl: HTMLElement | null = null // ! v0.0.15で追加。

	constructor(
		app: App,
		container: HTMLElement,
		memos: MemoEntry[] = [],
		focusedMemoId: string,
		handlers: ThreadViewHandlers = {},
		sourcePath = "",
		categories: CategoryConfig[] = [],
		collapsedThreads: string[] = [],
	) {
		this.app = app
		this.container = container
		this.memos = memos
		this.focusedMemoId = focusedMemoId
		this.handlers = handlers
		this.sourcePath = sourcePath
		this.categories = categories
		this.collapsedThreads = new Set(collapsedThreads)
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

		// ! 投稿欄を最下部に描画。v0.0.15で追加。
		this.renderInputArea()
	}

	// ! ヘッダーを描画する（戻るボタン + 親メモナビゲーション）。
	private renderHeader(): void {
		this.headerEl = this.container.createDiv({ cls: "memolog-thread-header" })

		// ! 戻るボタン。
		const backBtn = this.headerEl.createDiv({ cls: "memolog-thread-back-btn" })
		setIcon(backBtn, "arrow-left")
		backBtn.createSpan({ text: "戻る" })
		backBtn.addEventListener("click", () => {
			if (this.handlers.onBack) {
				this.handlers.onBack()
			}
		})

		// ! フォーカスメモの親がいる場合、親へのナビゲーションを表示。
		const focusedMemo = this.memos.find(m => m.id === this.focusedMemoId)
		if (focusedMemo?.parentId) {
			const parentNav = this.headerEl.createDiv({ cls: "memolog-thread-parent-nav" })
			setIcon(parentNav, "arrow-up")
			parentNav.createSpan({ text: "親メモへ" })
			parentNav.addEventListener("click", () => {
				if (this.handlers.onNavigateToParent && focusedMemo.parentId) {
					this.handlers.onNavigateToParent(focusedMemo.parentId)
				}
			})
		}
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
			false, // ! 折りたたみなし。
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

		// ! 折りたたまれているかチェック。
		const isCollapsed = this.collapsedThreads.has(parentId)
		if (isCollapsed) {
			return
		}

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
				this.collapsedThreads.has(child.id), // ! 折りたたみ状態。
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

	// ! 投稿欄を描画する。v0.0.15で追加。
	private renderInputArea(): void {
		this.inputAreaEl = this.container.createDiv({ cls: "memolog-thread-input-area" })

		const textarea = this.inputAreaEl.createEl("textarea", {
			cls: "memolog-thread-input-textarea",
			attr: {
				placeholder: "返信を入力...",
				rows: "3",
			},
		})

		const buttonContainer = this.inputAreaEl.createDiv({
			cls: "memolog-thread-input-buttons",
		})

		const submitBtn = buttonContainer.createEl("button", {
			cls: "memolog-thread-input-submit",
			text: "投稿",
		})

		// ! 投稿ボタンのクリックイベント。
		submitBtn.addEventListener("click", async () => {
			const content = textarea.value.trim()
			if (!content) return

			if (this.handlers.onThreadSubmit) {
				await this.handlers.onThreadSubmit(content, this.focusedMemoId)
				textarea.value = "" // ! 投稿後にテキストエリアをクリア。

				// ! スクロールを最下部に移動。
				setTimeout(() => {
					if (this.inputAreaEl) {
						this.inputAreaEl.scrollIntoView({ behavior: "smooth", block: "end" })
					}
				}, 100)
			}
		})

		// ! Ctrl+Enterで投稿。
		textarea.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault()
				submitBtn.click()
			}
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

	// ! 折りたたみ状態を更新する。
	updateCollapsedThreads(collapsedThreads: string[]): void {
		this.collapsedThreads = new Set(collapsedThreads)
		this.render()
	}
}
