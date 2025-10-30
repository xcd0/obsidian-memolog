import { App } from "obsidian";
import { MemoEntry, SortOrder, SaveUnit } from "../types";
import { MemologVaultHandler } from "../fs/vault-handler";
import { CacheManager } from "./cache-manager";
import { v7 as uuidv7 } from "uuid";
import { getErrorHandler, FileIOError } from "./error-handler";
import { notify } from "../utils/notification-manager";
import { formatTimestamp, memoToText } from "./memo-helpers";

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


	//! テキスト形式からメモエントリを解析する。
	private parseTextToMemo(text: string, category: string): MemoEntry | null {
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
			timestamp = timestampMatch ? timestampMatch[1].replace(" ", "T") : this.generateTimestamp();
		}

		//! timestampがnullの場合はデフォルト値を設定。
		const finalTimestamp = timestamp || this.generateTimestamp();

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

	//! メモを追加する。
	async addMemo(
		filePath: string,
		category: string,
		content: string,
		order: SortOrder = "asc",
		template?: string,
		attachments?: string[],
		existingId?: string,
		existingTimestamp?: string,
		useTodoList = false
	): Promise<MemoEntry> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! メモエントリを作成。
				const memo: MemoEntry = {
					id: existingId || uuidv7(),
					category,
					timestamp: existingTimestamp || this.generateTimestamp(),
					content,
					attachments,
					template,
				};

				//! メモをテキスト形式に変換。
				const memoText = memoToText(memo, template, useTodoList);

				//! ファイルが存在しない場合は空として扱う。
				const fileExists = this.vaultHandler.fileExists(filePath);
				let fileContent = "";
				if (fileExists) {
					fileContent = await this.vaultHandler.readFile(filePath);
				}

				//! 既存のメモを分割（HTMLコメント <!-- memo-id: で分割）。
				const existingMemos = fileContent ? fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim()) : [];

				//! 挿入位置を決定（昇順: bottom、降順: top）。
				let newContent: string;
				if (order === "desc") {
					//! 降順の場合は先頭に追加。
					newContent = [memoText, ...existingMemos].join("");
				} else {
					//! 昇順の場合は末尾に追加。
					newContent = [...existingMemos, memoText].join("");
				}

				//! ファイル全体を書き込む。
				await this.vaultHandler.writeFile(filePath, newContent);

				//! キャッシュを無効化（ファイル全体のキャッシュ）。
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

	//! メモをゴミ箱に移動する（削除フラグを追加してコメントアウト）。
	async moveToTrash(
		filePath: string,
		category: string,
		memoId: string,
		rootDirectory: string
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					notify.warning("ファイルが見つかりません");
					return false;
				}

				//! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath);

				//! メモを分割。
				const memos = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());
				const updatedMemos: string[] = [];

				let found = false;
				for (const memo of memos) {
					if (memo.includes(`memo-id: ${memoId}`)) {
						found = true;
						const trashedAt = this.generateTimestamp();

						//! memo-idヘッダーにdeleted: "true"とtrashedAtを追加。
						const updatedMemo = memo.replace(
							/(<!-- memo-id: [^>]+) -->/,
							`$1, deleted: "true", trashedAt: "${trashedAt}" -->`
						);

						//! メモのコンテンツ部分を抽出してコメントアウト。
						//! ヘッダー行とコンテンツを分離。
						const lines = updatedMemo.split("\n");
						const headerLine = lines[0]; //! 最初の行がヘッダー。
						const contentLines = lines.slice(1); //! 残りがコンテンツ。

						//! コンテンツをコメントアウト。
						const content = contentLines.join("\n").trim();
						const commentedContent = content ? `<!--\n${content}\n-->` : "";

						//! 結合。
						updatedMemos.push(headerLine + "\n" + commentedContent);
					} else {
						updatedMemos.push(memo);
					}
				}

				if (!found) {
					notify.warning("削除対象のメモが見つかりません");
					return false;
				}

				//! ファイルを更新。
				const newContent = updatedMemos.join("");
				await this.vaultHandler.writeFile(filePath, newContent);

				//! キャッシュを無効化。
				const cacheKey = `${filePath}::${category}`;
				this.cacheManager.invalidateMemos(cacheKey);

				notify.success("メモをゴミ箱に移動しました");
				return true;
			})(),
			{ filePath, category, memoId, rootDirectory, context: "MemoManager.moveToTrash" }
		);

		return result.success && result.data ? result.data : false;
	}

	//! ゴミ箱からメモを復活させる。
	async restoreFromTrash(
		memoId: string,
		rootDirectory: string,
		pathFormat: string,
		saveUnit: SaveUnit,
		useDirectoryCategory: boolean
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! 全カテゴリのファイルから対象メモを検索。
				const allFiles = this.vaultHandler.getMarkdownFiles();
				const memologFiles = allFiles.filter((file) => file.path.startsWith(rootDirectory + "/"));

				let targetFilePath: string | null = null;
				let targetMemoIndex = -1;
				let allMemos: string[] = [];

				//! 対象メモを含むファイルを検索。
				for (const file of memologFiles) {
					const fileContent = await this.vaultHandler.readFile(file.path);
					const memos = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());

					for (let i = 0; i < memos.length; i++) {
						if (memos[i].includes(`memo-id: ${memoId}`)) {
							//! 削除フラグが存在するか確認。
							if (memos[i].includes('deleted: "true"')) {
								targetFilePath = file.path;
								targetMemoIndex = i;
								allMemos = memos;
								break;
							}
						}
					}

					if (targetFilePath) break;
				}

				if (!targetFilePath || targetMemoIndex === -1) {
					notify.warning("復活対象のメモが見つかりません");
					return false;
				}

				//! 対象メモから削除フラグを削除。
				let restoredMemo = allMemos[targetMemoIndex];

				//! memo-idヘッダーから削除フラグを削除。
				restoredMemo = restoredMemo.replace(/, deleted: "true", trashedAt: "[^"]*"/, "");

				//! コメントアウトされたコンテンツを展開。
				const lines = restoredMemo.split("\n");
				const headerLine = lines[0]; //! 最初の行がヘッダー。
				const contentLines = lines.slice(1); //! 残りがコンテンツ。

				//! コンテンツがコメントアウトされている場合は展開。
				let content = contentLines.join("\n").trim();
				if (content.startsWith("<!--") && content.endsWith("-->")) {
					content = content.slice(4, -3).trim();
				}

				restoredMemo = headerLine + "\n" + content;

				//! メモを更新。
				allMemos[targetMemoIndex] = restoredMemo;

				//! ファイルに書き込み。
				const newContent = allMemos.join("");
				await this.vaultHandler.writeFile(targetFilePath, newContent);

				//! categoryを抽出してキャッシュを無効化。
				const categoryMatch = restoredMemo.match(/category: "([^"]+)"/);
				if (categoryMatch) {
					const category = categoryMatch[1];
					const cacheKey = `${targetFilePath}::${category}`;
					this.cacheManager.invalidateMemos(cacheKey);
				}

				notify.success("メモを復活しました");
				return true;
			})(),
			{ memoId, rootDirectory, pathFormat, saveUnit, useDirectoryCategory, context: "MemoManager.restoreFromTrash" }
		);

		return result.success && result.data ? result.data : false;
	}

	//! メモを削除する（IDで検索して削除）。
	async deleteMemo(filePath: string, category: string, memoId: string): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					notify.warning("ファイルが見つかりません");
					return false;
				}

				//! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath);

				//! メモを分割（HTMLコメント <!-- memo-id: で分割）。
				const memos = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());
				const filtered = memos.filter((memo) => !memo.includes(`memo-id: ${memoId}`));

				if (filtered.length === memos.length) {
					//! 削除対象が見つからなかった。
					notify.warning("削除対象のメモが見つかりません");
					return false;
				}

				//! ファイル全体を書き込む。
				const newContent = filtered.join("");
				await this.vaultHandler.writeFile(filePath, newContent);

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

				//! ファイルが存在しない場合は空配列を返す。
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					return [];
				}

				//! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath);
				if (!fileContent) {
					return [];
				}

				//! メモを分割（HTMLコメント <!-- memo-id: で分割）。
				const memoTexts = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());

				//! メモエントリに変換（categoryでフィルタリング）。
				const memos: MemoEntry[] = [];
				for (const text of memoTexts) {
					const memo = this.parseTextToMemo(text, category);
					//! categoryが空文字の場合はフィルタリングしない（全メモを取得）。
					if (memo && (!category || memo.category === category)) {
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
		template?: string,
		useTodoList = false
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				//! ファイルが存在しない場合はfalseを返す。
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					notify.warning("ファイルが見つかりません");
					return false;
				}

				//! ファイル全体を読み込む。
				const fileContent = await this.vaultHandler.readFile(filePath);

				//! メモを分割（HTMLコメント <!-- memo-id: で分割）。
				const memoTexts = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());
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
							return memoToText(memo, template, useTodoList);
						}
					}
					return memoText;
				});

				if (!updated) {
					notify.warning("更新対象のメモが見つかりません");
					return false;
				}

				//! ファイル全体を書き込む。
				const newFileContent = newMemoTexts.join("");
				await this.vaultHandler.writeFile(filePath, newFileContent);

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

	//! TODO完了状態を更新する。
	async updateTodoCompleted(
		filePath: string,
		category: string,
		memoId: string,
		completed: boolean
	): Promise<boolean> {
		const result = await this.errorHandler.wrap(
			(async () => {
				const fileExists = this.vaultHandler.fileExists(filePath);
				if (!fileExists) {
					return false;
				}

				const fileContent = await this.vaultHandler.readFile(filePath);
				const memoTexts = fileContent.split(/(?=<!-- memo-id:)/).filter((t) => t.trim());
				let updated = false;

				const newMemoTexts = memoTexts.map((memoText) => {
					if (memoText.includes(`memo-id: ${memoId}`)) {
						updated = true;
						let newText: string;
						//! チェックボックスを切り替え。
						if (completed) {
							//! - [ ] を - [x] に置換。
							//! HTMLコメントの後の改行も考慮して、行頭または改行直後のチェックボックスを探す。
							newText = memoText.replace(/(^|\n)-\s*\[\s?\]\s+/m, "$1- [x] ");
						} else {
							//! - [x] を - [ ] に置換。
							newText = memoText.replace(/(^|\n)-\s*\[x\]\s+/m, "$1- [ ] ");
						}

						return newText;
					}
					return memoText;
				});

				if (!updated) {
					return false;
				}

				const newFileContent = newMemoTexts.join("");
				await this.vaultHandler.writeFile(filePath, newFileContent);

				const cacheKey = `${filePath}::${category}`;
				this.cacheManager.invalidateMemos(cacheKey);

				return true;
			})(),
			{ filePath, category, memoId, context: "MemoManager.updateTodoCompleted" }
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
