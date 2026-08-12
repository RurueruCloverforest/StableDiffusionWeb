import { CATEGORIES } from './categories';
import type { Category, Material } from '../types';

export type SlotMap = Record<Category, string | null>;

export const emptySlots = (): SlotMap => ({
  character: null,
  situation: null,
  outfit: null,
  background: null,
  effect: null,
});

const findMaterial = (materials: Material[], id: string | null): Material | undefined =>
  id == null ? undefined : materials.find((m) => m.id === id);

/** カテゴリ順（キャラ→状況→服装→背景→演出）でタグを , 連結する */
export function composePrompt(materials: Material[], slots: SlotMap): string {
  const tags = CATEGORIES.flatMap((c) => findMaterial(materials, slots[c.id])?.tags ?? []);
  return tags.length ? tags.join(', ') : '—';
}

/** 素材フォームでの合成プレビュー: 編集中のタグ + 作業中プロンプトの他カテゴリのタグ */
export function previewFragments(
  materials: Material[],
  slots: SlotMap,
  draftCategory: Category,
  draftTags: string[],
): { fragment: string; rest: string } {
  const fragment = draftTags.join(', ');
  const restTags = CATEGORIES.filter((c) => c.id !== draftCategory).flatMap(
    (c) => findMaterial(materials, slots[c.id])?.tags ?? [],
  );
  const rest = restTags.length ? (fragment ? ', ' : '') + restTags.join(', ') : '';
  return { fragment, rest };
}
