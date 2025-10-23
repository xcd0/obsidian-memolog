import { App, PluginSettingTab, Setting } from "obsidian";
import MemologPlugin from "../../main";
import { CategoryConfig } from "../types";

//! memolog設定タブ。
export class MemologSettingTab extends PluginSettingTab {
	plugin: MemologPlugin;

	constructor(app: App, plugin: MemologPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "memolog 設定" });

		this.addBasicSettings(containerEl);
		this.addCategorySettings(containerEl);
	}

	//! 基本設定を追加する。
	private addBasicSettings(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "基本設定" });

		const settings = this.plugin.settingsManager.getGlobalSettings();

		//! ルートディレクトリ設定。
		new Setting(containerEl)
			.setName("ルートディレクトリ")
			.setDesc("memologファイルを保存するルートディレクトリ")
			.addText((text) =>
				text
					.setPlaceholder("memolog")
					.setValue(settings.rootDirectory)
					.onChange(async (value) => {
						await this.plugin.settingsManager.updateGlobalSettings({
							rootDirectory: value,
						});
					})
			);

		//! 保存単位設定。
		new Setting(containerEl)
			.setName("保存単位")
			.setDesc("メモを保存するファイルの単位")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("day", "日単位")
					.addOption("week", "週単位")
					.addOption("month", "月単位")
					.addOption("year", "年単位")
					.addOption("all", "全て1ファイル")
					.setValue(settings.saveUnit)
					.onChange(async (value) => {
						await this.plugin.settingsManager.updateGlobalSettings({
							saveUnit: value as typeof settings.saveUnit,
						});
					})
			);

		//! ソート順設定。
		new Setting(containerEl)
			.setName("ソート順")
			.setDesc("メモの表示順序")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("asc", "昇順（古い順）")
					.addOption("desc", "降順（新しい順）")
					.setValue(settings.order)
					.onChange(async (value) => {
						await this.plugin.settingsManager.updateGlobalSettings({
							order: value as typeof settings.order,
						});
					})
			);

		//! ディレクトリでカテゴリ分離設定。
		new Setting(containerEl)
			.setName("ディレクトリでカテゴリ分離")
			.setDesc("カテゴリごとに別のディレクトリに保存する")
			.addToggle((toggle) =>
				toggle.setValue(settings.useDirectoryCategory).onChange(async (value) => {
					await this.plugin.settingsManager.updateGlobalSettings({
						useDirectoryCategory: value,
					});
				})
			);

		//! Daily Notes連携設定。
		new Setting(containerEl)
			.setName("Daily Notes連携")
			.setDesc("メモをDaily Noteに追加するボタンを表示する")
			.addToggle((toggle) =>
				toggle.setValue(settings.enableDailyNotes).onChange(async (value) => {
					await this.plugin.settingsManager.updateGlobalSettings({
						enableDailyNotes: value,
					});
					//! サイドバーを再描画。
					this.plugin.refreshSidebar();
				})
			);

		//! デフォルトカテゴリ設定。
		new Setting(containerEl)
			.setName("デフォルトカテゴリ")
			.setDesc("新規メモ作成時のデフォルトカテゴリ")
			.addDropdown((dropdown) => {
				for (const category of settings.categories) {
					dropdown.addOption(category.name, category.name);
				}
				dropdown.setValue(settings.defaultCategory).onChange(async (value) => {
					await this.plugin.settingsManager.updateGlobalSettings({
						defaultCategory: value,
					});
				});
				return dropdown;
			});
	}

	//! カテゴリ設定を追加する。
	private addCategorySettings(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "カテゴリ管理" });

		const settings = this.plugin.settingsManager.getGlobalSettings();

		//! カテゴリ一覧を表示。
		for (let i = 0; i < settings.categories.length; i++) {
			this.addCategoryItem(containerEl, settings.categories[i], i);
		}

		//! カテゴリ追加ボタン。
		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("+ カテゴリを追加")
				.setCta()
				.onClick(async () => {
					const newCategory: CategoryConfig = {
						name: "新しいカテゴリ",
						directory: "new-category",
						color: "#3b82f6",
						icon: "folder",
					};
					const updatedCategories = [...settings.categories, newCategory];
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					});
					this.display();
				})
		);
	}

	//! カテゴリアイテムを追加する。
	private addCategoryItem(containerEl: HTMLElement, category: CategoryConfig, index: number): void {
		const settings = this.plugin.settingsManager.getGlobalSettings();

		const categoryDiv = containerEl.createDiv({ cls: "memolog-category-setting" });

		//! カテゴリ名。
		new Setting(categoryDiv)
			.setName("カテゴリ名")
			.addText((text) =>
				text
					.setPlaceholder("カテゴリ名")
					.setValue(category.name)
					.onChange(async (value) => {
						const updatedCategories = [...settings.categories];
						updatedCategories[index] = { ...updatedCategories[index], name: value };
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						});
					})
			);

		//! ディレクトリ名。
		new Setting(categoryDiv)
			.setName("ディレクトリ名")
			.addText((text) =>
				text
					.setPlaceholder("directory-name")
					.setValue(category.directory)
					.onChange(async (value) => {
						const updatedCategories = [...settings.categories];
						updatedCategories[index] = { ...updatedCategories[index], directory: value };
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						});
					})
			);

		//! カラーコード。
		new Setting(categoryDiv)
			.setName("カラー")
			.addText((text) =>
				text
					.setPlaceholder("#3b82f6")
					.setValue(category.color)
					.onChange(async (value) => {
						const updatedCategories = [...settings.categories];
						updatedCategories[index] = { ...updatedCategories[index], color: value };
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						});
					})
			);

		//! アイコン名。
		new Setting(categoryDiv)
			.setName("アイコン")
			.setDesc("Lucideアイコン名 (例: folder, briefcase, star)")
			.addText((text) =>
				text
					.setPlaceholder("folder")
					.setValue(category.icon)
					.onChange(async (value) => {
						const updatedCategories = [...settings.categories];
						updatedCategories[index] = { ...updatedCategories[index], icon: value };
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						});
					})
			);

		//! 削除ボタン。
		new Setting(categoryDiv)
			.addButton((button) =>
				button
					.setButtonText("削除")
					.setWarning()
					.onClick(async () => {
						const updatedCategories = settings.categories.filter((_, i) => i !== index);
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						});
						this.display();
					})
			);

		categoryDiv.createEl("hr");
	}
}
