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

		//! %Cが含まれているかチェック。
		const hasCategoryPlaceholder = pathFormat.includes("%C");

		//! 変数置換。
		let path = pathFormat
			.replace(/%Y/g, year.toString())
			.replace(/%m/g, month)
			.replace(/%d/g, day)
			.replace(/%H/g, hour)
			.replace(/%M/g, minute)
			.replace(/%S/g, second)
			.replace(/%C/g, category);

		//! .md拡張子を確認。
		if (!path.endsWith(".md")) {
			path += ".md";
		}

		//! %Cが含まれる場合はrootDirのみ、含まれない場合は従来の動作。
		if (hasCategoryPlaceholder) {
			return `${rootDir}/${path}`;
		} else {
			const categoryPath = useDirectoryCategory ? `${rootDir}/${category}` : rootDir;
			return `${categoryPath}/${path}`;
		}
	}

	//! 添付ファイルの完全なパスを生成する。
	static generateAttachmentPath(
		rootDir: string,
		memoFilePath: string,
		attachmentPathFormat: string,
		attachmentNameFormat: string,
		originalFileName: string,
		date: Date = new Date()
	): string {
		//! 添付ファイル保存先ディレクトリを生成。
		let attachmentDir: string;

		if (attachmentPathFormat.startsWith("/")) {
			//! /から始まる場合はmemologルートディレクトリからの相対パス。
			const relativePath = attachmentPathFormat.substring(1);
			attachmentDir = `${rootDir}/${this.formatDateString(relativePath, date)}`;
		} else if (attachmentPathFormat.startsWith("./")) {
			//! ./から始まる場合はメモファイルのディレクトリからの相対パス。
			const memoDir = memoFilePath.substring(0, memoFilePath.lastIndexOf("/"));
			const relativePath = attachmentPathFormat.substring(2);
			attachmentDir = `${memoDir}/${this.formatDateString(relativePath, date)}`;
		} else {
			//! それ以外の場合はメモファイルのディレクトリからの相対パス。
			const memoDir = memoFilePath.substring(0, memoFilePath.lastIndexOf("/"));
			attachmentDir = `${memoDir}/${this.formatDateString(attachmentPathFormat, date)}`;
		}

		//! 添付ファイル名を生成。
		const fileName = this.generateAttachmentName(attachmentNameFormat, originalFileName, date);

		return `${attachmentDir}/${fileName}`;
	}

	//! 添付ファイル名を生成する。
	static generateAttachmentName(
		nameFormat: string,
		originalFileName: string,
		date: Date = new Date()
	): string {
		//! タイムスタンプ。
		const timestamp = Date.now();

		//! 元ファイル名から拡張子を分離。
		const lastDot = originalFileName.lastIndexOf(".");
		const baseName = lastDot > 0 ? originalFileName.substring(0, lastDot) : originalFileName;
		const extension = lastDot > 0 ? originalFileName.substring(lastDot) : "";

		//! 変数置換。
		let fileName = this.formatDateString(nameFormat, date)
			.replace(/%s/g, timestamp.toString())
			.replace(/%f/g, baseName)
			.replace(/%e/g, extension);

		return fileName;
	}

	//! 日付書式文字列を置換する（共通処理）。
	private static formatDateString(format: string, date: Date): string {
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const day = date.getDate().toString().padStart(2, "0");
		const hour = date.getHours().toString().padStart(2, "0");
		const minute = date.getMinutes().toString().padStart(2, "0");
		const second = date.getSeconds().toString().padStart(2, "0");

		return format
			.replace(/%Y/g, year.toString())
			.replace(/%m/g, month)
			.replace(/%d/g, day)
			.replace(/%H/g, hour)
			.replace(/%M/g, minute)
			.replace(/%S/g, second);
	}
}
