import { App } from "obsidian";
import { MemoEntry, SortOrder } from "../types";
import { MemologVaultHandler } from "../fs/vault-handler";
import { CacheManager } from "./cache-manager";
import { v7 as uuidv7 } from "uuid";
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
		//! メモに保存されているテンプレートを優先、なければ引数のテンプレートを使用。
		const actualTemplate = memo.template || template || "## %Y-%m-%d %H:%M";
		const timestamp = this.formatTimestamp(memo.timestamp, actualTemplate);
		const content = memo.content;
		const attachments =
			memo.attachments && memo.attachments.length > 0
				? `\n\n添付: ${memo.attachments.map((a) => `[[${a}]]`).join(", ")}`
				: "";

		//! ID、タイムスタンプ、テンプレートをHTMLコメントとして埋め込む。
		//! テンプレートはJSON.stringifyでエンコード（改行等を含むため）。
		const templateEncoded = memo.template ? `, template: ${JSON.stringify(memo.template)}` : "";
		return `<!-- memo-id: ${memo.id}, timestamp: ${memo.timestamp}${templateEncoded} -->\n${timestamp}\n${content}${attachments}\n`;
	}

	//! テキスト形式からメモエントリを解析する。
	private parseTextToMemo(text: string, category: string): MemoEntry | null {
		//! 簡易的なパース実装（タイムスタンプと内容を分離）。
		const lines = text.trim().split("\n");
		if (lines.length === 0) {
			return null;
		}

		//! ID、タイムスタンプ、テンプレートをHTMLコメントから抽出。
		const commentMatch = text.match(/<!-- (.+?) -->/);
		let id = uuidv7();
		let timestamp: string | null = null;
		let template: string | undefined = undefined;

		if (commentMatch) {
			const comment = commentMatch[1];
			const idMatch = comment.match(/memo-id: ([^,]+)/);
			const timestampMatch = comment.match(/timestamp: ([^,]+?)(?:,|$)/);
			const templateMatch = comment.match(/template: (.+)$/);

			id = idMatch?.[1].trim() || uuidv7();
			timestamp = timestampMatch?.[1].trim() || null;

			if (templateMatch) {
				try {
					template = JSON.parse(templateMatch[1].trim());
				} catch (e) {
					//! JSON.parseエラーは無視（後方互換性）。
					console.warn("[memolog] Failed to parse template from comment:", e);
				}
			}
		}

		//! HTMLコメント行をスキップしてタイムスタンプを探す。
		let timestampLine = lines[0];
		let contentStartIndex = 1;

		if (lines[0].startsWith("<!--")) {
			timestampLine = lines[1] || "";
			contentStartIndex = 2;
		}

		//! HTMLコメントにtimestampがない場合は、見出し行から抽出（後方互換性）。
		if (!timestamp) {
			const timestampMatch = timestampLine.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2})/);
			timestamp = timestampMatch ? timestampMatch[1].replace(" ", "T") : this.generateTimestamp();
		}

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
			template,
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
				console.log("[memolog DEBUG] Creating memo entry...");
				const memo: MemoEntry = {
					id: uuidv7(),
					category,
					timestamp: this.generateTimestamp(),
					content,
					attachments,
					template,
				};
				console.log("[memolog DEBUG] Memo entry created:", { id: memo.id, content: memo.content });

				//! メモをテキスト形式に変換。
				console.log("[memolog DEBUG] Converting memo to text...");
				const memoText = this.memoToText(memo, template);
				console.log("[memolog DEBUG] Memo text:", memoText);

				//! 挿入位置は常に末尾（bottom）。
				const position = "bottom";
				console.log("[memolog DEBUG] Insert position:", position);

				//! カテゴリ領域にメモを挿入。
				console.log("[memolog DEBUG] Inserting text in category...");
				await this.vaultHandler.insertTextInCategory(filePath, category, memoText, position);
				console.log("[memolog DEBUG] Text inserted successfully");

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
				const filtered = memos.filter((memo) => !memo.includes(`memo-id: ${memoId}`));

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
					if (memoText.includes(`memo-id: ${memoId}`)) {
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
