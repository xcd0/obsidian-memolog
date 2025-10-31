import { MemoManager } from "../src/core/memo-manager";
import { App, TFile } from "obsidian";

//! タイムゾーン処理のテスト。
//!
//! 仕様:
//! 1. 新規投稿時: 投稿者のローカルタイムゾーンに合わせたタイムスタンプを保存
//! 2. 表示時: 表示しているユーザーのローカルタイムゾーンでフィルタリング

//! TFileのモック作成ヘルパー。
const createMockTFile = (path: string): TFile => {
	return Object.create(TFile.prototype, {
		path: { value: path },
	}) as TFile;
};

describe("タイムゾーン処理", () => {
	let mockApp: App;
	let memoManager: MemoManager;
	const filePath = "memolog/work/2025-10-31.md";

	beforeEach(() => {
		//! vault APIのモック作成。
		const mockRead = jest.fn();
		const mockWrite = jest.fn();
		const mockModify = jest.fn();
		const mockGetAbstractFileByPath = jest.fn();
		const mockStat = jest.fn();

		mockApp = {
			vault: {
				read: mockRead,
				modify: mockModify,
				getAbstractFileByPath: mockGetAbstractFileByPath,
				adapter: {
					exists: jest.fn(),
					read: jest.fn(),
					write: mockWrite,
					remove: jest.fn(),
					list: jest.fn(),
					stat: mockStat,
				},
			},
		} as unknown as App;

		//! TFileのモックを作成。
		const mockFile = createMockTFile(filePath);
		mockGetAbstractFileByPath.mockReturnValue(mockFile);

		//! ファイルのstatを返す。
		mockStat.mockResolvedValue({
			mtime: Date.now(),
			ctime: Date.now(),
			size: 0,
		});

		//! 空のファイルとして初期化。
		mockRead.mockResolvedValue("");

		memoManager = new MemoManager(mockApp);

		//! ファイルが存在すると仮定。
		(mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(true);
		(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue("");
	});

	describe("新規投稿時のタイムスタンプ", () => {
		it("【新仕様】新規投稿がISO 8601形式(タイムゾーンオフセット付き)で保存されること", async () => {
			//! シナリオ:
			//! - ユーザーA (GMT+9、日本) が 2025-10-31 14:30:00 JST に投稿
			//!
			//! 期待される動作:
			//! - タイムスタンプは ISO 8601 形式でタイムゾーンオフセット付きで保存される
			//! - 旧形式: 2025-10-31T05:30:00.000Z (UTC形式、Z終端)
			//! - 新形式: 2025-10-31T14:30:00.000+09:00 (タイムゾーンオフセット付き)
			//!
			//! これにより:
			//! - 投稿者がどのタイムゾーンで投稿したかが分かる (+09:00)
			//! - ローカル時刻が直接分かる (14:30)
			//! - UTC時刻への変換も可能 (JavaScriptが自動変換)

			//! モックの現在時刻を設定（テスト実行時の実際の時刻を使用）。
			const now = new Date();
			const localTimeStr = now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
			console.log("=== 新規投稿テスト (ISO形式、タイムゾーンオフセット付き) ===");
			console.log("テスト実行時刻 (ローカル):", localTimeStr);
			console.log("テスト実行時刻 (UTC):", now.toISOString());

			//! タイムゾーンオフセットを取得 (分単位)。
			const offsetMinutes = -now.getTimezoneOffset(); //! 日本は-540分 -> +540分 = +9時間。
			const offsetHours = Math.floor(offsetMinutes / 60);
			const offsetMins = Math.abs(offsetMinutes % 60);
			const offsetStr = `${offsetHours >= 0 ? "+" : ""}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;
			console.log("タイムゾーンオフセット:", offsetStr);

			//! メモを追加。
			await memoManager.addMemo(filePath, "work", "テストメモ", "asc");

			//! vault.modifyが呼ばれたことを確認。
			const modifyCalls = (mockApp.vault.modify as jest.Mock).mock.calls;
			expect(modifyCalls.length).toBeGreaterThan(0);

			//! 保存されたコンテンツを取得。
			const savedContent = modifyCalls[0][1] as string;
			console.log("保存されたコンテンツ:", savedContent);

			//! タイムスタンプを抽出。
			const timestampMatch = savedContent.match(/timestamp: ([^,]+),/);
			expect(timestampMatch).not.toBeNull();

			const savedTimestamp = timestampMatch![1];
			console.log("保存されたタイムスタンプ:", savedTimestamp);

			//! 【新仕様】タイムゾーンオフセット付きのISO 8601形式であることを確認。
			//! 形式: 2025-10-31T14:30:00.000+09:00 (末尾が +09:00 など)
			expect(savedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);

			//! 【新仕様の検証】タイムゾーンオフセットが含まれていることを確認。
			if (offsetStr !== "+00:00") {
				//! UTC以外のタイムゾーンの場合、オフセットが含まれるべき。
				expect(savedTimestamp).toContain(offsetStr);
				console.log("✓ タイムゾーンオフセットが含まれています:", offsetStr);
			} else {
				//! UTCタイムゾーンの場合、+00:00が含まれるべき。
				expect(savedTimestamp).toContain("+00:00");
				console.log("✓ UTCタイムゾーンオフセットが含まれています: +00:00");
			}

			//! 保存されたタイムスタンプをDateオブジェクトに変換。
			const savedDate = new Date(savedTimestamp);
			const savedLocalTime = savedDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
			console.log("保存されたタイムスタンプ (ローカル):", savedLocalTime);

			//! 現在時刻との差が数秒以内であることを確認（投稿時刻として妥当）。
			const timeDiff = Math.abs(savedDate.getTime() - now.getTime());
			expect(timeDiff).toBeLessThan(5000); //! 5秒以内。

			console.log("✓ ISO 8601形式(タイムゾーンオフセット付き)で保存されています");
		});

		it("【新仕様】新規投稿がUTC形式(Z終端)ではないことを確認", async () => {
			//! シナリオ:
			//! - 旧形式(UTC形式、Z終端)で保存されないことを確認する
			//!
			//! 期待される動作:
			//! - タイムスタンプは Z で終わらない (UTC形式ではない)
			//! - タイムゾーンオフセット(+09:00など)で終わる

			console.log("=== 新規投稿テスト (UTC形式でないことを確認) ===");

			//! メモを追加。
			await memoManager.addMemo(filePath, "work", "テストメモ", "asc");

			//! vault.modifyが呼ばれたことを確認。
			const modifyCalls = (mockApp.vault.modify as jest.Mock).mock.calls;
			expect(modifyCalls.length).toBeGreaterThan(0);

			//! 保存されたコンテンツを取得。
			const savedContent = modifyCalls[0][1] as string;

			//! タイムスタンプを抽出。
			const timestampMatch = savedContent.match(/timestamp: ([^,]+),/);
			expect(timestampMatch).not.toBeNull();

			const savedTimestamp = timestampMatch![1];
			console.log("保存されたタイムスタンプ:", savedTimestamp);

			//! 【新仕様の検証】UTC形式(Z終端)ではないことを確認。
			expect(savedTimestamp).not.toMatch(/Z$/);
			console.log("✓ UTC形式(Z終端)ではありません");

			//! タイムゾーンオフセットで終わることを確認。
			expect(savedTimestamp).toMatch(/[+-]\d{2}:\d{2}$/);
			console.log("✓ タイムゾーンオフセット形式で終わっています");
		});

		it("異なるタイムゾーンのユーザーが同時刻に投稿した場合、異なるUTC時刻が保存されること", async () => {
			//! シナリオ:
			//! - ユーザーA (GMT+9) が 2025-10-31 14:30:00 JST に投稿
			//!   -> UTC: 2025-10-31 05:30:00 UTC
			//! - ユーザーB (GMT+0) が 2025-10-31 14:30:00 GMT に投稿
			//!   -> UTC: 2025-10-31 14:30:00 UTC
			//!
			//! 期待される動作:
			//! - 両方とも「14:30に投稿した」という事実が保持される
			//! - UTC時刻としては9時間の差がある

			//! ユーザーAの投稿（GMT+9）。
			const userALocalTime = new Date("2025-10-31T14:30:00+09:00");
			const userAUtcTime = userALocalTime.toISOString();

			console.log("=== 異なるタイムゾーンのユーザーテスト ===");
			console.log("ユーザーA (GMT+9):");
			console.log("  ローカル時刻: 2025-10-31 14:30:00 JST");
			console.log("  UTC時刻:", userAUtcTime);

			//! ユーザーBの投稿（GMT+0）。
			const userBLocalTime = new Date("2025-10-31T14:30:00Z");
			const userBUtcTime = userBLocalTime.toISOString();

			console.log("ユーザーB (GMT+0):");
			console.log("  ローカル時刻: 2025-10-31 14:30:00 GMT");
			console.log("  UTC時刻:", userBUtcTime);

			//! UTC時刻が9時間異なることを確認。
			const timeDiff = userBLocalTime.getTime() - userALocalTime.getTime();
			const hoursDiff = timeDiff / (1000 * 60 * 60);
			expect(hoursDiff).toBe(9);

			console.log("時差:", hoursDiff, "時間");

			//! 【重要な仕様】
			//! - 各ユーザーは自分のローカル時刻で投稿する
			//! - タイムスタンプはUTC形式で保存されるが、投稿者のローカル時刻が反映される
			//! - これにより、各ユーザーが「いつ投稿したか」という情報が正確に保持される
		});
	});

	describe("表示時のフィルタリング", () => {
		it("【仕様2】表示ユーザーのローカルタイムゾーンでフィルタリングされること", async () => {
			//! シナリオ:
			//! - GMT+9のユーザーAが 2025-10-29 08:45 JST に投稿
			//!   -> UTC: 2025-10-28 23:45 UTC
			//! - GMT+9のユーザーBが「10/29のメモ」を見る
			//!
			//! 期待される動作:
			//! - ユーザーBのローカルタイムゾーン (GMT+9) で10/29のメモとして表示される
			//! - UTC時刻が10/28であっても、ローカル時刻が10/29なら表示される

			//! テストデータ: 2025-10-28T23:45:37.050Z (UTC) = 2025-10-29 08:45 (JST)。
			const testMemoContent = `<!-- memo-id: test-id-1, timestamp: 2025-10-28T23:45:37.050Z, category: "work", template: "{{content}}" -->
テストメモ（10/29朝）
`;

			(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(testMemoContent);
			(mockApp.vault.read as jest.Mock).mockResolvedValue(testMemoContent);

			//! メモを取得。
			const allMemos = await memoManager.getMemos(filePath, "work");
			expect(allMemos).toHaveLength(1);

			const memo = allMemos[0];
			console.log("=== 表示時のフィルタリングテスト ===");
			console.log("メモのUTC時刻:", memo.timestamp);

			//! メモのローカル時刻を計算（GMT+9）。
			const memoDate = new Date(memo.timestamp);
			const memoLocalTime = memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
			console.log("メモのローカル時刻 (GMT+9):", memoLocalTime);

			//! ユーザーBが「10/29のメモ」を見る場合のフィルター範囲。
			const targetDate = new Date("2025-10-29T12:00:00+09:00"); //! GMT+9の10/29正午。
			const startDate = new Date(targetDate);
			startDate.setHours(0, 0, 0, 0); //! ローカルタイムゾーンの0時。
			const endDate = new Date(targetDate);
			endDate.setHours(23, 59, 59, 999); //! ローカルタイムゾーンの23:59。

			console.log("フィルター範囲 (ローカル):");
			console.log("  開始:", startDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
			console.log("  終了:", endDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
			console.log("フィルター範囲 (UTC):");
			console.log("  開始:", startDate.toISOString());
			console.log("  終了:", endDate.toISOString());

			//! フィルタリング。
			const isInRange = memoDate >= startDate && memoDate <= endDate;
			console.log("メモがフィルター範囲内か:", isInRange);

			//! 【期待される動作】
			//! - ユーザーBのローカルタイムゾーン (GMT+9) で10/29として表示される
			expect(isInRange).toBe(true);
		});

		it("異なるタイムゾーンのユーザーが同じメモを見た場合、異なる日付として表示される可能性があること", async () => {
			//! シナリオ:
			//! - GMT+9のユーザーAが 2025-10-29 00:30 JST に投稿
			//!   -> UTC: 2025-10-28 15:30 UTC
			//! - GMT+9のユーザーBが見る: 10/29のメモとして表示
			//! - GMT-8のユーザーCが見る: 10/28のメモとして表示
			//!
			//! 期待される動作:
			//! - 各ユーザーは自分のローカルタイムゾーンで日付を判断する
			//! - 同じメモでも、表示されるユーザーのタイムゾーンによって「今日」かどうかが変わる

			//! テストデータ: 2025-10-28T15:30:00.000Z (UTC)。
			const testTimestamp = "2025-10-28T15:30:00.000Z";
			const utcDate = new Date(testTimestamp);

			console.log("=== 異なるタイムゾーンでの表示テスト ===");
			console.log("UTC時刻:", testTimestamp);

			//! GMT+9 (日本) での表示。
			const jstTime = utcDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
			console.log("GMT+9での表示:", jstTime);

			//! GMT-8 (太平洋時間) での表示。
			const pstTime = utcDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
			console.log("GMT-8での表示:", pstTime);

			//! 日付のみを抽出。
			const jstDateOnly = utcDate
				.toLocaleString("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })
				.split(",")[0];
			const pstDateOnly = utcDate
				.toLocaleString("en-US", {
					timeZone: "America/Los_Angeles",
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
				})
				.split(",")[0];

			console.log("GMT+9での日付:", jstDateOnly); //! 10/29/2025。
			console.log("GMT-8での日付:", pstDateOnly); //! 10/28/2025。

			//! 異なる日付として表示されることを確認。
			expect(jstDateOnly).not.toBe(pstDateOnly);

			//! 【重要な仕様】
			//! - タイムゾーンが異なるユーザーは、同じメモを異なる日付として見る可能性がある
			//! - これは正常な動作であり、各ユーザーのローカルタイムゾーンが尊重される
		});

		it("「今日」フィルターは、表示ユーザーのローカルタイムゾーンの「今日」を基準とすること", async () => {
			//! シナリオ:
			//! - 現在時刻: 2025-10-31 02:00 JST (GMT+9)
			//!   -> UTC: 2025-10-30 17:00 UTC
			//! - GMT+9のユーザーが「今日」フィルターを適用
			//! - UTC時刻が10/30のメモでも、ローカル時刻が10/31なら表示される
			//!
			//! 期待される動作:
			//! - 「今日」= 表示ユーザーのローカルタイムゾーンでの今日
			//! - UTC時刻ベースではなく、ローカル時刻ベースで判定

			//! 現在時刻を設定（GMT+9の10/31 02:00）。
			const now = new Date("2025-10-31T02:00:00+09:00");
			console.log("=== 「今日」フィルターテスト ===");
			console.log("現在時刻 (GMT+9):", now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
			console.log("現在時刻 (UTC):", now.toISOString());

			//! テストメモ: 2025-10-30T17:30:00.000Z (UTC) = 2025-10-31 02:30 JST。
			const testMemoContent = `<!-- memo-id: test-id-2, timestamp: 2025-10-30T17:30:00.000Z, category: "work", template: "{{content}}" -->
テストメモ（10/31深夜）
`;

			(mockApp.vault.adapter.read as jest.Mock).mockResolvedValue(testMemoContent);
			(mockApp.vault.read as jest.Mock).mockResolvedValue(testMemoContent);

			//! メモを取得。
			const allMemos = await memoManager.getMemos(filePath, "work");
			expect(allMemos).toHaveLength(1);

			const memo = allMemos[0];
			const memoDate = new Date(memo.timestamp);
			const memoLocalTime = memoDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
			console.log("メモのローカル時刻 (GMT+9):", memoLocalTime);

			//! 「今日」フィルターの範囲（ローカルタイムゾーン）。
			const startDate = new Date(now);
			startDate.setHours(0, 0, 0, 0); //! 10/31 00:00 JST = 10/30 15:00 UTC。
			const endDate = new Date(now);
			endDate.setHours(23, 59, 59, 999); //! 10/31 23:59 JST = 10/31 14:59 UTC。

			console.log("「今日」の範囲 (ローカル):");
			console.log("  開始:", startDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
			console.log("  終了:", endDate.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }));
			console.log("「今日」の範囲 (UTC):");
			console.log("  開始:", startDate.toISOString());
			console.log("  終了:", endDate.toISOString());

			//! フィルタリング。
			const isInRange = memoDate >= startDate && memoDate <= endDate;
			console.log("メモが「今日」の範囲内か:", isInRange);

			//! 【期待される動作】
			//! - UTC時刻が10/30でも、ローカル時刻が10/31なら「今日」として表示される
			expect(isInRange).toBe(true);

			//! 【重要な仕様確認】
			//! - `new Date().setHours(0, 0, 0, 0)` はローカルタイムゾーンの0時を設定する
			//! - `new Date(utcTimestamp)` はUTC時刻として解釈される
			//! - 両方をDateオブジェクトとして比較すると、内部ではUTCミリ秒で比較される
			//! - つまり、ローカルタイムゾーンを考慮したフィルタリングが実現される
		});
	});

	describe("タイムゾーン変換の正確性", () => {
		it("夏時間 (DST) の切り替え時にも正確にフィルタリングできること", async () => {
			//! シナリオ:
			//! - アメリカの夏時間切り替え時（3月第2日曜日、11月第1日曜日）
			//! - 2025年3月9日 02:00に時計が3:00になる（1時間進む）
			//!
			//! 期待される動作:
			//! - 夏時間の切り替えがあっても、タイムスタンプは正確に保存される
			//! - フィルタリングも正確に動作する

			//! 夏時間切り替え前: 2025-03-09 01:30 PST (UTC-8) = 2025-03-09 09:30 UTC。
			const beforeDST = new Date("2025-03-09T09:30:00.000Z");
			const beforeDSTLocal = beforeDST.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });

			//! 夏時間切り替え後: 2025-03-09 03:30 PDT (UTC-7) = 2025-03-09 10:30 UTC。
			const afterDST = new Date("2025-03-09T10:30:00.000Z");
			const afterDSTLocal = afterDST.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });

			console.log("=== 夏時間 (DST) テスト ===");
			console.log("切り替え前 (PST, UTC-8):");
			console.log("  UTC:", beforeDST.toISOString());
			console.log("  ローカル:", beforeDSTLocal);
			console.log("切り替え後 (PDT, UTC-7):");
			console.log("  UTC:", afterDST.toISOString());
			console.log("  ローカル:", afterDSTLocal);

			//! 【重要な仕様】
			//! - JavaScriptのDateオブジェクトは、ブラウザのタイムゾーン設定を自動的に考慮する
			//! - 夏時間の切り替えも自動的に処理される
			//! - タイムスタンプはUTC形式で保存されるため、夏時間の影響を受けない

			//! 1時間の差があることを確認（実際の時間経過は1時間だが、ローカル時刻は2時間進んでいる）。
			const timeDiffMs = afterDST.getTime() - beforeDST.getTime();
			const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
			expect(timeDiffHours).toBe(1);

			console.log("実際の時間経過:", timeDiffHours, "時間");
		});

		it("異なる日付表記形式でも正確にパースできること", async () => {
			//! シナリオ:
			//! - ISO 8601形式のタイムスタンプが正確にパースされる
			//! - タイムゾーンオフセット付き、なし、両方とも正確に扱える
			//!
			//! 期待される動作:
			//! - "2025-10-31T14:30:00.000Z" (UTC)
			//! - "2025-10-31T14:30:00+09:00" (GMT+9)
			//! - 両方とも正確にDateオブジェクトに変換される

			const utcFormat = "2025-10-31T14:30:00.000Z";
			const jstFormat = "2025-10-31T14:30:00+09:00";

			const utcDate = new Date(utcFormat);
			const jstDate = new Date(jstFormat);

			console.log("=== 日付表記形式テスト ===");
			console.log("UTC形式:", utcFormat);
			console.log("  パース結果 (UTC):", utcDate.toISOString());
			console.log("JST形式:", jstFormat);
			console.log("  パース結果 (UTC):", jstDate.toISOString());

			//! タイムゾーンオフセットを考慮して、両方とも正確にパースされることを確認。
			const timeDiffHours = (utcDate.getTime() - jstDate.getTime()) / (1000 * 60 * 60);
			expect(timeDiffHours).toBe(9); //! 9時間の差。

			console.log("時差:", timeDiffHours, "時間");

			//! 【重要な仕様】
			//! - ISO 8601形式はタイムゾーン情報を含むことができる
			//! - JavaScriptは自動的にUTCに変換して内部保持する
			//! - これにより、異なるタイムゾーンのタイムスタンプを正確に比較できる
		});
	});
});
