// ! ログ出力を制御するユーティリティ。

export type LogLevel = "none" | "error" | "warn" | "info" | "debug"

// ! ログレベルの優先順位。
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	none: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
}

// ! ログ出力クラス。
export class Logger {
	private static currentLevel: LogLevel = "info"

	// ! ログレベルを設定する。
	static setLogLevel(level: LogLevel): void {
		Logger.currentLevel = level
	}

	// ! 現在のログレベルを取得する。
	static getLogLevel(): LogLevel {
		return Logger.currentLevel
	}

	// ! 指定したレベルのログを出力すべきか判定する。
	private static shouldLog(level: LogLevel): boolean {
		return (
			LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[Logger.currentLevel]
		)
	}

	// ! エラーログを出力する。
	static error(message: string, ...args: unknown[]): void {
		if (Logger.shouldLog("error")) {
			console.error(`[memolog] ${message}`, ...args)
		}
	}

	// ! 警告ログを出力する。
	static warn(message: string, ...args: unknown[]): void {
		if (Logger.shouldLog("warn")) {
			console.warn(`[memolog] ${message}`, ...args)
		}
	}

	// ! 情報ログを出力する。
	static info(message: string, ...args: unknown[]): void {
		if (Logger.shouldLog("info")) {
			console.info(`[memolog] ${message}`, ...args)
		}
	}

	// ! デバッグログを出力する。
	static debug(message: string, ...args: unknown[]): void {
		if (Logger.shouldLog("debug")) {
			console.log(`[memolog DEBUG] ${message}`, ...args)
		}
	}

	// ! ログを出力する（汎用）。
	static log(message: string, ...args: unknown[]): void {
		if (Logger.shouldLog("info")) {
			console.log(`[memolog] ${message}`, ...args)
		}
	}
}
