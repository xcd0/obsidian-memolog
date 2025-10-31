# memolog 実装TODO リスト

最終更新: 2025-10-31
バージョン: v0.0.11 (開発中)

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

### v0.4 ファイルアクセス層強化 ✅ **完了**
- TagManager強化
  - 重複カテゴリ検出
  - 強化版整合性チェック (warnings追加)
  - repairTagPairs() - 自動修復機能
  - getAllTagPairs() - 複数カテゴリ対応
- VaultHandler強化
  - repairTagPairs() - バックアップ付き修復
  - getAllCategories() - 全カテゴリ取得
  - getMultipleCategoryContents() - 複数カテゴリ一括取得
  - safeReadFile()/safeWriteFile() - エラーハンドリング強化

### v0.4 パフォーマンス最適化 ✅ **完了**
- src/utils/performance.ts
  - debounce/throttle/rafDebounce実装
  - memoize関数
  - batch処理関数
- InputFormへのdebounce適用

### v0.4 エラーハンドリング強化 ✅ **完了**
- src/core/error-handler.ts
  - ErrorHandler統一機構
  - MemologError/FileIOError/ValidationError/ParseError/ConfigurationError
  - wrap/wrapSyncメソッド
  - エラーログ管理
- src/utils/notification-manager.ts
  - NotificationManager (シングルトン)
  - 重複通知防止
  - 通知履歴管理
- MemoManager/InputFormへのエラーハンドリング統合

### v0.0.5 UX改善機能 ✅ **完了**
- 検索機能 (SearchEngine)
  - 全文検索、日付範囲フィルタ、カテゴリフィルタ
  - 大文字小文字区別オプション
  - 検索クエリの型安全性
- メモ編集機能
  - インライン編集UI
  - 編集モード切替
  - 変更保存処理
- エクスポート機能 (Exporter)
  - Markdown/JSON/CSV形式対応
  - 日付範囲・カテゴリ指定エクスポート
  - ファイルエンコーディング対応
- テンプレート管理 (TemplateManager)
  - カスタマイズ可能なメモテンプレート
  - テンプレート構文バリデーション
  - デフォルトテンプレートフォールバック

### v0.0.6 リリース準備 ✅ **完了**
- テストカバレッジ測定環境構築
  - jest --coverage設定
  - カバレッジ閾値設定 (70%以上)
  - UI/types除外設定
- テストカバレッジ達成
  - 73.92% statements (目標70%達成)
  - 67.63% branches
  - 77.82% functions
  - 73.55% lines
- ドキュメント整備
  - README.md更新 (v0.5機能追加)
  - テストカバレッジ統計追加
  - スクリプトコマンド文書化

### v0.0.7 高度な機能 ✅ **完了**
- メモ間リンク機能 (LinkManager)
  - `[[memo-id]]` と `[[memo-id|text]]` 形式のリンク抽出
  - バックリンク取得 (メモを参照している全メモ)
  - リンクグラフ構築 (メモ間参照関係の可視化)
  - 孤立メモ検出 (リンクなし・参照なし)
  - リンク切れ検出 (存在しないメモへのリンク)
  - リンクハイライト表示 (HTML変換)
- 検索履歴管理 (SearchHistory)
  - 検索クエリ履歴の保存 (タイムスタンプ・結果数付き)
  - 履歴サイズ管理 (デフォルト50件、設定可能)
  - 重複クエリの自動排除 (最新を保持)
  - 頻繁な検索・最近の検索の取得
  - JSON形式でのエクスポート/インポート
  - 統計情報 (総検索数、ユニーク数、平均結果数)
- タグ管理UIパネル (TagPanel)
  - タグ一覧表示 (使用回数バッジ付き)
  - タグフィルタリング (検索ボックス)
  - タグソート (名前順・回数順)
  - タグCRUD操作 (作成・名前変更・削除)
  - タグ統計情報表示
  - カラーインジケーター対応
- テスト追加
  - link-manager.test.ts (46テストケース)
  - search-history.test.ts (複数テストケース)
  - 総テスト数: 219件 (v0.0.6: 173件 → v0.0.7: 219件)

### v0.0.8 UI/UX洗練 ✅ **完了**
- 設定画面拡充 (SettingsTab)
  - 「高度な機能」セクション追加
  - 検索履歴設定 (有効化トグル、最大サイズスライダー 1-100)
  - メモ間リンク設定 (有効化、孤立メモ警告、リンク切れチェック)
  - タグ管理設定 (パネル表示、自動補完)
