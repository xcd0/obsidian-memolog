import { NotificationManager, NotificationType } from "../src/utils/notification-manager";
import { Notice } from "obsidian";

//! Noticeのモック。
jest.mock("obsidian", () => ({
	Notice: jest.fn(),
}));

describe("NotificationManager", () => {
	let notificationManager: NotificationManager;
	let mockNotice: jest.Mock;

	beforeEach(() => {
		notificationManager = NotificationManager.getInstance();
		notificationManager.clearHistory();
		mockNotice = Notice as jest.Mock;
		mockNotice.mockClear();
	});

	describe("Singleton Pattern", () => {
		test("should return same instance", () => {
			const instance1 = NotificationManager.getInstance();
			const instance2 = NotificationManager.getInstance();

			expect(instance1).toBe(instance2);
		});
	});

	describe("Notification Types", () => {
		test("should show info notification", () => {
			notificationManager.info("Info message");

			expect(mockNotice).toHaveBeenCalledWith("ℹ️ Info message", 3000);
		});

		test("should show success notification", () => {
			notificationManager.success("Success message");

			expect(mockNotice).toHaveBeenCalledWith("✅ Success message", 2000);
		});

		test("should show warning notification", () => {
			notificationManager.warning("Warning message");

			expect(mockNotice).toHaveBeenCalledWith("⚠️ Warning message", 5000);
		});

		test("should show error notification", () => {
			notificationManager.error("Error message");

			expect(mockNotice).toHaveBeenCalledWith("❌ Error message", 7000);
		});
	});

	describe("Custom Options", () => {
		test("should use custom duration", () => {
			notificationManager.info("Custom duration", { duration: 10000 });

			expect(mockNotice).toHaveBeenCalledWith("ℹ️ Custom duration", 10000);
		});

		test("should use custom icon", () => {
			notificationManager.info("Custom icon", { icon: "🎉" });

			expect(mockNotice).toHaveBeenCalledWith("🎉 Custom icon", 3000);
		});

		test("should allow custom empty icon", () => {
			notificationManager.info("Custom empty icon", { icon: "" });

			//! iconが空文字列の場合、アイコンなしで表示される。
			expect(mockNotice).toHaveBeenCalledWith("Custom empty icon", 3000);
		});
	});

	describe("Duplicate Prevention", () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		test("should prevent duplicate notifications within window", () => {
			notificationManager.info("Same message");
			notificationManager.info("Same message");

			//! 1回のみ表示される。
			expect(mockNotice).toHaveBeenCalledTimes(1);
		});

		test("should allow duplicate after window expires", () => {
			notificationManager.info("Same message");

			//! 3秒経過（DUPLICATE_WINDOW）。
			jest.advanceTimersByTime(3000);

			notificationManager.info("Same message");

			//! 2回表示される。
			expect(mockNotice).toHaveBeenCalledTimes(2);
		});

		test("should allow duplicate if preventDuplicate is false", () => {
			notificationManager.info("Same message", { preventDuplicate: false });
			notificationManager.info("Same message", { preventDuplicate: false });

			//! 2回表示される。
			expect(mockNotice).toHaveBeenCalledTimes(2);
		});

		test("should distinguish different types", () => {
			notificationManager.info("Message");
			notificationManager.error("Message");

			//! 異なるタイプなので2回表示される。
			expect(mockNotice).toHaveBeenCalledTimes(2);
		});
	});

	describe("History Management", () => {
		test("should record notification history", () => {
			notificationManager.info("Message 1");
			notificationManager.success("Message 2");

			const history = notificationManager.getHistory();

			expect(history).toHaveLength(2);
			expect(history[0].message).toBe("Message 1");
			expect(history[0].type).toBe(NotificationType.INFO);
			expect(history[1].message).toBe("Message 2");
			expect(history[1].type).toBe(NotificationType.SUCCESS);
		});

		test("should clear history", () => {
			notificationManager.info("Message 1");
			notificationManager.info("Message 2");

			expect(notificationManager.getHistory()).toHaveLength(2);

			notificationManager.clearHistory();

			expect(notificationManager.getHistory()).toHaveLength(0);
		});

		test("should limit history size", () => {
			//! HISTORY_SIZE(50)を超える通知を送信。
			for (let i = 0; i < 60; i++) {
				notificationManager.info(`Message ${i}`, { preventDuplicate: false });
			}

			const history = notificationManager.getHistory();

			//! 最大50件まで保存される。
			expect(history).toHaveLength(50);
		});
	});
});
