//! メモエントリの型定義。
export interface MemoEntry {
	//! メモの一意識別子（UUID等）。
	id: string;

	//! カテゴリ名。
	category: string;

	//! タイムスタンプ（ISO 8601形式）。
	timestamp: string;

	//! メモの本文。
	content: string;

	//! 添付ファイルのパス配列（オプション）。
	attachments?: string[];

	//! メモ作成時に使用されたテンプレート（オプション）。
	template?: string;

	//! 作成日時（Date型）。
	createdAt?: Date;

	//! 更新日時（Date型）。
	updatedAt?: Date;

	//! ゴミ箱に移動した日時（ISO 8601形式）。
	trashedAt?: string;

	//! ピン留めした日時（ISO 8601形式）。
	pinnedAt?: string;

	//! 親メモのID（スレッドの場合）。v0.0.14で追加。
	parentId?: string;

	//! 返信数（キャッシュ用）。v0.0.14で追加。
	replyCount?: number;
}

//! メモの挿入位置。
export type InsertPosition = "top" | "bottom";

//! メモのソート順。
export type SortOrder = "asc" | "desc";

//! スレッドインデックス（メモリ内のみ）。v0.0.14で追加。
export interface ThreadIndex {
	//! 親メモID → 子メモIDリストのマップ。
	childrenMap: Map<string, string[]>;

	//! 子メモID → 親メモIDのマップ。
	parentMap: Map<string, string>;

	//! ルートメモIDのセット（parentIdがないメモ）。
	rootIds: Set<string>;

	//! 各メモの深さ（ルート=0）。
	depthMap: Map<string, number>;

	//! 各メモの子孫数（自身含まず）。
	descendantCountMap: Map<string, number>;
}

//! スレッドツリーのノード。v0.0.14で追加。
export interface ThreadNode {
	//! メモID。
	id: string;

	//! 子ノードのID配列（返信）。
	childIds: string[];

	//! 親ノードのID。
	parentId?: string;

	//! スレッドの深さ（0がルート）。
	depth: number;

	//! 子孫の総数（自身含まず）。
	descendantCount: number;

	//! 折りたたみ状態（UIで使用）。
	collapsed?: boolean;
}

//! スレッドツリー。v0.0.14で追加。
export interface ThreadTree {
	//! ルートメモのID。
	rootId: string;

	//! ノードマップ（ID → ThreadNode）。
	nodes: Map<string, ThreadNode>;

	//! 全メモ数（ルート含む）。
	totalCount: number;

	//! 最大深さ。
	maxDepth: number;

	//! 最終更新日時（ツリー内の最新タイムスタンプ）。
	lastUpdated: string;
}