- カテゴリ変更機能 (MemoCard)
  - カテゴリ変更ボタン追加（現在のカテゴリアイコン表示）
  - カテゴリ選択ドロップダウンメニュー
  - メモのカテゴリ間移動機能（古いファイルから削除→新しいファイルに追加）
  - カテゴリ変更メニューのスタイリング
- 検索機能強化 (SearchBar, SearchEngine, Sidebar)
  - 日付範囲検索の改善（範囲内の全日付のファイルを検索対象に）
  - 「過去全て」検索プリセット追加（1970年1月1日から今日まで）
  - 検索バーUI全面改善
    - 検索入力欄のスタイリング（アイコン、フォーカス効果）
    - 詳細検索オプションのレイアウト改善
    - プリセットボタンのグリッド表示とホバーアニメーション
    - 日付入力・カテゴリ選択のスタイル統一
- コード品質向上
  - 非同期ハンドラー最適化 (不要なasync削除)
  - lintエラー0件、警告3件のみ (non-null assertion)
- 総合テスト
  - 全テスト219件パス
  - カバレッジ: 73.92% statements, 67.63% branches, 77.82% functions, 73.55% lines
  - ビルド成功

### v0.0.9 ゴミ箱機能とUI/UX改善 ✅ **完了**
- ゴミ箱機能
  - 削除メモの一時保管機能
  - ゴミ箱専用タブ
  - 保持期間設定 (デフォルト30日)
  - 設定画面に専用タブ追加
- ピン留め機能の改善
  - ピン留めタブへの投稿表示修正
  - ソート変更時のピン状態維持
  - 日付フィルタ適用時のピン留め投稿表示
- 日付範囲フィルタの改善
  - 「今日」「一週間」ボタン両方OFF時に全期間表示
  - 初期状態を全期間表示に変更
- パス変換機能の改善
  - バックアップのみ実行ボタン追加
  - 変換予定の全件表示 (スクロール可能)
  - 特別なファイルの自動除外
  - Git検出ロジックの修正
- UI/UX改善
  - カテゴリ設定タブの表示順序変更
  - デフォルトカテゴリ設定のアイコン色改善
  - ピン留めタブのラベル削除
  - ピン留めボタンの透明度調整
- 総合テスト
  - 全テスト392件パス
  - カバレッジ: 66.98% statements, 59.24% branches

### v0.0.10 コード品質向上とドキュメント整備 ✅ **完了**

**方針**: v0.1.0に向けた既存機能のブラッシュアップ。新機能の追加は行わず、v0.0.9の機能の未熟な部分を改善。

- ESLintエラー修正
  - [x] ESLint auto-fixで修正可能なエラーを修正 (18件)
  - [x] Floating Promiseの修正 (1件)
  - [x] 不要な型アサーションの削除 (auto-fix)
  - [x] const宣言の修正 (2件)
  - [x] 不要なasyncの削除 (3件)
  - [x] エスケープ文字の修正 (4件)
  - [x] Promise処理の一部修正
- ドキュメント整備
  - [x] TODO.mdをv0.0.10の方針に更新
  - [x] README.mdをv0.0.10に更新
  - [x] SPEC_v0.0.10.mdを作成
- テスト
  - [x] 全テスト392件パス
  - [x] ビルド成功
  - [x] カバレッジ確認 (66.98% statements)

### v0.0.11 大規模リファクタリングとテスト拡充 ✅ **完了**

**方針**: コードの保守性とテスト容易性を大幅に改善。I/O操作と業務ロジックを分離し、純粋関数として抽出。

- 大規模リファクタリング
  - [x] memo-manager.ts のリファクタリング (610行 → 442行, -27.5%)
    - [x] memo-crud-operations.ts 抽出 (8関数, 40テスト, 100%カバレッジ)
    - [x] memo-trash-operations.ts 抽出 (8関数, 33テスト, 100%カバレッジ)
    - [x] memo-query-operations.ts 抽出 (13関数, 44テスト, 100%カバレッジ)
  - [x] path-migrator.ts のリファクタリング (497行 → 460行, -7.4%)
    - [x] memo-split-operations.ts 抽出 (5関数, 23テスト, 100%カバレッジ)
  - [x] cache-manager.ts のリファクタリング (210行 → 115行, -45.2%)
    - [x] cache/lru-cache.ts 抽出 (LRUCache実装, 24テスト, 100%カバレッジ)
  - [x] tag-manager.ts のテスト拡充 (88.46% → 100%, +12テスト)

