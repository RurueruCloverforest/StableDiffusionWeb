# Prompt Studio

`Stable Diffusion Web UI mockups/design_handoff_prompt_studio` のデザインハンドオフ（`id="3a"`）を React + TypeScript + Vite で実装したもの。

## セットアップ

```bash
npm install
npm run dev
```

`npm run dev` はローカルサーバーを起動する（デフォルト http://localhost:5173）。

## ビルド / デプロイ

```bash
npm run build
```

`dist/` に静的ファイルが出力される。バックエンドを持たない完全な静的サイトなので、`dist/` をそのまま Vercel / Netlify / GitHub Pages / Cloudflare Pages / S3 等にアップロードすればデプロイできる。`vite.config.ts` で `base: './'` を設定済みなので、サブパス配下にホストしても相対パスで解決される。

ローカルでビルド結果を確認する場合:

```bash
npm run preview
```

## データの永続化

素材 (`Material`) と 公開エントリ (`Publication`) はブラウザの `localStorage`（キー: `prompt-studio:data`）に保存される。バックエンドは存在しない、単一ユーザー・単一ブラウザ向けのプロトタイプ実装。

- 初回起動時はシードデータ（`src/data/seed.ts`）が読み込まれる
- 別のブラウザ/端末とはデータを共有しない
- 将来 API 連携する場合は `src/state/store.tsx` の `loadPersisted` / 永続化 `useEffect` を差し替える想定

### 素材データのエクスポート / インポート

素材モードの第2パネル下部から、登録済み素材（全カテゴリ）を1つのJSONファイルとして書き出せる。読み込みは全置き換えではなく**追加のみ**: 既存に同じ (カテゴリ, 名前) の素材が無いものだけを新しい id で追加する（`src/state/materialsIO.ts`）。ブラウザ間・環境間（本番/`experiment` など localStorage が別れている場合）で素材を持ち運ぶ用途を想定。

## デザイン仕様との差分・実装判断

デザインドキュメント（`design_handoff_prompt_studio/README.md`）で「未設計」とされていた箇所は、実装を通すために以下の通り最小限の判断を加えている。

- **画像アップロード**: 実装済み。参照画像・サムネイル・代表画像はクリックでファイル選択→リサイズして data URL として保存する（`src/state/image.ts`）
- **「＋ 新しい公開」後のフロー**: 空のエントリを作成して詳細パネルを開く。名前はタイトル部分をテキスト入力として編集可能にした（デザインでは静的テキスト）
- **削除の確認ダイアログ**: 素材の削除時のみ `window.confirm` を追加した（デザインでは未指定だが、localStorage に実データが載るため誤操作対策として付与）
- **「保存」ボタン**: アドレス・トグルは入力時に即時反映される仕様のため、「保存」は明示的な完了フィードバック（チェックマーク表示）のみを行う
- **展示の階層**: デザイン仕様ではキャラクター一覧→キャラクター詳細（フラットな展示リスト）の2階層だったが、キャラクター→シチュエーション→服装の3階層ナビゲーションに変更（`src/modes/ExhibitMode.tsx`）。各階層はグループごとの展示数を集計して一覧表示し、状況/服装が未設定の展示は「未設定」グループにまとめる

## 未実装（デザイン仕様どおり out of scope）

- 展示の並び順（新着順 / 手動並べ替え）
- 閲覧者向けの公開ページ
- 認証・複数ユーザー
- 検索フィールドの実挙動（表示のみ）
- ライトテーマ

## ディレクトリ構成

```
src/
  components/   共通UI（モードレール, 第2パネル, ヘッダ, ストライプサムネ, トグル）
  modes/        4モードの画面コンポーネント（recipe / material / publish / exhibit）
  state/        状態管理（Context + useReducer）, カテゴリ定義, プロンプト合成ロジック
  data/         初期シードデータ
  styles/       グローバル CSS（デザイントークンを CSS 変数化）
```
