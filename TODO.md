# memolog 実装TODO リスト

最終更新: 2025-01-23
バージョン: v0.4 実装中

---

## 実装状況サマリー

### v0.1 基盤実装 ✅ **完了**
- 型定義 (MemoEntry, CategoryConfig, GlobalSettings, etc.)
- SettingsManager (設定管理)
- TagManager (HTMLコメントタグ管理)
- VaultHandler (ファイルアクセス基盤)
- MemoManager (メモ管理)
- PathGenerator (ファイルパス生成)
- ユニットテスト (57件)

### v0.2 UI基盤実装 ✅ **完了**
- MemologSidebar (サイドバーUI)
- MemoCard (メモカードコンポーネント)
- MemoList (メモリスト表示)
- InputForm (入力欄UI)
- ButtonBar (ボタン群)
- メモ追加・削除機能
- 昇順/降順切替機能
- スタイリング (styles.css)

### v0.3 高度なUI機能 ✅ **完了**
- CategoryTabs (カテゴリタブUI)
- CalendarView (カレンダー表示・日付フィルタ)
- 添付ファイル処理 (画像プレビュー、ファイルリンク)
- Daily Notes連携 (Daily Noteへのメモ追加)

### v0.4 設定UI ✅ **完了**
- SettingsTab (設定画面UI)
  - 基本設定 (ルートディレクトリ、保存単位、ソート順、etc.)
  - カテゴリ管理 (追加・編集・削除)
  - Daily Notes連携設定
  - デフォルトカテゴリ設定

### v0.4 キャッシュ最適化 ✅ **完了**
- CacheManager (キャッシュ管理)
  - LRUキャッシュ実装
  - メモリスト読み込みキャッシュ
  - ファイル変更検知によるキャッシュ無効化
  - 設定キャッシュ
  - MemoManagerへの統合

### v0.4 残タスク (アーキテクチャ改善)
- [ ] ファイルアクセス層完全分離
- [ ] 複数カテゴリ領域完全対応
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング強化

---

## 凡例
- [ ] 未着手
- [!] 進行中
- [x] 完了
- [?] 保留・要検討

---

## 0. プロジェクト初期設定

### 0.1 開発環境構築
- [ ] Node.js/npm環境確認
- [ ] TypeScript開発環境セットアップ
- [ ] Obsidian Plugin開発用ボイラープレート導入
- [ ] package.json作成 (必要な依存関係を定義)
- [ ] tsconfig.json作成 (strict mode有効化)
- [ ] .gitignore作成
- [ ] ESLint/Prettier設定

### 0.2 ビルド環境構築
- [ ] Rollup設定ファイル作成
- [ ] 開発用ホットリロード環境構築 (npm run dev)
- [ ] ビルドスクリプト作成 (npm run build)
- [ ] テスト環境構築 (Jest設定)

### 0.3 プロジェクト構造作成
- [ ] ディレクトリ構造作成
  - [ ] `src/` ルートディレクトリ
  - [ ] `src/ui/` UI層
  - [ ] `src/core/` ロジック層
  - [ ] `src/fs/` ファイルアクセス層
  - [ ] `src/types/` 型定義
  - [ ] `src/utils/` ユーティリティ
  - [ ] `test/` テストコード
  - [ ] `docs/` ドキュメント

### 0.4 基本ファイル作成
- [ ] main.ts (プラグインエントリーポイント)
- [ ] manifest.json (Obsidianプラグイン定義)
- [ ] LICENSE (MIT)
- [ ] README.md (ユーザー向け)
- [ ] CONTRIBUTING.md (開発者向け)

---

## v0.1 基盤実装

### 1.1 型定義 (src/types/)
- [ ] MemoEntry型定義
  ```ts
  interface MemoEntry {
    id: string;
    category: string;
    timestamp: string;
    content: string;
    attachments?: string[];
  }
  ```
- [ ] CategoryConfig型定義
  ```ts
  interface CategoryConfig {
    name: string;
    directory: string;
    color: string;
    icon: string;
  }
  ```
