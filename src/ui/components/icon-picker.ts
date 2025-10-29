//! アイコンピッカーコンポーネント。

import { setIcon } from "obsidian";
import {
	ICON_CATEGORIES,
	COMMON_ICONS,
	searchIcons,
	getIconsByCategory,
	getAllIcons,
} from "../../utils/icon-list";

//! アイコンピッカーのハンドラー。
interface IconPickerHandlers {
	onIconSelect: (iconName: string) => void;
}

//! アイコンピッカーUI。
export class IconPicker {
	private container: HTMLElement;
	private handlers: IconPickerHandlers;
	private selectedIcon: string;
	private isOpen: boolean = false;
	private pickerElement: HTMLElement | null = null;

	constructor(container: HTMLElement, selectedIcon: string, handlers: IconPickerHandlers) {
		this.container = container;
		this.selectedIcon = selectedIcon;
		this.handlers = handlers;
	}

	//! アイコンピッカーを描画する。
	render(): void {
		this.container.empty();

		//! アイコンボタン（現在選択されているアイコンを表示）。
		const iconButton = this.container.createDiv({ cls: "memolog-icon-picker-button" });

		const iconPreview = iconButton.createSpan({ cls: "memolog-icon-preview" });
		if (this.selectedIcon) {
			setIcon(iconPreview, this.selectedIcon);
		} else {
			iconPreview.setText("?");
		}

		const iconLabel = iconButton.createSpan({ cls: "memolog-icon-label" });
		iconLabel.setText(this.selectedIcon || "アイコンを選択");

		//! クリックでピッカーを開閉。
		iconButton.addEventListener("click", () => {
			this.toggle();
		});
	}

	//! ピッカーを開閉。
	toggle(): void {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}

