import type { Material } from '../types';

export const MATERIALS_EXPORT_KIND = 'prompt-studio-materials';

export interface MaterialsExportFile {
  kind: typeof MATERIALS_EXPORT_KIND;
  version: 1;
  exportedAt: string;
  materials: Material[];
}

export function buildMaterialsExport(materials: Material[]): MaterialsExportFile {
  return {
    kind: MATERIALS_EXPORT_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    materials,
  };
}

const materialKey = (m: Material) => `${m.category}::${m.name.trim()}`;

/**
 * 既存素材とマージする。(category, name) が既存にあるものはスキップし、
 * 無いものだけを新しい id を振って追加する（全置き換えではなく追加のみ）。
 * インポート対象自身に重複があった場合も先勝ちで1件だけ残す。
 */
export function mergeImportedMaterials(
  existing: Material[],
  incoming: Material[],
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
    additions.push({ ...m, id: `mat-${Date.now().toString(36)}-${i}-${Math.floor(Math.random() * 1000)}` });
  });

  return { merged: [...existing, ...additions], addedCount: additions.length, skippedCount };
}
