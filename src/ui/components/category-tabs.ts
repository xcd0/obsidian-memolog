import { setIcon } from "obsidian"
import { CategoryConfig } from "../../types"

// ! カテゴリタブのハンドラー。
interface CategoryTabsHandlers {
	onCategoryChange: (categoryDirectory: string) => void
	onCategoryOrderChange?: (newOrder: string[]) => void
}

// ! カテゴリタブUI。
export class CategoryTabs {
	private container: HTMLElement
	private categories: CategoryConfig[]
	private handlers: CategoryTabsHandlers
	private activeCategory: string // ! アクティブなカテゴリのディレクトリ名。
	private tabElements: Map<string, HTMLElement> = new Map() // ! キーはディレクトリ名。
	private showAllTab: boolean
	private showTrashTab: boolean
	private showPinnedTab: boolean
	private draggedCategory: string | null = null // ! ドラッグ中のカテゴリ。
	private categoryOrder: string[] = [] // ! カテゴリの表示順序。

	constructor(
		container: HTMLElement,
		categories: CategoryConfig[],
		handlers: CategoryTabsHandlers,
		showAllTab = true,
		showTrashTab = false,
		showPinnedTab = true,
		categoryOrder: string[] = [],
	) {
		this.container = container
		this.categories = categories
		this.handlers = handlers
		this.showAllTab = showAllTab
		this.showTrashTab = showTrashTab
		this.showPinnedTab = showPinnedTab
		this.activeCategory = categories[0]?.directory || ""
		// ! カテゴリ順序が指定されていない場合は、categoriesから順序を抽出。
		this.categoryOrder = categoryOrder.length > 0
			? categoryOrder
			: categories.map(c => c.directory)
	}

	// ! タブを描画する。
	render(activeCategory: string): void {
		this.activeCategory = activeCategory
		this.container.empty()
		this.tabElements.clear()

		// ! タブがない場合は何も表示しない。
		if (this.categories.length === 0) {
			return
		}

		// ! タブコンテナを作成。
		const tabsContainer = this.container.createDiv({ cls: "memolog-category-tabs" })

		// ! Allタブを最初に追加（showAllTabがtrueの場合）。
		if (this.showAllTab) {
			const allTab = this.createAllTab(tabsContainer)
			this.tabElements.set("all", allTab)

			// ! アクティブなタブをハイライト。
			if (this.activeCategory === "all") {
				allTab.addClass("memolog-category-tab-active")
			}
		}

		// ! 各カテゴリのタブをcategoryOrderの順序で作成。
		const sortedCategories = this.getSortedCategories()
		for (const category of sortedCategories) {
			// ! ディレクトリ名が空の場合はスキップ。
			if (!category.directory || !category.directory.trim()) {
				continue
			}

			const tab = this.createTab(tabsContainer, category)
			this.tabElements.set(category.directory, tab)

			// ! アクティブなタブをハイライト。
			if (category.directory === this.activeCategory) {
				tab.addClass("memolog-category-tab-active")
			}
		}

		// ! ピン留めタブを追加（showPinnedTabがtrueの場合）。
		if (this.showPinnedTab) {
			const pinnedTab = this.createPinnedTab(tabsContainer)
			this.tabElements.set("pinned", pinnedTab)

			// ! アクティブなタブをハイライト。
			if (this.activeCategory === "pinned") {
				pinnedTab.addClass("memolog-category-tab-active")
			}
		}

		// ! ゴミ箱タブを最後に追加（showTrashTabがtrueの場合）。
		if (this.showTrashTab) {
			const trashTab = this.createTrashTab(tabsContainer)
			this.tabElements.set("trash", trashTab)

			// ! アクティブなタブをハイライト。
			if (this.activeCategory === "trash") {
				trashTab.addClass("memolog-category-tab-active")
			}
		}
	}

	// ! Allタブを作成する。
	private createAllTab(container: HTMLElement): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" })

		// ! デフォルトのアクセントカラーを設定。
		tab.style.setProperty("--category-color", "var(--interactive-accent)")

		// ! カテゴリ名を追加。
		tab.createDiv({
			cls: "memolog-category-tab-name",
			text: "All",
		})

		// ! クリックイベントを設定（ディレクトリ名"all"を渡す）。
		tab.addEventListener("click", () => {
			this.setActiveCategory("all")
			this.handlers.onCategoryChange("all")
		})

