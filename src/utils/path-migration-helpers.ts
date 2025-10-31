import { CategoryConfig } from "../types/settings";
import { PathMapping, MemoSplitMapping } from "./path-migrator";

//! ファイルパスから日付情報を抽出する。
export function extractDateFromPath(path: string): Date | null {
	//! YYYY-MM-DD形式を検索。
	const match1 = path.match(/(\d{4})-(\d{2})-(\d{2})/);
	if (match1) {
		const year = parseInt(match1[1], 10);
		const month = parseInt(match1[2], 10) - 1;
		const day = parseInt(match1[3], 10);
		return new Date(year, month, day);
	}

	//! YYYYMMDD形式を検索。
	const match2 = path.match(/(\d{4})(\d{2})(\d{2})/);
	if (match2) {
		const year = parseInt(match2[1], 10);
		const month = parseInt(match2[2], 10) - 1;
		const day = parseInt(match2[3], 10);
		return new Date(year, month, day);
	}

	//! YYYY-MM形式を検索。
	const match3 = path.match(/(\d{4})-(\d{2})(?!-\d{2})/);
	if (match3) {
		const year = parseInt(match3[1], 10);
		const month = parseInt(match3[2], 10) - 1;
		return new Date(year, month, 1);
	}

	//! YYYY-Wxx形式（週番号）を検索。
	const match4 = path.match(/(\d{4})-W(\d{2})/);
	if (match4) {
		const year = parseInt(match4[1], 10);
		const week = parseInt(match4[2], 10);
		//! 週番号から日付を復元（ISO 8601の第1週の木曜日から計算）。
		return getDateFromWeek(year, week);
	}

	//! YYYY形式を検索。
	const match5 = path.match(/(\d{4})(?!-?\d)/);
	if (match5) {
		const year = parseInt(match5[1], 10);
		return new Date(year, 0, 1);
	}

	return null;
}

//! ISO 8601週番号から日付を取得する。
export function getDateFromWeek(year: number, week: number): Date {
	//! その年の1月1日を取得。
	const jan1 = new Date(year, 0, 1);
	//! 1月1日の曜日（0=日曜、1=月曜、...、6=土曜）。
	const day = jan1.getDay();
	//! ISO週の開始日（月曜日）までのオフセット。
	const offset = day <= 4 ? 1 - day : 8 - day;
	//! 第1週の月曜日。
	const firstMonday = new Date(year, 0, 1 + offset);
	//! 指定週の月曜日。
	const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
	return targetDate;
}

//! カスタムパスフォーマットから情報を抽出。
export function extractFromCustomPath(
	relativePath: string,
	pathFormat: string,
	categories: CategoryConfig[]
): { category: string | null; date: Date | null } {
	//! %Cの位置を特定。
	const cIndex = pathFormat.indexOf("%C");
	if (cIndex === -1) {
		return { category: null, date: null };
	}

	//! カテゴリ名を抽出するための正規表現を構築。
	//! 簡略化のため、/で区切られたパスからカテゴリ名を探す。
	for (const cat of categories) {
		if (relativePath.includes(cat.directory)) {
			return { category: cat.directory, date: extractDateFromPath(relativePath) };
		}
	}

	return { category: null, date: null };
}

//! 競合を検出する。
export function detectConflicts(mappings: PathMapping[]): void {
	const pathCounts = new Map<string, number>();

	//! 新しいパスの重複をカウント。
	for (const mapping of mappings) {
		const count = pathCounts.get(mapping.newPath) || 0;
		pathCounts.set(mapping.newPath, count + 1);
	}

	//! 競合フラグを設定。
	for (const mapping of mappings) {
		const count = pathCounts.get(mapping.newPath);
		if (count !== undefined && count > 1) {
			mapping.hasConflict = true;
		}
	}
}

//! メモ分割時の競合を検出する。
export function detectSplitConflicts(mappings: MemoSplitMapping[]): void {
	const pathCounts = new Map<string, number>();

	//! 全ての新しいパスをカウント。
	for (const mapping of mappings) {
		for (const newPath of mapping.newPathToMemos.keys()) {
			const count = pathCounts.get(newPath) || 0;
			pathCounts.set(newPath, count + 1);
		}
	}

	//! 競合フラグを設定。
	for (const mapping of mappings) {
		for (const newPath of mapping.newPathToMemos.keys()) {
			const count = pathCounts.get(newPath);
			if (count !== undefined && count > 1) {
				mapping.hasConflict = true;
				break;
			}
		}
	}
}

//! 特別なファイルかどうかを判定する。
export function isSpecialFile(relativePath: string): boolean {
	//! rootディレクトリ直下のファイルのみチェック（サブディレクトリは対象）。
	if (!relativePath.includes("/")) {
		//! index.mdを除外。
		if (relativePath === "index.md") {
			return true;
		}

		//! _trash.md（またはその他のゴミ箱ファイル名）を除外。
		//! ゴミ箱ファイルは通常 "_*.md" の形式を想定。
		if (relativePath.startsWith("_") && relativePath.endsWith(".md")) {
			return true;
		}
	}

	return false;
}

//! ディレクトリ名からカテゴリを推定する。
export function extractCategoryFromDirectory(
	relativePath: string,
	categories: CategoryConfig[]
): string | null {
	const parts = relativePath.split("/");
	if (parts.length > 0) {
		const dirName = parts[0];
		const matchedCategory = categories.find((c) => c.directory === dirName);
		if (matchedCategory) {
			return matchedCategory.directory;
		}
	}
	return null;
}
