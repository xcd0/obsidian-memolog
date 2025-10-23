import { SaveUnit } from "../types";

//! ファイルパス生成ユーティリティ。
export class PathGenerator {
	//! 保存単位に基づいてファイルパスを生成する。
	static generateFilePath(
		rootDir: string,
		category: string,
		saveUnit: SaveUnit,
		useDirectoryCategory: boolean,
		date: Date = new Date()
	): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");

		//! カテゴリディレクトリのパス。
		const categoryPath = useDirectoryCategory ? `${rootDir}/${category}` : rootDir;

		//! 保存単位に応じたファイル名。
		let filename: string;
		switch (saveUnit) {
			case "day":
				filename = `${year}-${month}-${day}.md`;
				break;
			case "week": {
				const weekNumber = PathGenerator.getWeekNumber(date);
				filename = `${year}-W${weekNumber.toString().padStart(2, "0")}.md`;
				break;
			}
			case "month":
				filename = `${year}-${month}.md`;
				break;
			case "year":
				filename = `${year}.md`;
				break;
			case "all":
				filename = useDirectoryCategory ? `${category}.md` : "all.md";
				break;
			default:
				filename = `${year}-${month}-${day}.md`;
		}

		return `${categoryPath}/${filename}`;
	}

	//! 週番号を取得する（ISO 8601形式）。
	private static getWeekNumber(date: Date): number {
		const target = new Date(date.valueOf());
		const dayNr = (date.getDay() + 6) % 7;
		target.setDate(target.getDate() - dayNr + 3);
		const firstThursday = target.valueOf();
		target.setMonth(0, 1);
		if (target.getDay() !== 4) {
			target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
		}
		return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
	}

	//! カスタムフォーマットでファイルパスを生成する。
	static generateCustomPath(
		rootDir: string,
		category: string,
		pathFormat: string,
		useDirectoryCategory: boolean,
		date: Date = new Date()
	): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		const hour = date.getHours().toString().padStart(2, "0");
		const minute = date.getMinutes().toString().padStart(2, "0");
		const second = date.getSeconds().toString().padStart(2, "0");

		//! カテゴリディレクトリのパス。
		const categoryPath = useDirectoryCategory ? `${rootDir}/${category}` : rootDir;

		//! 変数置換。
		let path = pathFormat
			.replace(/%Y/g, year.toString())
			.replace(/%m/g, month)
			.replace(/%d/g, day)
			.replace(/%H/g, hour)
			.replace(/%M/g, minute)
			.replace(/%S/g, second);

		//! .md拡張子を確認。
		if (!path.endsWith(".md")) {
			path += ".md";
		}

		return `${categoryPath}/${path}`;
	}
}
