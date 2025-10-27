//! エクスポート機能。

import { MemoEntry } from "../types";

//! エクスポート形式。
export enum ExportFormat {
	MARKDOWN = "markdown",
	JSON = "json",
	CSV = "csv",
}

//! エクスポートオプション。
export interface ExportOptions {
	//! エクスポート形式。
	format: ExportFormat;

	//! 開始日 (オプション)。
	startDate?: string;

	//! 終了日 (オプション)。
	endDate?: string;

	//! カテゴリフィルタ (オプション)。
	categories?: string[];

	//! タイトルを含めるか。
	includeTitle?: boolean;

	//! タイムスタンプ形式。
	timestampFormat?: string;
}

//! エクスポート結果。
export interface ExportResult {
	//! エクスポートされたデータ。
	content: string;

	//! エクスポートされたメモ数。
	count: number;

	//! ファイル名（推奨）。
	filename: string;
}

//! エクスポータークラス。
export class Exporter {
	//! メモをエクスポートする。
	static export(memos: MemoEntry[], options: ExportOptions): ExportResult {
		//! フィルタリング。
		let filteredMemos = [...memos];

		//! 日付範囲フィルタ。
		if (options.startDate) {
			const startDate = new Date(options.startDate);
			filteredMemos = filteredMemos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate >= startDate;
			});
		}

		if (options.endDate) {
			//! 終了日の23:59:59まで含める（UTC）。
			const endDate = new Date(options.endDate + "T23:59:59.999Z");
			filteredMemos = filteredMemos.filter((memo) => {
				const memoDate = new Date(memo.timestamp);
				return memoDate <= endDate;
			});
		}

		//! カテゴリフィルタ。
		if (options.categories && options.categories.length > 0) {
			const categories = options.categories;
			filteredMemos = filteredMemos.filter((memo) =>
				categories.includes(memo.category)
			);
		}

		//! ソート (タイムスタンプ昇順)。
		filteredMemos.sort((a, b) => {
			return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
		});

		//! 形式に応じてエクスポート。
		let content: string;
		let filename: string;

		switch (options.format) {
			case ExportFormat.MARKDOWN:
				content = Exporter.toMarkdown(filteredMemos, options);
				filename = Exporter.generateFilename("md", options);
				break;
			case ExportFormat.JSON:
				content = Exporter.toJSON(filteredMemos, options);
				filename = Exporter.generateFilename("json", options);
				break;
			case ExportFormat.CSV:
				content = Exporter.toCSV(filteredMemos, options);
				filename = Exporter.generateFilename("csv", options);
				break;
		}

		return {
			content,
			count: filteredMemos.length,
			filename,
		};
	}

	//! Markdown形式に変換する。
	private static toMarkdown(memos: MemoEntry[], options: ExportOptions): string {
		const lines: string[] = [];

		//! タイトル。
		if (options.includeTitle !== false) {
			lines.push("# Memolog Export");
			lines.push("");
			lines.push(`Export Date: ${new Date().toISOString()}`);
			lines.push(`Total Memos: ${memos.length}`);
			lines.push("");
			lines.push("---");
			lines.push("");
		}

		//! カテゴリごとにグループ化。
		const byCategory = new Map<string, MemoEntry[]>();
		for (const memo of memos) {
			if (!byCategory.has(memo.category)) {
				byCategory.set(memo.category, []);
			}
			const categoryMemos = byCategory.get(memo.category);
			if (categoryMemos) {
				categoryMemos.push(memo);
			}
		}

		//! カテゴリ別に出力。
		for (const [category, categoryMemos] of byCategory.entries()) {
			lines.push(`## ${category}`);
			lines.push("");

			for (const memo of categoryMemos) {
				const timestamp = Exporter.formatTimestamp(
					memo.timestamp,
					options.timestampFormat
				);

				lines.push(`### ${timestamp}`);
				lines.push("");
				lines.push(memo.content);
				lines.push("");

				//! 添付ファイル。
				if (memo.attachments && memo.attachments.length > 0) {
					lines.push("**Attachments:**");
					for (const attachment of memo.attachments) {
						lines.push(`- ![](${attachment})`);
					}
					lines.push("");
				}

				lines.push("---");
				lines.push("");
			}
		}

		return lines.join("\n");
	}

	//! JSON形式に変換する。
	private static toJSON(memos: MemoEntry[], options: ExportOptions): string {
		const data = {
			exportDate: new Date().toISOString(),
			totalMemos: memos.length,
			options: {
				startDate: options.startDate,
				endDate: options.endDate,
				categories: options.categories,
			},
			memos: memos.map((memo) => ({
				id: memo.id,
				category: memo.category,
				timestamp: memo.timestamp,
				content: memo.content,
				attachments: memo.attachments || [],
			})),
		};

		return JSON.stringify(data, null, 2);
	}

	//! CSV形式に変換する。
	private static toCSV(memos: MemoEntry[], _options: ExportOptions): string {
		const lines: string[] = [];

		//! ヘッダー。
		lines.push("ID,Category,Timestamp,Content,Attachments");

		//! データ行。
		for (const memo of memos) {
			const id = Exporter.escapeCSV(memo.id);
			const category = Exporter.escapeCSV(memo.category);
			const timestamp = Exporter.escapeCSV(memo.timestamp);
			const content = Exporter.escapeCSV(memo.content);
			const attachments = Exporter.escapeCSV(
				(memo.attachments || []).join("; ")
			);

			lines.push(`${id},${category},${timestamp},${content},${attachments}`);
		}

		return lines.join("\n");
	}

	//! CSV用にエスケープする。
	private static escapeCSV(value: string): string {
		//! ダブルクォートをエスケープし、カンマや改行が含まれる場合はクォートで囲む。
		const escaped = value.replace(/"/g, '""');
		if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')) {
			return `"${escaped}"`;
		}
		return escaped;
	}

	//! タイムスタンプをフォーマットする。
	private static formatTimestamp(
		timestamp: string,
		format?: string
	): string {
		const date = new Date(timestamp);

		if (format) {
			//! カスタムフォーマット。
			return format
				.replace("%Y", date.getFullYear().toString())
				.replace("%m", (date.getMonth() + 1).toString().padStart(2, "0"))
				.replace("%d", date.getDate().toString().padStart(2, "0"))
				.replace("%H", date.getHours().toString().padStart(2, "0"))
				.replace("%M", date.getMinutes().toString().padStart(2, "0"))
				.replace("%S", date.getSeconds().toString().padStart(2, "0"));
		}

		//! デフォルトフォーマット。
		return date.toISOString();
	}

	//! ファイル名を生成する。
	private static generateFilename(
		extension: string,
		options: ExportOptions
	): string {
		const now = new Date();
		const dateStr = now.toISOString().split("T")[0];

		let filename = `memolog-export-${dateStr}`;

		//! カテゴリが指定されている場合。
		if (options.categories && options.categories.length > 0) {
			filename += `-${options.categories.join("-")}`;
		}

		//! 日付範囲が指定されている場合。
		if (options.startDate && options.endDate) {
			filename += `-${options.startDate}-to-${options.endDate}`;
		} else if (options.startDate) {
			filename += `-from-${options.startDate}`;
		} else if (options.endDate) {
			filename += `-to-${options.endDate}`;
		}

		return `${filename}.${extension}`;
	}
}
