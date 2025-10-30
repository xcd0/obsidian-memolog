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

	//! TODO完了状態（TODOリストカテゴリの場合のみ使用）。
	todoCompleted?: boolean;
}

//! メモの挿入位置。
export type InsertPosition = "top" | "bottom";

//! メモのソート順。
export type SortOrder = "asc" | "desc";