- テスト拡充
  - [x] 総テスト数: 527件 → 703件 (+176件, +33.4%)
  - [x] 全体カバレッジ: 88.4% → 91.89% (+3.49%)
  - [x] 100%カバレッジモジュール: 5個追加
    - [x] memo-crud-operations.ts
    - [x] memo-trash-operations.ts
    - [x] memo-query-operations.ts
    - [x] memo-split-operations.ts
    - [x] cache/lru-cache.ts
    - [x] tag-manager.ts

- ドキュメント整備
  - [x] README.md をv0.0.11に更新
  - [x] TESTING_GUIDE.md を新規作成
  - [x] TODO.md をv0.0.11に更新

### v0.0.12 UI/UX改善と機能拡張 [ ] **未着手**

**方針**: ユーザー体験の向上とファイル管理の柔軟性向上。

- UI/UX改善 (優先度: 高)
  - [ ] ゴミ箱タブのラベルから「ゴミ箱」の文字列を削除
  - [ ] ログ出力の抑制機能追加
  - [ ] Ctrl+Enterでも送信できるように改善 (現在はShift+Enterのみ)
  - [ ] カード表示のチェックボックスクリック機能の拡張
    - [ ] todoリストオプションにかかわらず全カテゴリで有効化
    - [ ] クリック時に元ファイルの`- [ ]`を`- [x]`に変更

- ファイルパス書式の追加 (優先度: 高)
  - [ ] 新規書式 `%Y%m%d-%C.md` の実装 (日別+カテゴリ形式)
    - [ ] PathFormat型に追加
    - [ ] 設定画面のドロップダウンに追加
    - [ ] path-generator.ts の拡張 (%C置換対応)
    - [ ] テストケース追加 (10個程度)
  - [ ] 設定画面の選択肢の並び順最適化
    - [ ] 使用頻度の高い順に並び替え
    - [ ] 説明文の充実とプレビュー機能追加

- 保存単位の追加 (優先度: 中)
  - [ ] 新規保存単位「1投稿毎」の実装
    - [ ] SaveUnit型に "per-memo" を追加
    - [ ] path-generator.ts のgenerateMemoPath()拡張
    - [ ] memo-manager.ts の対応
    - [ ] テストケース追加 (15個程度)
    - [ ] 設定画面に警告文追加 (ファイル数増加の注意)

- 設定画面の改善 (優先度: 中)
  - [ ] セクション見出しの追加 (ファイル管理、メモ表示、カテゴリ管理)
  - [ ] カスタム書式のバリデーション追加
  - [ ] リアルタイムフィードバック機能
  - [ ] プレビュー表示機能

- コード品質向上
  - [ ] path-migrator.ts のテスト追加 (0% → 30-40%)
  - [ ] 残りのESLintエラー修正

- ドキュメント整備
  - [ ] ARCHITECTURE.md の作成
  - [ ] README.md を v0.0.12 に更新
  - [ ] CHANGELOG.md の作成
  - [ ] マイグレーションガイドの作成

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

## v0.1.0 基盤実装 (正式版に向けて)

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
- [ ] memolog-setting.json読み込み機能
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

### 4.1 ファイルアクセス層完全分離 (src/fs/) ✅ **完了**
- [x] MemologVaultHandler リファクタリング
- [x] コメントタグ構造解析機能強化
- [x] start/endペア整合性チェック機能 (warnings追加)
- [x] メモ挿入位置判定ロジック (昇順・降順・カテゴリ別)
- [x] エラーリカバリー機能 (タグ修復・バックアップ)

### 4.2 複数カテゴリ領域完全対応 ✅ **完了**
- [x] 同一ファイル内複数カテゴリメモ管理
- [x] カテゴリ別メモ挿入
- [x] カテゴリ別メモ取得
- [x] カテゴリ別メモ削除
- [x] 全カテゴリ一括取得 (getAllCategories)
- [x] 複数カテゴリ一括取得 (getMultipleCategoryContents)

