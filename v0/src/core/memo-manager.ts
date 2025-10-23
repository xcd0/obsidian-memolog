import { App } from "obsidian";
import { MemoEntry, SortOrder } from "../types";
import { MemologVaultHandler } from "../fs/vault-handler";
import { v4 as uuidv4 } from "uuid";

//! メモを管理するクラス。
export class MemoManager {
	//! VaultHandlerインスタンス（publicアクセス可能）。
	public vaultHandler: MemologVaultHandler;

	constructor(app: App) {
		this.vaultHandler = new MemologVaultHandler(app);
	}

	//! 現在のタイムスタンプを生成する。
	private generateTimestamp(): string {
		return new Date().toISOString();
	}

	//! タイムスタンプをフォーマットする。
	private formatTimestamp(timestamp: string, format: string): string {
		const date = new Date(timestamp);

		const replacements: Record<string, string> = {
			"%Y": date.getFullYear().toString(),
			"%m": (date.getMonth() + 1).toString().padStart(2, "0"),
			"%d": date.getDate().toString().padStart(2, "0"),
			"%H": date.getHours().toString().padStart(2, "0"),
			"%M": date.getMinutes().toString().padStart(2, "0"),
			"%S": date.getSeconds().toString().padStart(2, "0"),
		};

		let formatted = format;
		for (const [key, value] of Object.entries(replacements)) {
			formatted = formatted.replace(new RegExp(key, "g"), value);
		}

		return formatted;
	}

	//! メモエントリをテキスト形式に変換する。
	private memoToText(memo: MemoEntry, template?: string): string {
		const timestamp = this.formatTimestamp(memo.timestamp, template || "## %Y-%m-%d %H:%M");
		const content = memo.content;
		const attachments =
			memo.attachments && memo.attachments.length > 0
				? `\n\n添付: ${memo.attachments.map((a) => `[[${a}]]`).join(", ")}`
				: "";

		return `${timestamp}\n${content}${attachments}\n`;
	}

	//! テキスト形式からメモエントリを解析する。
	private parseTextToMemo(text: string, category: string): MemoEntry | null {
		//! 簡易的なパース実装（タイムスタンプと内容を分離）。
		const lines = text.trim().split("\n");
		if (lines.length === 0) {
			return null;
		}

		//! 最初の行をタイトル/タイムスタンプとして扱う。
		const firstLine = lines[0];
		const timestampMatch = firstLine.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2})/);
		const timestamp = timestampMatch ? timestampMatch[1].replace(" ", "T") : this.generateTimestamp();

		//! 残りの行を本文として扱う。
		const content = lines.slice(1).join("\n").trim();

		//! 添付ファイルを抽出（[[filename]]形式）。
		const attachmentMatches = content.match(/\[\[([^\]]+)\]\]/g);
		const attachments = attachmentMatches
			? attachmentMatches.map((m) => m.replace(/\[\[|\]\]/g, ""))
			: undefined;

		return {
			id: uuidv4(),
			category,
			timestamp,
			content,
			attachments,
		};
	}

	//! メモを追加する。
	async addMemo(
		filePath: string,
		category: string,
		content: string,
		order: SortOrder = "asc",
		template?: string,
		attachments?: string[]
	): Promise<MemoEntry> {
		//! タグペアが存在しない場合は初期化。
		if (!(await this.vaultHandler.fileExists(filePath))) {
			await this.vaultHandler.initializeTagPair(filePath, category, { order });
		} else {
			const pair = await this.vaultHandler.findTagPairByCategory(filePath, category);
			if (!pair) {
				await this.vaultHandler.initializeTagPair(filePath, category, { order });
			}
		}

		//! メモエントリを作成。
		const memo: MemoEntry = {
			id: uuidv4(),
			category,
			timestamp: this.generateTimestamp(),
			content,
			attachments,
		};

		//! メモをテキスト形式に変換。
		const memoText = this.memoToText(memo, template);

		//! 挿入位置を決定（昇順: top, 降順: bottom）。
		const position = order === "asc" ? "bottom" : "top";

		//! カテゴリ領域にメモを挿入。
		await this.vaultHandler.insertTextInCategory(filePath, category, memoText, position);

		return memo;
	}

	//! メモを削除する（内容で検索して削除）。
	async deleteMemo(filePath: string, category: string, memoId: string): Promise<boolean> {
		const content = await this.vaultHandler.getCategoryContent(filePath, category);
		if (!content) {
			return false;
		}

		//! メモを分割（簡易的な実装）。
		const memos = content.split(/(?=##\s+\d{4}-\d{2}-\d{2})/);
		const filtered = memos.filter((memo) => !memo.includes(memoId));

		if (filtered.length === memos.length) {
			//! 削除対象が見つからなかった。
			return false;
		}

		//! カテゴリ領域の内容を更新。
		const newContent = filtered.join("");
		await this.vaultHandler.replaceCategoryContent(filePath, category, newContent);

		return true;
	}

	//! カテゴリ内の全メモを取得する。
	async getMemos(filePath: string, category: string): Promise<MemoEntry[]> {
		const content = await this.vaultHandler.getCategoryContent(filePath, category);
		if (!content) {
			return [];
		}

		//! メモを分割（簡易的な実装）。
		const memoTexts = content.split(/(?=##\s+\d{4}-\d{2}-\d{2})/).filter((t) => t.trim());

		//! メモエントリに変換。
		const memos: MemoEntry[] = [];
		for (const text of memoTexts) {
			const memo = this.parseTextToMemo(text, category);
			if (memo) {
				memos.push(memo);
			}
		}

		return memos;
	}

	//! 特定のメモを取得する。
	async getMemoById(filePath: string, category: string, memoId: string): Promise<MemoEntry | null> {
		const memos = await this.getMemos(filePath, category);
		return memos.find((m) => m.id === memoId) || null;
	}

	//! カテゴリ領域を初期化する。
	async initializeCategory(
		filePath: string,
		category: string,
		order: SortOrder = "asc"
	): Promise<void> {
		await this.vaultHandler.initializeTagPair(filePath, category, { order });
	}
}