- [ ] GlobalSettings型定義
  ```ts
  interface GlobalSettings {
    useDirectoryCategory: boolean;
    categories: CategoryConfig[];
    defaultCategory: string;
    saveUnit: 'day' | 'week' | 'month' | 'year' | 'all';
    order: 'asc' | 'desc';
    enableDailyNotes: boolean;
  }
  ```
- [ ] LocalSettings型定義
  ```ts
  interface LocalSettings {
    template?: string;
    order?: 'asc' | 'desc';
    attachmentPath?: string;
    pathFormat?: string;
  }
  ```
- [ ] MemoTemplate型定義
  ```ts
  interface MemoTemplate {
    titleFormat: string;
    bodyFormat: string;
    includeTimestamp: boolean;
  }
  ```

### 1.2 設定ファイル管理 (src/core/settings.ts)
- [ ] SettingsManager クラス作成
- [ ] デフォルト設定定義
- [ ] global-setting.json読み込み機能
- [ ] setting.json (ローカル) 読み込み機能
- [ ] 設定マージロジック実装
- [ ] 設定保存機能
- [ ] 設定バリデーション機能
- [ ] JSON Schema定義と検証

### 1.3 memologタグ管理 (src/core/tag-manager.ts)
- [ ] TagManager クラス作成
- [ ] `<!-- memolog: start category="xxx" -->` 挿入機能
- [ ] `<!-- memolog: end -->` 挿入機能
- [ ] タグペア検証機能
- [ ] カテゴリ属性パース機能
- [ ] メタデータコメント `<!-- memolog: {...} -->` パース機能

### 1.4 ファイルアクセス基盤 (src/fs/vault-handler.ts)
- [ ] MemologVaultHandler クラス作成
- [ ] ファイル存在確認機能
- [ ] ファイル生成機能
- [ ] ファイル読み込み機能
- [ ] ファイル書き込み機能
- [ ] ファイルロック機構
- [ ] 非同期I/O制御

### 1.5 単一カテゴリメモ管理 (src/core/memo-manager.ts)
- [ ] MemoManager クラス作成
- [ ] メモ追加機能 (単一カテゴリ)
- [ ] メモ削除機能
- [ ] メモ取得機能
- [ ] タイムスタンプ生成機能
- [ ] 昇順/降順挿入ロジック

### 1.6 テスト (test/v0.1/)
- [ ] SettingsManager ユニットテスト
- [ ] TagManager ユニットテスト
- [ ] MemologVaultHandler モックテスト
- [ ] MemoManager ユニットテスト

---

## v0.2 UI基盤実装

### 2.1 サイドバーUI基盤 (src/ui/sidebar.ts)
- [ ] MemologSidebar クラス作成
- [ ] Obsidian ItemView 継承
- [ ] サイドバー登録・表示機能
- [ ] 基本レイアウト構築 (HTML/CSS)
- [ ] リアクティブステート管理導入

### 2.2 メモカードUI (src/ui/components/memo-card.ts)
- [ ] MemoCard コンポーネント作成
- [ ] カード表示ロジック
- [ ] カードスタイリング (CSS)
- [ ] カード内容レンダリング
- [ ] 日付表示フォーマット
- [ ] 添付情報表示 (アイコン)

### 2.3 メモリスト表示 (src/ui/components/memo-list.ts)
- [ ] MemoList コンポーネント作成
- [ ] メモ一覧取得・表示
- [ ] 空状態UI ("メモがありません")
- [ ] ローディングUI

### 2.4 入力欄UI (src/ui/components/input-form.ts)
- [ ] InputForm コンポーネント作成
- [ ] テキストエリア実装
- [ ] 送信ボタン実装
- [ ] キーボードショートカット (Ctrl+Enter等)
- [ ] 入力内容クリア機能

### 2.5 ボタン群UI (src/ui/components/button-bar.ts)
- [ ] ButtonBar コンポーネント作成
- [ ] 昇順/降順切替ボタン
- [ ] カレンダーボタン (プレースホルダー)
- [ ] 設定ボタン
- [ ] アイコン設定 (Lucide icons使用)

