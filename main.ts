import { Plugin } from "obsidian";
import { MemologSidebar, VIEW_TYPE_MEMOLOG } from "./src/ui/sidebar";
import { SettingsManager } from "./src/core/settings";
import { MemologSettingTab } from "./src/ui/settings-tab";

//! memologプラグインのメインクラス。
export default class MemologPlugin extends Plugin {
	//! 設定マネージャー。
	public settingsManager!: SettingsManager;

	//! プラグイン読み込み時の処理。
	override async onload() {
		//! 設定マネージャーを初期化。
		this.settingsManager = new SettingsManager(this.app);
		await this.settingsManager.loadGlobalSettings();

		//! サイドバービューを登録。
		this.registerView(VIEW_TYPE_MEMOLOG, (leaf) => new MemologSidebar(leaf, this));

		//! 設定タブを登録。
		this.addSettingTab(new MemologSettingTab(this.app, this));

		//! サイドバーを開くコマンドを登録。
		this.addCommand({
			id: "open-memolog-sidebar",
			name: "memologサイドバーを開く",
			callback: () => {
				void this.activateView();
			},
		});

		//! リボンアイコンを追加。
		this.addRibbonIcon("file-text", "memolog", () => {
			void this.activateView();
		});

		//! 初回起動時にサイドバーを開く。
		this.app.workspace.onLayoutReady(() => {
			void this.activateView();
		});
	}

	//! プラグインアンロード時の処理。
	override onunload() {
		//! ビューをデタッチ。
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_MEMOLOG);
	}

	//! サイドバーをアクティブにする。
	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_MEMOLOG)[0];

		if (!leaf) {
			//! 右サイドバーに新しいリーフを作成。
			const newLeaf = workspace.getRightLeaf(false);
			if (newLeaf) {
				await newLeaf.setViewState({
					type: VIEW_TYPE_MEMOLOG,
					active: true,
				});
				leaf = newLeaf;
			}
		}

		//! ビューをアクティブにする。
		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	//! サイドバーを再描画する。
	refreshSidebar(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MEMOLOG);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof MemologSidebar) {
				view.refresh();
			}
		}
	}
}
