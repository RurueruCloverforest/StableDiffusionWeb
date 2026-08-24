# データ形式リファレンス

外部スクリプトから素材データ・公開データを組み立てて、Prompt Studio の「追加読み込み」「参照読み込み」に流し込むための仕様書。アプリの実装（`src/types.ts` / `src/state/store.tsx` / `src/state/materialsIO.ts` / `src/state/publicationsIO.ts`）が正で、この文書はそのスナップショット。

## 共通事項

- 読み込みは常に**追加のみ**（全置き換えではない）。既存と重複するものはスキップされる
- 読み込み時、各フィールドは型チェックされ、欠けていたり型が違うものは下記の既定値で補われる（多少緩い形式のJSONでも壊れない）
- 「追加読み込み」「参照読み込み」のどちらのボタンで読み込んだかによって `isReference` が上書きされる。JSON側にどう書いてあっても関係ない
- 書き出し（エクスポート）は `isReference: true` のものを除外する

### 画像フィールド（refImage / thumbnail / heroImages）

`Material.refImage`、`Publication.thumbnail`、`Publication.heroImages` はいずれも文字列の **data URL**（例: `data:image/jpeg;base64,...`）をそのまま IndexedDB に保存する。アプリ自身がアップロード時に行っている変換に合わせて、外部スクリプトでも以下を目安にするとよい（サイズは厳密なチェックはしていないので、多少超えても壊れはしない）。

- 形式: JPEG
- 長辺: 約640px
- ファイルサイズ: 目安として1枚あたり200KB程度以内（アプリ自身が出す画像は640px・quality 0.82で大体40〜120KB程度）

IndexedDB は `localStorage`（オリジンごとに5〜10MB程度）より大幅に大きい容量を扱えるが、無制限ではないので、画像を機械的に大量投入する場合はこの目安を大きく外れないようにしたほうが安全、というだけの理由。厳密な制限値ではない。

## 素材データ（Materials）

### 書き出しファイル形式

```json
{
  "kind": "prompt-studio-materials",
  "version": 1,
  "exportedAt": "2026-08-24T12:00:00.000Z",
  "materials": [ /* Material の配列 */ ]
}
```

読み込み側は `kind`/`version`/`exportedAt` を見ておらず、配列そのもの（`[...]`）を渡しても、`{ "materials": [...] }` の形で渡してもどちらでも読める。

### Material

| フィールド | 型 | 必須 | 既定値 | 説明 |
|---|---|---|---|---|
| `id` | string | 任意 | ランダム生成 | 読み込み時に必ず新しいIDが振り直されるので、送る値は何でもよい（省略可） |
| `category` | `"character" \| "situation" \| "outfit" \| "background" \| "effect"` | 任意 | `"character"` | 不正な値も `"character"` にフォールバックされる |
| `name` | string | 任意 | `"無題"` | 素材名（基準名） |
| `alternativeName` | string | 任意 | `""` | 派生名称（バージョン違いなどのバリエーション）。空文字なら「派生ではない」。表示名は `name:alternativeName`。**展示のグルーピングは `name` のみで行われ、`alternativeName` は無視される** |
| `tags` | string[] | 任意 | `[]` | プロンプトタグ。配列内の非文字列要素は除外される |
| `note` | string | 任意 | `""` | メモ |
| `refImage` | string \| null | 任意 | `null` | 参照画像の data URL（形式の目安は上記「画像フィールド」参照） |
| `isReference` | boolean | — | — | **読み込み時に使ったボタンで上書きされるため、送っても無視される** |

### 重複判定（追加のみマージ）

キーは `` `${category}::${name.trim()}::${alternativeName.trim()}` ``。既存に同じキーがあればスキップ、無ければ新しいIDを振って追加する。同じ `name` でも `alternativeName` が違えば別物として追加される。

### 最小例

```json
{
  "materials": [
    { "category": "outfit", "name": "ウェイトレスの制服", "tags": ["waitress", "apron", "short skirt"] },
    { "category": "outfit", "name": "ウェイトレスの制服", "alternativeName": "冬服", "tags": ["waitress", "apron", "long skirt", "sweater"] }
  ]
}
```

## 公開データ（Publications）

### 書き出しファイル形式

```json
{
  "kind": "prompt-studio-publications",
  "version": 1,
  "exportedAt": "2026-08-24T12:00:00.000Z",
  "publications": [ /* Publication の配列 */ ]
}
```

配列そのもの、または `{ "publications": [...] }` のどちらでも読める。

### Publication

| フィールド | 型 | 必須 | 既定値 | 説明 |
|---|---|---|---|---|
| `id` | string | 任意 | ランダム生成 | 読み込み時に新しいIDが振り直される |
| `name` | string | 任意 | 自動生成 | **`prompt` があれば読み込み時に自動で作り直されるので、送る必要はない** |
| `prompt` | string | 実質必須 | `""` | 投稿時のプロンプト文字列。**これが唯一の正**。読み込み時にこれを今の素材データへ再マッチングし、下記のキャラ〜演出を自動で解決する（`,` 区切り、素材のタグがその並びのまま連続して含まれている必要がある。詳細は README の「内部データモデル」参照） |
| `char` / `situation` / `outfit` / `background` / `effect` | string \| null | 不要 | — | `prompt` が空でなければ、読み込み時に `prompt` から作り直されて**上書きされる**。`prompt` を空のまま送った場合だけ、ここに書いた生の値がそのまま使われる（通常は使わない想定）。基本的には `prompt` だけを送れば十分 |
| `ipfsUrl` | string | 実質必須 | `""` | `ipfs://` 込みの完全な形で入れる。空だと「未設定（下書き）」タブに入り、展示にも出ない |
| `httpUrl` | string | 任意 | `""` | 予備のゲートウェイURL |
| `thumbnail` | string \| null | 任意 | `null` | サムネイルの data URL（形式の目安は上記「画像フィールド」参照） |
| `heroImages` | (string\|null)[] | 任意 | `[null,null,null]` | 代表画像3枚分。長さが3以外でも先頭3件に丸められる（形式の目安は上記「画像フィールド」参照） |
| `count` | number | 任意 | `0` | 収録枚数 |
| `updatedAt` | string | 任意 | 今日の日付 | 表示用の日付文字列（`YYYY-MM-DD`推奨） |
| `isReference` | boolean | — | — | **読み込み時に使ったボタンで上書きされるため、送っても無視される** |

### 重複判定（追加のみマージ）

キーは `ipfsUrl`（空なら `` `draft::${prompt.trim()}` ``）。既存に同じキーがあればスキップ、無ければ追加される。

### 最小例

```json
{
  "publications": [
    {
      "prompt": "1girl, silver hair, long hair, blue eyes, gothic lolita, classroom, desks, chalkboard, afternoon light, school uniform, pleated skirt, blazer, necktie, backlighting, rim light, lens flare",
      "ipfsUrl": "ipfs://bafybei...",
      "count": 18,
      "updatedAt": "2026-08-24"
    }
  ]
}
```

`prompt` さえ正しく組み立てれば、`char` 等のIDは一切気にしなくてよい。素材IDはブラウザごとに異なりうるが、`prompt` の中の実際のタグ文字列から毎回解決し直されるため、スクリプト側は今のブラウザの素材IDを一切知る必要がない。

### 再カテゴライズに失敗した場合

`prompt` の中にキャラの素材タグが見つからない（＝該当する素材が無い）と `char` が `""` になり、公開一覧に「⚠ 要再分類」と表示され、展示にも出ない。スクリプト側が想定通りの素材タグを組み立てられているか確認する目安になる。
