export type Category = 'character' | 'situation' | 'outfit' | 'background' | 'effect';

export type Mode = 'recipe' | 'material' | 'publish' | 'exhibit';

export interface Material {
  id: string;
  category: Category;
  name: string;
  tags: string[];
  note: string;
  /** 参照画像。プロトタイプ段階では枚数(最大3)のみを保持し、実データは持たない */
  refCount: number;
}

export interface PublicationOptions {
  prompt: boolean;
  parts: boolean;
  params: boolean;
}

export interface Publication {
  id: string;
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
  options: PublicationOptions;
}

export interface MaterialDraft {
  name: string;
  tags: string[];
  note: string;
  refCount: number;
}
