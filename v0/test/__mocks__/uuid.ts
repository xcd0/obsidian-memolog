//! uuid モジュールのモック。

let mockCounter = 0;

export function v4(): string {
	//! テスト用に予測可能なUUIDを生成。
	return `mock-uuid-${mockCounter++}`;
}

//! テスト用: カウンタをリセット。
export function resetMockUuid(): void {
	mockCounter = 0;
}