	//! ピッカーを開く。
	open(): void {
		if (this.isOpen) return;

		this.isOpen = true;

		//! 現在フォーカスされている要素をblurする。
		if (document.activeElement && document.activeElement instanceof HTMLElement) {
			console.log("[memolog] Blurring currently focused element:", document.activeElement);
			document.activeElement.blur();
		}

		//! 設定タブボタンを一時的にフォーカス不可にする。
		const settingsTabButtons = document.querySelectorAll(".memolog-settings-tab-button");
		const originalTabIndexes: Map<Element, string | null> = new Map();
		settingsTabButtons.forEach((btn) => {
			originalTabIndexes.set(btn, btn.getAttribute("tabindex"));
			btn.setAttribute("tabindex", "-1");
		});

		//! オーバーレイ背景を作成（document.bodyに追加）。
		const overlay = document.body.createDiv({ cls: "memolog-icon-picker-overlay" });

		//! オーバーレイがフォーカスを奪わないようにする。
		overlay.addEventListener("mousedown", (e) => {
			if (e.target !== overlay) {
				e.preventDefault();
			}
		});

		//! ピッカー要素を作成（オーバーレイ内に配置）。
		this.pickerElement = overlay.createDiv({ cls: "memolog-icon-picker-dropdown" });

		//! ピッカー要素内のクリックでフォーカスが外れないようにする。
		this.pickerElement.addEventListener("mousedown", (e) => {
			//! 検索ボックス以外のクリックでフォーカスが外れないようにする。
			const target = e.target as HTMLElement;
			if (!target.matches(".memolog-icon-picker-search-input")) {
				console.log("[memolog] Picker mousedown (not search input), preventing default");
				e.preventDefault();
			}
		});

		//! 設定タブボタンへのフォーカスを防ぐフォーカストラップ。
		const focusTrap = (e: FocusEvent) => {
			const target = e.target as HTMLElement;
			console.log("[memolog] Global focus event, target:", target);

			//! 設定タブボタンへのフォーカスを明示的にブロック。
			if (target.classList.contains("memolog-settings-tab-button")) {
				console.log("[memolog] Blocking focus on settings tab button");
				e.preventDefault();
				e.stopImmediatePropagation();
				//! 検索入力にフォーカスを戻す。
				const searchInput = this.pickerElement?.querySelector(".memolog-icon-picker-search-input") as HTMLInputElement;
				if (searchInput) {
					searchInput.focus();
				}
				return false;
			}

			//! フォーカスがピッカー内の要素でない場合は検索入力に戻す。
			if (!this.pickerElement?.contains(target)) {
				console.log("[memolog] Focus moved outside picker, redirecting to search input");
				const searchInput = this.pickerElement?.querySelector(".memolog-icon-picker-search-input") as HTMLInputElement;
				if (searchInput && target !== searchInput) {
					setTimeout(() => {
						searchInput.focus();
					}, 0);
				}
			}
		};

		//! フォーカストラップをcaptureフェーズで登録（より早い段階でキャッチ）。
		document.addEventListener("focus", focusTrap, true);

		//! ピッカーが閉じられた時にフォーカストラップを解除し、tabindexを復元。
		const originalClose = this.close.bind(this);
		this.close = () => {
			document.removeEventListener("focus", focusTrap, true);
			//! 設定タブボタンの tabindex を元に戻す。
			originalTabIndexes.forEach((originalValue, btn) => {
				if (originalValue === null) {
					btn.removeAttribute("tabindex");
				} else {
					btn.setAttribute("tabindex", originalValue);
				}
			});
			originalClose();
		};

		//! 検索ボックス。
		const searchContainer = this.pickerElement.createDiv({
			cls: "memolog-icon-picker-search",
		});

		const searchIcon = searchContainer.createSpan({ cls: "memolog-icon-picker-search-icon" });
		setIcon(searchIcon, "search");

		const searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "アイコンを検索...",
			cls: "memolog-icon-picker-search-input",
			attr: { tabindex: "0" },
		});

		//! デバッグログ。
		searchInput.addEventListener("focus", () => {
			console.log("[memolog] Search input focused");
		});

		//! blur イベントログ。
		searchInput.addEventListener("blur", (e) => {
			const relatedTarget = (e as FocusEvent).relatedTarget as HTMLElement;
			console.log("[memolog] Search input blur, relatedTarget:", relatedTarget);
		});

		//! 検索ボックスのmousedownで確実にフォーカス。
		searchInput.addEventListener("mousedown", (e) => {
			console.log("[memolog] Search input mousedown");
			e.stopPropagation();
			//! 既にフォーカスされていない場合のみpreventDefault。
			if (document.activeElement !== searchInput) {
				e.preventDefault();
				searchInput.focus();
			}
		});

		//! 検索ボックスクリック時にフォーカスを維持。
		searchInput.addEventListener("click", (e) => {
			console.log("[memolog] Search input click");
			e.stopPropagation();
			searchInput.focus();
		});

		//! 検索コンテナクリック時は検索ボックスにフォーカス。
		searchContainer.addEventListener("click", (e) => {
			e.stopPropagation();
			if (e.target !== searchInput) {
				searchInput.focus();
			}
		});

		//! 検索アイコンクリック時も検索ボックスにフォーカス。
		searchIcon.addEventListener("click", (e) => {
			e.stopPropagation();
			searchInput.focus();
		});

		//! タブコンテナ。
		const tabsContainer = this.pickerElement.createDiv({
			cls: "memolog-icon-picker-tabs",
		});

		//! アイコングリッドコンテナ。
		const gridContainer = this.pickerElement.createDiv({
			cls: "memolog-icon-picker-grid-container",
		});

		//! グリッドコンテナのクリックでもフォーカスを維持。
		gridContainer.addEventListener("mousedown", (e) => {
			e.preventDefault();
		});

		//! 「よく使う」タブを初期表示。
		this.renderIconGrid(gridContainer, COMMON_ICONS);

		//! タブを作成。
		let activeTab: HTMLElement | null = null;

		const renderTab = (categoryName: string, isActive = false) => {
			const tab = tabsContainer.createDiv({
				cls: isActive
					? "memolog-icon-picker-tab memolog-icon-picker-tab-active"
					: "memolog-icon-picker-tab",
			});
			tab.setText(categoryName);

			//! タブクリックでもフォーカスを維持。
			tab.addEventListener("mousedown", (e) => {
				e.preventDefault();
			});

			tab.addEventListener("click", (e) => {
				e.stopPropagation();

				//! 既存のアクティブタブを非アクティブ化。
				if (activeTab) {
					activeTab.removeClass("memolog-icon-picker-tab-active");
				}

				//! 新しいタブをアクティブ化。
				tab.addClass("memolog-icon-picker-tab-active");
				activeTab = tab;

				//! アイコングリッドを更新。
				const icons = getIconsByCategory(categoryName);
				this.renderIconGrid(gridContainer, icons);
			});

			if (isActive) {
				activeTab = tab;
			}
		};

		//! 各カテゴリのタブを作成。
		ICON_CATEGORIES.forEach((category, index) => {
			renderTab(category.name, index === 0);
		});

		//! 「全て」タブを追加。
		const allTab = tabsContainer.createDiv({ cls: "memolog-icon-picker-tab" });
		allTab.setText("全て");

		//! タブクリックでもフォーカスを維持。
		allTab.addEventListener("mousedown", (e) => {
			e.preventDefault();
		});

		allTab.addEventListener("click", (e) => {
			e.stopPropagation();

			//! 既存のアクティブタブを非アクティブ化。
			if (activeTab) {
				activeTab.removeClass("memolog-icon-picker-tab-active");
			}

			//! 新しいタブをアクティブ化。
			allTab.addClass("memolog-icon-picker-tab-active");
			activeTab = allTab;

			//! 全アイコンを表示（最大500件）。
			const allIcons = getAllIcons().slice(0, 500);
			this.renderIconGrid(gridContainer, allIcons);
		});

		//! 検索入力イベント。
		searchInput.addEventListener("input", (e) => {
			const query = (e.target as HTMLInputElement).value;

			if (query.trim() === "") {
				//! 検索クエリが空の場合は「よく使う」を表示。
				this.renderIconGrid(gridContainer, COMMON_ICONS);
			} else {
				//! 検索結果を表示（最大500件）。
				const results = searchIcons(query, 500);
				this.renderIconGrid(gridContainer, results);
			}

			//! アクティブなタブを解除。
			if (activeTab) {
				activeTab.removeClass("memolog-icon-picker-tab-active");
			}
		});

		//! オーバーレイクリックで閉じる。
		overlay.addEventListener("click", (e) => {
			//! オーバーレイ自体がクリックされた場合のみ閉じる（ピッカー内部のクリックは除外）。
			if (e.target === overlay) {
				this.close();
			}
		});

		//! 検索ボックスにフォーカス（DOMレンダリング完了後に実行）。
		//! requestAnimationFrameを2回使用して確実にレンダリング完了を待つ。
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				searchInput.focus();
			});
		});
	}

	//! ピッカーを閉じる。
	close(): void {
		if (!this.isOpen) return;

		this.isOpen = false;

		//! オーバーレイ全体を削除（ピッカーも含まれる）。
		const overlay = document.querySelector(".memolog-icon-picker-overlay");
		if (overlay) {
			overlay.remove();
		}

		this.pickerElement = null;
	}

	//! アイコングリッドを描画。
	private renderIconGrid(container: HTMLElement, icons: string[]): void {
		container.empty();

		if (icons.length === 0) {
			const noResults = container.createDiv({ cls: "memolog-icon-picker-no-results" });
			noResults.setText("アイコンが見つかりませんでした");
			return;
		}

		//! アイコングリッド。
		const grid = container.createDiv({ cls: "memolog-icon-picker-grid" });

		for (const iconName of icons) {
			const iconItem = grid.createDiv({
				cls:
					iconName === this.selectedIcon
						? "memolog-icon-picker-item memolog-icon-picker-item-selected"
						: "memolog-icon-picker-item",
			});

			const iconSpan = iconItem.createSpan({ cls: "memolog-icon-picker-item-icon" });
			setIcon(iconSpan, iconName);

			const iconLabel = iconItem.createSpan({ cls: "memolog-icon-picker-item-label" });
			iconLabel.setText(iconName);

			//! クリックでアイコンを選択。
			iconItem.addEventListener("click", () => {
				this.selectedIcon = iconName;
				this.handlers.onIconSelect(iconName);
				this.close();
				this.render(); //! ボタンの表示を更新。
			});

			//! ホバーでツールチップ。
			iconItem.setAttribute("aria-label", iconName);
		}
	}

	//! 選択されているアイコンを取得。
	getSelectedIcon(): string {
		return this.selectedIcon;
	}

	//! 選択されているアイコンを設定。
	setSelectedIcon(iconName: string): void {
		this.selectedIcon = iconName;
		this.render();
	}
}
