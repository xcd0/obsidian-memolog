//! テンプレート関連の型定義。

//! メモテンプレート。
export interface MemoTemplate {
	//! タイトル部分のフォーマット（例: '## %Y-%m-%d %H:%M'）。
	titleFormat: string;

	//! 本文部分のフォーマット。
	bodyFormat: string;

	//! タイムスタンプを含めるかどうか。
	includeTimestamp: boolean;

	//! カスタム変数定義（オプション）。
	customVariables?: Record<string, string>;
}

//! デフォルトのメモテンプレート。
export const DEFAULT_MEMO_TEMPLATE: MemoTemplate = {
	titleFormat: "## %Y-%m-%d %H:%M",
	bodyFormat: "%content%",
	includeTimestamp: true,
};

//! テンプレート変数。
export interface TemplateVariables {
	//! 年（4桁）。
	Y: string;

	//! 月（2桁）。
	m: string;

	//! 日（2桁）。
	d: string;

	//! 時（2桁・24時間形式）。
	H: string;

	//! 分（2桁）。
	M: string;

	//! 秒（2桁）。
	S: string;

	//! メモ本文。
	content: string;

	//! カテゴリ名。
	category?: string;

	//! カスタム変数。
	[key: string]: string | undefined;
}
