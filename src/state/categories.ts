import type { Category } from '../types';

export interface CategoryMeta {
  id: Category;
  /** 第2パネル・一覧見出しで使うフルネーム */
  name: string;
  /** レシピのスロット行で使う52px固定の略称 */
  abbr: string;
  /** 素材カードのサムネ中央に出すラベル */
  thumbLabel: string;
}

// 表示順 = プロンプト連結順（キャラ→状況→服装→背景→演出）
export const CATEGORIES: CategoryMeta[] = [
  { id: 'character', name: 'キャラクター', abbr: 'キャラ', thumbLabel: 'character ref' },
  { id: 'situation', name: 'シチュエーション', abbr: '状況', thumbLabel: 'scene ref' },
  { id: 'outfit', name: '服装', abbr: '服装', thumbLabel: 'outfit ref' },
  { id: 'background', name: '背景', abbr: '背景', thumbLabel: 'bg ref' },
  { id: 'effect', name: '演出', abbr: '演出', thumbLabel: 'style ref' },
];

export const categoryMeta = (id: Category): CategoryMeta =>
  CATEGORIES.find((c) => c.id === id)!;
