//! エラーハンドリング統一機構。

import { Notice } from "obsidian";

//! エラーの重要度レベル。
export enum ErrorSeverity {
	INFO = "info",
	WARNING = "warning",
	ERROR = "error",
	CRITICAL = "critical",
}

//! エラーカテゴリ。
export enum ErrorCategory {
	FILE_IO = "file_io",
	VALIDATION = "validation",
	PARSE = "parse",
	NETWORK = "network",
	CONFIGURATION = "configuration",
	UNKNOWN = "unknown",
}

//! memologエラー基底クラス。
export class MemologError extends Error {
	public readonly severity: ErrorSeverity;
	public readonly category: ErrorCategory;
	public readonly timestamp: Date;
	public readonly context?: Record<string, unknown>;

	constructor(
		message: string,
		severity: ErrorSeverity = ErrorSeverity.ERROR,
		category: ErrorCategory = ErrorCategory.UNKNOWN,
		context?: Record<string, unknown>
	) {
		super(message);
		this.name = "MemologError";
		this.severity = severity;
		this.category = category;
		this.timestamp = new Date();
		this.context = context;

		//! スタックトレースを正しく設定。
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, MemologError);
		}
	}
}

//! ファイルI/Oエラー。
export class FileIOError extends MemologError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, ErrorSeverity.ERROR, ErrorCategory.FILE_IO, context);
		this.name = "FileIOError";
	}
}

//! バリデーションエラー。
export class ValidationError extends MemologError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, ErrorSeverity.WARNING, ErrorCategory.VALIDATION, context);
		this.name = "ValidationError";
	}
}

//! パースエラー。
export class ParseError extends MemologError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, ErrorSeverity.ERROR, ErrorCategory.PARSE, context);
		this.name = "ParseError";
	}
}

//! 設定エラー。
export class ConfigurationError extends MemologError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, ErrorSeverity.ERROR, ErrorCategory.CONFIGURATION, context);
		this.name = "ConfigurationError";
	}
}

//! エラーハンドリング結果。
export interface ErrorHandlingResult<T> {
	success: boolean;
	data?: T;
	error?: MemologError;
}

//! エラーハンドラーオプション。
export interface ErrorHandlerOptions {
	showNotice: boolean;
	logToConsole: boolean;
	throwOnCritical: boolean;
}

//! デフォルトのエラーハンドラーオプション。
const DEFAULT_OPTIONS: ErrorHandlerOptions = {
	showNotice: true,
	logToConsole: true,
	throwOnCritical: true,
};

//! 統一エラーハンドラー。
export class ErrorHandler {
	private options: ErrorHandlerOptions;
	private errorLog: MemologError[] = [];
	private readonly MAX_LOG_SIZE = 100;

