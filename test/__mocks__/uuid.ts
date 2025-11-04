// ! uuid モジュールのモック。

let mockCounter = 0

export function v4(): string {
	// ! テスト用に予測可能なUUIDを生成。
	return `mock-uuid-${mockCounter++}`
}

export function v7(): string {
	// ! テスト用に予測可能なUUID v7を生成。
	return `mock-uuid-v7-${mockCounter++}`
}

// ! テスト用: カウンタをリセット。
export function resetMockUuid(): void {
	mockCounter = 0
}
