import { CATEGORIES } from './categories';
import type { Category, Material, Publication } from '../types';

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

/** タグ列 tags の中に、block と完全一致する連続した並びが存在するか */
export function containsBlock(tags: string[], block: string[]): boolean {
  if (block.length === 0) return false;
  for (let i = 0; i + block.length <= tags.length; i++) {
    let matches = true;
    for (let j = 0; j < block.length; j++) {
      if (tags[i + j] !== block[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

/**
 * 貼り付けられたプロンプト文字列から、登録済み素材の組み合わせを逆引きする。
 * カテゴリごとに「そのタグ列がプロンプト中にひとかたまり（連続・順序一致）で
 * 含まれている素材」を探して採用する。実際の生成時に付け足された品質タグなど、
 * 素材に登録されていない余分なタグがプロンプト側にあっても構わない
 * （= 完全一致ではなく包含判定）。キャラに該当する素材が1つも見つからなければ
 * null（＝このアプリの素材から生成されたプロンプトではないと判断）。
 */
export function matchPromptToMaterials(materials: Material[], promptText: string): SlotMap | null {
  const tags = promptText
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const result = emptySlots();
  for (const cat of CATEGORIES) {
    const candidates = materials.filter((m) => m.category === cat.id && m.tags.length > 0);
    const found = candidates.find((m) => containsBlock(tags, m.tags));
    result[cat.id] = found?.id ?? null;
  }

  return result.character ? result : null;
}

/** Publication の指定カテゴリに対応するフィールド値（character は char フィールド） */
export function publicationSlotValue(p: Publication, cat: Category): string | null {
  switch (cat) {
    case 'character':
      return p.char;
    case 'situation':
      return p.situation;
    case 'outfit':
      return p.outfit;
    case 'background':
      return p.background;
    case 'effect':
      return p.effect;
    default:
      return null;
  }
}

function weightedPick(candidates: Material[], weights: number[]): Material {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * ロックされていないカテゴリだけをランダムに選び直す。
 * weighted=true のときは、展示済み（ipfsUrl 設定済み）publication での使用回数が
 * 少ない素材ほど選ばれやすくなるよう重み付けする（1 / (使用回数 + 1)）。
 * 該当カテゴリに素材が1件も無ければ null のまま。
 */
export function randomizeSlots(
  materials: Material[],
  publications: Publication[],
  currentSlots: SlotMap,
  lockedSlots: Record<Category, boolean>,
  weighted: boolean,
): SlotMap {
  const published = publications.filter((p) => p.ipfsUrl !== '');
  const result: SlotMap = { ...currentSlots };

  for (const cat of CATEGORIES) {
    if (lockedSlots[cat.id]) continue;
    const candidates = materials.filter((m) => m.category === cat.id);
    if (candidates.length === 0) {
      result[cat.id] = null;
      continue;
    }
    if (!weighted) {
      result[cat.id] = candidates[Math.floor(Math.random() * candidates.length)].id;
      continue;
    }
    const weights = candidates.map((m) => {
      const usage = published.filter((p) => publicationSlotValue(p, cat.id) === m.id).length;
      return 1 / (usage + 1);
    });
    result[cat.id] = weightedPick(candidates, weights).id;
  }

  return result;
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
