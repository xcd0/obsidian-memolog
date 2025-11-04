// ! タグ管理パネルコンポーネント。

import { setIcon } from "obsidian"

// ! タグ情報。
export interface TagInfo {
	// ! タグ名。
	name: string

	// ! 使用回数。
	count: number

	// ! タグの色（オプション）。
	color?: string
}

// ! タグパネルのイベントハンドラー。
export interface TagPanelHandlers {
	// ! タグクリック時。
	onTagClick?: (tagName: string) => void

	// ! タグ削除時。
	onTagDelete?: (tagName: string) => void

	// ! タグ名変更時。
	onTagRename?: (oldName: string, newName: string) => void

	// ! タグ作成時。
	onTagCreate?: (tagName: string) => void
}

// ! タグパネルクラス。
export class TagPanel {
	private container: HTMLElement
	private handlers: TagPanelHandlers
	private tags: TagInfo[] = []
	private filterText = ""
	private sortBy: "name" | "count" = "count"

	constructor(container: HTMLElement, handlers: TagPanelHandlers = {}) {
		this.container = container
		this.handlers = handlers
	}

	// ! タグリストを設定する。
	setTags(tags: TagInfo[]): void {
		this.tags = tags
		this.render()
	}

	// ! タグをフィルタリングする。
	setFilter(text: string): void {
		this.filterText = text.toLowerCase()
		this.render()
	}

	// ! ソート順を設定する。
	setSortBy(sortBy: "name" | "count"): void {
		this.sortBy = sortBy
		this.render()
	}

	// ! レンダリングする。
	render(): void {
		this.container.empty()

		// ! ヘッダー。
		const header = this.container.createDiv({ cls: "memolog-tag-panel-header" })

		// ! タイトル。
		header.createEl("h3", { text: "タグ", cls: "memolog-tag-panel-title" })

		// ! 検索ボックス。
		const searchContainer = header.createDiv({ cls: "memolog-tag-search" })
		const searchInput = searchContainer.createEl("input", {
			cls: "memolog-tag-search-input",
			attr: { type: "text", placeholder: "タグを検索..." },
		})

		searchInput.addEventListener("input", () => {
			this.setFilter(searchInput.value)
		})

		// ! ソートボタン。
		const sortContainer = header.createDiv({ cls: "memolog-tag-sort" })

		const sortByNameBtn = sortContainer.createEl("button", {
			cls: "memolog-tag-sort-btn",
			text: "名前順",
		})
		sortByNameBtn.addEventListener("click", () => {
			this.setSortBy("name")
		})

		const sortByCountBtn = sortContainer.createEl("button", {
			cls: "memolog-tag-sort-btn",
			text: "回数順",
		})
		sortByCountBtn.addEventListener("click", () => {
			this.setSortBy("count")
		})

		// ! 新規タグ作成ボタン。
		const createBtn = header.createEl("button", {
			cls: "memolog-btn memolog-btn-primary",
			text: "+ タグ追加",
		})
		setIcon(createBtn, "plus")
		createBtn.addEventListener("click", () => {
			this.showCreateDialog()
		})

		// ! タグリスト。
		const listContainer = this.container.createDiv({ cls: "memolog-tag-list" })

		const filteredTags = this.getFilteredAndSortedTags()

		if (filteredTags.length === 0) {
			listContainer.createEl("div", {
				cls: "memolog-tag-empty",
				text: "タグがありません",
			})
			return
		}

		for (const tag of filteredTags) {
			this.renderTagItem(listContainer, tag)
		}
	}

	// ! タグアイテムをレンダリングする。
	private renderTagItem(container: HTMLElement, tag: TagInfo): void {
		const item = container.createDiv({ cls: "memolog-tag-item" })

		// ! タグ色インジケーター。
		if (tag.color) {
			const indicator = item.createDiv({ cls: "memolog-tag-indicator" })
			indicator.style.backgroundColor = tag.color
		}

		// ! タグ名。
		const nameEl = item.createDiv({ cls: "memolog-tag-name" })
		nameEl.setText(tag.name)

		// ! 使用回数バッジ。
		const countEl = item.createDiv({ cls: "memolog-tag-count" })
		countEl.setText(tag.count.toString())

		// ! アクションボタン。
		const actions = item.createDiv({ cls: "memolog-tag-actions" })

		// ! 名前変更ボタン。
		const renameBtn = actions.createEl("button", {
			cls: "memolog-tag-action-btn",
			attr: { title: "名前変更" },
		})
		setIcon(renameBtn, "pencil")
		renameBtn.addEventListener("click", e => {
			e.stopPropagation()
			this.showRenameDialog(tag.name)
		})

		// ! 削除ボタン。
		const deleteBtn = actions.createEl("button", {
			cls: "memolog-tag-action-btn memolog-tag-delete-btn",
			attr: { title: "削除" },
		})
		setIcon(deleteBtn, "trash")
		deleteBtn.addEventListener("click", e => {
			e.stopPropagation()
			if (this.handlers.onTagDelete) {
				if (confirm(`タグ "${tag.name}" を削除しますか？`)) {
					this.handlers.onTagDelete(tag.name)
				}
			}
		})

		// ! タグクリックイベント。
		item.addEventListener("click", () => {
			if (this.handlers.onTagClick) {
				this.handlers.onTagClick(tag.name)
			}
		})
	}

	// ! フィルタリングとソートを適用したタグリストを取得する。
	private getFilteredAndSortedTags(): TagInfo[] {
		let result = [...this.tags]

		// ! フィルタリング。
		if (this.filterText) {
			result = result.filter(tag => tag.name.toLowerCase().includes(this.filterText))
		}

		// ! ソート。
		if (this.sortBy === "name") {
			result.sort((a, b) => a.name.localeCompare(b.name))
		} else {
			result.sort((a, b) => b.count - a.count)
		}

		return result
	}

	// ! タグ作成ダイアログを表示する。
	private showCreateDialog(): void {
		const tagName = prompt("新しいタグ名を入力してください:")

		if (tagName && tagName.trim()) {
			if (this.handlers.onTagCreate) {
				this.handlers.onTagCreate(tagName.trim())
			}
		}
	}

	// ! タグ名変更ダイアログを表示する。
	private showRenameDialog(oldName: string): void {
		const newName = prompt(`"${oldName}" の新しい名前を入力してください:`, oldName)

		if (newName && newName.trim() && newName !== oldName) {
			if (this.handlers.onTagRename) {
				this.handlers.onTagRename(oldName, newName.trim())
			}
		}
	}

	// ! タグ統計情報を表示する。
	showStatistics(stats: {
		totalTags: number
		totalUsage: number
		mostUsedTag: TagInfo | null
	}): void {
		const statsContainer = this.container.createDiv({ cls: "memolog-tag-stats" })

		statsContainer.createEl("h4", { text: "統計情報" })

		statsContainer.createEl("div", {
			text: `総タグ数: ${stats.totalTags}`,
		})

		statsContainer.createEl("div", {
			text: `総使用回数: ${stats.totalUsage}`,
		})

		if (stats.mostUsedTag) {
			statsContainer.createEl("div", {
				text: `最も使用されているタグ: ${stats.mostUsedTag.name} (${stats.mostUsedTag.count}回)`,
			})
		}
	}

	// ! タグをクリアする。
	clear(): void {
		this.tags = []
		this.filterText = ""
		this.render()
	}
}
