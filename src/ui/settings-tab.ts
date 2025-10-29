import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { IconPicker } from "./components/icon-picker";
import MemologPlugin from "../../main";
import { CategoryConfig, DEFAULT_GLOBAL_SETTINGS } from "../types";
import { TemplateManager } from "../core/template-manager";
import { PathGenerator } from "../utils/path-generator";
import { MemologSidebar, VIEW_TYPE_MEMOLOG } from "./sidebar";
import { MigrationConfirmModal, MigrationResultModal } from "./migration-modal";
import { RestoreBackupModal } from "./restore-modal";
import { PathMigrator } from "../utils/path-migrator";
import { MemologVaultHandler } from "../fs/vault-handler";
import { MemoManager } from "../core/memo-manager";
import { BackupManager } from "../utils/backup-manager";

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

//! memolog設定タブ。
export class MemologSettingTab extends PluginSettingTab {
	plugin: MemologPlugin;
	private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
	private initialPathFormat: string = "";
	private initialUseDirectoryCategory: boolean = false;
	private migrationButton: HTMLButtonElement | null = null;

	constructor(app: App, plugin: MemologPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	//! debounce関数 - 連続入力時に過度な保存を防ぐ。
	private debounce(key: string, callback: () => void, delay: number = 500): void {
		//! 既存のタイマーをクリア。
		const existingTimer = this.debounceTimers.get(key);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		//! 新しいタイマーをセット。
		const timer = setTimeout(() => {
			callback();
			this.debounceTimers.delete(key);
		}, delay);

		this.debounceTimers.set(key, timer);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "memolog 設定" });

		//! 初期値を保存（変更検出用）。
		const settings = this.plugin.settingsManager.getGlobalSettings();
		this.initialPathFormat = settings.pathFormat;
		this.initialUseDirectoryCategory = settings.useDirectoryCategory;

