import { MemoEntry } from "../types/memo";
import { v7 as uuidv7 } from "uuid";

//! タイムスタンプをフォーマットする（Linuxのdateコマンド書式に対応）。
export function formatTimestamp(timestamp: string, format: string): string {
	const date = new Date(timestamp);

	//! 月名（日本語）。
	const monthNames = [
		"1月",
		"2月",
		"3月",
		"4月",
		"5月",
		"6月",
		"7月",
		"8月",
		"9月",
		"10月",
		"11月",
		"12月",
	];
	const monthNamesShort = [
		"1月",
		"2月",
		"3月",
		"4月",
		"5月",
		"6月",
		"7月",
		"8月",
		"9月",
		"10月",
		"11月",
		"12月",
	];

	//! 曜日名（日本語）。
	const dayNames = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
	const dayNamesShort = ["日", "月", "火", "水", "木", "金", "土"];

	//! 12時間形式の時。
	const hours12 = date.getHours() % 12 || 12;

	//! 曜日（1-7、月曜日=1）。
	const dayOfWeek = date.getDay();
	const isoWeekday = dayOfWeek === 0 ? 7 : dayOfWeek;

	//! 置換マップ（順序が重要: 長いパターンを先に置換）。
	const replacements: Record<string, string> = {
		"%Y": date.getFullYear().toString(),
		"%y": date.getFullYear().toString().slice(-2),
		"%B": monthNames[date.getMonth()],
		"%b": monthNamesShort[date.getMonth()],
		"%m": (date.getMonth() + 1).toString().padStart(2, "0"),
		"%d": date.getDate().toString().padStart(2, "0"),
		"%A": dayNames[dayOfWeek],
		"%a": dayNamesShort[dayOfWeek],
		"%u": isoWeekday.toString(),
		"%H": date.getHours().toString().padStart(2, "0"),
		"%I": hours12.toString().padStart(2, "0"),
		"%M": date.getMinutes().toString().padStart(2, "0"),
		"%S": date.getSeconds().toString().padStart(2, "0"),
		"%s": Math.floor(date.getTime() / 1000).toString(),
	};

	let formatted = format;
	//! %B, %A を先に置換（%b, %a と衝突しないように）。
	for (const [key, value] of Object.entries(replacements)) {
		formatted = formatted.replace(new RegExp(key, "g"), value);
	}

	return formatted;
}

//! メモエントリをテキスト形式に変換する。
export function memoToText(memo: MemoEntry, template?: string, useTodoList = false): string {
	//! メモに保存されているテンプレートを優先、なければ引数のテンプレートを使用。
	const actualTemplate = memo.template || template || "## %Y-%m-%d %H:%M";
	const formattedTemplate = formatTimestamp(memo.timestamp, actualTemplate);
	const content = memo.content;
	const attachments =
		memo.attachments && memo.attachments.length > 0
			? `\n\n添付: ${memo.attachments.map((a) => `[[${a}]]`).join(", ")}`
			: "";

	//! ボディを構築。
	let body: string;
	if (actualTemplate.includes("{{content}}")) {
		//! テンプレート内の{{content}}を実際のメモ内容に置換。
		body = formattedTemplate.replace(/\{\{content\}\}/g, content);
	} else {
		//! テンプレートに{{content}}がない場合は、タイムスタンプの後に改行してcontentを追加。
		body = `${formattedTemplate}\n${content}`;
	}

	//! TODOリストの場合、チェックボックスを追加（contentに既にない場合のみ）。
	if (useTodoList && !/^-\s*\[([x ])\]\s+/.test(content)) {
		body = "- [ ] " + body.replace(/\n/g, "\n  ");
	}

	//! ID、タイムスタンプ、カテゴリ、テンプレートをHTMLコメントとして埋め込む。
	//! テンプレートはJSON.stringifyでエンコード（改行等を含むため）。
	const categoryEncoded = memo.category ? `, category: ${JSON.stringify(memo.category)}` : "";
	const templateEncoded = memo.template ? `, template: ${JSON.stringify(memo.template)}` : "";
	return `<!-- memo-id: ${memo.id}, timestamp: ${memo.timestamp}${categoryEncoded}${templateEncoded} -->\n${body}${attachments}\n`;
}

