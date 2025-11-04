import { MemoEntry } from "../src/types";

describe("スレッド折りたたみ状態管理テスト", () => {
	//! テスト用のモックメモデータを作成。
	function createMockMemos(): MemoEntry[] {
		return [
			{
				id: "root",
				timestamp: "2025-11-04T10:00:00+09:00",
				content: "ルートメモ",
				category: "work",
				attachments: [],
				parentId: undefined,
				replyCount: 2,
			},
			{
				id: "child1",
				timestamp: "2025-11-04T10:10:00+09:00",
				content: "子メモ1",
				category: "work",
				attachments: [],
				parentId: "root",
				replyCount: 1,
			},
			{
				id: "child2",
				timestamp: "2025-11-04T10:20:00+09:00",
				content: "子メモ2",
				category: "work",
				attachments: [],
				parentId: "root",
				replyCount: 0,
			},
			{
				id: "grandchild1",
				timestamp: "2025-11-04T10:30:00+09:00",
				content: "孫メモ1",
				category: "work",
				attachments: [],
				parentId: "child1",
				replyCount: 0,
			},
		];
	}

	describe("折りたたみ状態の計算", () => {
		test("折りたたまれたスレッドの子孫メモIDが正しく計算される", () => {
			const memos = createMockMemos();
			const collapsedThreads = new Set(["root"]);

			//! childrenMapを構築。
			const childrenMap = new Map<string, string[]>();
			for (const memo of memos) {
				if (memo.parentId) {
					const siblings = childrenMap.get(memo.parentId) || [];
					siblings.push(memo.id);
					childrenMap.set(memo.parentId, siblings);
				}
			}

			//! 折りたたまれたスレッドの子孫を収集（BFS）。
			const hiddenIds = new Set<string>();
			for (const collapsedId of collapsedThreads) {
				const queue = [collapsedId];
				let head = 0;

				while (head < queue.length) {
					const currentId = queue[head++];
					const children = childrenMap.get(currentId) || [];

					for (const childId of children) {
						hiddenIds.add(childId);
						queue.push(childId);
					}
				}
			}

			//! rootの子孫（child1, child2, grandchild1）が非表示になる。
			expect(hiddenIds.has("child1")).toBe(true);
			expect(hiddenIds.has("child2")).toBe(true);
			expect(hiddenIds.has("grandchild1")).toBe(true);
			//! rootは非表示にならない（折りたたみボタンを持つメモ自体は表示）。
			expect(hiddenIds.has("root")).toBe(false);
		});

		test("child1だけ折りたたむとgrandchild1のみ非表示になる", () => {
			const memos = createMockMemos();
			const collapsedThreads = new Set(["child1"]);

			const childrenMap = new Map<string, string[]>();
			for (const memo of memos) {
				if (memo.parentId) {
					const siblings = childrenMap.get(memo.parentId) || [];
					siblings.push(memo.id);
					childrenMap.set(memo.parentId, siblings);
				}
			}

			const hiddenIds = new Set<string>();
			for (const collapsedId of collapsedThreads) {
				const queue = [collapsedId];
				let head = 0;

				while (head < queue.length) {
					const currentId = queue[head++];
					const children = childrenMap.get(currentId) || [];

					for (const childId of children) {
						hiddenIds.add(childId);
						queue.push(childId);
					}
				}
			}

			//! grandchild1のみ非表示。
			expect(hiddenIds.has("grandchild1")).toBe(true);
			//! その他は表示される。
			expect(hiddenIds.has("root")).toBe(false);
			expect(hiddenIds.has("child1")).toBe(false);
			expect(hiddenIds.has("child2")).toBe(false);
		});

		test("複数のスレッドを折りたたんだ場合、それぞれの子孫が非表示になる", () => {
			const memos = createMockMemos();
			const collapsedThreads = new Set(["root", "child1"]);

			const childrenMap = new Map<string, string[]>();
			for (const memo of memos) {
				if (memo.parentId) {
					const siblings = childrenMap.get(memo.parentId) || [];
					siblings.push(memo.id);
					childrenMap.set(memo.parentId, siblings);
				}
			}

			const hiddenIds = new Set<string>();
			for (const collapsedId of collapsedThreads) {
				const queue = [collapsedId];
				let head = 0;

				while (head < queue.length) {
					const currentId = queue[head++];
					const children = childrenMap.get(currentId) || [];

					for (const childId of children) {
						hiddenIds.add(childId);
						queue.push(childId);
					}
				}
			}

			//! rootとchild1の子孫がすべて非表示。
			expect(hiddenIds.has("child1")).toBe(true);
			expect(hiddenIds.has("child2")).toBe(true);
			expect(hiddenIds.has("grandchild1")).toBe(true);
		});

		test("折りたたまれていない場合、すべてのメモが表示される", () => {
			const memos = createMockMemos();
			const collapsedThreads = new Set<string>();

			const childrenMap = new Map<string, string[]>();
			for (const memo of memos) {
				if (memo.parentId) {
					const siblings = childrenMap.get(memo.parentId) || [];
					siblings.push(memo.id);
					childrenMap.set(memo.parentId, siblings);
				}
			}

			const hiddenIds = new Set<string>();
			for (const collapsedId of collapsedThreads) {
				const queue = [collapsedId];
				let head = 0;

				while (head < queue.length) {
					const currentId = queue[head++];
					const children = childrenMap.get(currentId) || [];

					for (const childId of children) {
						hiddenIds.add(childId);
						queue.push(childId);
					}
				}
			}

			//! すべてのメモが表示される。
			expect(hiddenIds.size).toBe(0);
		});
	});

	describe("折りたたみ状態のトグル", () => {
		test("折りたたみ状態をトグルできる", () => {
			const collapsedThreads = new Set<string>();

			//! 初期状態: 空。
			expect(collapsedThreads.has("root")).toBe(false);

			//! 折りたたむ。
			collapsedThreads.add("root");
			expect(collapsedThreads.has("root")).toBe(true);

			//! 展開。
			collapsedThreads.delete("root");
			expect(collapsedThreads.has("root")).toBe(false);
		});

		test("複数のスレッドを独立して折りたたみトグルできる", () => {
			const collapsedThreads = new Set<string>();

			//! child1を折りたたむ。
			collapsedThreads.add("child1");
			expect(collapsedThreads.has("child1")).toBe(true);
			expect(collapsedThreads.has("root")).toBe(false);

			//! rootを折りたたむ。
			collapsedThreads.add("root");
			expect(collapsedThreads.has("child1")).toBe(true);
			expect(collapsedThreads.has("root")).toBe(true);

			//! child1を展開。
			collapsedThreads.delete("child1");
			expect(collapsedThreads.has("child1")).toBe(false);
			expect(collapsedThreads.has("root")).toBe(true);
		});
	});

	describe("折りたたみ状態の配列変換", () => {
		test("Setから配列に変換できる", () => {
			const collapsedThreads = new Set(["root", "child1"]);
			const array = Array.from(collapsedThreads);

			expect(array).toContain("root");
			expect(array).toContain("child1");
			expect(array.length).toBe(2);
		});

		test("配列からSetに変換できる", () => {
			const array = ["root", "child1"];
			const collapsedThreads = new Set(array);

			expect(collapsedThreads.has("root")).toBe(true);
			expect(collapsedThreads.has("child1")).toBe(true);
			expect(collapsedThreads.size).toBe(2);
		});
	});

	describe("スレッド深さの計算", () => {
		test("parentIdから深さを正しく計算できる", () => {
			const memos = createMockMemos();
			const depthMap = new Map<string, number>();
			const parentMap = new Map<string, string>();

			//! parentMapを構築。
			for (const memo of memos) {
				if (memo.parentId) {
					parentMap.set(memo.id, memo.parentId);
				}
			}

			//! 各メモの深さを計算。
			for (const memo of memos) {
				let depth = 0;
				let currentId = memo.id;
				const visited = new Set<string>();

				while (parentMap.has(currentId)) {
					const parentId = parentMap.get(currentId);
					if (!parentId || visited.has(parentId)) {
						break;
					}
					visited.add(parentId);
					currentId = parentId;
					depth++;

					if (depth > 100) {
						break;
					}
				}

				depthMap.set(memo.id, depth);
			}

			//! 深さを確認。
			expect(depthMap.get("root")).toBe(0);
			expect(depthMap.get("child1")).toBe(1);
			expect(depthMap.get("child2")).toBe(1);
			expect(depthMap.get("grandchild1")).toBe(2);
		});

		test("循環参照がある場合でも無限ループにならない", () => {
			//! 循環参照を含むメモデータ。
			const memos: MemoEntry[] = [
				{
					id: "memo1",
					timestamp: "2025-11-04T10:00:00+09:00",
					content: "メモ1",
					category: "work",
					attachments: [],
					parentId: "memo2", //! 循環。
					replyCount: 0,
				},
				{
					id: "memo2",
					timestamp: "2025-11-04T10:10:00+09:00",
					content: "メモ2",
					category: "work",
					attachments: [],
					parentId: "memo1", //! 循環。
					replyCount: 0,
				},
			];

			const depthMap = new Map<string, number>();
			const parentMap = new Map<string, string>();

			for (const memo of memos) {
				if (memo.parentId) {
					parentMap.set(memo.id, memo.parentId);
				}
			}

			//! 各メモの深さを計算（visited Setで循環検出）。
			for (const memo of memos) {
				let depth = 0;
				let currentId = memo.id;
				const visited = new Set<string>();

				while (parentMap.has(currentId)) {
					const parentId = parentMap.get(currentId);
					if (!parentId || visited.has(parentId)) {
						break; //! 循環検出。
					}
					visited.add(parentId);
					currentId = parentId;
					depth++;

					if (depth > 100) {
						break;
					}
				}

				depthMap.set(memo.id, depth);
			}

			//! 無限ループにならず、適切な深さが計算される。
			expect(depthMap.get("memo1")).toBeDefined();
			expect(depthMap.get("memo2")).toBeDefined();
			//! 循環により深さは2で止まる（memo1->memo2->memo1で検出）。
			expect(depthMap.get("memo1")).toBe(2);
			expect(depthMap.get("memo2")).toBe(2);
		});
	});
});
