// ! 検索バーコンポーネント。

import { setIcon } from "obsidian"
import { SearchEngine, SearchQuery } from "../../core/search-engine"
import { debounce } from "../../utils/performance"

// ! 検索バーのイベントハンドラー。
export interface SearchBarHandlers {
	// ! 検索実行時のハンドラー。
	onSearch?: (query: SearchQuery) => void

	// ! 検索クリア時のハンドラー。
	onClear?: () => void
}

// ! 検索バーコンポーネント。
export class SearchBar {
	private container: HTMLElement
	private handlers: SearchBarHandlers
	private searchInput: HTMLInputElement | null = null
	private startDateInput: HTMLInputElement | null = null
	private endDateInput: HTMLInputElement | null = null
	private categorySelect: HTMLSelectElement | null = null
	private caseSensitiveCheckbox: HTMLInputElement | null = null
	private advancedOptionsVisible = false
	private categories: string[] = []
	private debouncedSearch: ((query: SearchQuery) => void) | null = null

	constructor(container: HTMLElement, handlers: SearchBarHandlers = {}) {
		this.container = container
		this.handlers = handlers

		// ! 検索処理にdebounceを適用 (300ms)。
		if (handlers.onSearch) {
			this.debouncedSearch = debounce(handlers.onSearch, 300)
		}
	}

	// ! カテゴリリストを設定する。
	setCategories(categories: string[]): void {
		this.categories = categories
		this.updateCategorySelect()
	}

	// ! 検索バーを描画する。
	render(): void {
		this.container.empty()

		// ! 検索バーコンテナ。
		const searchContainer = this.container.createDiv({ cls: "memolog-search-bar" })

		// ! 検索入力欄。
		const inputGroup = searchContainer.createDiv({ cls: "memolog-search-input-group" })

		const searchIconDiv = inputGroup.createDiv({ cls: "memolog-search-icon" })
		setIcon(searchIconDiv, "search")

		this.searchInput = inputGroup.createEl("input", {
			cls: "memolog-search-input",
			attr: {
				type: "text",
				placeholder: "メモを検索...",
			},
		})

		// ! 検索入力時のイベント。
		this.searchInput.addEventListener("input", () => {
			this.executeSearch()
		})

		// ! クリアボタン。
		const clearBtn = inputGroup.createDiv({ cls: "memolog-search-clear" })
		setIcon(clearBtn, "x")
		clearBtn.style.display = "none"

		clearBtn.addEventListener("click", () => {
			this.clearSearch()
		})

		// ! 検索入力があればクリアボタンを表示。
		this.searchInput.addEventListener("input", () => {
			if (this.searchInput && this.searchInput.value.trim()) {
				clearBtn.style.display = "block"
			} else {
				clearBtn.style.display = "none"
			}
		})

		// ! 高度な検索オプショントグルボタン。
		const toggleBtn = searchContainer.createEl("button", {
			cls: "memolog-search-toggle",
			text: "詳細検索",
		})

		toggleBtn.addEventListener("click", () => {
			this.toggleAdvancedOptions()
		})

		// ! 高度な検索オプション。
		const advancedOptions = searchContainer.createDiv({
			cls: "memolog-search-advanced",
		})
		advancedOptions.style.display = "none"

		// ! 日付範囲検索。
		const dateRangeGroup = advancedOptions.createDiv({ cls: "memolog-search-date-range" })

		dateRangeGroup.createEl("label", { text: "開始日" })
		this.startDateInput = dateRangeGroup.createEl("input", {
			type: "date",
			cls: "memolog-search-date-input",
		})

		dateRangeGroup.createEl("label", { text: "終了日" })
		this.endDateInput = dateRangeGroup.createEl("input", {
			type: "date",
			cls: "memolog-search-date-input",
		})

		// ! 日付プリセットボタン。
		const presetGroup = advancedOptions.createDiv({ cls: "memolog-search-presets" })

		const presets = [
			{ label: "今日", value: "today" },
			{ label: "過去7日", value: "week" },
			{ label: "過去30日", value: "month" },
			{ label: "過去1年", value: "year" },
			{ label: "過去全て", value: "all" },
		]

		for (const preset of presets) {
			const btn = presetGroup.createEl("button", {
				cls: "memolog-search-preset-btn",
				text: preset.label,
			})

			btn.addEventListener("click", () => {
				this.applyDatePreset(preset.value as "today" | "week" | "month" | "year" | "all")
			})
		}

		// ! カテゴリフィルタ。
		const categoryGroup = advancedOptions.createDiv({ cls: "memolog-search-category" })

		categoryGroup.createEl("label", { text: "カテゴリ" })
		this.categorySelect = categoryGroup.createEl("select", {
			cls: "memolog-search-category-select",
		})

		this.updateCategorySelect()

		// ! 大文字小文字区別。
		const optionsGroup = advancedOptions.createDiv({ cls: "memolog-search-options" })

		const caseSensitiveLabel = optionsGroup.createEl("label", {
			cls: "memolog-search-checkbox-label",
		})

		this.caseSensitiveCheckbox = caseSensitiveLabel.createEl("input", {
			type: "checkbox",
		})

		caseSensitiveLabel.createSpan({ text: "大文字小文字を区別" })

		// ! 変更時に検索実行。
		this.startDateInput.addEventListener("change", () => this.executeSearch())
		this.endDateInput.addEventListener("change", () => this.executeSearch())
		this.categorySelect.addEventListener("change", () => this.executeSearch())
		this.caseSensitiveCheckbox.addEventListener("change", () => this.executeSearch())
	}