### 2.6 基本操作統合
- [ ] メモ追加処理とUIの接続
- [ ] メモ削除処理とUIの接続 (カードに削除ボタン追加)
- [ ] 昇順/降順切替とメモリスト更新
- [ ] エラーハンドリングとユーザー通知 (Notice API)

### 2.7 スタイリング (styles.css)
- [ ] グローバルスタイル定義
- [ ] カードデザイン
- [ ] ボタンデザイン
- [ ] レスポンシブ対応 (モバイル考慮)
- [ ] ダークモード対応

### 2.8 テスト (test/v0.2/)
- [ ] MemoCard レンダリングテスト
- [ ] MemoList 表示テスト
- [ ] InputForm 動作テスト
- [ ] ボタン操作テスト

---

## v0.3 高度なUI機能 ✅ **完了**

### 3.1 カレンダー表示機能 (src/ui/components/calendar-view.ts)
- [x] Calendar コンポーネント作成
- [x] 月表示カレンダー実装
- [x] 日付選択機能
- [x] 選択日のメモフィルタリング
- [x] メモ数インジケーター表示
- [x] 月ナビゲーション機能

### 3.2 カテゴリタブUI (src/ui/components/category-tabs.ts)
- [x] CategoryTabs コンポーネント作成
- [x] タブ表示 (カテゴリ名・色・アイコン)
- [x] タブ切替機能
- [x] アクティブタブハイライト
- [x] カテゴリ別メモフィルタリング

### 3.3 添付ファイル処理 (InputForm, MemoCard統合)
- [x] 添付ファイルパス解決
- [x] 画像添付対応 (プレビュー表示)
- [x] ファイル添付対応 (リンク表示)
- [x] 添付ファイルコピー機能 (Vaultへのアップロード)
- [ ] 添付ファイル削除機能 (未実装)
- [ ] ドラッグ&ドロップ対応 (未実装)

### 3.4 date命名対応 (src/core/path-generator.ts)
- [ ] PathGenerator クラス作成
- [ ] pathFormat設定パース機能
- [ ] %Y, %m, %d, %H, %M, %S 置換処理
- [ ] ディレクトリ自動生成
- [ ] ファイル名衝突回避ロジック

### 3.5 複数カテゴリ領域対応準備
- [ ] ファイル内複数 `start/end` ペア検出
- [ ] カテゴリ別領域マッピング
- [ ] カテゴリ指定メモ追加

### 3.6 テスト (test/v0.3/)
- [ ] Calendar 機能テスト
- [ ] CategoryTabs 動作テスト
- [ ] AttachmentManager テスト
- [ ] PathGenerator テスト

---

## v0.4 設定UI & アーキテクチャ改善

### 4.0 設定UI (src/ui/settings-tab.ts) ✅ **完了**
- [x] SettingsTab クラス作成
- [x] 基本設定UI実装
  - [x] ルートディレクトリ設定
  - [x] 保存単位設定 (day/week/month/year/all)
  - [x] ソート順設定 (asc/desc)
  - [x] ディレクトリカテゴリ分離設定
  - [x] Daily Notes連携設定
  - [x] デフォルトカテゴリ設定
- [x] カテゴリ管理UI実装
  - [x] カテゴリ追加機能
  - [x] カテゴリ編集機能 (名前、ディレクトリ、色、アイコン)
  - [x] カテゴリ削除機能
- [x] main.tsへの設定タブ登録
- [x] refreshSidebarメソッド実装

### 4.1 ファイルアクセス層完全分離 (src/fs/)
- [ ] MemologVaultHandler リファクタリング
- [ ] コメントタグ構造解析機能強化
- [ ] start/endペア整合性チェック機能
- [ ] メモ挿入位置判定ロジック (昇順・降順・カテゴリ別)
- [ ] エラーリカバリー機能 (タグ修復等)

### 4.2 複数カテゴリ領域完全対応
- [ ] 同一ファイル内複数カテゴリメモ管理
- [ ] カテゴリ別メモ挿入
- [ ] カテゴリ別メモ取得
- [ ] カテゴリ別メモ削除
- [ ] カテゴリ間メモ移動機能

