import { useState } from 'react';

/** navigator.clipboard.writeText のラッパー。コピー直後に短時間 true を返す */
export function useCopy(resetMs = 1200) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボード API が使えない環境ではフォールバックしない（表示のみ）
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), resetMs);
  };

  return { isCopied: (key: string) => copiedKey === key, copy };
}
