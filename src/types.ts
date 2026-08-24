export type Category = 'character' | 'situation' | 'outfit' | 'background' | 'effect';

export type Mode = 'recipe' | 'material' | 'publish' | 'exhibit';

export interface Material {
  id: string;
  category: Category;
  name: string;
  /** 派生名称。同じ name のバリエーション（バージョン違いなど）を作るときに使う。
   * 空文字は「派生ではない基準の素材」を意味する。表示名は name:alternativeName、
   * 展示のグルーピングは name のみで行う（マッチング・プロンプト合成には一切影響しない） */
  alternativeName: string;
  tags: string[];
  note: string;
  /** 参照画像（key visual）の data URL。未設定は null */
  refImage: string | null;
  /** 「参照読み込み」で取り込んだ他人のデータか。true のものは書き出し対象から除外される */
  isReference: boolean;
}

export interface Publication {
  id: string;
  /** キャラ・状況・服装・背景・演出の名前を連結した表示名。自動生成のみ、直接編集はしない */
  name: string;
  /** 投稿時に貼り付けた元のプロンプト文字列。読み込み時にこれを今の素材データへ再マッチングし、
   * 下記のキャラ・状況・服装・背景・演出を作り直す（素材の削除・変更に追従するための唯一の情報源） */
  prompt: string;
  /** キャラクター素材の id。展示の上位グルーピングキー。再マッチングに失敗すると '' になる */
  char: string;
  situation: string | null;
  outfit: string | null;
  background: string | null;
  effect: string | null;
  ipfsUrl: string;
  httpUrl: string;
  /** data URL（アップロード画像をリサイズして格納）。未設定は null */
  thumbnail: string | null;
  /** 代表画像スロット。長さ3固定、未設定要素は null */
  heroImages: (string | null)[];
  count: number;
  updatedAt: string;
  /** 「参照読み込み」で取り込んだ他人のデータか。true のものは書き出し対象から除外される */
  isReference: boolean;
}

export interface MaterialDraft {
  name: string;
  alternativeName: string;
  tags: string[];
  note: string;
  refImage: string | null;
}
