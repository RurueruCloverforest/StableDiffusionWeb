import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { CATEGORIES } from '../state/categories';
import { buildMaterialsExport, mergeImportedMaterials } from '../state/materialsIO';
import { buildPublicationsExport, mergeImportedPublications } from '../state/publicationsIO';
import { normalizeMaterial, normalizePublication, useStore } from '../state/store';

interface Row {
  key: string;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

export function SecondPanel() {
  const { state, dispatch } = useStore();
  const { mode, materials, publications, matCat, pubTab, exChar } = state;
  const importInputRef = useRef<HTMLInputElement>(null);
  const [ioMessage, setIoMessage] = useState<string | null>(null);

  const handleExportMaterials = () => {
    const payload = buildMaterialsExport(materials);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-studio-materials-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPublications = () => {
    const payload = buildPublicationsExport(publications);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-studio-publications-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMaterialsFile = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.materials) ? parsed.materials : null;
    if (!rawList) {
      setIoMessage('素材データとして読み込めませんでした');
      return;
    }
    const incoming = (rawList as Record<string, unknown>[]).map(normalizeMaterial);
    const { addedCount, skippedCount } = mergeImportedMaterials(materials, incoming);
    dispatch({ type: 'IMPORT_MATERIALS', materials: incoming });
    setIoMessage(`${addedCount} 件追加${skippedCount > 0 ? `（${skippedCount} 件は既存のためスキップ）` : ''}`);
  };

  const handleImportPublicationsFile = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.publications) ? parsed.publications : null;
    if (!rawList) {
      setIoMessage('公開データとして読み込めませんでした');
      return;
    }
    const incoming = (rawList as Record<string, unknown>[]).map(normalizePublication);
    const { addedCount, skippedCount } = mergeImportedPublications(publications, incoming);
    dispatch({ type: 'IMPORT_PUBLICATIONS', publications: incoming });
    setIoMessage(`${addedCount} 件追加${skippedCount > 0 ? `（${skippedCount} 件は既存のためスキップ）` : ''}`);
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (mode === 'publish') {
        await handleImportPublicationsFile(file);
      } else {
        await handleImportMaterialsFile(file);
      }
    } catch {
      setIoMessage('JSONの読み込みに失敗しました');
    }
  };

  if (mode === 'recipe') return null;

  let title = '';
  let sectionLabel = '';
  let rows: Row[] = [];

  if (mode === 'material') {
    title = '素材';
    sectionLabel = 'CATEGORY';
    rows = CATEGORIES.map((c) => ({
      key: c.id,
      label: c.name,
      count: materials.filter((m) => m.category === c.id).length,
      active: matCat === c.id,
      onClick: () => dispatch({ type: 'SET_MAT_CAT', category: c.id }),
    }));
  } else if (mode === 'publish') {
    title = '公開';
    sectionLabel = 'PUBLISH';
    const publishedCount = publications.filter((p) => p.ipfsUrl !== '').length;
    const draftCount = publications.length - publishedCount;
    rows = [
      {
        key: 'published',
        label: 'アドレス設定済み',
        count: publishedCount,
        active: pubTab === 'published',
        onClick: () => dispatch({ type: 'SET_PUB_TAB', tab: 'published' }),
      },
      {
        key: 'draft',
        label: '未設定',
        count: draftCount,
        active: pubTab === 'draft',
        onClick: () => dispatch({ type: 'SET_PUB_TAB', tab: 'draft' }),
      },
    ];
  } else if (mode === 'exhibit') {
    title = '展示';
    sectionLabel = 'CHARACTER';
    const published = publications.filter((p) => p.ipfsUrl !== '');
    const characters = materials.filter(
      (m) => m.category === 'character' && published.some((p) => p.char === m.id),
    );
    rows = [
      {
        key: '__all__',
        label: 'すべて',
        count: characters.length,
        active: exChar === null,
        onClick: () => dispatch({ type: 'SELECT_EX_CHAR', id: null }),
      },
      ...characters.map((c) => ({
        key: c.id,
        label: c.name,
        count: published.filter((p) => p.char === c.id).length,
        active: exChar === c.id,
        onClick: () => dispatch({ type: 'SELECT_EX_CHAR', id: c.id }),
      })),
    ];
  }

  return (
    <nav className="second-panel">
      <div className="second-panel__header">{title}</div>
      <div className="section-label">{sectionLabel}</div>
      <div className="second-panel__list">
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`second-panel__row ${r.active ? 'is-active' : ''}`}
            onClick={r.onClick}
          >
            {r.label}
            <span className="second-panel__count">{r.count}</span>
          </button>
        ))}
      </div>
      <div className="second-panel__bottom">
        {(mode === 'material' || mode === 'publish') && (
          <div className="second-panel__io">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <div className="second-panel__io-buttons">
              <button
                type="button"
                className="second-panel__io-btn"
                onClick={mode === 'publish' ? handleExportPublications : handleExportMaterials}
              >
                書き出し
              </button>
              <button type="button" className="second-panel__io-btn" onClick={() => importInputRef.current?.click()}>
                読み込み
              </button>
            </div>
            {ioMessage && <div className="second-panel__io-msg">{ioMessage}</div>}
          </div>
        )}
        <div className="second-panel__footer">pinned 2.1 GB</div>
      </div>
    </nav>
  );
}
