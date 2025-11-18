// ! 設定関連の型定義。

// ! カテゴリ設定。
export interface CategoryConfig {
	// ! カテゴリ表示名。
	name: string

	// ! 実際の保存フォルダ名。
	directory: string

	// ! UI上で使用するカラーコード。
	color: string

	// ! アイコン名（Obsidianのアイコンセット）。
	icon: string

	// ! アイコンを表示するか（デフォルト: true）。
	showIcon?: boolean

	// ! TODOリストとして使用するか（デフォルト: false）。
	useTodoList?: boolean
}

// ! グローバル設定。
export interface GlobalSettings {
	// ! ディレクトリでカテゴリを分離するかどうか。
	useDirectoryCategory: boolean

	// ! カテゴリ情報配列。
	categories: CategoryConfig[]

	// ! 既定のカテゴリのディレクトリ名。
	defaultCategory: string

	// ! ソート順（昇順/降順）。
	order: "asc" | "desc"

	// ! memologファイルの保存先ルートディレクトリ。
	rootDirectory: string

	// ! メモのテンプレート書式。
	memoTemplate: string

	// ! ファイルパスの書式（%Y/%m/%d/%H-%M.mdなど）。
	pathFormat: string

	// ! 添付ファイルの保存先（./相対パスまたは/ルート相対パス）。
	attachmentPath: string

	// ! 添付ファイル名の書式（%Y=年、%m=月、%d=日、%H=時、%M=分、%S=秒、%s=タイムスタンプ、%f=元ファイル名、%e=拡張子）。
	attachmentNameFormat: string

	// ! 検索履歴の最大サイズ。
	searchHistoryMaxSize: number

	// ! 全カテゴリ表示タブ（all）を表示するか。
	showAllTab: boolean

	// ! ゴミ箱機能を有効化するか。
	enableTrash: boolean

	// ! ゴミ箱の保持期間（日数）。
	trashRetentionDays: number

	// ! ゴミ箱タブを表示するか。
	showTrashTab: boolean

	// ! ピン留めされた投稿のID配列。
	pinnedMemoIds: string[]

	// ! ログ出力レベル（none, error, warn, info, debug）。
	logLevel: "none" | "error" | "warn" | "info" | "debug"

	// ! ピン留めタブを表示するか。
	showPinnedTab: boolean

	// ! 折りたたまれたスレッドのメモID配列。
	collapsedThreads: string[]

	// ! カテゴリタブの表示順序（カテゴリdirectory名の配列）。
	categoryOrder: string[]
}

// ! ローカル設定（カテゴリディレクトリごとの上書き設定）。
export interface LocalSettings {
	// ! テンプレート書式。
	template?: string

	// ! ソート順（昇順/降順）。
	order?: "asc" | "desc"

	// ! 添付ファイルの保存パス。
	attachmentPath?: string

	// ! ファイルパスフォーマット。
	pathFormat?: string
}

// ! デフォルトのグローバル設定。
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
	order: "asc",
	rootDirectory: "memolog",
	memoTemplate: "# %Y-%m-%d %H:%M:%S\n{{content}}",
	pathFormat: "%Y%m%d-%C.md",
	attachmentPath: "./attachments",
	attachmentNameFormat: "pasted-%s-%f%e",
	searchHistoryMaxSize: 50,
	showAllTab: true,
	enableTrash: true,
	trashRetentionDays: 30,
	showTrashTab: true,
	pinnedMemoIds: [],
	showPinnedTab: true,
	logLevel: "info",
	collapsedThreads: [],
	categoryOrder: ["work", "hobby"],
}
