import type { Publication } from '../types';

export const PUBLICATIONS_EXPORT_KIND = 'prompt-studio-publications';

export interface PublicationsExportFile {
  kind: typeof PUBLICATIONS_EXPORT_KIND;
  version: 1;
  exportedAt: string;
  publications: Publication[];
}

export function buildPublicationsExport(publications: Publication[]): PublicationsExportFile {
  return {
    kind: PUBLICATIONS_EXPORT_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    publications,
  };
}

// ipfsUrl があればそれが実世界での一意な識別子。未設定（下書き）はプロンプト文字列で識別する
const publicationKey = (p: Publication) => p.ipfsUrl.trim() || `draft::${p.prompt.trim()}`;

/**
 * 既存の公開データとマージする。ipfsUrl（未設定ならプロンプト文字列）が既存と
 * 一致するものはスキップし、無いものだけを新しい id を振って追加する
 * （全置き換えではなく追加のみ）。キャラ・状況・服装・背景・演出のID参照は
 * 読み込み時に prompt から今の素材データへ再マッチングされるため、
 * インポート元のIDをそのまま持ち越しても支障はない。
 */
export function mergeImportedPublications(
  existing: Publication[],
  incoming: Publication[],
): { merged: Publication[]; addedCount: number; skippedCount: number } {
  const seen = new Set(existing.map(publicationKey));
  const additions: Publication[] = [];
  let skippedCount = 0;

  incoming.forEach((p, i) => {
    const key = publicationKey(p);
    if (seen.has(key)) {
      skippedCount += 1;
      return;
    }
    seen.add(key);
    additions.push({ ...p, id: `pub-${Date.now().toString(36)}-${i}-${Math.floor(Math.random() * 1000)}` });
  });

  return { merged: [...existing, ...additions], addedCount: additions.length, skippedCount };
}