		this.addBasicSettings(containerEl);
		this.addCategorySettings(containerEl);
		this.addAdvancedFeatures(containerEl);
		this.addActionButtons(containerEl);
	}

	//! 基本設定を追加する。
	private addBasicSettings(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "基本設定" });

		const settings = this.plugin.settingsManager.getGlobalSettings();

		//! ルートディレクトリ設定。
		new Setting(containerEl)
			.setName("ルートディレクトリ")
			.setDesc("memologファイルを保存するルートディレクトリ")
			.addText((text) => {
				text
					.setPlaceholder("memolog")
					.setValue(settings.rootDirectory);

				const saveRootDirectory = async (value: string) => {
					await this.plugin.settingsManager.updateGlobalSettings({
						rootDirectory: value,
					});
				};

				//! リアルタイム保存 - input イベントを監視。
				text.inputEl.addEventListener("input", () => {
					const value = text.inputEl.value;
					this.debounce("root-directory", async () => {
						await saveRootDirectory(value);
					});
				});

				//! フォーカスが外れた時も即座に保存。
				text.inputEl.addEventListener("blur", () => {
					const value = text.inputEl.value;
					const existingTimer = this.debounceTimers.get("root-directory");
					if (existingTimer) {
						clearTimeout(existingTimer);
						this.debounceTimers.delete("root-directory");
					}
					void saveRootDirectory(value);
				});

				return text;
			});

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
					.addOption("asc", "昇順（最新が下）")
					.addOption("desc", "降順（最新が上）")
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

		//! ファイルパス書式設定。
		const pathFormatSetting = new Setting(containerEl)
			.setName("ファイルパスの書式")
			.setDesc("保存ファイルパスの書式を指定します。%Y=年、%m=月、%d=日、%H=時、%M=分、%C=カテゴリ名");

		//! プレビュー表示領域を説明側に追加。
		const pathPreviewContainer = pathFormatSetting.descEl.createDiv({
			cls: "memolog-template-preview-container",
			attr: {
				style: "margin-top: 8px; padding: 8px 12px; background-color: var(--background-secondary); border-radius: 4px; border: 1px solid var(--background-modifier-border);"
			}
		});
		pathPreviewContainer.createDiv({
			text: "出力例:",
			attr: {
				style: "font-weight: 600; margin-bottom: 4px; color: var(--text-muted); font-size: 0.85rem;"
			}
		});
		const pathPreviewContent = pathPreviewContainer.createDiv({
			cls: "memolog-template-preview-content",
			attr: {
				style: "white-space: pre-wrap; font-family: var(--font-monospace); line-height: 1.5; color: var(--text-normal); font-size: 0.9rem;"
			}
		});

		//! パスプレビュー更新関数。
		const updatePathPreview = (format: string) => {
			try {
				const preview = PathGenerator.generateCustomPath(
					"memolog",
					settings.categories[0]?.directory || "default",
					format,
					settings.useDirectoryCategory,
					new Date()
				);
				pathPreviewContent.setText(preview);
			} catch (error) {
				pathPreviewContent.setText(`エラー: ${(error as Error).message}`);
			}
		};

		const pathFormatContainer = pathFormatSetting.controlEl.createDiv({
			cls: "memolog-path-format-container"
		});

		//! プリセットオプション。
		const pathPresets = [
			{ label: "%Y-%m-%d/memo.md", value: "%Y-%m-%d/memo.md" },
			{ label: "%Y-%m-%d.md", value: "%Y-%m-%d.md" },
			{ label: "%Y%m%d.md", value: "%Y%m%d.md" },
			{ label: "%Y/%m/%d.md", value: "%Y/%m/%d.md" },
			{ label: "%C/%Y-%m-%d/memo.md", value: "%C/%Y-%m-%d/memo.md" },
			{ label: "%Y-%m-%d/%C.md", value: "%Y-%m-%d/%C.md" },
		];

		//! 現在の設定値がプリセットに含まれるか確認。
		const isPathCustom = !pathPresets.some(preset => preset.value === settings.pathFormat);

		//! カスタム入力欄の初期値（設定値または空文字）。
		let pathCustomValue = isPathCustom ? settings.pathFormat : "";

		//! ラジオボタングループ。
		const pathRadioGroup = pathFormatContainer.createDiv({
			cls: "memolog-path-format-radio-group"
		});

		//! カスタムラジオボタンと入力欄。
		const pathCustomRadioItem = pathRadioGroup.createDiv({
			cls: "memolog-path-format-radio-item"
		});

		const pathCustomRadio = pathCustomRadioItem.createEl("input", {
			type: "radio",
			attr: {
				name: "path-format",
				value: "custom",
				id: "path-format-custom"
			}
		}) as HTMLInputElement;

		if (isPathCustom) {
			pathCustomRadio.checked = true;
		}

		const pathCustomInput = pathCustomRadioItem.createEl("input", {
			type: "text",
			placeholder: "%Y-%m-%d/memo.md",
			value: pathCustomValue,
			cls: "memolog-setting-text-input-inline"
		}) as HTMLInputElement;

		//! カスタム入力欄クリック時、カスタムラジオボタンを自動選択。
		pathCustomInput.addEventListener("focus", () => {
			pathCustomRadio.checked = true;
			pathCustomRadio.dispatchEvent(new Event("change"));
		});

		//! 初期プレビューを表示。
		updatePathPreview(settings.pathFormat);

		//! 変換ボタンのチェック関数。
		const checkMigrationNeeded = () => {
			const currentSettings = this.plugin.settingsManager.getGlobalSettings();
			const hasChanged =
				currentSettings.pathFormat !== this.initialPathFormat ||
				currentSettings.useDirectoryCategory !== this.initialUseDirectoryCategory;

			if (this.migrationButton) {
				this.migrationButton.disabled = !hasChanged;
				this.migrationButton.toggleClass("mod-cta", hasChanged);
			}
		};

		//! プリセットラジオボタン。
		for (const preset of pathPresets) {
			const radioItem = pathRadioGroup.createDiv({
				cls: "memolog-path-format-radio-item"
			});

			const radio = radioItem.createEl("input", {
				type: "radio",
				attr: {
					name: "path-format",
					value: preset.value,
					id: `path-format-${preset.value}`
				}
			}) as HTMLInputElement;

			if (settings.pathFormat === preset.value) {
				radio.checked = true;
			}

			radioItem.createEl("label", {
				text: preset.label,
				attr: {
					for: `path-format-${preset.value}`
				},
				cls: "memolog-path-format-radio-label"
			});

			radio.addEventListener("change", async () => {
				if (radio.checked) {
					updatePathPreview(preset.value);
					await this.plugin.settingsManager.updateGlobalSettings({
						pathFormat: preset.value,
					});
					checkMigrationNeeded();
					//! サイドバー(カード表示)を再描画。
					this.refreshSidebar();
				}
			});
		}

		//! 変換ボタンを追加。
		const migrationSetting = new Setting(containerEl)
			.setName("既存ファイルの変換")
			.setDesc(
				"ファイルパス書式を変更した場合、このボタンで既存のファイルを新しい構造に変換できます。"
			);

		migrationSetting.addButton((btn) => {
			this.migrationButton = btn.buttonEl;
			btn.setButtonText("ファイルを変換").onClick(async () => {
				await this.showMigrationDialog();
			});
			btn.buttonEl.disabled = true;
		});

		//! リストアボタンを追加。
		const restoreSetting = new Setting(containerEl)
			.setName("バックアップから元に戻す")
			.setDesc("既存ファイルの変換処理時に作成されたバックアップからファイルを元の状態に戻します。");

		restoreSetting.addButton(async (btn) => {
			//! バックアップの存在を確認。
			const backupManager = new BackupManager(this.app);
			const backups = await backupManager.listBackupsWithMetadata("backup-memolog-");

			//! バックアップがない場合はボタンを無効化。
			if (backups.length === 0) {
				btn.setButtonText("元に戻す").setDisabled(true);
			} else {
				btn.setButtonText("元に戻す").onClick(async () => {
					const settings = this.plugin.settingsManager.getGlobalSettings();
					const modal = new RestoreBackupModal(
						this.app,
						settings.rootDirectory,
						() => {
							//! リストア後に画面を再描画。
							this.display();
							this.refreshSidebar();
						}
					);
					modal.open();
				});
			}
		});

		//! 各pathFormat変更時に変換ボタンをチェック。
		pathCustomRadio.addEventListener("change", async () => {
			if (pathCustomRadio.checked) {
				await this.plugin.settingsManager.updateGlobalSettings({
					pathFormat: pathCustomInput.value,
				});
				updatePathPreview(pathCustomInput.value);
				checkMigrationNeeded();
				//! サイドバー(カード表示)を再描画。
				this.refreshSidebar();
			}
		});

		pathCustomInput.addEventListener("input", () => {
			pathCustomValue = pathCustomInput.value;
			if (pathCustomRadio.checked) {
				updatePathPreview(pathCustomInput.value);
				this.debounce("path-format-custom", async () => {
					await this.plugin.settingsManager.updateGlobalSettings({
						pathFormat: pathCustomInput.value,
					});
					checkMigrationNeeded();
					//! サイドバー(カード表示)を再描画。
					this.refreshSidebar();
				});
			}
		});

		//! 添付ファイル保存先設定。
		const attachmentPathSetting = new Setting(containerEl)
			.setName("添付ファイルの保存先")
			.setDesc("画像などの添付ファイルの保存先を指定します。./で始まる場合は投稿ファイルのディレクトリからの相対パス、/で始まる場合はmemologルートディレクトリからの相対パスとなります。");

		const attachmentPathContainer = attachmentPathSetting.controlEl.createDiv({
			cls: "memolog-path-format-container"
		});

		//! プリセットオプション。
		const attachmentPresets = [
			{ label: "./attachments", value: "./attachments" },
			{ label: "/attachments", value: "/attachments" },
		];

		//! 現在の設定値がプリセットに含まれるか確認。
		const isAttachmentCustom = !attachmentPresets.some(preset => preset.value === settings.attachmentPath);

		//! カスタム入力欄の初期値。
		let attachmentCustomValue = isAttachmentCustom ? settings.attachmentPath : "";

		//! ラジオボタングループ。
		const attachmentRadioGroup = attachmentPathContainer.createDiv({
			cls: "memolog-path-format-radio-group"
		});

		//! カスタムラジオボタンと入力欄。
		const attachmentCustomRadioItem = attachmentRadioGroup.createDiv({
			cls: "memolog-path-format-radio-item"
		});

		const attachmentCustomRadio = attachmentCustomRadioItem.createEl("input", {
			type: "radio",
			attr: {
				name: "attachment-path",
				value: "custom",
				id: "attachment-path-custom"
			}
		}) as HTMLInputElement;

		if (isAttachmentCustom) {
			attachmentCustomRadio.checked = true;
		}

		const attachmentCustomInput = attachmentCustomRadioItem.createEl("input", {
			type: "text",
			placeholder: "./attachments",
			value: attachmentCustomValue,
			cls: "memolog-setting-text-input-inline"
		}) as HTMLInputElement;

		//! カスタムラジオボタンクリック時。
		attachmentCustomRadio.addEventListener("change", async () => {
			if (attachmentCustomRadio.checked) {
				await this.plugin.settingsManager.updateGlobalSettings({
					attachmentPath: attachmentCustomInput.value,
				});
			}
		});

		//! カスタム入力欄の入力時。
		attachmentCustomInput.addEventListener("input", () => {
			attachmentCustomValue = attachmentCustomInput.value;
			if (attachmentCustomRadio.checked) {
				this.debounce("attachment-path-custom", async () => {
					await this.plugin.settingsManager.updateGlobalSettings({
						attachmentPath: attachmentCustomInput.value,
					});
				});
			}
		});

		//! カスタム入力欄クリック時、カスタムラジオボタンを自動選択。
		attachmentCustomInput.addEventListener("focus", () => {
			attachmentCustomRadio.checked = true;
			attachmentCustomRadio.dispatchEvent(new Event("change"));
		});

		//! プリセットラジオボタン。
		for (const preset of attachmentPresets) {
			const radioItem = attachmentRadioGroup.createDiv({
				cls: "memolog-path-format-radio-item"
			});

			const radio = radioItem.createEl("input", {
				type: "radio",
				attr: {
					name: "attachment-path",
					value: preset.value,
					id: `attachment-path-${preset.value}`
				}
			}) as HTMLInputElement;

			if (settings.attachmentPath === preset.value) {
				radio.checked = true;
			}

			radioItem.createEl("label", {
				text: preset.label,
				attr: {
					for: `attachment-path-${preset.value}`
				},
				cls: "memolog-path-format-radio-label"
			});

			radio.addEventListener("change", async () => {
				if (radio.checked) {
					await this.plugin.settingsManager.updateGlobalSettings({
						attachmentPath: preset.value,
					});
				}
			});
		}

		//! 添付ファイル名書式設定。
		const attachmentNameSetting = new Setting(containerEl)
			.setName("添付ファイル名の書式")
			.setDesc("添付ファイルの名前を指定します。%Y=年、%m=月、%d=日、%H=時、%M=分、%S=秒、%s=タイムスタンプ、%f=元ファイル名、%e=拡張子");

		//! プレビュー表示領域を説明側に追加。
		const attachmentNamePreviewContainer = attachmentNameSetting.descEl.createDiv({
			cls: "memolog-template-preview-container",
			attr: {
				style: "margin-top: 8px; padding: 8px 12px; background-color: var(--background-secondary); border-radius: 4px; border: 1px solid var(--background-modifier-border);"
			}
		});
		attachmentNamePreviewContainer.createDiv({
			text: "出力例:",
			attr: {
				style: "font-weight: 600; margin-bottom: 4px; color: var(--text-muted); font-size: 0.85rem;"
			}
		});
		const attachmentNamePreviewContent = attachmentNamePreviewContainer.createDiv({
			cls: "memolog-template-preview-content",
			attr: {
				style: "white-space: pre-wrap; font-family: var(--font-monospace); line-height: 1.5; color: var(--text-normal); font-size: 0.9rem;"
			}
		});

		//! プレビュー更新関数。
		const updateAttachmentNamePreview = (format: string) => {
			try {
				const now = new Date();
				const examples = [
					{ label: "クリップボード貼り付け", fileName: "image.png" },
					{ label: "動画ファイル", fileName: "video.mp4" },
					{ label: "PDFファイル", fileName: "document.pdf" },
				];

				const previews = examples.map(example => {
					const generated = PathGenerator.generateAttachmentName(format, example.fileName, now);
					return `${example.label}: ${generated}`;
				});

				attachmentNamePreviewContent.setText(previews.join("\n"));
			} catch (error) {
				attachmentNamePreviewContent.setText(`エラー: ${(error as Error).message}`);
			}
		};

		const attachmentNameContainer = attachmentNameSetting.controlEl.createDiv({
			cls: "memolog-path-format-container"
		});

		//! プリセットオプション。
		const attachmentNamePresets = [
			{ label: "pasted-%s-%f%e", value: "pasted-%s-%f%e" },
			{ label: "%Y%m%d-%H%M%S-%f%e", value: "%Y%m%d-%H%M%S-%f%e" },
			{ label: "%f-%s%e", value: "%f-%s%e" },
		];

		//! 現在の設定値がプリセットに含まれるか確認。
		const isAttachmentNameCustom = !attachmentNamePresets.some(preset => preset.value === settings.attachmentNameFormat);

		//! カスタム入力欄の初期値。
		let attachmentNameCustomValue = isAttachmentNameCustom ? settings.attachmentNameFormat : "";

		//! ラジオボタングループ。
		const attachmentNameRadioGroup = attachmentNameContainer.createDiv({
			cls: "memolog-path-format-radio-group"
		});

		//! カスタムラジオボタンと入力欄。
		const attachmentNameCustomRadioItem = attachmentNameRadioGroup.createDiv({
			cls: "memolog-path-format-radio-item"
		});

		const attachmentNameCustomRadio = attachmentNameCustomRadioItem.createEl("input", {
			type: "radio",
			attr: {
				name: "attachment-name-format",
				value: "custom",
				id: "attachment-name-format-custom"
			}
		}) as HTMLInputElement;

		if (isAttachmentNameCustom) {
			attachmentNameCustomRadio.checked = true;
		}

		const attachmentNameCustomInput = attachmentNameCustomRadioItem.createEl("input", {
			type: "text",
			placeholder: "pasted-%s-%f%e",
			value: attachmentNameCustomValue,
			cls: "memolog-setting-text-input-inline"
		}) as HTMLInputElement;

		//! カスタムラジオボタンクリック時。
		attachmentNameCustomRadio.addEventListener("change", async () => {
			if (attachmentNameCustomRadio.checked) {
				await this.plugin.settingsManager.updateGlobalSettings({
					attachmentNameFormat: attachmentNameCustomInput.value,
				});
				updateAttachmentNamePreview(attachmentNameCustomInput.value);
			}
		});

		//! カスタム入力欄の入力時。
		attachmentNameCustomInput.addEventListener("input", () => {
			attachmentNameCustomValue = attachmentNameCustomInput.value;
			if (attachmentNameCustomRadio.checked) {
				updateAttachmentNamePreview(attachmentNameCustomInput.value);
				this.debounce("attachment-name-format-custom", async () => {
					await this.plugin.settingsManager.updateGlobalSettings({
						attachmentNameFormat: attachmentNameCustomInput.value,
					});
				});
			}
		});

		//! カスタム入力欄クリック時、カスタムラジオボタンを自動選択。
		attachmentNameCustomInput.addEventListener("focus", () => {
			attachmentNameCustomRadio.checked = true;
			attachmentNameCustomRadio.dispatchEvent(new Event("change"));
		});

		//! プリセットラジオボタン。
		for (const preset of attachmentNamePresets) {
			const radioItem = attachmentNameRadioGroup.createDiv({
				cls: "memolog-path-format-radio-item"
			});

			const radio = radioItem.createEl("input", {
				type: "radio",
				attr: {
					name: "attachment-name-format",
					value: preset.value,
					id: `attachment-name-format-${preset.value}`
				}
			}) as HTMLInputElement;

			if (settings.attachmentNameFormat === preset.value) {
				radio.checked = true;
			}

			radioItem.createEl("label", {
				text: preset.label,
				attr: {
					for: `attachment-name-format-${preset.value}`
				},
				cls: "memolog-path-format-radio-label"
			});

			radio.addEventListener("change", async () => {
				if (radio.checked) {
					updateAttachmentNamePreview(preset.value);
					await this.plugin.settingsManager.updateGlobalSettings({
						attachmentNameFormat: preset.value,
					});
				}
			});
		}

		//! 初期プレビューを表示。
		updateAttachmentNamePreview(settings.attachmentNameFormat);

		//! メモのテンプレート設定。
		const templateSetting = new Setting(containerEl)
			.setName("メモのテンプレート");

		//! 説明文を追加。
		templateSetting.descEl.createDiv({ text: "メモの書式を指定します。{{content}}が実際のメモ内容に置き換えられます。" });
		templateSetting.descEl.createDiv({
			text: "※この書式はファイルに保存される形式です。カード形式の表示では{{content}}の内容のみが表示されます。",
			attr: { style: "margin-top: 4px; color: var(--text-muted); font-size: 0.9em;" }
		});

		const templateContainer = templateSetting.controlEl.createDiv({
			cls: "memolog-path-format-container"
		});

		//! プリセットオプション。
		const templatePresets = [
			{ label: "{{content}}", value: "{{content}}" },
			{ label: "# %Y-%m-%d %H:%M:%S\\n{{content}}", value: "# %Y-%m-%d %H:%M:%S\n{{content}}" },
			{ label: "%Y/%m/%d-%H:%M:%S {{content}}", value: "%Y/%m/%d-%H:%M:%S {{content}}" },
		];

		//! 現在の設定値がプリセットに含まれるか確認。
		const isTemplateCustom = !templatePresets.some(preset => preset.value === settings.memoTemplate);

		//! カスタム入力欄の初期値。
		let templateCustomValue = isTemplateCustom ? settings.memoTemplate : "";

		//! ラジオボタングループ。
		const templateRadioGroup = templateContainer.createDiv({
			cls: "memolog-path-format-radio-group"
		});

		//! カスタムラジオボタンと入力欄。
		const templateCustomRadioItem = templateRadioGroup.createDiv({
			cls: "memolog-path-format-radio-item-textarea"
		});

		const templateCustomRadio = templateCustomRadioItem.createEl("input", {
			type: "radio",
			attr: {
				name: "memo-template",
				value: "custom",
				id: "memo-template-custom"
			}
		}) as HTMLInputElement;

		if (isTemplateCustom) {
			templateCustomRadio.checked = true;
		}

		const templateCustomInput = templateCustomRadioItem.createEl("textarea", {
			placeholder: "# %Y-%m-%d %H:%M:%S\n{{content}}",
			value: templateCustomValue,
			cls: "memolog-setting-textarea-input-inline"
		}) as HTMLTextAreaElement;
		templateCustomInput.rows = 4;

		//! カスタムラジオボタンクリック時。
		templateCustomRadio.addEventListener("change", async () => {
			if (templateCustomRadio.checked) {
				await this.plugin.settingsManager.updateGlobalSettings({
					memoTemplate: templateCustomInput.value,
				});
				updatePreview(templateCustomInput.value);
			}
		});

		//! カスタム入力欄の入力時。
		templateCustomInput.addEventListener("input", () => {
			templateCustomValue = templateCustomInput.value;
			if (templateCustomRadio.checked) {
				updatePreview(templateCustomInput.value);
				this.debounce("template-custom", async () => {
					await this.plugin.settingsManager.updateGlobalSettings({
						memoTemplate: templateCustomInput.value,
					});
				});
			}
		});

		//! カスタム入力欄クリック時、カスタムラジオボタンを自動選択。
		templateCustomInput.addEventListener("focus", () => {
			templateCustomRadio.checked = true;
			templateCustomRadio.dispatchEvent(new Event("change"));
		});

		//! カスタム入力欄からフォーカスが外れた時、{{content}}が含まれているかチェック。
		templateCustomInput.addEventListener("blur", () => {
			let value = templateCustomInput.value.trim();
			if (!value.includes("{{content}}")) {
				//! {{content}}が含まれていない場合は追加。
				if (value) {
					//! 値がある場合は改行を入れて追加。
					value = value + "\n{{content}}";
				} else {
					//! 空の場合は改行なしで追加。
					value = "{{content}}";
				}
				templateCustomInput.value = value;
				templateCustomValue = value;
				if (templateCustomRadio.checked) {
					updatePreview(value);
					void this.plugin.settingsManager.updateGlobalSettings({
						memoTemplate: value,
					});
				}
			}
		});

		//! プリセットラジオボタン。
		for (const preset of templatePresets) {
			const radioItem = templateRadioGroup.createDiv({
				cls: "memolog-path-format-radio-item"
			});

			const radio = radioItem.createEl("input", {
				type: "radio",
				attr: {
					name: "memo-template",
					value: preset.value,
					id: `memo-template-${preset.value}`
				}
			}) as HTMLInputElement;

			if (settings.memoTemplate === preset.value) {
				radio.checked = true;
			}

			radioItem.createEl("label", {
				text: preset.label,
				attr: {
					for: `memo-template-${preset.value}`
				},
				cls: "memolog-path-format-radio-label"
			});

			radio.addEventListener("change", async () => {
				if (radio.checked) {
					updatePreview(preset.value);
					await this.plugin.settingsManager.updateGlobalSettings({
						memoTemplate: preset.value,
					});
				}
			});
		}

		//! プレビュー表示領域を追加。
		const previewContainer = templateSetting.descEl.createDiv({
			cls: "memolog-template-preview-container",
			attr: {
				style: "margin-top: 12px; padding: 12px; background-color: var(--background-secondary); border-radius: 4px; border: 1px solid var(--background-modifier-border);"
			}
		});
		previewContainer.createDiv({
			text: "投稿例:",
			attr: {
				style: "font-weight: 600; margin-bottom: 8px; color: var(--text-muted);"
			}
		});
		const previewContent = previewContainer.createDiv({
			cls: "memolog-template-preview-content",
			attr: {
				style: "white-space: pre-wrap; font-family: var(--font-text); line-height: 1.5; color: var(--text-normal);"
			}
		});

		//! プレビュー更新関数。
		const updatePreview = (template: string) => {
			try {
				const preview = TemplateManager.preview(template);
				previewContent.setText(preview);
			} catch (error) {
				previewContent.setText(`エラー: ${(error as Error).message}`);
			}
		};

		//! 初期プレビューを表示。
		updatePreview(settings.memoTemplate);

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
			.addText((text) => {
				text
					.setPlaceholder("50")
					.setValue(String(settings.searchHistoryMaxSize));

				const saveMaxSize = async (value: string) => {
					const numValue = parseInt(value, 10);
					if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
						await this.plugin.settingsManager.updateGlobalSettings({
							searchHistoryMaxSize: numValue,
						});
					}
				};

				//! リアルタイム保存 - input イベントを監視。
				text.inputEl.addEventListener("input", () => {
					const value = text.inputEl.value;
					this.debounce("search-history-max-size", async () => {
						await saveMaxSize(value);
					});
				});

				//! フォーカスが外れた時も即座に保存。
				text.inputEl.addEventListener("blur", () => {
					const value = text.inputEl.value;
					const existingTimer = this.debounceTimers.get("search-history-max-size");
					if (existingTimer) {
						clearTimeout(existingTimer);
						this.debounceTimers.delete("search-history-max-size");
					}
					void saveMaxSize(value);
				});

				return text;
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
					this.refreshSidebar();
				})
		);

		//! 全カテゴリタブ表示設定。
		new Setting(containerEl)
			.setName("Allタブを表示")
			.setDesc("全カテゴリの投稿をまとめて表示するタブを追加します")
			.addToggle((toggle) =>
				toggle.setValue(settings.showAllTab).onChange(async (value) => {
					await this.plugin.settingsManager.updateGlobalSettings({
						showAllTab: value,
					});
					this.refreshSidebar();
				})
			);

		//! デフォルトカテゴリ設定。
		const defaultCategorySetting = new Setting(containerEl)
			.setName("デフォルトカテゴリ")
			.setDesc("新規メモ作成時のデフォルトカテゴリ（行をクリックして選択）");

		//! カテゴリが1つもない場合。
		if (settings.categories.length === 0) {
			defaultCategorySetting.setDesc("カテゴリを追加してください");
			return;
		}

		//! デフォルトカテゴリが存在しない場合、一番上のカテゴリを選択。
		const categoryExists = settings.categories.some((c) => c.directory === settings.defaultCategory);
		if (!categoryExists || !settings.defaultCategory) {
			const firstCategory = settings.categories[0];
			//! 非同期で設定を更新（awaitしない）。
			this.plugin.settingsManager
				.updateGlobalSettings({
					defaultCategory: firstCategory.directory,
				})
				.then(() => {
					//! 更新後にサイドバーを再描画。
					this.refreshSidebar();
				});
			//! 表示用に現在の設定を更新。
			settings.defaultCategory = firstCategory.directory;
		}

		//! 表を作成。
		const tableContainer = defaultCategorySetting.controlEl.createDiv({
			cls: "memolog-default-category-table-container",
		});
		const table = tableContainer.createEl("table", { cls: "memolog-default-category-table" });

		//! ヘッダー。
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "選択" });
		headerRow.createEl("th", { text: "カテゴリ名" });
		headerRow.createEl("th", { text: "カテゴリ表示名" });
		headerRow.createEl("th", { text: "色" });

		//! ボディ。
		const tbody = table.createEl("tbody");
		for (const category of settings.categories) {
			const row = tbody.createEl("tr", { cls: "memolog-default-category-row" });

			//! 選択されているカテゴリをハイライト。
			if (category.directory === settings.defaultCategory) {
				row.addClass("memolog-default-category-selected");
			}

			//! ラジオボタン。
			const radioCell = row.createEl("td");
			const radio = radioCell.createEl("input", { type: "radio" });
			radio.name = "default-category";
			radio.checked = category.directory === settings.defaultCategory;

			//! カテゴリ名（ディレクトリ名）。
			row.createEl("td", { text: category.directory, cls: "memolog-directory-name" });

			//! カテゴリ表示名。
			row.createEl("td", { text: category.name });

			//! 色。
			const colorCell = row.createEl("td");
			const colorBox = colorCell.createDiv({ cls: "memolog-color-box" });
			colorBox.style.backgroundColor = category.color;

			//! 行クリックで選択。
			row.addEventListener("click", async () => {
				//! 全ての行から選択状態を解除。
				tbody.querySelectorAll(".memolog-default-category-row").forEach((r) => {
					r.removeClass("memolog-default-category-selected");
					const radioInput = r.querySelector('input[type="radio"]') as HTMLInputElement;
					if (radioInput) radioInput.checked = false;
				});

				//! この行を選択。
				row.addClass("memolog-default-category-selected");
				radio.checked = true;

				//! 設定を更新。
				await this.plugin.settingsManager.updateGlobalSettings({
					defaultCategory: category.directory,
				});

				//! サイドバーを再描画。
				this.refreshSidebar();
			});
		}
	}

	//! カテゴリアイテムを追加する。
	private addCategoryItem(containerEl: HTMLElement, category: CategoryConfig, index: number): void {
		const settings = this.plugin.settingsManager.getGlobalSettings();

		const categoryDiv = containerEl.createDiv({ cls: "memolog-category-setting" });

		//! カテゴリ名（ディレクトリ名）。
		const directorySetting = new Setting(categoryDiv)
			.setName("カテゴリ名 (必須)")
			.setDesc("ディレクトリでカテゴリ分離がONの時にディレクトリ名として使用されます。");

		directorySetting.addText((text) => {
			text
				.setPlaceholder("directory-name")
				.setValue(category.directory);

			//! バリデーションと保存の共通処理。
			const validateAndSave = async (value: string) => {
				//! ディレクトリ名が空の場合はエラーメッセージを表示。
				if (!value.trim()) {
					text.inputEl.addClass("memolog-input-error");
					directorySetting.setDesc("⚠️ カテゴリ名は必須です。ディレクトリでカテゴリ分離がONの時にディレクトリ名として使用されます。");
				} else {
					text.inputEl.removeClass("memolog-input-error");
					directorySetting.setDesc("ディレクトリでカテゴリ分離がONの時にディレクトリ名として使用されます。");
				}

				//! 保存（空文字列でも保存される）。
				const updatedCategories = [...settings.categories];
				updatedCategories[index] = { ...updatedCategories[index], directory: value };
				await this.plugin.settingsManager.updateGlobalSettings({
					categories: updatedCategories,
				});
				this.refreshSidebar();
				//! デフォルトカテゴリ選択の表を更新。
				this.updateDefaultCategoryTable();
			};

			//! リアルタイム保存 - input イベントを監視。
			text.inputEl.addEventListener("input", () => {
				const value = text.inputEl.value;

				//! debounce付きで保存。
				this.debounce(`category-directory-${index}`, async () => {
					await validateAndSave(value);
				});
			});

			//! フォーカスが外れた時も即座に保存（debounce待ちをキャンセル）。
			text.inputEl.addEventListener("blur", () => {
				const value = text.inputEl.value;
				//! debounceのタイマーをクリア。
				const existingTimer = this.debounceTimers.get(`category-directory-${index}`);
				if (existingTimer) {
					clearTimeout(existingTimer);
					this.debounceTimers.delete(`category-directory-${index}`);
				}
				//! 即座に保存。
				void validateAndSave(value);
			});

			//! 初期表示時のチェック。
			if (!category.directory.trim()) {
				text.inputEl.addClass("memolog-input-error");
				directorySetting.setDesc("⚠️ カテゴリ名は必須です。ディレクトリでカテゴリ分離がONの時にディレクトリ名として使用されます。");
			}

			return text;
		});

		//! カテゴリ表示名。
		new Setting(categoryDiv)
			.setName("カテゴリ表示名 (空欄可)")
			.setDesc("タブ表示にのみ使用されます。空欄の場合はカテゴリ名が表示されます。")
			.addText((text) => {
				text
					.setPlaceholder("表示名")
					.setValue(category.name);

				//! 保存処理の共通関数（空文字列も許容）。
				const saveDisplayName = async (value: string) => {
					const updatedCategories = [...settings.categories];
					updatedCategories[index] = { ...updatedCategories[index], name: value };
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					});
					this.refreshSidebar();
					//! デフォルトカテゴリ選択の表を更新。
					this.updateDefaultCategoryTable();
				};

				//! リアルタイム保存 - input イベントを監視。
				text.inputEl.addEventListener("input", () => {
					const value = text.inputEl.value;

					//! debounce付きで保存（空文字列も保存される）。
					this.debounce(`category-name-${index}`, async () => {
						await saveDisplayName(value);
					});
				});

				//! フォーカスが外れた時も即座に保存（debounce待ちをキャンセル）。
				text.inputEl.addEventListener("blur", () => {
					const value = text.inputEl.value;
					//! debounceのタイマーをクリア。
					const existingTimer = this.debounceTimers.get(`category-name-${index}`);
					if (existingTimer) {
						clearTimeout(existingTimer);
						this.debounceTimers.delete(`category-name-${index}`);
					}
					//! 即座に保存（空文字列も保存される）。
					void saveDisplayName(value);
				});

				return text;
			});

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
			colorBtn.addEventListener("click", () => {
				void (async () => {
					const updatedCategories = [...settings.categories];
					updatedCategories[index] = { ...updatedCategories[index], color: preset.value };
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					});
					this.display();
					this.refreshSidebar();
				})();
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
					this.refreshSidebar();
				})
			)
			.addText((text) => {
				text
					.setValue(category.color)
					.setPlaceholder("#3b82f6");

				const saveColor = async (value: string) => {
					//! #で始まる6桁の16進数かチェック。
					if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
						const updatedCategories = [...settings.categories];
						updatedCategories[index] = { ...updatedCategories[index], color: value };
						await this.plugin.settingsManager.updateGlobalSettings({
							categories: updatedCategories,
						});
						this.display();
						this.refreshSidebar();
					}
				};

				//! リアルタイム保存 - input イベントを監視。
				text.inputEl.addEventListener("input", () => {
					const value = text.inputEl.value;
					this.debounce(`category-color-${index}`, async () => {
						await saveColor(value);
					});
				});

				//! フォーカスが外れた時も即座に保存。
				text.inputEl.addEventListener("blur", () => {
					const value = text.inputEl.value;
					const existingTimer = this.debounceTimers.get(`category-color-${index}`);
					if (existingTimer) {
						clearTimeout(existingTimer);
						this.debounceTimers.delete(`category-color-${index}`);
					}
					void saveColor(value);
				});

				return text;
			});

		//! アイコン選択（アイコンピッカーを使用）。
		const iconSetting = new Setting(categoryDiv)
			.setName("アイコン")
			.setDesc("カテゴリのアイコンを選択（1000種類以上から選択可能）");

		//! アイコンピッカーを作成。
		const iconPickerContainer = iconSetting.controlEl.createDiv({
			cls: "memolog-icon-picker-container",
		});
		iconPickerContainer.style.position = "relative";

		const iconPicker = new IconPicker(iconPickerContainer, category.icon, {
			onIconSelect: (iconName: string) => {
				void (async () => {
					const updatedCategories = [...settings.categories];
					updatedCategories[index] = { ...updatedCategories[index], icon: iconName };
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					});
					this.display();
					this.refreshSidebar();
				})();
			},
		});

		iconPicker.render();

		//! アイコン表示トグル。
		new Setting(categoryDiv)
			.setName("アイコンを表示")
			.setDesc("このカテゴリのタブにアイコンを表示します")
			.addToggle((toggle) =>
				toggle.setValue(category.showIcon ?? true).onChange(async (value) => {
					const updatedCategories = [...settings.categories];
					updatedCategories[index] = { ...updatedCategories[index], showIcon: value };
					await this.plugin.settingsManager.updateGlobalSettings({
						categories: updatedCategories,
					});
					this.refreshSidebar();
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
						this.refreshSidebar();
					})
			);
	}

	//! アクションボタン（設定リセット、保存）を追加する。
	private addActionButtons(containerEl: HTMLElement): void {
		//! ボタンコンテナ。
		const buttonContainer = containerEl.createDiv({
			cls: "memolog-settings-actions"
		});

		//! 左側: 設定リセットボタン。
		const resetContainer = buttonContainer.createDiv({
			cls: "memolog-settings-reset-container"
		});

		new Setting(resetContainer)
			.setName("設定をリセット")
			.setDesc("全ての設定をデフォルト値に戻します。この操作は取り消せません。")
			.addButton((button) =>
				button
					.setButtonText("設定をリセット")
					.setWarning()
					.onClick(async () => {
						//! 確認ダイアログ。
						const confirmed = await this.showResetConfirmDialog();
						if (confirmed) {
							//! デフォルト設定に戻す。
							await this.plugin.settingsManager.updateGlobalSettings(
								{ ...DEFAULT_GLOBAL_SETTINGS }
							);
							//! 画面を再描画。
							this.display();
							this.refreshSidebar();
							//! 成功通知。
							new Notice("設定をリセットしました");
						}
					})
			);

		//! 右側: 設定保存ボタン。
		const saveContainer = buttonContainer.createDiv({
			cls: "memolog-settings-save-container"
		});

		new Setting(saveContainer)
			.setName("設定を保存")
			.setDesc("設定はリアルタイムで自動保存されています。このボタンは手動で保存を確認したい場合に使用できます。")
			.addButton((button) =>
				button
					.setButtonText("設定を保存")
					.setCta()
					.onClick(async () => {
						await this.plugin.settingsManager.saveGlobalSettings();
						//! 成功通知。
						new Notice("設定を保存しました");
					})
			);
	}

	//! 設定リセット確認ダイアログを表示する。
	private async showResetConfirmDialog(): Promise<boolean> {
		return new Promise((resolve) => {
			//! モーダルダイアログを作成。
			const modal = document.createElement("div");
			modal.addClass("modal-container");
			modal.addClass("mod-dim");

			const modalBg = modal.createDiv({ cls: "modal-bg" });
			const modalContent = modal.createDiv({ cls: "modal" });

			//! タイトル。
			modalContent.createEl("h3", {
				text: "設定をリセットしますか？",
				cls: "modal-title"
			});

			//! メッセージ。
			modalContent.createEl("p", {
				text: "全ての設定がデフォルト値に戻ります。この操作は取り消せません。",
				cls: "modal-content"
			});

			//! ボタン群。
			const buttonGroup = modalContent.createDiv({ cls: "modal-button-container" });

			const cancelBtn = buttonGroup.createEl("button", {
				text: "キャンセル",
				cls: "mod-cta"
			});

			const confirmBtn = buttonGroup.createEl("button", {
				text: "リセット",
				cls: "mod-warning"
			});

			//! イベントリスナー。
			const closeModal = () => {
				modal.remove();
			};

			cancelBtn.addEventListener("click", () => {
				closeModal();
				resolve(false);
			});

			confirmBtn.addEventListener("click", () => {
				closeModal();
				resolve(true);
			});

			modalBg.addEventListener("click", () => {
				closeModal();
				resolve(false);
			});

			//! モーダルを表示。
			document.body.appendChild(modal);
		});
	}

	//! サイドバーをリフレッシュする。
	private refreshSidebar(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MEMOLOG);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof MemologSidebar) {
				view.refresh();
			}
		}
	}

	//! デフォルトカテゴリ選択の表を更新する。
	private updateDefaultCategoryTable(): void {
		const settings = this.plugin.settingsManager.getGlobalSettings();

		//! 既存の表を探す。
		const table = document.querySelector(".memolog-default-category-table") as HTMLTableElement;
		if (!table) return;

		//! tbody の内容を再生成。
		const tbody = table.querySelector("tbody");
		if (!tbody) return;

		tbody.empty();

		//! 各カテゴリの行を再作成。
		for (const category of settings.categories) {
			const row = tbody.createEl("tr", { cls: "memolog-default-category-row" });

			//! 選択されているカテゴリをハイライト。
			if (category.directory === settings.defaultCategory) {
				row.addClass("memolog-default-category-selected");
			}

			//! ラジオボタン。
			const radioCell = row.createEl("td");
			const radio = radioCell.createEl("input", { type: "radio" });
			radio.name = "default-category";
			radio.checked = category.directory === settings.defaultCategory;

			//! カテゴリ名（ディレクトリ名）。
			row.createEl("td", { text: category.directory, cls: "memolog-directory-name" });

			//! カテゴリ表示名。
			row.createEl("td", { text: category.name });

			//! 色。
			const colorCell = row.createEl("td");
			const colorBox = colorCell.createDiv({ cls: "memolog-color-box" });
			colorBox.style.backgroundColor = category.color;

			//! 行クリックで選択。
			row.addEventListener("click", async () => {
				//! 全ての行から選択状態を解除。
				tbody.querySelectorAll(".memolog-default-category-row").forEach((r) => {
					r.removeClass("memolog-default-category-selected");
					const radioInput = r.querySelector('input[type="radio"]') as HTMLInputElement;
					if (radioInput) radioInput.checked = false;
				});

				//! この行を選択。
				row.addClass("memolog-default-category-selected");
				radio.checked = true;

				//! 設定を更新。
				await this.plugin.settingsManager.updateGlobalSettings({
					defaultCategory: category.directory,
				});

				//! サイドバーを再描画。
				this.refreshSidebar();
			});
		}
	}

	//! メモマッピングを通常のPathMapping形式に変換（表示用）。
	private convertMemoMappingsToPathMappings(
		memoMappings: import("../utils/path-migrator").MemoSplitMapping[]
	): import("../utils/path-migrator").PathMapping[] {
		const mappings: import("../utils/path-migrator").PathMapping[] = [];

		for (const memoMapping of memoMappings) {
			for (const [newPath, memos] of memoMapping.newPathToMemos) {
				mappings.push({
					oldPath: memoMapping.oldPath,
					newPath,
					category: memos[0]?.category || "",
					date: memos[0] ? new Date(memos[0].timestamp) : undefined,
					hasConflict: memoMapping.hasConflict,
				});
			}
		}

		return mappings;
	}

	//! マイグレーションダイアログを表示。
	private async showMigrationDialog() {
		const settings = this.plugin.settingsManager.getGlobalSettings();
		const vaultHandler = new MemologVaultHandler(this.app);
		const memoManager = new MemoManager(this.app);
		const migrator = new PathMigrator(this.app, vaultHandler, memoManager);

		//! マイグレーション計画を作成。
		const notice = new Notice("変換計画を作成中...", 0);
		try {
			//! メモ分割マイグレーションを使用。
			const memoMappings = await migrator.planMemoSplitMigration(
				settings.rootDirectory,
				settings.pathFormat,
				settings.useDirectoryCategory,
				settings.defaultCategory
			);

			notice.hide();

			if (memoMappings.length === 0) {
				new Notice("変換対象のファイルがありません。");
				return;
			}

			//! メモマッピングを通常のPathMapping形式に変換（モーダル表示用）。
			const displayMappings = this.convertMemoMappingsToPathMappings(memoMappings);

			//! 確認モーダルを表示。
			const modal = new MigrationConfirmModal(
				this.app,
				settings.rootDirectory,
				displayMappings,
				this.initialPathFormat,
				settings.pathFormat,
				this.plugin.settingsManager,
				async (createBackup: boolean) => {
					const progressNotice = new Notice("ファイルを変換中...", 0);

					try {
						//! メモ分割マイグレーションを実行。
						const result = await migrator.executeMemoSplitMigration(
							memoMappings,
							createBackup
						);

						progressNotice.hide();

						//! 結果を表示。
						const resultModal = new MigrationResultModal(this.app, result);
						resultModal.open();

						//! 成功した場合は初期値を更新。
						if (result.successCount > 0) {
							this.initialPathFormat = settings.pathFormat;
							this.initialUseDirectoryCategory = settings.useDirectoryCategory;

							//! 変換ボタンを無効化。
							if (this.migrationButton) {
								this.migrationButton.disabled = true;
								this.migrationButton.removeClass("mod-cta");
							}
						}
					} catch (error) {
						progressNotice.hide();
						new Notice(
							`❌ 変換エラー: ${error instanceof Error ? error.message : "Unknown error"}`
						);
					}
				}
			);

			modal.open();
		} catch (error) {
			notice.hide();
			new Notice(
				`❌ 計画作成エラー: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}
}