	constructor(options: Partial<ErrorHandlerOptions> = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	//! エラーを処理する。
	handle(error: Error | MemologError, context?: Record<string, unknown>): void {
		const memologError = this.toMemologError(error, context);

		//! ログに記録。
		this.logError(memologError);

		//! コンソールに出力。
		if (this.options.logToConsole) {
			this.logToConsole(memologError);
		}

		//! ユーザーに通知。
		if (this.options.showNotice) {
			this.showNotice(memologError);
		}

		//! クリティカルエラーの場合は例外を再スロー。
		if (
			this.options.throwOnCritical &&
			memologError.severity === ErrorSeverity.CRITICAL
		) {
			throw memologError;
		}
	}

	//! 非同期処理をラップしてエラーハンドリングを適用する。
	async wrap<T>(
		promise: Promise<T>,
		context?: Record<string, unknown>
	): Promise<ErrorHandlingResult<T>> {
		try {
			const data = await promise;
			return { success: true, data };
		} catch (error) {
			const memologError = this.toMemologError(error as Error, context);
			this.handle(memologError);
			return { success: false, error: memologError };
		}
	}

	//! 同期処理をラップしてエラーハンドリングを適用する。
	wrapSync<T>(
		func: () => T,
		context?: Record<string, unknown>
	): ErrorHandlingResult<T> {
		try {
			const data = func();
			return { success: true, data };
		} catch (error) {
			const memologError = this.toMemologError(error as Error, context);
			this.handle(memologError);
			return { success: false, error: memologError };
		}
	}

	//! ErrorをMemologErrorに変換する。
	private toMemologError(
		error: Error | MemologError,
		context?: Record<string, unknown>
	): MemologError {
		if (error instanceof MemologError) {
			//! コンテキストをマージ。
			if (context) {
				//! contextは読み取り専用なので、新しいMemologErrorを作成。
				return new MemologError(
					error.message,
					error.severity,
					error.category,
					{ ...error.context, ...context }
				);
			}
			return error;
		}

		//! 通常のErrorをMemologErrorに変換。
		return new MemologError(
			error.message,
			ErrorSeverity.ERROR,
			ErrorCategory.UNKNOWN,
			{ originalError: error.name, ...context }
		);
	}

	//! エラーをログに記録する。
	private logError(error: MemologError): void {
		this.errorLog.push(error);

		//! ログサイズ制限。
		if (this.errorLog.length > this.MAX_LOG_SIZE) {
			this.errorLog.shift();
		}
	}

	//! コンソールにエラーを出力する。
	private logToConsole(error: MemologError): void {
		const prefix = `[memolog] [${error.severity}] [${error.category}]`;
		const message = `${prefix} ${error.message}`;

		switch (error.severity) {
			case ErrorSeverity.INFO:
				console.info(message, error.context);
				break;
			case ErrorSeverity.WARNING:
				console.warn(message, error.context);
				break;
			case ErrorSeverity.ERROR:
			case ErrorSeverity.CRITICAL:
				console.error(message, error.context);
				break;
		}
	}

	//! ユーザーに通知を表示する。
	private showNotice(error: MemologError): void {
		//! INFOレベルは通知しない。
		if (error.severity === ErrorSeverity.INFO) {
			return;
		}

		const prefix = this.getSeverityIcon(error.severity);
		const message = `${prefix} ${error.message}`;

		new Notice(message, 5000);
	}

	//! 重要度アイコンを取得する。
	private getSeverityIcon(severity: ErrorSeverity): string {
		switch (severity) {
			case ErrorSeverity.INFO:
				return "ℹ️";
			case ErrorSeverity.WARNING:
				return "⚠️";
			case ErrorSeverity.ERROR:
				return "❌";
			case ErrorSeverity.CRITICAL:
				return "🚨";
		}
	}

	//! エラーログを取得する。
	getErrorLog(): MemologError[] {
		return [...this.errorLog];
	}

	//! エラーログをクリアする。
	clearErrorLog(): void {
		this.errorLog = [];
	}

	//! 特定カテゴリのエラーを取得する。
	getErrorsByCategory(category: ErrorCategory): MemologError[] {
		return this.errorLog.filter((error) => error.category === category);
	}

	//! 特定重要度以上のエラーを取得する。
	getErrorsBySeverity(minSeverity: ErrorSeverity): MemologError[] {
		const severityOrder = [
			ErrorSeverity.INFO,
			ErrorSeverity.WARNING,
			ErrorSeverity.ERROR,
			ErrorSeverity.CRITICAL,
		];

		const minIndex = severityOrder.indexOf(minSeverity);

		return this.errorLog.filter(
			(error) => severityOrder.indexOf(error.severity) >= minIndex
		);
	}
}

//! グローバルエラーハンドラーインスタンス。
let globalErrorHandler: ErrorHandler | null = null;

//! グローバルエラーハンドラーを初期化する。
export function initializeErrorHandler(
	options: Partial<ErrorHandlerOptions> = {}
): ErrorHandler {
	globalErrorHandler = new ErrorHandler(options);
	return globalErrorHandler;
}

//! グローバルエラーハンドラーを取得する。
export function getErrorHandler(): ErrorHandler {
	if (!globalErrorHandler) {
		globalErrorHandler = new ErrorHandler();
	}
	return globalErrorHandler;
}
