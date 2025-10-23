import { Plugin } from "obsidian";

//! memologプラグインのメインクラス。
export default class MemologPlugin extends Plugin {
	//! プラグイン読み込み時の処理。
	override async onload() {
		console.log("memolog plugin loading...");

		//! TODO: 設定の読み込み。
		//! TODO: サイドバーUIの登録。
		//! TODO: コマンドの登録。

		console.log("memolog plugin loaded.");
	}

	//! プラグインアンロード時の処理。
	override onunload() {
		console.log("memolog plugin unloading...");
		//! TODO: クリーンアップ処理。
		console.log("memolog plugin unloaded.");
	}
}
