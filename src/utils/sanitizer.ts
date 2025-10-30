//! 入力のサニタイズユーティリティ。

//! HTMLタグを検出する正規表現。
const HTML_TAG_REGEX = /<[^>]*>/g;

//! スクリプトタグを検出する正規表現（大文字小文字を区別しない）。
const SCRIPT_TAG_REGEX = /<script[\s\S]*?<\/script>/gi;

//! イベントハンドラ属性を検出する正規表現。
const EVENT_HANDLER_REGEX = /\s+on\w+\s*=\s*["'][^"']*["']/gi;

//! javascript:プロトコルを検出する正規表現。
const JAVASCRIPT_PROTOCOL_REGEX = /javascript:/gi;

//! 危険な文字のエスケープマップ。
const ESCAPE_MAP: { [key: string]: string } = {
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#x27;",
	"/": "&#x2F;",
};

//! 文字列をエスケープする。
function escapeHtml(str: string): string {
	return str.replace(/[<>"'/]/g, (char) => ESCAPE_MAP[char] || char);
}

//! HTMLタグやスクリプトを含むかチェックする。
export function containsDangerousContent(input: string): boolean {
	if (!input || typeof input !== "string") {
		return false;
	}

	//! HTMLタグが含まれているかチェック。
	if (HTML_TAG_REGEX.test(input)) {
		return true;
	}

	//! スクリプトタグが含まれているかチェック。
	if (SCRIPT_TAG_REGEX.test(input)) {
		return true;
	}

	//! イベントハンドラ属性が含まれているかチェック。
	if (EVENT_HANDLER_REGEX.test(input)) {
		return true;
	}

	//! javascript:プロトコルが含まれているかチェック。
	if (JAVASCRIPT_PROTOCOL_REGEX.test(input)) {
		return true;
	}

	return false;
}

//! 文字列からHTMLタグやスクリプトを除去する。
export function sanitizeString(input: string, escapeHtmlChars = true): string {
	if (!input || typeof input !== "string") {
		return input;
	}

	let sanitized = input;

	//! スクリプトタグを除去。
	sanitized = sanitized.replace(SCRIPT_TAG_REGEX, "");

	//! イベントハンドラ属性を除去。
	sanitized = sanitized.replace(EVENT_HANDLER_REGEX, "");

	//! javascript:プロトコルを除去。
	sanitized = sanitized.replace(JAVASCRIPT_PROTOCOL_REGEX, "");

	//! HTMLタグを除去。
	sanitized = sanitized.replace(HTML_TAG_REGEX, "");

	//! HTML文字をエスケープ（オプション）。
	if (escapeHtmlChars) {
		sanitized = escapeHtml(sanitized);
	}

	return sanitized;
}

//! パス文字列をサニタイズする（パス区切り文字は保持）。
export function sanitizePath(path: string): string {
	if (!path || typeof path !== "string") {
		return path;
	}

	//! まず危険なコンテンツをチェック。
	if (containsDangerousContent(path)) {
		//! パス区切り文字以外のHTMLタグ等を除去。
		let sanitized = path;
		sanitized = sanitized.replace(SCRIPT_TAG_REGEX, "");
		sanitized = sanitized.replace(EVENT_HANDLER_REGEX, "");
		sanitized = sanitized.replace(JAVASCRIPT_PROTOCOL_REGEX, "");
		sanitized = sanitized.replace(HTML_TAG_REGEX, "");
		return sanitized;
	}

	return path;
}

//! テンプレート文字列をサニタイズする（{{content}}などのプレースホルダーは保持）。
export function sanitizeTemplate(template: string): string {
	if (!template || typeof template !== "string") {
		return template;
	}

	//! プレースホルダーを一時的に保護。
	const placeholderMap: { [key: string]: string } = {};
	let counter = 0;

	const protectedTemplate = template.replace(/\{\{[^}]+\}\}/g, (match) => {
		const placeholder = `__PLACEHOLDER_${counter}__`;
		placeholderMap[placeholder] = match;
		counter++;
		return placeholder;
	});

	//! サニタイズ（HTML文字はエスケープしない - Markdownとして使用されるため）。
	let sanitized = protectedTemplate;
	sanitized = sanitized.replace(SCRIPT_TAG_REGEX, "");
	sanitized = sanitized.replace(EVENT_HANDLER_REGEX, "");
	sanitized = sanitized.replace(JAVASCRIPT_PROTOCOL_REGEX, "");

	//! scriptタグ以外のHTMLタグは許可（Markdownとして使用されるため）。
	//! ただしイベントハンドラは除去済み。

	//! プレースホルダーを復元。
	Object.keys(placeholderMap).forEach((placeholder) => {
		sanitized = sanitized.replace(placeholder, placeholderMap[placeholder]);
	});

	return sanitized;
}

//! カテゴリ名をサニタイズする。
export function sanitizeCategoryName(name: string): string {
	return sanitizeString(name, false);
}

//! ディレクトリ名をサニタイズする。
export function sanitizeDirectoryName(directory: string): string {
	//! パスとして処理。
	return sanitizePath(directory);
}