//! メモテキストからメタデータを抽出する。
export function parseMetadata(text: string): {
	id: string | null;
	timestamp: string | null;
	category: string | null;
	template: string | undefined;
	deleted: boolean;
	trashedAt: string | null;
	pinnedAt: string | null;
} {
	const commentMatch = text.match(/<!-- (.+?) -->/);

	if (!commentMatch) {
		return {
			id: null,
			timestamp: null,
			category: null,
			template: undefined,
			deleted: false,
			trashedAt: null,
			pinnedAt: null,
		};
	}

	const comment = commentMatch[1];
	const idMatch = comment.match(/memo-id: ([^,]+)/);
	const timestampMatch = comment.match(/timestamp: ([^,]+?)(?:,|$)/);
	const categoryMatch = comment.match(/category: ([^,]+?)(?:,|$)/);
	const templateMatch = comment.match(/template: ([^,]+?)(?:,|$)/);
	const deletedMatch = comment.match(/deleted: "([^"]+)"/);
	const trashedAtMatch = comment.match(/trashedAt: "([^"]+)"/);
	const pinnedAtMatch = comment.match(/pinnedAt: "([^"]+)"/);

	return {
		id: idMatch?.[1].trim() || null,
		timestamp: timestampMatch?.[1].trim() || null,
		category: categoryMatch ? JSON.parse(categoryMatch[1].trim()) : null,
		template: templateMatch ? JSON.parse(templateMatch[1].trim()) : undefined,
		deleted: deletedMatch?.[1] === "true",
		trashedAt: trashedAtMatch?.[1] || null,
		pinnedAt: pinnedAtMatch?.[1] || null,
	};
}

//! メモテキストから内容を抽出する（コメントヘッダーを除く）。
export function extractContent(text: string): string {
	//! コメント行を削除。
	const withoutComment = text.replace(/^<!-- .+? -->\n?/m, "");

	//! 添付ファイル行を削除。
	const withoutAttachments = withoutComment.replace(/\n\n添付: .+$/m, "");

	return withoutAttachments.trim();
}

//! 添付ファイルを抽出する。
export function extractAttachments(text: string): string[] {
	const attachmentMatch = text.match(/添付: (.+)$/m);
	if (!attachmentMatch) {
		return [];
	}

	const attachmentText = attachmentMatch[1];
	const attachmentLinks = attachmentText.match(/\[\[([^\]]+)\]\]/g);

	if (!attachmentLinks) {
		return [];
	}

	return attachmentLinks.map((link) => link.replace(/\[\[|\]\]/g, ""));
}

//! メモをコメントアウトする（ゴミ箱用）。
export function commentOutMemo(memoText: string): string {
	const lines = memoText.split("\n");
	const headerLine = lines[0]; //! 最初の行がヘッダー。
	const contentLines = lines.slice(1); //! 残りがコンテンツ。

	//! コンテンツをコメントアウト。
	const content = contentLines.join("\n").trim();
	const commentedContent = content ? `<!--\n${content}\n-->` : "";

	//! 結合。
	return headerLine + "\n" + commentedContent;
}

//! メモのコメントアウトを解除する（復元用）。
export function uncommentMemo(memoText: string): string {
	const lines = memoText.split("\n");
	const headerLine = lines[0];

	//! コメントアウトされたコンテンツを抽出。
	const commentMatch = memoText.match(/<!--\n([\s\S]*?)\n-->/);

	if (!commentMatch) {
		//! コメントアウトされていない場合はそのまま返す。
		return memoText;
	}

	const content = commentMatch[1];
	return headerLine + "\n" + content + "\n";
}

//! メモヘッダーにフラグを追加する。
export function addFlagToHeader(
	memoText: string,
	flagName: string,
	flagValue: string
): string {
	return memoText.replace(
		/(<!-- memo-id: [^>]+) -->/,
		`$1, ${flagName}: "${flagValue}" -->`
	);
}

//! メモヘッダーからフラグを削除する。
export function removeFlagFromHeader(memoText: string, flagName: string): string {
	const pattern = new RegExp(`, ${flagName}: "[^"]*"`, "g");
	return memoText.replace(pattern, "");
}

//! メモが削除されているかチェックする。
export function isDeletedMemo(memoText: string): boolean {
	return /deleted: "true"/.test(memoText);
}

//! メモがピン留めされているかチェックする。
export function isPinnedMemo(memoText: string): boolean {
	return /pinnedAt: "/.test(memoText);
}

//! TODOの完了状態を更新する。
export function updateTodoStatus(content: string, completed: boolean): string {
	const checkbox = completed ? "[x]" : "[ ]";
	return content.replace(/^-\s*\[([x ])\]\s+/m, `- ${checkbox} `);
}