		return tab
	}

	// ! ピン留めタブを作成する。
	private createPinnedTab(container: HTMLElement): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" })

		// ! ピン留めのカラーを設定（オレンジ系）。
		tab.style.setProperty("--category-color", "#f59e0b")

		// ! アイコンを追加。
		const iconEl = tab.createDiv({ cls: "memolog-category-tab-icon" })
		setIcon(iconEl, "pin")

		// ! クリックイベントを設定（ディレクトリ名"pinned"を渡す）。
		tab.addEventListener("click", () => {
			this.setActiveCategory("pinned")
			this.handlers.onCategoryChange("pinned")
		})

		return tab
	}

	// ! ゴミ箱タブを作成する。
	private createTrashTab(container: HTMLElement): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" })

		// ! ゴミ箱のカラーを設定（グレー系）。
		tab.style.setProperty("--category-color", "#6c757d")

		// ! アイコンを追加。
		const iconEl = tab.createDiv({ cls: "memolog-category-tab-icon" })
		setIcon(iconEl, "trash-2")

		// ! ラベルは表示しない（アイコンのみ）。

		// ! クリックイベントを設定（ディレクトリ名"trash"を渡す）。
		tab.addEventListener("click", () => {
			this.setActiveCategory("trash")
			this.handlers.onCategoryChange("trash")
		})

		return tab
	}

	// ! 個別のタブを作成する。
	private createTab(container: HTMLElement, category: CategoryConfig): HTMLElement {
		const tab = container.createDiv({ cls: "memolog-category-tab" })

		// ! カテゴリカラーを設定。
		tab.style.setProperty("--category-color", category.color)

		// ! アイコンを追加（category.showIconがtrueの場合のみ、デフォルトはtrue）。
		if ((category.showIcon ?? true) && category.icon) {
			const iconEl = tab.createDiv({ cls: "memolog-category-tab-icon" })
			setIcon(iconEl, category.icon)
		}

		// ! カテゴリ名を表示（UIのみ）。
		tab.createDiv({
			cls: "memolog-category-tab-name",
			text: category.name,
		})

		// ! クリックイベントを設定（ディレクトリ名を渡す）。
		tab.addEventListener("click", () => {
			this.setActiveCategory(category.directory)
			this.handlers.onCategoryChange(category.directory)
		})

		// ! ドラッグ&ドロップ機能を有効化。
		this.setupDragAndDrop(tab, category.directory)

		return tab
	}

	// ! アクティブなカテゴリを設定する。
	setActiveCategory(category: string): void {
		// ! 前のアクティブタブを非アクティブ化。
		const prevActive = this.tabElements.get(this.activeCategory)
		if (prevActive) {
			prevActive.removeClass("memolog-category-tab-active")
		}

		// ! 新しいアクティブタブをハイライト。
		this.activeCategory = category
		const newActive = this.tabElements.get(category)
		if (newActive) {
			newActive.addClass("memolog-category-tab-active")
		}
	}

	// ! カテゴリリストを更新する。
	updateCategories(categories: CategoryConfig[]): void {
		this.categories = categories
		this.render(this.activeCategory)
	}

	// ! 現在のアクティブカテゴリを取得する。
	getActiveCategory(): string {
		return this.activeCategory
	}

	// ! カテゴリをソートして返す。
	private getSortedCategories(): CategoryConfig[] {
		// ! categoryOrderに従ってソート。
		const orderMap = new Map(this.categoryOrder.map((dir, index) => [dir, index]))

		return [...this.categories].sort((a, b) => {
			const indexA = orderMap.get(a.directory) ?? this.categoryOrder.length
			const indexB = orderMap.get(b.directory) ?? this.categoryOrder.length
			return indexA - indexB
		})
	}

	// ! ドラッグ&ドロップを設定する。
	private setupDragAndDrop(tab: HTMLElement, categoryDirectory: string): void {
		// ! draggable属性を設定。
		tab.setAttribute("draggable", "true")
		tab.setAttribute("data-category", categoryDirectory)

		// ! dragstartイベント。
		tab.addEventListener("dragstart", (e: DragEvent) => {
			if (!e.dataTransfer) return

			this.draggedCategory = categoryDirectory
			e.dataTransfer.effectAllowed = "move"
			e.dataTransfer.setData("text/plain", categoryDirectory)
			tab.addClass("memolog-category-tab-dragging")
		})

		// ! dragendイベント。
		tab.addEventListener("dragend", () => {
			tab.removeClass("memolog-category-tab-dragging")
			// ! すべてのdragoverクラスを削除。
			this.container.querySelectorAll(".memolog-category-tab-dragover").forEach(el => {
				el.removeClass("memolog-category-tab-dragover")
			})
			this.draggedCategory = null
		})

		// ! dragenterイベント。
		tab.addEventListener("dragenter", (e: DragEvent) => {
			if (!this.draggedCategory || this.draggedCategory === categoryDirectory) return
			e.preventDefault()
			tab.addClass("memolog-category-tab-dragover")
		})

		// ! dragleaveイベント。
		tab.addEventListener("dragleave", () => {
			tab.removeClass("memolog-category-tab-dragover")
		})

		// ! dragoverイベント。
		tab.addEventListener("dragover", (e: DragEvent) => {
			if (!this.draggedCategory || this.draggedCategory === categoryDirectory) return
			e.preventDefault()
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = "move"
			}
		})

		// ! dropイベント。
		tab.addEventListener("drop", (e: DragEvent) => {
			e.preventDefault()
			tab.removeClass("memolog-category-tab-dragover")

			if (!this.draggedCategory || this.draggedCategory === categoryDirectory) return

			// ! カテゴリの順序を入れ替える。
			this.swapCategories(this.draggedCategory, categoryDirectory)
		})
	}

	// ! カテゴリの順序を入れ替える。
	private swapCategories(fromCategory: string, toCategory: string): void {
		const fromIndex = this.categoryOrder.indexOf(fromCategory)
		const toIndex = this.categoryOrder.indexOf(toCategory)

		if (fromIndex === -1 || toIndex === -1) return

		// ! 新しい順序を作成。
		const newOrder = [...this.categoryOrder]
		const [removed] = newOrder.splice(fromIndex, 1)
		newOrder.splice(toIndex, 0, removed)

		this.categoryOrder = newOrder

		// ! ハンドラーに通知。
		if (this.handlers.onCategoryOrderChange) {
			this.handlers.onCategoryOrderChange(newOrder)
		}

		// ! 再描画。
		this.render(this.activeCategory)
	}

	// ! カテゴリ順序を更新する。
	updateCategoryOrder(newOrder: string[]): void {
		this.categoryOrder = newOrder
		this.render(this.activeCategory)
	}
}