### 4.3 キャッシュ最適化 (src/core/cache-manager.ts) ✅ **完了**
- [x] CacheManager クラス作成
- [x] メモリスト読み込みキャッシュ
- [x] カテゴリ設定キャッシュ
- [x] キャッシュ無効化ロジック (ファイル変更検知)
- [x] LRUキャッシュ実装
- [x] MemoManagerへの統合
- [x] テスト作成 (test/cache-manager.test.ts)

### 4.4 パフォーマンス最適化
- [ ] ファイルI/O非同期処理最適化
- [ ] 大量メモ読み込み処理の最適化
- [ ] 不要な再レンダリング防止
- [ ] debounce/throttle適用 (入力処理等)

### 4.5 エラーハンドリング強化
- [ ] 統一エラーハンドリング機構
- [ ] ファイルI/Oエラー処理
- [ ] 設定ファイル読み込みエラー処理
- [ ] ユーザーへのエラー通知改善

### 4.6 テスト (test/v0.4/)
- [ ] 複数カテゴリ管理テスト
- [ ] CacheManager テスト
- [ ] パフォーマンステスト (大量メモ生成スクリプト作成)
- [ ] エラーハンドリングテスト

---

## v0.5 UX改善と高度な機能

### 5.1 型安全テンプレート管理 (src/core/template-manager.ts)
- [ ] TemplateManager クラス作成
- [ ] テンプレート型定義強化
- [ ] テンプレート構文バリデーション
- [ ] 不正テンプレートのフォールバック処理
- [ ] テンプレート変数展開機能
- [ ] カスタム変数対応

### 5.2 テンプレート設定UI (src/ui/components/template-editor.ts)
- [ ] TemplateEditor コンポーネント作成
- [ ] フォームベーステンプレート編集
- [ ] プレビュー機能
- [ ] 構文ハイライト
- [ ] エラー表示

### 5.3 インフィニティスクロール (src/ui/components/infinite-scroll.ts)
- [ ] InfiniteScroll コンポーネント作成
- [ ] 仮想スクロール実装 (react-window等参考)
- [ ] ページネーション処理
- [ ] 遅延ロード機能
- [ ] スクロール位置保持

### 5.4 検索機能 (src/ui/components/search-bar.ts)
- [ ] SearchBar コンポーネント作成
- [ ] 全文検索機能
- [ ] 日付範囲検索
- [ ] カテゴリフィルタ
- [ ] タグ検索 (将来拡張)

### 5.5 メモ編集機能
- [ ] メモ内容編集UI (インライン編集)
- [ ] 編集モード切替
- [ ] 変更保存処理
- [ ] 編集履歴管理 (オプション)

### 5.6 エクスポート機能 (src/core/exporter.ts)
- [ ] Exporter クラス作成
- [ ] Markdown形式エクスポート
- [ ] JSON形式エクスポート
- [ ] 期間指定エクスポート
- [ ] カテゴリ指定エクスポート

### 5.7 UX改善
- [ ] ローディングアニメーション追加
- [ ] スムーズスクロール
- [ ] トースト通知デザイン改善
- [ ] キーボードショートカット拡充
- [ ] アクセシビリティ対応 (ARIA属性等)

### 5.8 テスト (test/v0.5/)
- [ ] TemplateManager テスト
- [ ] InfiniteScroll パフォーマンステスト
- [ ] 検索機能テスト
- [ ] エクスポート機能テスト

---

## v0.6 安定版リリース準備

### 6.1 ディレクトリカテゴリ設定切替
- [ ] useDirectoryCategory設定の完全実装
- [ ] true時: ディレクトリ分離モード動作確認
- [ ] false時: 単一ディレクトリモード動作確認
- [ ] モード切替時のマイグレーション機能

### 6.2 ローカル設定上書き対応
- [ ] ローカルsetting.json読み込み完全対応
- [ ] グローバル設定とのマージ処理確認
- [ ] 設定優先順位の明確化
- [ ] 設定UIでのローカル設定編集機能

### 6.3 Daily Notes連携
- [ ] enableDailyNotes設定実装
- [ ] Daily Notesファイルへのメモ保存
- [ ] Daily Notesテンプレート対応
- [ ] Daily Notesプラグインとの互換性確認

