# memolog 仕様書 v0.0.15 - モバイル対応

最終更新: 2025-11-13
バージョン: v0.0.15（策定中）

---

## 1. 概要

v0.0.15 では、モバイルデバイス（スマートフォン・タブレット）での使いやすさを向上させる。

### 1.1 背景

現状、memolog は `isDesktopOnly: false` としてモバイルでも動作するが、以下の課題がある：

- **タッチ操作の最適化不足**: ボタンのタップ領域が小さい
- **画面サイズへの対応不足**: 小さい画面での表示が最適化されていない
- **入力体験の改善**: モバイルキーボードとの連携が不十分
- **UI の調整**: モバイルデバイスでの操作性を考慮した UI 設計が必要

### 1.2 主な変更点

1. **Platform API の導入**
   - Obsidian の Platform API を使用してデバイスを判定
   - モバイル/デスクトップで UI を適切に切り替え

2. **タッチ操作の最適化**
   - ボタンのタップ領域を拡大（最小 44x44px）
   - スワイプジェスチャーのサポート
   - 長押しメニューの実装

3. **レスポンシブ UI の改善**
   - モバイル向けのレイアウト調整
   - フォントサイズの最適化
   - 余白とパディングの調整

4. **入力体験の改善**
   - モバイルキーボードとの連携
   - 自動フォーカス制御
   - ソフトウェアキーボードの表示時のレイアウト調整

---

## 2. Platform API の導入

### 2.1 デバイス判定

```typescript
import { Platform } from "obsidian"

// ! モバイルデバイスかどうかを判定。
export function isMobile(): boolean {
	return Platform.isMobile
}

// ! タブレットかどうかを判定。
export function isTablet(): boolean {
	return Platform.isTablet
}

// ! スマートフォンかどうかを判定。
export function isPhone(): boolean {
	return Platform.isPhone
}

// ! デスクトップかどうかを判定。
export function isDesktop(): boolean {
	return Platform.isDesktopApp
}
```

### 2.2 使用例

```typescript
import { isMobile } from "./utils/platform"

if (isMobile()) {
	// ! モバイル向けの処理。
	this.applyMobileLayout()
} else {
	// ! デスクトップ向けの処理。
	this.applyDesktopLayout()
}
```

---

## 3. タッチ操作の最適化

### 3.1 タップ領域の拡大

**Apple のヒューマンインターフェイスガイドライン:**

- 最小タップ領域: 44x44pt (約 44x44px)

**実装:**

```css
/* モバイルでのボタンサイズ調整 */
@media (max-width: 768px), (hover: none) {
	.memolog-btn,
	.memolog-btn-pin,
	.memolog-btn-delete,
	.memolog-btn-edit,
	.memolog-btn-category,
	.memolog-btn-thread {
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem;
	}

	/* アイコンサイズも調整 */
	.memolog-btn svg,
	.memolog-btn-pin svg,
	.memolog-btn-delete svg,
	.memolog-btn-edit svg,
	.memolog-btn-category svg,
	.memolog-btn-thread svg {
		width: 20px;
		height: 20px;
	}
}
```

### 3.2 スワイプジェスチャー

```typescript
// ! スワイプでメモカードを削除。
class MemoCard {
	private touchStartX = 0
	private touchStartY = 0

	setupSwipeGesture(element: HTMLElement) {
		element.addEventListener("touchstart", this.onTouchStart.bind(this))
		element.addEventListener("touchend", this.onTouchEnd.bind(this))
	}

	private onTouchStart(e: TouchEvent) {
		this.touchStartX = e.touches[0].clientX
		this.touchStartY = e.touches[0].clientY
	}

	private onTouchEnd(e: TouchEvent) {
		const deltaX = e.changedTouches[0].clientX - this.touchStartX
		const deltaY = e.changedTouches[0].clientY - this.touchStartY

		// ! 水平方向のスワイプを検出。
		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
			if (deltaX < 0) {
				// ! 左スワイプ: 削除オプションを表示。
				this.showDeleteOptions()
			} else {
				// ! 右スワイプ: ピン留め。
				this.togglePin()
			}
		}
	}
}
```

### 3.3 長押しメニュー

```typescript
// ! 長押しでコンテキストメニューを表示。
class MemoCard {
	private longPressTimer: number | null = null

	setupLongPress(element: HTMLElement) {
		element.addEventListener("touchstart", this.onTouchStartLongPress.bind(this))
		element.addEventListener("touchend", this.onTouchEndLongPress.bind(this))
		element.addEventListener("touchmove", this.onTouchMoveLongPress.bind(this))
	}

	private onTouchStartLongPress(e: TouchEvent) {
		this.longPressTimer = window.setTimeout(() => {
			this.showContextMenu(e)
		}, 500) // ! 500ms長押しで発動。
	}

	private onTouchEndLongPress(e: TouchEvent) {
		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer)
			this.longPressTimer = null
		}
	}

	private onTouchMoveLongPress(e: TouchEvent) {
		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer)
			this.longPressTimer = null
		}
	}

	private showContextMenu(e: TouchEvent) {
		// ! コンテキストメニューを表示。
		const menu = new Menu()
		menu.addItem(item => item.setTitle("ピン留め").onClick(() => this.togglePin()))
		menu.addItem(item => item.setTitle("削除").onClick(() => this.delete()))
		menu.addItem(item => item.setTitle("編集").onClick(() => this.edit()))
		menu.showAtPosition({ x: e.touches[0].clientX, y: e.touches[0].clientY })
	}
}
```

