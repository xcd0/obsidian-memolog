import { Logger } from "../src/utils/logger"

describe("Logger", () => {
	let consoleErrorSpy: jest.SpyInstance
	let consoleWarnSpy: jest.SpyInstance
	let consoleInfoSpy: jest.SpyInstance
	let consoleLogSpy: jest.SpyInstance

	beforeEach(() => {
		// ! コンソール出力をモック。
		consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
		consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
		consoleInfoSpy = jest.spyOn(console, "info").mockImplementation()
		consoleLogSpy = jest.spyOn(console, "log").mockImplementation()

		// ! デフォルトのログレベルにリセット。
		Logger.setLogLevel("info")
	})

	afterEach(() => {
		// ! モックをリストア。
		consoleErrorSpy.mockRestore()
		consoleWarnSpy.mockRestore()
		consoleInfoSpy.mockRestore()
		consoleLogSpy.mockRestore()
	})

	describe("setLogLevel / getLogLevel", () => {
		it("ログレベルを設定・取得できる", () => {
			Logger.setLogLevel("debug")
			expect(Logger.getLogLevel()).toBe("debug")

			Logger.setLogLevel("error")
			expect(Logger.getLogLevel()).toBe("error")

			Logger.setLogLevel("none")
			expect(Logger.getLogLevel()).toBe("none")
		})
	})

	describe("error", () => {
		it("errorレベル以上で出力される", () => {
			Logger.setLogLevel("error")
			Logger.error("Test error", { foo: "bar" })
			expect(consoleErrorSpy).toHaveBeenCalledWith("[memolog] Test error", { foo: "bar" })
		})

		it("noneレベルでは出力されない", () => {
			Logger.setLogLevel("none")
			Logger.error("Test error")
			expect(consoleErrorSpy).not.toHaveBeenCalled()
		})

		it("warnレベル以上で出力される", () => {
			Logger.setLogLevel("warn")
			Logger.error("Test error")
			expect(consoleErrorSpy).toHaveBeenCalledWith("[memolog] Test error")
		})
	})

	describe("warn", () => {
		it("warnレベル以上で出力される", () => {
			Logger.setLogLevel("warn")
			Logger.warn("Test warning", 123)
			expect(consoleWarnSpy).toHaveBeenCalledWith("[memolog] Test warning", 123)
		})

		it("errorレベルでは出力されない", () => {
			Logger.setLogLevel("error")
			Logger.warn("Test warning")
			expect(consoleWarnSpy).not.toHaveBeenCalled()
		})

		it("infoレベル以上で出力される", () => {
			Logger.setLogLevel("info")
			Logger.warn("Test warning")
			expect(consoleWarnSpy).toHaveBeenCalledWith("[memolog] Test warning")
		})
	})

	describe("info", () => {
		it("infoレベル以上で出力される", () => {
			Logger.setLogLevel("info")
			Logger.info("Test info", true)
			expect(consoleInfoSpy).toHaveBeenCalledWith("[memolog] Test info", true)
		})

		it("warnレベルでは出力されない", () => {
			Logger.setLogLevel("warn")
			Logger.info("Test info")
			expect(consoleInfoSpy).not.toHaveBeenCalled()
		})

		it("debugレベルで出力される", () => {
			Logger.setLogLevel("debug")
			Logger.info("Test info")
			expect(consoleInfoSpy).toHaveBeenCalledWith("[memolog] Test info")
		})
	})

	describe("debug", () => {
		it("debugレベルで出力される", () => {
			Logger.setLogLevel("debug")
			Logger.debug("Test debug", [1, 2, 3])
			expect(consoleLogSpy).toHaveBeenCalledWith("[memolog DEBUG] Test debug", [1, 2, 3])
		})

		it("infoレベルでは出力されない", () => {
			Logger.setLogLevel("info")
			Logger.debug("Test debug")
			expect(consoleLogSpy).not.toHaveBeenCalled()
		})

		it("複数の引数を受け取れる", () => {
			Logger.setLogLevel("debug")
			Logger.debug("Test debug", "arg1", "arg2", { key: "value" })
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[memolog DEBUG] Test debug",
				"arg1",
				"arg2",
				{ key: "value" },
			)
		})
	})

	describe("log", () => {
		it("infoレベル以上で出力される", () => {
			Logger.setLogLevel("info")
			Logger.log("Test log", null)
			expect(consoleLogSpy).toHaveBeenCalledWith("[memolog] Test log", null)
		})

		it("warnレベルでは出力されない", () => {
			Logger.setLogLevel("warn")
			Logger.log("Test log")
			expect(consoleLogSpy).not.toHaveBeenCalled()
		})

		it("debugレベルで出力される", () => {
			Logger.setLogLevel("debug")
			Logger.log("Test log")
			expect(consoleLogSpy).toHaveBeenCalledWith("[memolog] Test log")
		})
	})

	describe("ログレベルによるフィルタリング", () => {
		it("noneレベルでは何も出力されない", () => {
			Logger.setLogLevel("none")
			Logger.error("error")
			Logger.warn("warn")
			Logger.info("info")
			Logger.debug("debug")
			Logger.log("log")

			expect(consoleErrorSpy).not.toHaveBeenCalled()
			expect(consoleWarnSpy).not.toHaveBeenCalled()
			expect(consoleInfoSpy).not.toHaveBeenCalled()
			expect(consoleLogSpy).not.toHaveBeenCalled()
		})

		it("errorレベルではerrorのみ出力される", () => {
			Logger.setLogLevel("error")
			Logger.error("error")
			Logger.warn("warn")
			Logger.info("info")
			Logger.debug("debug")

			expect(consoleErrorSpy).toHaveBeenCalled()
			expect(consoleWarnSpy).not.toHaveBeenCalled()
			expect(consoleInfoSpy).not.toHaveBeenCalled()
			expect(consoleLogSpy).not.toHaveBeenCalled()
		})

		it("warnレベルではerror+warnが出力される", () => {
			Logger.setLogLevel("warn")
			Logger.error("error")
			Logger.warn("warn")
			Logger.info("info")
			Logger.debug("debug")

			expect(consoleErrorSpy).toHaveBeenCalled()
			expect(consoleWarnSpy).toHaveBeenCalled()
			expect(consoleInfoSpy).not.toHaveBeenCalled()
			expect(consoleLogSpy).not.toHaveBeenCalled()
		})

		it("infoレベルではerror+warn+infoが出力される", () => {
			Logger.setLogLevel("info")
			Logger.error("error")
			Logger.warn("warn")
			Logger.info("info")
			Logger.debug("debug")
			Logger.log("log")

			expect(consoleErrorSpy).toHaveBeenCalled()
			expect(consoleWarnSpy).toHaveBeenCalled()
			expect(consoleInfoSpy).toHaveBeenCalled()
			// ! debugは出力されないが、logは出力される（infoレベル）。
			expect(consoleLogSpy).toHaveBeenCalledTimes(1)
			expect(consoleLogSpy).toHaveBeenCalledWith("[memolog] log")
		})

		it("debugレベルでは全て出力される", () => {
			Logger.setLogLevel("debug")
			Logger.error("error")
			Logger.warn("warn")
			Logger.info("info")
			Logger.debug("debug")
			Logger.log("log")

			expect(consoleErrorSpy).toHaveBeenCalled()
			expect(consoleWarnSpy).toHaveBeenCalled()
			expect(consoleInfoSpy).toHaveBeenCalled()
			// ! debugとlogの両方が出力される。
			expect(consoleLogSpy).toHaveBeenCalledTimes(2)
		})
	})
})
