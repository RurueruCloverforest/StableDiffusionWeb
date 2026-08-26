import { pickFallbackImage, publicationSlotValue } from './prompt';
import type { Category, Material, Publication } from '../types';

/** 「状況/服装が未設定」グループを表すセンチネル。素材名と衝突しない専用文字列 */
export const UNSET_GROUP = '__unset__';

export interface GroupEntry {
  /** グルーピングキー。素材の name（派生名称は無視）、未設定は UNSET_GROUP */
  id: string;
  label: string;
  tags: string[];
  refImage: string | null;
  items: Publication[];
}

/** 公開エントリの指定カテゴリの素材の name（派生名称を除いた基準名）。素材が無ければ null */
function materialNameOf(materials: Material[], p: Publication, cat: Category): string | null {
  const id = publicationSlotValue(p, cat);
  if (!id) return null;
  return materials.find((m) => m.id === id)?.name ?? null;
}

/**
 * 公開エントリを、指定カテゴリの素材の「基準名」でグルーピングする。
 * 派生名称（バリエーション）違いの素材は同じ名前であれば1つのグループにまとまる。
 * 展示画面（ExhibitMode）と第2パネルのキャラクター一覧（SecondPanel）の両方から
 * 同じロジックを使うことで、グルーピングキーの食い違いを防ぐ。
 */
export function groupByCategory(items: Publication[], materials: Material[], cat: Category): GroupEntry[] {
  const map = new Map<string, Publication[]>();
  for (const p of items) {
    const key = materialNameOf(materials, p, cat) ?? UNSET_GROUP;
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  }

  const entries: GroupEntry[] = [];
  for (const [key, list] of map) {
    if (key === UNSET_GROUP) {
      entries.push({ id: UNSET_GROUP, label: '未設定', tags: [], refImage: null, items: list });
    } else {
      // 代表として、そのグループの先頭エントリが参照している素材のタグ・参照画像を使う。
      // 素材に参照画像が無ければ、このグループの公開エントリの画像を代わりに使う
      const firstId = publicationSlotValue(list[0], cat);
      const mat = firstId ? materials.find((m) => m.id === firstId) : undefined;
      const refImage = mat?.refImage ?? pickFallbackImage(key, list);
      entries.push({ id: key, label: key, tags: mat?.tags ?? [], refImage, items: list });
    }
  }

  // 未設定は最後に、それ以外は展示数が多い順
  entries.sort((a, b) => {
    if (a.id === UNSET_GROUP) return 1;
    if (b.id === UNSET_GROUP) return -1;
    return b.items.length - a.items.length;
  });
  return entries;
}

export function matchesGroup(materials: Material[], p: Publication, cat: Category, groupId: string): boolean {
  const name = materialNameOf(materials, p, cat);
  return groupId === UNSET_GROUP ? name === null : name === groupId;
}