---

## 4. レスポンシブ UI の改善

### 4.1 モバイル向けレイアウト

```css
/* モバイルでの全体レイアウト調整 */
@media (max-width: 768px) {
	/* コンテナの余白を削減 */
	.memolog-container {
		padding: 0;
	}

	/* ヘッダーを省スペース化 */
	.memolog-header {
		padding: 0.5rem 0.75rem;
		gap: 0.5rem;
	}

	/* 検索バーを縮小 */
	.memolog-search-bar {
		font-size: 0.9rem;
		padding: 0.5rem;
	}

	/* カテゴリタブをスクロール可能に */
	.memolog-category-tabs {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none; /* Firefox */
	}

	.memolog-category-tabs::-webkit-scrollbar {
		display: none; /* Chrome/Safari */
	}

	/* メモカードの余白調整 */
	.memolog-card {
		padding: 0.75rem;
		margin-bottom: 0.75rem;
	}

	/* 入力エリアの調整 */
	.memolog-input-area {
		padding: 0.75rem;
	}

	.memolog-input-textarea {
		min-height: 60px;
		font-size: 0.95rem;
	}
}
```

### 4.2 フォントサイズの最適化

```css
/* モバイルでのフォントサイズ調整 */
@media (max-width: 768px) {
	.memolog-card-header-text {
		font-size: 0.85rem;
	}

	.memolog-card-content {
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.memolog-category-tab {
		font-size: 0.9rem;
		padding: 0.5rem 1rem;
	}
}
```

### 4.3 モーダルの調整

```css
/* モバイルでのモーダル調整 */
@media (max-width: 768px) {
	.modal {
		width: 95vw !important;
		max-width: 95vw !important;
		height: 90vh !important;
		max-height: 90vh !important;
	}

	.modal-content {
		padding: 1rem;
		overflow-y: auto;
	}

	/* 設定モーダルの調整 */
	.memolog-settings-modal .modal {
		width: 100vw !important;
		height: 100vh !important;
		max-width: 100vw !important;
		max-height: 100vh !important;
		border-radius: 0;
	}
}
```

---

## 5. 入力体験の改善

### 5.1 モバイルキーボードとの連携

```typescript
// ! モバイルキーボード表示時のレイアウト調整。
class MemoInput {
	setupKeyboardHandling(inputElement: HTMLTextAreaElement) {
		if (Platform.isMobile) {
			// ! フォーカス時にスクロール。
			inputElement.addEventListener("focus", () => {
				setTimeout(() => {
					inputElement.scrollIntoView({
						behavior: "smooth",
						block: "center",
					})
				}, 300) // ! キーボード表示を待つ。
			})
		}
	}
}
```

### 5.2 自動フォーカス制御

```typescript
// ! モバイルでは自動フォーカスを制御。
class MemoInput {
	focus() {
		if (Platform.isMobile) {
			// ! モバイルでは明示的にフォーカスされた場合のみ。
			// ! 自動フォーカスはキーボードが予期せず表示されるため避ける。
			return
		}

		this.inputElement.focus()
	}

	focusExplicit() {
		// ! 明示的なフォーカス（モバイルでも実行）。
		this.inputElement.focus()
	}
}
```

---

## 6. 実装計画

### 6.1 フェーズ1: Platform API の導入

- [ ] Platform API のユーティリティ関数を作成
- [ ] 既存コードで Platform API を使用するよう修正
- [ ] 単体テスト作成（10件以上）

### 6.2 フェーズ2: タッチ操作の最適化

- [ ] ボタンのタップ領域を拡大
- [ ] スワイプジェスチャーの実装
- [ ] 長押しメニューの実装
- [ ] タッチ操作のテスト作成

### 6.3 フェーズ3: レスポンシブ UI の改善

- [ ] モバイル向けレイアウト調整
- [ ] フォントサイズの最適化
- [ ] モーダルの調整
- [ ] CSS のメディアクエリ追加

### 6.4 フェーズ4: 入力体験の改善

- [ ] モバイルキーボードとの連携
- [ ] 自動フォーカス制御
- [ ] 入力エリアのスクロール調整

### 6.5 フェーズ5: テストと品質保証

- [ ] モバイルデバイスでの動作確認
- [ ] タッチ操作のテスト
- [ ] レイアウトの確認
- [ ] ドキュメント整備

---

## 7. 成功基準

### 7.1 機能要件

- [ ] Platform API を使用してデバイスを判定できる
- [ ] モバイルでボタンのタップ領域が 44x44px 以上
- [ ] スワイプジェスチャーでメモを操作できる
- [ ] 長押しでコンテキストメニューを表示できる
- [ ] モバイルキーボード表示時にレイアウトが調整される

### 7.2 非機能要件

- [ ] モバイルデバイスで快適に動作する
- [ ] タッチ操作が直感的である
- [ ] レイアウトが画面サイズに適応する
- [ ] テストカバレッジ 90% 以上を維持

---

## 8. 改訂履歴

### 2025-11-13 (第1版・策定中)

初版策定。モバイル対応の方針と実装計画を定義。

---

以上、memolog v0.0.15 仕様書（策定中）