### 4.3 キャッシュ最適化 (src/core/cache-manager.ts) ✅ **完了**
- [x] CacheManager クラス作成
- [x] メモリスト読み込みキャッシュ
- [x] カテゴリ設定キャッシュ
- [x] キャッシュ無効化ロジック (ファイル変更検知)
- [x] LRUキャッシュ実装
- [x] MemoManagerへの統合
- [x] テスト作成 (test/cache-manager.test.ts)

### 4.4 パフォーマンス最適化 ✅ **完了**
- [x] ファイルI/O非同期処理最適化 (CacheManager)
- [x] 大量メモ読み込み処理の最適化 (LRUキャッシュ)
- [ ] 不要な再レンダリング防止 (UIコンポーネント最適化 - 保留)
- [x] debounce/throttle適用 (InputForm)

### 4.5 エラーハンドリング強化 ✅ **完了**
- [x] 統一エラーハンドリング機構 (ErrorHandler)
- [x] ファイルI/Oエラー処理 (FileIOError, VaultHandler)
- [x] 設定ファイル読み込みエラー処理 (ConfigurationError)
- [x] ユーザーへのエラー通知改善 (NotificationManager)

### 4.6 テスト (test/v0.4/) ✅ **完了**
- [x] 複数カテゴリ管理テスト (tag-manager.test.ts)
- [x] CacheManager テスト (cache-manager.test.ts - 8テスト)
- [x] パフォーマンステスト (performance.test.ts - 9テスト)
- [x] エラーハンドリングテスト (error-handler.test.ts - 28テスト)
- [x] NotificationManagerテスト (notification-manager.test.ts - 13テスト)

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

## Obsidian Community Plugins 提出準備チェックリスト

### 必須ファイル (Before you begin)
- [ ] README.md - プラグインの目的と使い方を記述
- [ ] LICENSE - ライセンスファイル (MIT推奨)
- [ ] manifest.json - プラグイン定義ファイル
  - [ ] `id` - ユニーク、"obsidian"を含まない
  - [ ] `name` - プラグイン名
  - [ ] `author` - 作者名
  - [ ] `description` - 短く簡潔な説明 (最大250文字、ピリオドで終わる)
  - [ ] `version` - Semantic Versioning (x.y.z形式)
  - [ ] `minAppVersion` - 最小互換Obsidianバージョン
  - [ ] `isDesktopOnly` - Node.js/Electron API使用時はtrue

### GitHub リリース準備 (Step 2)
- [ ] GitHubリポジトリ作成・公開
- [ ] manifest.jsonのバージョンを更新 (例: 1.0.0)
- [ ] GitHubリリースを作成
  - [ ] タグバージョンがmanifest.jsonと一致
  - [ ] リリース名と説明を記入
  - [ ] 以下のファイルをバイナリ添付:
    - [ ] main.js
    - [ ] manifest.json
    - [ ] styles.css (使用している場合)

### 提出準備 (Step 3)
- [ ] community-plugins.jsonにエントリ追加
  - [ ] `id` - manifest.jsonと一致、ユニーク
  - [ ] `name` - manifest.jsonと一致
  - [ ] `author` - manifest.jsonと一致
  - [ ] `description` - manifest.jsonと一致
  - [ ] `repo` - GitHubリポジトリパス (例: username/repo-name)
- [ ] Pull Request作成
  - [ ] タイトル: "Add plugin: [プラグイン名]"
  - [ ] チェックボックスをすべて確認
- [ ] bot検証通過を待つ (Ready for reviewラベル)

### プラグインガイドライン - 一般

#### 必須対応項目
- [ ] グローバルappインスタンスを使用しない (this.app を使用)
- [ ] 不要なconsole.logを削除 (デバッグメッセージは削除)
- [ ] プレースホルダークラス名を変更 (MyPlugin, MyPluginSettings等)
- [ ] サンプルコードをすべて削除

#### 推奨対応項目
- [ ] フォルダを使用してコードベースを整理

### プラグインガイドライン - モバイル対応
- [ ] Node.js/Electron APIを使用していないか確認
  - [ ] fs, crypto, os等のNode.jsパッケージ不使用
  - [ ] 使用している場合は`isDesktopOnly: true`を設定
- [ ] 正規表現でlookbehindを使用している場合、iOS 16.4以下の対応確認
- [ ] モバイルでの動作テスト完了

#### Node.js API代替手段の使用確認
- [ ] cryptoの代わりにSubtleCryptoを使用
- [ ] クリップボードアクセスにnavigator.clipboard APIを使用

