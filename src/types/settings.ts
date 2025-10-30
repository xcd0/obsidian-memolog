//! 設定関連の型定義。

//! カテゴリ設定。
export interface CategoryConfig {
	//! カテゴリ表示名。
	name: string;

	//! 実際の保存フォルダ名。
	directory: string;

	//! UI上で使用するカラーコード。
	color: string;

	//! アイコン名（Obsidianのアイコンセット）。
	icon: string;

	//! アイコンを表示するか（デフォルト: true）。
	showIcon?: boolean;

	//! TODOリストとして使用するか（デフォルト: false）。
	useTodoList?: boolean;
}

//! 保存単位。
export type SaveUnit = "day" | "week" | "month" | "year" | "all";

//! グローバル設定。
export interface GlobalSettings {
	//! ディレクトリでカテゴリを分離するかどうか。
	useDirectoryCategory: boolean;

	//! カテゴリ情報配列。
	categories: CategoryConfig[];

	//! 既定のカテゴリのディレクトリ名。
	defaultCategory: string;

	//! 保存単位。
	saveUnit: SaveUnit;

	//! ソート順（昇順/降順）。
	order: "asc" | "desc";

	//! Daily Notes連携を有効化するか。
	enableDailyNotes: boolean;

	//! memologファイルの保存先ルートディレクトリ。
	rootDirectory: string;

	//! メモのテンプレート書式。
	memoTemplate: string;

	//! ファイルパスの書式（%Y/%m/%d/%H-%M.mdなど）。
	pathFormat: string;

	//! 添付ファイルの保存先（./相対パスまたは/ルート相対パス）。
	attachmentPath: string;

	//! 添付ファイル名の書式（%Y=年、%m=月、%d=日、%H=時、%M=分、%S=秒、%s=タイムスタンプ、%f=元ファイル名、%e=拡張子）。
	attachmentNameFormat: string;

	//! 検索履歴の最大サイズ。
	searchHistoryMaxSize: number;

	//! 全カテゴリ表示タブ（all）を表示するか。
	showAllTab: boolean;
}

//! ローカル設定（カテゴリディレクトリごとの上書き設定）。
export interface LocalSettings {
	//! テンプレート書式。
	template?: string;

	//! ソート順（昇順/降順）。
	order?: "asc" | "desc";

	//! 添付ファイルの保存パス。
	attachmentPath?: string;

	//! ファイルパスフォーマット。
	pathFormat?: string;
}

//! デフォルトのグローバル設定。
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
	useDirectoryCategory: false,
	categories: [
		{
			name: "仕事",
			directory: "work",
			color: "#3b82f6",
			icon: "briefcase",
		},
		{
			name: "趣味",
			directory: "hobby",
			color: "#22c55e",
			icon: "gamepad-2",
		},
	],
	defaultCategory: "work",
	saveUnit: "day",
	order: "asc",
	enableDailyNotes: false,
	rootDirectory: "memolog",
	memoTemplate: "# %Y-%m-%d %H:%M:%S\n{{content}}",
	pathFormat: "%Y-%m-%d.md",
	attachmentPath: "./attachments",
	attachmentNameFormat: "pasted-%s-%f%e",
	searchHistoryMaxSize: 50,
	showAllTab: true,
};
