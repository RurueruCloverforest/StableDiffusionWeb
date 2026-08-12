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

/** 解決済みスロットのキャラ・状況・服装・背景・演出の名前を , ではなく ・ で連結した表示名 */
export function composeName(materials: Material[], slots: SlotMap): string {
  const names = CATEGORIES.map((c) => findMaterial(materials, slots[c.id])?.name).filter(
    (n): n is string => !!n,
  );
  return names.length ? names.join('・') : '無題';
}

/**
 * 貼り付けられたプロンプト文字列を、登録済み素材の組み合わせに逆引きする。
 * カテゴリ順（キャラ→状況→服装→背景→演出）に沿って、各カテゴリの素材タグ列が
 * 先頭から連続一致するかをバックトラックで探索する。キャラは必須（スキップ不可）、
 * 他4カテゴリは未設定（タグ0個）を許容する。全トークンを過不足なく消費できる
 * 組み合わせが1つも無ければ null（＝このアプリが生成したプロンプトではない）。
 */
export function matchPromptToMaterials(materials: Material[], promptText: string): SlotMap | null {
  const tags = promptText
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const byCategory = (cat: Category) => materials.filter((m) => m.category === cat && m.tags.length > 0);

  const backtrack = (catIndex: number, pos: number, acc: SlotMap): SlotMap | null => {
    if (catIndex === CATEGORIES.length) {
      return pos === tags.length ? acc : null;
    }
    const cat = CATEGORIES[catIndex].id;

    for (const mat of byCategory(cat)) {
      const len = mat.tags.length;
      if (pos + len > tags.length) continue;
      let matches = true;
      for (let i = 0; i < len; i++) {
        if (tags[pos + i] !== mat.tags[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        const result = backtrack(catIndex + 1, pos + len, { ...acc, [cat]: mat.id });
        if (result) return result;
      }
    }

    if (cat !== 'character') {
      const result = backtrack(catIndex + 1, pos, { ...acc, [cat]: null });
      if (result) return result;
    }
    return null;
  };

  return backtrack(0, 0, emptySlots());
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
