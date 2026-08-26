import type { Publication } from '../types';

export const PUBLICATIONS_EXPORT_KIND = 'prompt-studio-publications';

export interface PublicationsExportFile {
  kind: typeof PUBLICATIONS_EXPORT_KIND;
  version: 1;
  exportedAt: string;
  publications: Publication[];
}

/** 書き出しは自分のデータのみ対象。「参照読み込み」で取り込んだ他人のデータは含めない */
export function buildPublicationsExport(publications: Publication[]): PublicationsExportFile {
  return {
    kind: PUBLICATIONS_EXPORT_KIND,
    version: 1,
    exportedAt: new Date().toISOString(),
    publications: publications.filter((p) => !p.isReference),
  };
}

// ipfsUrl があればそれが実世界での一意な識別子。未設定（下書き）はプロンプト文字列で識別する。
// どちらも空（プロンプトも貼っていない真っ新な下書き）は同一性を判定できないため null を返す
function publicationKey(p: Publication): string | null {
  if (p.ipfsUrl.trim()) return p.ipfsUrl.trim();
  if (p.prompt.trim()) return `draft::${p.prompt.trim()}`;
  return null;
}

/**
 * 既存の公開データとマージする。ipfsUrl（未設定ならプロンプト文字列）が既存と
 * 一致するものはスキップし、無いものだけを新しい id を振って追加する
 * （全置き換えではなく追加のみ）。キャラ・状況・服装・背景・演出のID参照は
 * 読み込み時に prompt から今の素材データへ再マッチングされるため、
 * インポート元のIDをそのまま持ち越しても支障はない。
 * asReference=true の場合は「参照読み込み」として isReference を立てて追加する
 * （書き出し対象から除外されるだけで、展示等では通常の公開データと同様に使える）。
 *
 * ipfsUrl・プロンプトのどちらも未入力の下書き同士は同一性を判定できないため、
 * 重複スキップの対象にせず常に追加する（放置すると、そうした下書きが複数あると
 * 2件目以降が誤って「重複」としてスキップされてしまうため）。
 */
export function mergeImportedPublications(
  existing: Publication[],
  incoming: Publication[],
  asReference: boolean,
): { merged: Publication[]; addedCount: number; skippedCount: number } {
  const seen = new Set(
    existing.map(publicationKey).filter((key): key is string => key !== null),
  );
  const additions: Publication[] = [];
  let skippedCount = 0;

  incoming.forEach((p, i) => {
    const key = publicationKey(p);
    if (key !== null) {
      if (seen.has(key)) {
        skippedCount += 1;
        return;
      }
      seen.add(key);
    }
    additions.push({
      ...p,
      id: `pub-${Date.now().toString(36)}-${i}-${Math.floor(Math.random() * 1000)}`,
      isReference: asReference,
    });
  });

  return { merged: [...existing, ...additions], addedCount: additions.length, skippedCount };
}
