import { CATEGORIES } from '../state/categories';
import { useStore } from '../state/store';

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
      <div className="second-panel__footer">pinned 2.1 GB</div>
    </nav>
  );
}
