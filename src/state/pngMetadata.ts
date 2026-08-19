/**
 * Stable Diffusion 系ツール（AUTOMATIC1111 など）が生成する PNG は、
 * tEXt/iTXt チャンクにキーワード "parameters" で生成情報を埋め込む。
 * その値の1行目が正のプロンプトなので、それだけを取り出す。
 * 該当チャンクが無い・壊れている場合は null を返す（例外は投げない）。
 */
export async function extractPromptFromPng(file: File): Promise<string | null> {
  if (file.type !== 'image/png') return null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);

    const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== SIGNATURE[i]) return null;
    }

    let offset = 8;
    while (offset + 8 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = latin1Decode(bytes.slice(offset + 4, offset + 8));
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (length < 0 || dataEnd > bytes.length) break;

      if (type === 'tEXt' || type === 'iTXt') {
        const entry = type === 'tEXt' ? parseTEXt(bytes, dataStart, dataEnd) : parseITXt(bytes, dataStart, dataEnd);
        if (entry && entry.keyword.toLowerCase() === 'parameters') {
          const firstLine = entry.text.split(/\r?\n/)[0]?.trim();
          return firstLine || null;
        }
      }
      if (type === 'IEND') break;
      offset = dataEnd + 4; // 4 バイトの CRC をスキップ
    }
  } catch {
    return null;
  }
  return null;
}

function parseTEXt(bytes: Uint8Array, start: number, end: number): { keyword: string; text: string } | null {
  const chunk = bytes.slice(start, end);
  const nullIndex = chunk.indexOf(0);
  if (nullIndex === -1) return null;
  return {
    keyword: latin1Decode(chunk.slice(0, nullIndex)),
    text: latin1Decode(chunk.slice(nullIndex + 1)),
  };
}

function parseITXt(bytes: Uint8Array, start: number, end: number): { keyword: string; text: string } | null {
  const chunk = bytes.slice(start, end);
  const keywordEnd = chunk.indexOf(0);
  if (keywordEnd === -1) return null;
  const keyword = latin1Decode(chunk.slice(0, keywordEnd));

  let idx = keywordEnd + 1;
  const compressionFlag = chunk[idx];
  idx += 2; // compression flag + compression method

  const langEnd = chunk.indexOf(0, idx);
  if (langEnd === -1) return null;
  idx = langEnd + 1;

  const transKeywordEnd = chunk.indexOf(0, idx);
  if (transKeywordEnd === -1) return null;
  idx = transKeywordEnd + 1;

  if (compressionFlag === 1) return null; // 圧縮 iTXt は未対応（parameters では稀）

  return { keyword, text: new TextDecoder('utf-8').decode(chunk.slice(idx)) };
}

function latin1Decode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}
