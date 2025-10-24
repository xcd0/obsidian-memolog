import { App } from "obsidian";
import { MemoEntry, SortOrder } from "../types";
import { MemologVaultHandler } from "../fs/vault-handler";
import { CacheManager } from "./cache-manager";
import { v4 as uuidv4 } from "uuid";
import { getErrorHandler, FileIOError } from "./error-handler";
import { notify } from "../utils/notification-manager";

//! メモを管理するクラス。
export class MemoManager {
	//! VaultHandlerインスタンス（publicアクセス可能）。
	public vaultHandler: MemologVaultHandler;

	//! CacheManagerインスタンス。
	private cacheManager: CacheManager;

	//! ErrorHandlerインスタンス。
	private errorHandler = getErrorHandler();

	constructor(app: App) {
		this.vaultHandler = new MemologVaultHandler(app);
		this.cacheManager = new CacheManager(app);
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

		//! IDをHTMLコメントとして埋め込む。
		return `<!-- memo-id: ${memo.id} -->\n${timestamp}\n${content}${attachments}\n`;
	}

	//! テキスト形式からメモエントリを解析する。
	private parseTextToMemo(text: string, category: string): MemoEntry | null {
		//! 簡易的なパース実装（タイムスタンプと内容を分離）。
		const lines = text.trim().split("\n");
		if (lines.length === 0) {
			return null;
		}

		//! IDをHTMLコメントから抽出。
		const idMatch = text.match(/<!-- memo-id: (.+?) -->/);
		const id = idMatch ? idMatch[1] : uuidv4();

		//! HTMLコメント行をスキップしてタイムスタンプを探す。
		let timestampLine = lines[0];
		let contentStartIndex = 1;

		if (lines[0].startsWith("<!--")) {
			timestampLine = lines[1] || "";
			contentStartIndex = 2;
		}

		const timestampMatch = timestampLine.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2})/);
		const timestamp = timestampMatch ? timestampMatch[1].replace(" ", "T") : this.generateTimestamp();

		//! 残りの行を本文として扱う。
		const content = lines.slice(contentStartIndex).join("\n").trim();

		//! 添付ファイルを抽出（[[filename]]形式）。
		const attachmentMatches = content.match(/\[\[([^\]]+)\]\]/g);
		const attachments = attachmentMatches
			? attachmentMatches.map((m) => m.replace(/\[\[|\]\]/g, ""))
			: undefined;

		return {
			id,
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
		console.log("[memolog DEBUG] addMemo called with:", { filePath, category, order });
		const result = await this.errorHandler.wrap(
			(async () => {
				//! タグペアが存在しない場合は初期化。
				console.log("[memolog DEBUG] Checking if file exists:", filePath);
				const fileExists = this.vaultHandler.fileExists(filePath);
				console.log("[memolog DEBUG] File exists:", fileExists);

				if (!fileExists) {
					console.log("[memolog DEBUG] File does not exist, initializing tag pair...");
					await this.vaultHandler.initializeTagPair(filePath, category, { order });
					console.log("[memolog DEBUG] Tag pair initialized");
				} else {
					console.log("[memolog DEBUG] File exists, checking for tag pair...");
					const pair = await this.vaultHandler.findTagPairByCategory(filePath, category);
					console.log("[memolog DEBUG] Tag pair found:", !!pair);
					if (!pair) {
						console.log("[memolog DEBUG] Tag pair not found, initializing...");
						await this.vaultHandler.initializeTagPair(filePath, category, { order });
						console.log("[memolog DEBUG] Tag pair initialized");
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

				//! キャッシュを無効化。
				const cacheKey = `${filePath}::${category}`;
				this.cacheManager.invalidateMemos(cacheKey);

				notify.success("メモを追加しました");
				return memo;
			})(),
			{ filePath, category, context: "MemoManager.addMemo" }
		);

		if (!result.success || !result.data) {
			throw new FileIOError("メモの追加に失敗しました", {
				filePath,
				category,
			});
		}

		return result.data;
	}

	//! メモを削除する（IDで検索して削除）。
	async deleteMemo(filePath: string, category: string, memoId: string): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				const content = await this.vaultHandler.getCategoryContent(filePath, category);
				if (!content) {
					notify.warning("カテゴリが見つかりません");
					return false;
				}

				//! メモを分割（HTMLコメント <!-- memo-id: で分割）。
				const memos = content.split(/(?=<!-- memo-id:)/);
				const filtered = memos.filter((memo) => !memo.includes(`<!-- memo-id: ${memoId} -->`));

				if (filtered.length === memos.length) {
					//! 削除対象が見つからなかった。
					notify.warning("削除対象のメモが見つかりません");
					return false;
				}

				//! カテゴリ領域の内容を更新。
				const newContent = filtered.join("");
				await this.vaultHandler.replaceCategoryContent(filePath, category, newContent);

				//! キャッシュを無効化。
				const cacheKey = `${filePath}::${category}`;
				this.cacheManager.invalidateMemos(cacheKey);

				notify.success("メモを削除しました");
				return true;
			})(),
			{ filePath, category, memoId, context: "MemoManager.deleteMemo" }
		);

		return result.success && result.data ? result.data : false;
	}

	//! カテゴリ内の全メモを取得する。
	async getMemos(filePath: string, category: string): Promise<MemoEntry[]> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! キャッシュキーを生成（ファイルパス + カテゴリ）。
				const cacheKey = `${filePath}::${category}`;

				//! キャッシュをチェック。
				const cachedMemos = await this.cacheManager.getMemos(cacheKey);
				if (cachedMemos) {
					return cachedMemos;
				}

				//! キャッシュミス: ファイルから読み込む。
				const content = await this.vaultHandler.getCategoryContent(filePath, category);
				if (!content) {
					return [];
				}

				//! メモを分割（HTMLコメント <!-- memo-id: で分割）。
				const memoTexts = content.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());

				//! メモエントリに変換。
				const memos: MemoEntry[] = [];
				for (const text of memoTexts) {
					const memo = this.parseTextToMemo(text, category);
					if (memo) {
						memos.push(memo);
					}
				}

				//! キャッシュに保存。
				await this.cacheManager.setMemos(cacheKey, memos);

				return memos;
			})(),
			{ filePath, category, context: "MemoManager.getMemos" }
		);

		return result.success && result.data ? result.data : [];
	}

	//! 特定のメモを取得する。
	async getMemoById(filePath: string, category: string, memoId: string): Promise<MemoEntry | null> {
		const memos = await this.getMemos(filePath, category);
		return memos.find((m) => m.id === memoId) || null;
	}

	//! メモを更新する（IDで検索して内容を置き換え）。
	async updateMemo(
		filePath: string,
		category: string,
		memoId: string,
		newContent: string,
		template?: string
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				const content = await this.vaultHandler.getCategoryContent(filePath, category);
				if (!content) {
					notify.warning("カテゴリが見つかりません");
					return false;
				}

				//! メモを分割（HTMLコメント <!-- memo-id: で分割）。
				const memoTexts = content.split(/(?=<!-- memo-id:)/);
				let updated = false;

				const newMemoTexts = memoTexts.map((memoText) => {
					if (memoText.includes(`<!-- memo-id: ${memoId} -->`)) {
						//! 対象メモを解析。
						const memo = this.parseTextToMemo(memoText, category);
						if (memo) {
							//! 内容を更新。
							memo.content = newContent;

							//! 新しいテキストに変換。
							updated = true;
							return this.memoToText(memo, template);
						}
					}
					return memoText;
				});

				if (!updated) {
					notify.warning("更新対象のメモが見つかりません");
					return false;
				}

				//! カテゴリ領域の内容を更新。
				const newCategoryContent = newMemoTexts.join("");
				await this.vaultHandler.replaceCategoryContent(filePath, category, newCategoryContent);

				//! キャッシュを無効化。
				const cacheKey = `${filePath}::${category}`;
				this.cacheManager.invalidateMemos(cacheKey);

				notify.success("メモを更新しました");
				return true;
			})(),
			{ filePath, category, memoId, context: "MemoManager.updateMemo" }
		);

		return result.success && result.data ? result.data : false;
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
