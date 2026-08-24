import type { Material } from '../types';

export const MATERIALS_EXPORT_KIND = 'prompt-studio-materials';

export interface MaterialsExportFile {
  kind: typeof MATERIALS_EXPORT_KIND;
  version: 1;
  exportedAt: string;
  materials: Material[];
}

/** 書き出しは自分のデータのみ対象。「参照読み込み」で取り込んだ他人のデータは含めない */
export function buildMaterialsExport(materials: Material[]): MaterialsExportFile {
  return {
    kind: MATERIALS_EXPORT_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    materials: materials.filter((m) => !m.isReference),
  };
}

const materialKey = (m: Material) => `${m.category}::${m.name.trim()}`;

/**
 * 既存素材とマージする。(category, name) が既存にあるものはスキップし、
 * 無いものだけを新しい id を振って追加する（全置き換えではなく追加のみ）。
 * インポート対象自身に重複があった場合も先勝ちで1件だけ残す。
 * asReference=true の場合は「参照読み込み」として isReference を立てて追加する
 * （書き出し対象から除外されるだけで、レシピ等では通常の素材と同様に使える）。
 */
export function mergeImportedMaterials(
  existing: Material[],
  incoming: Material[],
  asReference: boolean,
): { merged: Material[]; addedCount: number; skippedCount: number } {
  const seen = new Set(existing.map(materialKey));
  const additions: Material[] = [];
  let skippedCount = 0;

  incoming.forEach((m, i) => {
    const key = materialKey(m);
    if (seen.has(key)) {
      skippedCount += 1;
      return;
    }
    seen.add(key);
    additions.push({
      ...m,
      id: `mat-${Date.now().toString(36)}-${i}-${Math.floor(Math.random() * 1000)}`,
      isReference: asReference,
    });
  });

  return { merged: [...existing, ...additions], addedCount: additions.length, skippedCount };
}
