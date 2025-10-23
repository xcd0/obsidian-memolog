//! 通知管理機能。

import { Notice } from "obsidian";

//! 通知タイプ。
export enum NotificationType {
	INFO = "info",
	SUCCESS = "success",
	WARNING = "warning",
	ERROR = "error",
}

//! 通知オプション。
export interface NotificationOptions {
	duration?: number;
	icon?: string;
	preventDuplicate?: boolean;
}

//! 通知履歴エントリ。
interface NotificationHistory {
	message: string;
	type: NotificationType;
	timestamp: number;
}

//! 通知管理クラス。
export class NotificationManager {
	private static instance: NotificationManager | null = null;
	private history: NotificationHistory[] = [];
	private readonly HISTORY_SIZE = 50;
	private readonly DUPLICATE_WINDOW = 3000; //! 3秒以内の重複を検知。

	//! シングルトンインスタンスを取得する。
	static getInstance(): NotificationManager {
		if (!NotificationManager.instance) {
			NotificationManager.instance = new NotificationManager();
		}
		return NotificationManager.instance;
	}

	//! 情報通知を表示する。
	info(message: string, options: NotificationOptions = {}): void {
		this.show(message, NotificationType.INFO, options);
	}

	//! 成功通知を表示する。
	success(message: string, options: NotificationOptions = {}): void {
		this.show(message, NotificationType.SUCCESS, options);
	}

	//! 警告通知を表示する。
	warning(message: string, options: NotificationOptions = {}): void {
		this.show(message, NotificationType.WARNING, options);
	}

	//! エラー通知を表示する。
	error(message: string, options: NotificationOptions = {}): void {
		this.show(message, NotificationType.ERROR, options);
	}

	//! 通知を表示する。
	private show(
		message: string,
		type: NotificationType,
		options: NotificationOptions = {}
	): void {
		//! 重複チェック。
		if (options.preventDuplicate !== false) {
			if (this.isDuplicate(message, type)) {
				return;
			}
		}

		//! アイコンを追加。
		const icon =
			options.icon !== undefined ? options.icon : this.getTypeIcon(type);
		const fullMessage = icon ? `${icon} ${message}` : message;

		//! デフォルトのdurationを設定。
		const duration = options.duration ?? this.getDefaultDuration(type);

		//! Obsidian Noticeを表示。
		new Notice(fullMessage, duration);

		//! 履歴に追加。
		this.addToHistory(message, type);
	}

	//! 重複通知をチェックする。
	private isDuplicate(message: string, type: NotificationType): boolean {
		const now = Date.now();

		return this.history.some(
			(entry) =>
				entry.message === message &&
				entry.type === type &&
				now - entry.timestamp < this.DUPLICATE_WINDOW
		);
	}

	//! 履歴に追加する。
	private addToHistory(message: string, type: NotificationType): void {
		this.history.push({
			message,
			type,
			timestamp: Date.now(),
		});

		//! 履歴サイズ制限。
		if (this.history.length > this.HISTORY_SIZE) {
			this.history.shift();
		}
	}

	//! タイプに応じたアイコンを取得する。
	private getTypeIcon(type: NotificationType): string {
		switch (type) {
			case NotificationType.INFO:
				return "ℹ️";
			case NotificationType.SUCCESS:
				return "✅";
			case NotificationType.WARNING:
				return "⚠️";
			case NotificationType.ERROR:
				return "❌";
		}
	}

	//! タイプに応じたデフォルトdurationを取得する。
	private getDefaultDuration(type: NotificationType): number {
		switch (type) {
			case NotificationType.INFO:
				return 3000;
			case NotificationType.SUCCESS:
				return 2000;
			case NotificationType.WARNING:
				return 5000;
			case NotificationType.ERROR:
				return 7000;
		}
	}

	//! 通知履歴を取得する。
	getHistory(): NotificationHistory[] {
		return [...this.history];
	}

	//! 通知履歴をクリアする。
	clearHistory(): void {
		this.history = [];
	}
}

//! 便利な関数エクスポート。
export const notify = NotificationManager.getInstance();
