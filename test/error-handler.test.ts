import {
	ErrorHandler,
	MemologError,
	FileIOError,
	ValidationError,
	ParseError,
	ConfigurationError,
	ErrorSeverity,
	ErrorCategory,
	initializeErrorHandler,
	getErrorHandler,
} from "../src/core/error-handler";

//! Noticeのモック。
jest.mock("obsidian", () => ({
	Notice: jest.fn(),
}));

describe("ErrorHandler", () => {
	let errorHandler: ErrorHandler;

	beforeEach(() => {
		//! テスト前にエラーハンドラーを初期化。
		errorHandler = new ErrorHandler({
			showNotice: false,
			logToConsole: false,
			throwOnCritical: false,
		});

		jest.clearAllMocks();
	});

	describe("Error Classes", () => {
		test("MemologError should create error with correct properties", () => {
			const error = new MemologError(
				"Test error",
				ErrorSeverity.ERROR,
				ErrorCategory.FILE_IO,
				{ key: "value" }
			);

			expect(error.message).toBe("Test error");
			expect(error.severity).toBe(ErrorSeverity.ERROR);
			expect(error.category).toBe(ErrorCategory.FILE_IO);
			expect(error.context).toEqual({ key: "value" });
			expect(error.timestamp).toBeInstanceOf(Date);
		});

		test("FileIOError should have correct defaults", () => {
			const error = new FileIOError("File not found");

			expect(error.severity).toBe(ErrorSeverity.ERROR);
			expect(error.category).toBe(ErrorCategory.FILE_IO);
		});

		test("ValidationError should have correct defaults", () => {
			const error = new ValidationError("Invalid input");

			expect(error.severity).toBe(ErrorSeverity.WARNING);
			expect(error.category).toBe(ErrorCategory.VALIDATION);
		});

		test("ParseError should have correct defaults", () => {
			const error = new ParseError("Parse failed");

			expect(error.severity).toBe(ErrorSeverity.ERROR);
			expect(error.category).toBe(ErrorCategory.PARSE);
		});

		test("ConfigurationError should have correct defaults", () => {
			const error = new ConfigurationError("Config error");

			expect(error.severity).toBe(ErrorSeverity.ERROR);
			expect(error.category).toBe(ErrorCategory.CONFIGURATION);
		});
	});

	describe("handle", () => {
		test("should add error to log", () => {
			const error = new MemologError("Test error");

			errorHandler.handle(error);

			const log = errorHandler.getErrorLog();
			expect(log).toHaveLength(1);
			expect(log[0].message).toBe("Test error");
		});

		test("should convert regular Error to MemologError", () => {
			const error = new Error("Regular error");

			errorHandler.handle(error);

			const log = errorHandler.getErrorLog();
			expect(log).toHaveLength(1);
			expect(log[0]).toBeInstanceOf(MemologError);
			expect(log[0].message).toBe("Regular error");
		});

		test("should merge context", () => {
			const error = new MemologError("Test", ErrorSeverity.ERROR, ErrorCategory.UNKNOWN, {
				original: "data",
			});

			errorHandler.handle(error, { additional: "context" });

			const log = errorHandler.getErrorLog();
			expect(log[0].context).toEqual({
				original: "data",
				additional: "context",
			});
		});

		test("should throw on critical error when enabled", () => {
			const criticalHandler = new ErrorHandler({
				showNotice: false,
				logToConsole: false,
				throwOnCritical: true,
			});

			const error = new MemologError("Critical error", ErrorSeverity.CRITICAL);

			expect(() => criticalHandler.handle(error)).toThrow();
		});
	});

	describe("wrap", () => {
		test("should return success result for successful promise", async () => {
			const promise = Promise.resolve(42);

			const result = await errorHandler.wrap(promise);

			expect(result.success).toBe(true);
			expect(result.data).toBe(42);
			expect(result.error).toBeUndefined();
		});

		test("should return error result for failed promise", async () => {
			const promise = Promise.reject(new Error("Failed"));

			const result = await errorHandler.wrap(promise);

			expect(result.success).toBe(false);
			expect(result.data).toBeUndefined();
			expect(result.error).toBeInstanceOf(MemologError);
		});

		test("should include context in error", async () => {
			const promise = Promise.reject(new Error("Failed"));

			const result = await errorHandler.wrap(promise, { operation: "test" });

			expect(result.error?.context).toHaveProperty("operation", "test");
		});
	});

	describe("wrapSync", () => {
		test("should return success result for successful function", () => {
			const func = () => 42;

			const result = errorHandler.wrapSync(func);

			expect(result.success).toBe(true);
			expect(result.data).toBe(42);
			expect(result.error).toBeUndefined();
		});

		test("should return error result for throwing function", () => {
			const func = () => {
				throw new Error("Failed");
			};

			const result = errorHandler.wrapSync(func);

			expect(result.success).toBe(false);
			expect(result.data).toBeUndefined();
			expect(result.error).toBeInstanceOf(MemologError);
		});
	});

	describe("Error Log Management", () => {
		test("should limit error log size", () => {
			//! MAX_LOG_SIZE(100)を超えるエラーを追加。
			for (let i = 0; i < 150; i++) {
				errorHandler.handle(new MemologError(`Error ${i}`));
			}

			const log = errorHandler.getErrorLog();
			expect(log).toHaveLength(100);
		});

		test("should clear error log", () => {
			errorHandler.handle(new MemologError("Error 1"));
			errorHandler.handle(new MemologError("Error 2"));

			expect(errorHandler.getErrorLog()).toHaveLength(2);

			errorHandler.clearErrorLog();

			expect(errorHandler.getErrorLog()).toHaveLength(0);
		});

		test("should filter errors by category", () => {
			errorHandler.handle(new FileIOError("File error"));
			errorHandler.handle(new ValidationError("Validation error"));
			errorHandler.handle(new FileIOError("Another file error"));

			const fileErrors = errorHandler.getErrorsByCategory(ErrorCategory.FILE_IO);
			expect(fileErrors).toHaveLength(2);
		});

		test("should filter errors by severity", () => {
			errorHandler.handle(new MemologError("Info", ErrorSeverity.INFO));
			errorHandler.handle(new MemologError("Warning", ErrorSeverity.WARNING));
			errorHandler.handle(new MemologError("Error", ErrorSeverity.ERROR));
			errorHandler.handle(new MemologError("Critical", ErrorSeverity.CRITICAL));

			const warningAndAbove = errorHandler.getErrorsBySeverity(ErrorSeverity.WARNING);
			expect(warningAndAbove).toHaveLength(3); //! WARNING, ERROR, CRITICAL。
		});
	});

	describe("Global Error Handler", () => {
		test("should initialize global error handler", () => {
			const handler = initializeErrorHandler({
				showNotice: false,
			});

			expect(handler).toBeInstanceOf(ErrorHandler);
		});

		test("should get global error handler", () => {
			const handler1 = getErrorHandler();
			const handler2 = getErrorHandler();

			//! 同じインスタンスを返す。
			expect(handler1).toBe(handler2);
		});
	});
});