### プラグインガイドライン - UIテキスト
- [ ] 設定の最上位に「設定」見出しを追加していない
- [ ] 設定の見出しに「設定」という単語を含めていない
- [ ] UI要素で文頭大文字を使用 (タイトルケース不使用)
- [ ] プラグインの説明はアクションステートメントで開始
- [ ] 説明は250文字以内でピリオドで終わる
- [ ] 絵文字や特殊文字を使用していない
- [ ] 固有名詞・頭字語で正しい大文字表記を使用
- [ ] setHeadingの代わりに`new Setting().setName().setHeading()`を使用

### プラグインガイドライン - 安全性
- [ ] innerHTML, outerHTML, insertAdjacentHTMLを使用していない
- [ ] ユーザー入力からDOM要素を構築する際、createEl()等を使用
- [ ] HTML要素のクリーンアップにel.empty()を使用

### プラグインガイドライン - リソース管理
- [ ] プラグインアンロード時にリソースをクリーンアップ
  - [ ] イベントリスナーをregisterEvent()で登録
  - [ ] コマンドをaddCommand()で登録
- [ ] onunload()で葉(leaf)をデタッチしていない

### プラグインガイドライン - コマンド
- [ ] コマンドのデフォルトホットキーを設定していない
- [ ] コマンドIDにプラグインIDを含めていない
- [ ] 適切なコールバックタイプを使用
  - [ ] callback - 無条件実行
  - [ ] checkCallback - 条件付き実行
  - [ ] editorCallback/editorCheckCallback - エディター必須時

### プラグインガイドライン - ワークスペース
- [ ] workspace.activeLeafに直接アクセスしていない
- [ ] getActiveViewOfType()を使用してアクティブビューにアクセス
- [ ] activeEditorを使用してエディターにアクセス
- [ ] カスタムビューへの参照を管理していない
- [ ] getActiveLeavesOfType()を使用してビューにアクセス

### プラグインガイドライン - Vault
- [ ] アクティブファイル編集時にVault.modify()ではなくEditor APIを使用
- [ ] バックグラウンドファイル変更時にVault.process()を使用
- [ ] フロントマター変更時にFileManager.processFrontMatter()を使用
- [ ] Adapter APIよりVault APIを優先使用
- [ ] パスでファイルを探す際に全ファイル反復処理していない
  - [ ] Vault.getFileByPath()を使用
  - [ ] Vault.getFolderByPath()を使用
  - [ ] Vault.getAbstractFileByPath()を使用
- [ ] ユーザー定義パスのクリーンアップにnormalizePath()を使用

### プラグインガイドライン - エディタ
- [ ] registerEditorExtension()後の変更時にupdateOptions()を使用

### プラグインガイドライン - スタイリング
- [ ] ハードコードされたスタイルを使用していない
- [ ] CSSクラスを使用してスタイルを適用
- [ ] Obsidian提供のCSS変数を使用 (例: --text-normal, --background-modifier-error)

### プラグインガイドライン - TypeScript
- [ ] varの代わりにconst/letを使用
- [ ] Promiseの代わりにasync/awaitを使用

### デバイス対応テスト
- [ ] デスクトップ (Windows) 動作確認
- [ ] デスクトップ (Mac) 動作確認
- [ ] デスクトップ (Linux) 動作確認
- [ ] モバイル (iOS) 動作確認
- [ ] モバイル (Android) 動作確認

### ドキュメント
- [ ] README.mdに機能説明を記載
- [ ] README.mdに使い方を記載
- [ ] README.mdにスクリーンショットを追加
- [ ] CHANGELOG.mdを作成
- [ ] リリースノートを作成

### 品質保証
- [ ] 全テストがパス
- [ ] ビルドエラーなし
- [ ] ESLintエラーなし
- [ ] パフォーマンステスト完了
- [ ] メモリリーク確認

---

## 参考資料

### Obsidian API
- [Obsidian API Documentation](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Developer Policies](https://docs.obsidian.md/Developer+policies)
- [Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Submission Requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements)

### 技術スタック
- TypeScript 4.9+
- Rollup (ビルド)
- Jest (テスト)
- ESLint + Prettier (リント・フォーマット)

### 設計パターン
- MVC (Model-View-Controller)
- Repository Pattern (ファイルアクセス層)
- Strategy Pattern (設定管理)
