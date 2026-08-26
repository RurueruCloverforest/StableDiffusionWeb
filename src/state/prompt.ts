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

/** 素材の表示名。派生名称があれば「名称:派生名称」、無ければ名称のみ */
export function materialDisplayName(m: Material): string {
  return m.alternativeName ? `${m.name}:${m.alternativeName}` : m.name;
}

/** カテゴリ順（キャラ→状況→服装→背景→演出）でタグを , 連結する */
export function composePrompt(materials: Material[], slots: SlotMap): string {
  const tags = CATEGORIES.flatMap((c) => findMaterial(materials, slots[c.id])?.tags ?? []);
  return tags.length ? tags.join(', ') : '—';
}

/** 解決済みスロットのキャラ・状況・服装・背景・演出の表示名を , ではなく ・ で連結した表示名 */
export function composeName(materials: Material[], slots: SlotMap): string {
  const names = CATEGORIES.map((c) => {
    const mat = findMaterial(materials, slots[c.id]);
    return mat ? materialDisplayName(mat) : undefined;
  }).filter((n): n is string => !!n);
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
 * 複数カテゴリが同時にマッチした際、片方の素材のタグ集合がもう片方のタグ集合の
 * 部分集合になっているなら、部分集合側を無効化して上位集合側だけを残す。
 * 例: outfit「glowing dress, sparkle」と effect「sparkle」が両方マッチした場合、
 * sparkle は outfit 側のタグに含まれる断片に過ぎないとみなし、effect の判定を取り消す。
 * 順序は問わない集合としての包含判定（"集合的に含まれる"）。
 */
function resolveSubsetConflicts(materials: Material[], slots: SlotMap): void {
  const tagsOf = (id: string | null): string[] | null =>
    id ? materials.find((m) => m.id === id)?.tags ?? null : null;
  const isSubset = (a: string[], b: string[]) => a.every((t) => b.includes(t));

  for (const catA of CATEGORIES) {
    const tagsA = tagsOf(slots[catA.id]);
    if (!tagsA) continue;
    for (const catB of CATEGORIES) {
      if (catA.id === catB.id) continue;
      const tagsB = tagsOf(slots[catB.id]);
      if (!tagsB) continue;
      if (isSubset(tagsA, tagsB)) {
        slots[catA.id] = null;
        break;
      }
    }
  }
}

/**
 * 貼り付けられたプロンプト文字列から、登録済み素材の組み合わせを逆引きする。
 * カテゴリごとに「そのタグ列がプロンプト中にひとかたまり（連続・順序一致）で
 * 含まれている素材」を探して採用する。実際の生成時に付け足された品質タグなど、
 * 素材に登録されていない余分なタグがプロンプト側にあっても構わない
 * （= 完全一致ではなく包含判定）。同一カテゴリ内で複数の素材が同時にマッチした
 * 場合（部分集合関係にある素材同士など）は、タグ集合が一番大きいものを採用する。
 * カテゴリをまたいで部分集合の関係にあるマッチが同時に成立した場合は
 * resolveSubsetConflicts で上位集合側に一本化する。
 * キャラに該当する素材が1つも見つからなければ null（＝このアプリの素材から
 * 生成されたプロンプトではないと判断）。
 */
export function matchPromptToMaterials(materials: Material[], promptText: string): SlotMap | null {
  const tags = promptText
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const result = emptySlots();
  for (const cat of CATEGORIES) {
    const candidates = materials.filter((m) => m.category === cat.id && m.tags.length > 0);
    const matched = candidates.filter((m) => containsBlock(tags, m.tags));
    // 同カテゴリ内で複数マッチした場合は、タグ集合が一番大きい（＝より具体的な）ものを採用する
    const found = matched.sort((a, b) => b.tags.length - a.tags.length)[0];
    result[cat.id] = found?.id ?? null;
  }

  resolveSubsetConflicts(materials, result);

  return result.character ? result : null;
}

/**
 * 保存されているプロンプト文字列を、今の素材データに対して再マッチングし直し、
 * キャラ・状況・服装・背景・演出を作り直す。素材が削除・変更されて追従できなく
 * なったカテゴリは null（キャラは ''）になる。プロンプトが空の場合は何もしない
 * （まだ一度もプロンプトを貼り付けていない下書きをリセットしないため）。
 */
export function recategorizePublication(materials: Material[], p: Publication): Publication {
  if (!p.prompt.trim()) return p;
  const matched = matchPromptToMaterials(materials, p.prompt) ?? emptySlots();
  return {
    ...p,
    name: composeName(materials, matched),
    char: matched.character ?? '',
    situation: matched.situation,
    outfit: matched.outfit,
    background: matched.background,
    effect: matched.effect,
  };
}

/** プロンプトはあるのにキャラが再マッチングできなかった（＝参照していた素材が消えた等）公開エントリか */
export function needsRecategorization(p: Publication): boolean {
  return p.prompt.trim() !== '' && p.char === '';
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

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * 公開エントリ群から代表画像（サムネイル優先、無ければ代表画像の先頭）を持つものを
 * 1件“ランダムに”選んで返す。seed に基づく決定的な選択のため、再描画のたびに変わらない。
 * 該当が無ければ null。
 */
export function pickFallbackImage(seed: string, publications: Publication[]): string | null {
  const candidates = publications
    .map((p) => p.thumbnail ?? p.heroImages.find((h) => h) ?? null)
    .filter((src): src is string => !!src);
  if (candidates.length === 0) return null;
  return candidates[hashString(seed) % candidates.length];
}

/**
 * 素材に参照画像 (refImage) が設定されていない場合の代替表示用に、その素材を実際に
 * 使っている公開エントリの画像を1件拾ってくる。該当が無ければ null。
 */
export function materialFallbackImage(material: Material, publications: Publication[]): string | null {
  const used = publications.filter((p) => publicationSlotValue(p, material.category) === material.id);
  return pickFallbackImage(material.id, used);
}

/** 指定カテゴリの素材が、展示済み（ipfsUrl設定済み）の公開エントリで何回使われているか */
export function exhibitUsageCount(publications: Publication[], cat: Category, materialId: string): number {
  return publications.filter((p) => p.ipfsUrl !== '' && publicationSlotValue(p, cat) === materialId).length;
}

/** キャラ・状況・服装の組み合わせが、展示済み（ipfsUrl設定済み）の公開エントリに何件あるか */
export function comboUsageCount(
  publications: Publication[],
  char: string | null,
  situation: string | null,
  outfit: string | null,
): number {
  return publications.filter(
    (p) => p.ipfsUrl !== '' && p.char === char && p.situation === situation && p.outfit === outfit,
  ).length;
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

const TRIO_CATEGORIES: Category[] = ['character', 'situation', 'outfit'];
const REST_CATEGORIES: Category[] = ['background', 'effect'];

/**
 * ロックされていないカテゴリだけをランダムに選び直す。
 *
 * weighted=true のとき、キャラ・状況・服装は単体の使用回数ではなく
 * 「その3つの組み合わせ」で展示済み件数が一番少ないものを優先する
 * （同数のものが複数あればその中からランダム）。背景・演出は従来通り、
 * カテゴリ単体の使用回数が少ない素材ほど選ばれやすくなるよう重み付けする
 * （1 / (使用回数 + 1)）。該当カテゴリに素材が1件も無ければ null のまま。
 */
export function randomizeSlots(
  materials: Material[],
  publications: Publication[],
  currentSlots: SlotMap,
  lockedSlots: Record<Category, boolean>,
  weighted: boolean,
): SlotMap {
  const result: SlotMap = { ...currentSlots };

  if (weighted) {
    const candidateLists = TRIO_CATEGORIES.map((cat) => {
      if (lockedSlots[cat]) return [currentSlots[cat]];
      const opts = materials.filter((m) => m.category === cat).map((m) => m.id);
      return opts.length > 0 ? opts : [null];
    });
    const combos: [string | null, string | null, string | null][] = [];
    for (const c of candidateLists[0]) {
      for (const s of candidateLists[1]) {
        for (const o of candidateLists[2]) {
          combos.push([c, s, o]);
        }
      }
    }
    const counts = combos.map(([c, s, o]) => comboUsageCount(publications, c, s, o));
    const min = Math.min(...counts);
    const bestCombos = combos.filter((_, i) => counts[i] === min);
    const [char, situation, outfit] = bestCombos[Math.floor(Math.random() * bestCombos.length)];
    if (!lockedSlots.character) result.character = char;
    if (!lockedSlots.situation) result.situation = situation;
    if (!lockedSlots.outfit) result.outfit = outfit;
  } else {
    for (const cat of TRIO_CATEGORIES) {
      if (lockedSlots[cat]) continue;
      const candidates = materials.filter((m) => m.category === cat);
      result[cat] = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)].id : null;
    }
  }

  for (const cat of REST_CATEGORIES) {
    if (lockedSlots[cat]) continue;
    const candidates = materials.filter((m) => m.category === cat);
    if (candidates.length === 0) {
      result[cat] = null;
      continue;
    }
    if (!weighted) {
      result[cat] = candidates[Math.floor(Math.random() * candidates.length)].id;
      continue;
    }
    const weights = candidates.map((m) => 1 / (exhibitUsageCount(publications, cat, m.id) + 1));
    result[cat] = weightedPick(candidates, weights).id;
  }

  return result;
}

/**
 * 参照画像（サムネイル）生成の叩き台となるプロンプトを組む補助タグ。
 * カテゴリだけでは「誰が/何が写るか」が決まらない服装・演出には仮の被写体
 * （1girl, solo）を足し、状況・背景は逆に人物なしの構図にする。あくまで
 * 固定の組み合わせによる叩き台で、狙い通りの絵になるとは限らない。
 */
const REFERENCE_PROMPT_FILLER: Record<Category, { before: string[]; after: string[] }> = {
  character: { before: [], after: ['solo', 'simple background', 'white background', 'looking at viewer', 'upper body', 'best quality', 'masterpiece'] },
  situation: { before: [], after: ['no humans', 'scenery', 'wide shot', 'best quality', 'masterpiece'] },
  outfit: { before: ['1girl', 'solo'], after: ['simple background', 'white background', 'standing', 'looking at viewer', 'best quality', 'masterpiece'] },
  background: { before: [], after: ['no humans', 'scenery', 'wide shot', 'best quality', 'masterpiece'] },
  effect: { before: ['1girl', 'solo'], after: ['simple background', 'best quality', 'masterpiece'] },
};

/** 素材のタグに、上記の固定タグを足して参照画像用プロンプトを組む。タグが無ければ空文字 */
export function buildReferenceImagePrompt(category: Category, tags: string[]): string {
  if (tags.length === 0) return '';
  const filler = REFERENCE_PROMPT_FILLER[category];
  return [...filler.before, ...tags, ...filler.after].join(', ');
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
