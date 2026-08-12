export type Category = 'character' | 'situation' | 'outfit' | 'background' | 'effect';

export type Mode = 'recipe' | 'material' | 'publish' | 'exhibit';

export interface Material {
  id: string;
  category: Category;
  name: string;
  tags: string[];
  note: string;
  /** 参照画像（key visual）の data URL。未設定は null */
  refImage: string | null;
}

export interface Publication {
  id: string;
  /** キャラ・状況・服装・背景・演出の名前を連結した表示名。自動生成のみ、直接編集はしない */
  name: string;
  /** キャラクター素材の id。展示の上位グルーピングキー */
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
}

export interface MaterialDraft {
  name: string;
  tags: string[];
  note: string;
  refImage: string | null;
}