### 6.4 設定UI完全実装 (src/ui/settings-tab.ts)
- [ ] SettingsTab クラス作成
- [ ] グローバル設定編集UI
- [ ] カテゴリ管理UI (追加・編集・削除)
- [ ] テンプレート設定UI統合
- [ ] 設定インポート/エクスポート機能

### 6.5 ドキュメント整備
- [ ] ユーザーマニュアル作成 (docs/user-manual.md)
- [ ] 開発者ガイド作成 (docs/developer-guide.md)
- [ ] API仕様書作成 (docs/api-reference.md)
- [ ] トラブルシューティングガイド作成
- [ ] サンプル設定ファイル集

### 6.6 品質保証
- [ ] 全機能統合テスト
- [ ] パフォーマンステスト (大量メモ: 1000件以上)
- [ ] モバイル動作確認
- [ ] クロスプラットフォーム動作確認 (Windows/Mac/Linux)
- [ ] メモリリーク確認
- [ ] セキュリティ監査 (ファイルアクセス権限等)

### 6.7 リリース準備
- [ ] バージョン番号確定 (v1.0.0-beta)
- [ ] CHANGELOG.md作成
- [ ] リリースノート作成
- [ ] Community Plugins申請準備
- [ ] デモ動画作成
- [ ] スクリーンショット準備

### 6.8 最終テスト (test/v0.6/)
- [ ] リグレッションテスト全実行
- [ ] ベータテスター募集・フィードバック収集
- [ ] バグ修正
- [ ] パフォーマンスチューニング

---

## v1.0 以降の拡張機能 (将来計画)

### 将来拡張案
- [ ] タグ機能 (#tag形式)
- [ ] メモ間リンク機能
- [ ] メモのピン留め機能
- [ ] メモの色分け・ラベル機能
- [ ] リマインダー機能
- [ ] 統計ダッシュボード (メモ数推移等)
- [ ] 複数Vault対応
- [ ] クラウド同期対応
- [ ] モバイル専用UI最適化
- [ ] 音声入力対応
- [ ] OCR機能 (画像からテキスト抽出)
- [ ] AI要約機能統合

---

## 開発ガイドライン

### コーディング規約
- TypeScript strict mode必須
- インデントはtab使用
- コメントは日本語、doxygen形式 (`//!`)
- 関数は必ず分割し、main関数から呼び出す構造
- エラーハンドリングを適切に実装

### Git運用
- ブランチ戦略: Git Flow準拠
  - `main`: 安定版
  - `develop`: 開発版
  - `feature/xxx`: 機能開発
  - `hotfix/xxx`: 緊急修正
- コミットメッセージ: Angular Conventional Commit (日本語)
  - `feat: カレンダー表示機能を追加`
  - `fix: メモ削除時のバグを修正`
  - `docs: README更新`

### テスト方針
- 単体テスト: 各クラス・関数ごとに実装
- 統合テスト: UI操作フロー全体をテスト
- カバレッジ目標: 80%以上

---

## 進捗管理

### マイルストーン
- [ ] v0.1完了 (目標: 2週間)
- [ ] v0.2完了 (目標: 2週間)
- [ ] v0.3完了 (目標: 3週間)
- [ ] v0.4完了 (目標: 2週間)
- [ ] v0.5完了 (目標: 3週間)
- [ ] v0.6完了 (目標: 2週間)
- [ ] v1.0 リリース (目標: 合計14週間 ≒ 3.5ヶ月)

### レビューポイント
- 各バージョン完了時にコードレビュー実施
- 設計ドキュメントとの整合性確認
- パフォーマンス測定
- ユーザビリティテスト

---

## 参考資料

### Obsidian API
- [Obsidian API Documentation](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)

### 技術スタック
- TypeScript 4.9+
- Rollup (ビルド)
- Jest (テスト)
- ESLint + Prettier (リント・フォーマット)

### 設計パターン
- MVC (Model-View-Controller)
- Repository Pattern (ファイルアクセス層)
- Strategy Pattern (設定管理)
