import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import MemologPlugin from "../../main";
import { CategoryConfig } from "../types";

//! プリセットカラー定義。
const PRESET_COLORS = [
	{ name: "青", value: "#3b82f6" },
	{ name: "緑", value: "#22c55e" },
	{ name: "赤", value: "#ef4444" },
	{ name: "黄", value: "#eab308" },
	{ name: "紫", value: "#a855f7" },
	{ name: "ピンク", value: "#ec4899" },
	{ name: "橙", value: "#f97316" },
	{ name: "青緑", value: "#14b8a6" },
	{ name: "灰", value: "#6b7280" },
	{ name: "茶", value: "#92400e" },
];

//! よく使うアイコン定義。
const COMMON_ICONS = [
	"folder",
	"briefcase",
	"gamepad-2",
	"star",
	"heart",
	"book",
	"coffee",
	"home",
	"user",
	"users",
	"calendar",
	"clock",
	"bookmark",
	"tag",
	"lightbulb",
	"code",
	"music",
	"image",
	"camera",
	"palette",
];

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
		this.addAdvancedFeatures(containerEl);
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

		//! メモのテンプレート設定。
		const templateSetting = new Setting(containerEl)
			.setName("メモのテンプレート")
			.addTextArea((text) => {
				text
					.setPlaceholder("{{content}}")
					.setValue(settings.memoTemplate)
					.onChange(async (value) => {
						await this.plugin.settingsManager.updateGlobalSettings({
							memoTemplate: value,
						});
					});
				//! textareaのサイズを大きくする。
				text.inputEl.rows = 5;
				text.inputEl.cols = 50;
			});

		//! 説明文と表を追加。
		templateSetting.descEl.createDiv({ text: "メモの書式を指定します。{{content}}が実際のメモ内容に置き換えられます。" });
		templateSetting.descEl.createEl("br");
		templateSetting.descEl.createDiv({ text: "利用可能な書式:", cls: "setting-item-description" });

		//! 書式コード一覧表を作成。
		const table = templateSetting.descEl.createEl("table", {
			attr: { style: "width: 100%; margin-top: 8px; border-collapse: collapse;" },
		});

		//! ヘッダー行。
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "書式", attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; text-align: left;" } });
		headerRow.createEl("th", { text: "説明", attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; text-align: left;" } });
		headerRow.createEl("th", { text: "例", attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; text-align: left;" } });

		//! データ行。
		const tbody = table.createEl("tbody");
		const formatData = [
			{ code: "%Y", desc: "年(4桁)", example: "2025" },
			{ code: "%y", desc: "年(2桁)", example: "25" },
			{ code: "%m", desc: "月(01-12)", example: "01" },
			{ code: "%B", desc: "月名", example: "1月" },
			{ code: "%b", desc: "月名略", example: "1月" },
			{ code: "%d", desc: "日(01-31)", example: "27" },
			{ code: "%A", desc: "曜日", example: "月曜日" },
			{ code: "%a", desc: "曜日略", example: "月" },
			{ code: "%u", desc: "曜日(1-7)", example: "1" },
			{ code: "%H", desc: "時(24h)", example: "14" },
			{ code: "%I", desc: "時(12h)", example: "02" },
			{ code: "%M", desc: "分", example: "30" },
			{ code: "%S", desc: "秒", example: "45" },
			{ code: "%s", desc: "UNIX時刻", example: "1738017045" },
		];

		for (const format of formatData) {
			const row = tbody.createEl("tr");
			row.createEl("td", { text: format.code, attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; font-family: monospace;" } });
			row.createEl("td", { text: format.desc, attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px;" } });
			row.createEl("td", { text: format.example, attr: { style: "border: 1px solid var(--background-modifier-border); padding: 4px 8px; font-family: monospace;" } });
		}

		//! ファイルパス書式設定。
		new Setting(containerEl)
			.setName("ファイルパスの書式")
			.setDesc("保存ファイルパスの書式を指定します。%Y=年、%m=月、%d=日、%H=時、%M=分")
			.addText((text) =>
				text
					.setPlaceholder("%Y/%m/%d")
					.setValue(settings.pathFormat)
					.onChange(async (value) => {
						await this.plugin.settingsManager.updateGlobalSettings({
							pathFormat: value,
						});
					})
			);
	}

	//! 高度な機能設定を追加する。
	private addAdvancedFeatures(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "高度な機能" });

		const settings = this.plugin.settingsManager.getGlobalSettings();

		//! 検索履歴設定。
		containerEl.createEl("h4", { text: "検索履歴" });

		new Setting(containerEl)
			.setName("検索履歴を有効化")
			.setDesc("検索履歴を保存して再利用可能にする")
			.addToggle((toggle) =>
				toggle.setValue(true).onChange((_value) => {
					//! 検索履歴の有効/無効を切り替え。
					this.plugin.refreshSidebar();
				})
			);

		new Setting(containerEl)
			.setName("検索履歴の最大サイズ")
			.setDesc("保存する検索履歴の最大数（1-100）")
			.addText((text) =>
				text
					.setPlaceholder("50")
					.setValue(String(settings.searchHistoryMaxSize))
					.onChange(async (value) => {
						const numValue = parseInt(value, 10);
						if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
							await this.plugin.settingsManager.updateGlobalSettings({
								searchHistoryMaxSize: numValue,
							});
						}
					})
			);

		//! メモ間リンク設定。
		containerEl.createEl("h4", { text: "メモ間リンク" });

		new Setting(containerEl)
			.setName("メモ間リンクを有効化")
			.setDesc("[[memo-id]] 形式のリンクを使用可能にする")
			.addToggle((toggle) =>
				toggle.setValue(true).onChange((_value) => {
					//! リンク機能の有効/無効を切り替え。
					this.plugin.refreshSidebar();
				})
			);

		new Setting(containerEl)
			.setName("孤立メモを警告")
			.setDesc("リンクがなく参照もされていないメモを警告する")
			.addToggle((toggle) =>
				toggle.setValue(false).onChange((_value) => {
					//! 孤立メモ警告の有効/無効を切り替え。
				})
			);

		new Setting(containerEl)
			.setName("リンク切れをチェック")
			.setDesc("存在しないメモへのリンクを検出して警告する")
			.addToggle((toggle) =>
				toggle.setValue(true).onChange((_value) => {
					//! リンク切れチェックの有効/無効を切り替え。
				})
			);

		//! タグ管理設定。
		containerEl.createEl("h4", { text: "タグ管理" });

		new Setting(containerEl)
			.setName("タグパネルを表示")
			.setDesc("サイドバーにタグ一覧パネルを表示する")
			.addToggle((toggle) =>
				toggle.setValue(true).onChange((_value) => {
					//! タグパネルの表示/非表示を切り替え。
					this.plugin.refreshSidebar();
				})
			);

		new Setting(containerEl)
			.setName("タグの自動補完")
			.setDesc("メモ作成時に既存のタグを候補として表示する")
			.addToggle((toggle) =>
				toggle.setValue(true).onChange((_value) => {
					//! タグ自動補完の有効/無効を切り替え。
				})
			);
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

		//! プリセットカラー選択。
		const colorSetting = new Setting(categoryDiv).setName("プリセットカラー");

		//! プリセットカラーボタンを追加。
		const colorContainer = colorSetting.controlEl.createDiv({ cls: "memolog-color-preset-container" });

		for (const preset of PRESET_COLORS) {
			const colorBtn = colorContainer.createDiv({ cls: "memolog-color-preset-btn" });
			colorBtn.style.backgroundColor = preset.value;
			colorBtn.setAttribute("aria-label", preset.name);
			if (category.color === preset.value) {
				colorBtn.addClass("memolog-color-preset-btn-selected");
			}
			colorBtn.addEventListener("click", async () => {
				const updatedCategories = [...settings.categories];
				updatedCategories[index] = { ...updatedCategories[index], color: preset.value };
				await this.plugin.settingsManager.updateGlobalSettings({
					categories: updatedCategories,
				});
				this.display();
			});
		}

		//! カラーコード入力（カラーピッカー + テキスト入力欄）。
		new Setting(categoryDiv)
			.setName("カラーコード")
			.addColorPicker((colorPicker) =>
				colorPicker.setValue(category.color).onChange(async (value) => {
					const updatedCategories = [...settings.categories];
					updatedCategories[index] = { ...updatedCategories[index], color: value };
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					});
					this.display();
				})
			)
			.addText((text) =>
				text
					.setValue(category.color)
					.setPlaceholder("#3b82f6")
					.onChange(async (value) => {
						//! #で始まる6桁の16進数かチェック。
						if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
							const updatedCategories = [...settings.categories];
							updatedCategories[index] = { ...updatedCategories[index], color: value };
							await this.plugin.settingsManager.updateGlobalSettings({
								categories: updatedCategories,
							});
							this.display();
						}
					})
			);

		//! アイコン選択。
		const iconSetting = new Setting(categoryDiv)
			.setName("アイコン")
			.setDesc(`選択中: ${category.icon}`);

		//! 現在選択されているアイコンを表示。
		const currentIconDiv = iconSetting.controlEl.createDiv({ cls: "memolog-current-icon" });
		setIcon(currentIconDiv, category.icon);

		//! アイコンプリセットボタンを追加。
		const iconContainer = iconSetting.controlEl.createDiv({ cls: "memolog-icon-preset-container" });

		for (const iconName of COMMON_ICONS) {
			const iconBtn = iconContainer.createDiv({ cls: "memolog-icon-preset-btn" });
			if (category.icon === iconName) {
				iconBtn.addClass("memolog-icon-preset-btn-selected");
			}
			setIcon(iconBtn, iconName);
			iconBtn.setAttribute("aria-label", iconName);
			iconBtn.addEventListener("click", async () => {
				const updatedCategories = [...settings.categories];
				updatedCategories[index] = { ...updatedCategories[index], icon: iconName };
				await this.plugin.settingsManager.updateGlobalSettings({
					categories: updatedCategories,
				});
				this.display();
			});
		}

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
	}
}
