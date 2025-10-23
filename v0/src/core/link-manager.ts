//! メモ間リンク管理機能。

import { MemoEntry } from "../types";

//! リンク情報。
export interface MemoLink {
	//! リンク元メモID。
	sourceId: string;

	//! リンク先メモID。
	targetId: string;

	//! リンクテキスト。
	text: string;

	//! リンク位置（行番号）。
	line?: number;
}

//! バックリンク情報。
export interface Backlink {
	//! 参照元メモID。
	memoId: string;

	//! 参照元メモのコンテンツ（プレビュー用）。
	preview: string;

	//! リンクテキスト。
	text: string;
}

//! リンクマネージャークラス。
export class LinkManager {
	//! メモ内のリンクを抽出する。
	static extractLinks(memo: MemoEntry): MemoLink[] {
		const links: MemoLink[] = [];
		const content = memo.content;

		//! 統合正規表現で両方の形式を検出。
		//! [[memo-id|text]] または [[memo-id]] の形式。
		const linkRegex = /\[\[([a-zA-Z0-9-]+)(?:\|([^\]]+))?\]\]/g;
		let match: RegExpExecArray | null;

		while ((match = linkRegex.exec(content)) !== null) {
			links.push({
				sourceId: memo.id,
				targetId: match[1],
				text: match[2] || match[1], //! 表示テキストがなければIDを使用。
			});
		}

		return links;
	}

	//! バックリンクを取得する（あるメモを参照している全メモを取得）。
	static getBacklinks(targetMemoId: string, allMemos: MemoEntry[]): Backlink[] {
		const backlinks: Backlink[] = [];

		for (const memo of allMemos) {
			const links = LinkManager.extractLinks(memo);

			for (const link of links) {
				if (link.targetId === targetMemoId) {
					//! プレビュー用にリンク周辺のテキストを抽出。
					const preview = LinkManager.getPreviewText(memo.content, link.text);

					backlinks.push({
						memoId: memo.id,
						preview,
						text: link.text,
					});
				}
			}
		}

		return backlinks;
	}

	//! リンク周辺のプレビューテキストを取得する。
	static getPreviewText(content: string, linkText: string, contextLength = 50): string {
		const index = content.indexOf(linkText);

		if (index === -1) {
			//! リンクテキストが見つからない場合は先頭を返す。
			return content.substring(0, contextLength) + "...";
		}

		const start = Math.max(0, index - contextLength);
		const end = Math.min(content.length, index + linkText.length + contextLength);

		let preview = content.substring(start, end);

		if (start > 0) {
			preview = "..." + preview;
		}

		if (end < content.length) {
			preview = preview + "...";
		}

		return preview;
	}

	//! リンクをMarkdown形式に変換する。
	static createLink(targetMemoId: string, displayText?: string): string {
		if (displayText) {
			return `[[${targetMemoId}|${displayText}]]`;
		}
		return `[[${targetMemoId}]]`;
	}

	//! メモコンテンツ内のリンクをハイライト表示用にマークアップする。
	static highlightLinks(content: string): string {
		//! [[memo-id|text]] 形式を<a>タグに変換。
		let result = content.replace(
			/\[\[([a-zA-Z0-9-]+)\|([^\]]+)\]\]/g,
			'<a href="#" data-memo-id="$1" class="memolog-link">$2</a>'
		);

		//! [[memo-id]] 形式を<a>タグに変換。
		result = result.replace(
			/\[\[([a-zA-Z0-9-]+)\]\]/g,
			'<a href="#" data-memo-id="$1" class="memolog-link">$1</a>'
		);

		return result;
	}

	//! リンクグラフを構築する（メモ間の参照関係を可視化用）。
	static buildLinkGraph(memos: MemoEntry[]): Map<string, string[]> {
		const graph = new Map<string, string[]>();

		for (const memo of memos) {
			const links = LinkManager.extractLinks(memo);
			const targetIds = links.map((link) => link.targetId);

			graph.set(memo.id, targetIds);
		}

		return graph;
	}

	//! 孤立したメモ（リンクがなく、参照もされていないメモ）を検出する。
	static findOrphanedMemos(memos: MemoEntry[]): MemoEntry[] {
		const graph = LinkManager.buildLinkGraph(memos);
		const referencedMemos = new Set<string>();

		//! 参照されているメモを収集。
		for (const targetIds of graph.values()) {
			for (const targetId of targetIds) {
				referencedMemos.add(targetId);
			}
		}

		//! リンクを持たず、参照もされていないメモを抽出。
		return memos.filter((memo) => {
			const hasOutgoingLinks = (graph.get(memo.id) || []).length > 0;
			const hasIncomingLinks = referencedMemos.has(memo.id);

			return !hasOutgoingLinks && !hasIncomingLinks;
		});
	}

	//! リンク切れを検出する。
	static findBrokenLinks(memos: MemoEntry[]): MemoLink[] {
		const memoIds = new Set(memos.map((m) => m.id));
		const brokenLinks: MemoLink[] = [];

		for (const memo of memos) {
			const links = LinkManager.extractLinks(memo);

			for (const link of links) {
				if (!memoIds.has(link.targetId)) {
					brokenLinks.push(link);
				}
			}
		}

		return brokenLinks;
	}

	//! メモIDが有効かチェックする。
	static isValidMemoId(memoId: string): boolean {
		//! 英数字とハイフンのみ許可。
		return /^[a-zA-Z0-9-]+$/.test(memoId);
	}

	//! リンクテキストからメモIDを抽出する。
	static extractMemoId(linkText: string): string | null {
		//! [[memo-id]] または [[memo-id|text]] 形式から抽出。
		const match = linkText.match(/\[\[([a-zA-Z0-9-]+)(?:\|[^\]]+)?\]\]/);
		return match ? match[1] : null;
	}
}