	// ! 高度な検索オプションの表示切替。
	private toggleAdvancedOptions(): void {
		this.advancedOptionsVisible = !this.advancedOptionsVisible

		const advancedOptions = this.container.querySelector(
			".memolog-search-advanced",
		) as HTMLElement

		if (advancedOptions) {
			advancedOptions.style.display = this.advancedOptionsVisible ? "block" : "none"
		}
	}

	// ! カテゴリセレクトを更新する。
	private updateCategorySelect(): void {
		if (!this.categorySelect) return

		this.categorySelect.empty()

		// ! 全カテゴリオプション。
		const allOption = this.categorySelect.createEl("option", {
			value: "",
			text: "すべてのカテゴリ",
		})
		allOption.selected = true

		// ! カテゴリオプション。
		for (const category of this.categories) {
			this.categorySelect.createEl("option", {
				value: category,
				text: category,
			})
		}
	}

	// ! 日付プリセットを適用する。
	private applyDatePreset(preset: "today" | "week" | "month" | "year" | "all"): void {
		const range = SearchEngine.getDateRangePreset(preset)

		if (this.startDateInput) {
			this.startDateInput.value = range.startDate
		}

		if (this.endDateInput) {
			this.endDateInput.value = range.endDate
		}

		this.executeSearch()
	}

	// ! 検索を実行する。
	private executeSearch(): void {
		if (!this.debouncedSearch) return

		const query: SearchQuery = {
			text: this.searchInput?.value.trim() || undefined,
			startDate: this.startDateInput?.value || undefined,
			endDate: this.endDateInput?.value || undefined,
			categories: this.categorySelect && this.categorySelect.value
				? [this.categorySelect.value]
				: undefined,
			caseSensitive: this.caseSensitiveCheckbox?.checked || false,
		}

		// ! 空の検索条件の場合はクリア。
		if (!query.text && !query.startDate && !query.endDate && !query.categories) {
			if (this.handlers.onClear) {
				this.handlers.onClear()
			}
			return
		}

		this.debouncedSearch(query)
	}

	// ! 検索をクリアする。
	clearSearch(): void {
		if (this.searchInput) {
			this.searchInput.value = ""
		}

		if (this.startDateInput) {
			this.startDateInput.value = ""
		}

		if (this.endDateInput) {
			this.endDateInput.value = ""
		}

		if (this.categorySelect) {
			this.categorySelect.value = ""
		}

		if (this.caseSensitiveCheckbox) {
			this.caseSensitiveCheckbox.checked = false
		}

		// ! クリアボタンを非表示。
		const clearBtn = this.container.querySelector(".memolog-search-clear") as HTMLElement
		if (clearBtn) {
			clearBtn.style.display = "none"
		}

		if (this.handlers.onClear) {
			this.handlers.onClear()
		}
	}

	// ! 検索入力欄にフォーカスする。
	focus(): void {
		if (this.searchInput) {
			this.searchInput.focus()
		}
	}

	// ! 検索クエリを取得する。
	getQuery(): SearchQuery {
		return {
			text: this.searchInput?.value.trim() || undefined,
			startDate: this.startDateInput?.value || undefined,
			endDate: this.endDateInput?.value || undefined,
			categories: this.categorySelect && this.categorySelect.value
				? [this.categorySelect.value]
				: undefined,
			caseSensitive: this.caseSensitiveCheckbox?.checked || false,
		}
	}
}