//! テキスト形式からメモエントリを解析する。
export function parseTextToMemo(text: string, category: string): MemoEntry | null {
	//! 簡易的なパース実装（タイムスタンプと内容を分離）。
	const lines = text.trim().split("\n");
	if (lines.length === 0) {
		return null;
	}

	//! ID、タイムスタンプ、カテゴリ、テンプレートをHTMLコメントから抽出。
	const commentMatch = text.match(/<!-- (.+?) -->/);
	let id = uuidv7();
	let timestamp: string | null = null;
	let parsedCategory: string | null = null;
	let template: string | undefined = undefined;

	if (commentMatch) {
		const comment = commentMatch[1];
		const idMatch = comment.match(/memo-id: ([^,]+)/);
		const timestampMatch = comment.match(/timestamp: ([^,]+?)(?:,|$)/);
		const categoryMatch = comment.match(/category: ([^,]+?)(?:,|$)/);
		const templateMatch = comment.match(/template: ([^,]+?)(?:,|$)/);

		id = idMatch?.[1].trim() || uuidv7();
		timestamp = timestampMatch?.[1].trim() || null;

		if (categoryMatch) {
			try {
				parsedCategory = JSON.parse(categoryMatch[1].trim()) as string;
			} catch (e) {
				//! JSON.parseエラーの場合は直接使用。
				parsedCategory = categoryMatch[1].trim();
			}
		}

		if (templateMatch) {
			try {
				template = JSON.parse(templateMatch[1].trim()) as string;
			} catch (e) {
				//! JSON.parseエラーは無視（後方互換性）。
				console.warn("[memolog] Failed to parse template from comment:", e);
			}
		}
	}


	//! 削除フラグとtrashedAtタイムスタンプをmemo-idヘッダーから抽出。
	let trashedAt: string | undefined = undefined;
	if (commentMatch) {
		const comment = commentMatch[1];
		const deletedMatch = comment.match(/deleted: "([^"]+)"/);
		const trashedAtMatch = comment.match(/trashedAt: "([^"]+)"/);
		if (deletedMatch && trashedAtMatch) {
			const isDeleted = deletedMatch[1] === "true";
			if (isDeleted) {
				trashedAt = trashedAtMatch[1];
			}
		}
	}

	//! コメントからパースしたカテゴリがあればそれを使用、なければ引数のcategoryを使用。
	const finalCategory = parsedCategory || category;

	//! HTMLコメント行をスキップ。
	const contentStartIndex = lines[0].startsWith("<!--") ? 1 : 0;

	//! HTMLコメントにtimestampがない場合は、見出し行から抽出（後方互換性）。
	if (!timestamp && contentStartIndex < lines.length) {
		const timestampLine = lines[contentStartIndex];
		const timestampMatch = timestampLine.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2})/);
		timestamp = timestampMatch ? timestampMatch[1].replace(" ", "T") : new Date().toISOString();
	}

	//! timestampがnullの場合はデフォルト値を設定。
	const finalTimestamp = timestamp || new Date().toISOString();

	//! 本文を抽出。
	let content: string;

	//! テンプレートに{{content}}が含まれている場合、テンプレートから{{content}}部分のみを逆算。
	if (template && template.includes("{{content}}")) {
		const bodyText = lines.slice(contentStartIndex).join("\n");

		//! テンプレートを{{content}}で分割。
		const parts = template.split("{{content}}");
		const beforeContent = parts[0] ? formatTimestamp(finalTimestamp, parts[0]) : "";
		const afterContent = parts[1] ? formatTimestamp(finalTimestamp, parts[1]) : "";

		//! 実際のテキストから前後の部分を削除してコンテンツを抽出。
		let extracted = bodyText;
		if (beforeContent && extracted.startsWith(beforeContent)) {
			extracted = extracted.slice(beforeContent.length);
		}
		if (afterContent && extracted.endsWith(afterContent)) {
			extracted = extracted.slice(0, -afterContent.length);
		}
		content = extracted.trim();
	} else {
		//! デフォルト: HTMLコメントの次がタイムスタンプ行、その次の行から本文。
		const actualContentStartIndex = contentStartIndex + 1;
		content = lines.slice(actualContentStartIndex).join("\n").trim();
	}

	//! コメントアウトされたコンテンツ（<!--\nCONTENT\n-->）を展開。
	if (content.startsWith("<!--") && content.endsWith("-->")) {
		//! HTMLコメントを削除。
		const uncommented = content.slice(4, -3).trim();
		content = uncommented;
	}

	//! 添付ファイルを抽出（[[filename]]形式）。
	const attachmentMatches = content.match(/\[\[([^\]]+)\]\]/g);
	const attachments = attachmentMatches
		? attachmentMatches.map((m) => m.replace(/\[\[|\]\]/g, ""))
		: undefined;

	return {
		id,
		category: finalCategory,
		timestamp: finalTimestamp,
		content,
		attachments,
		template,
		trashedAt,
	};
}
