import { useState } from 'react';
import { MainHeader } from '../components/MainHeader';
import { StripedThumb } from '../components/StripedThumb';
import { CATEGORIES } from '../state/categories';
import { useStore } from '../state/store';
import { useCopy } from '../state/useCopy';
import type { Category, Material, Publication } from '../types';

const DETAIL_CHIP_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'character');

function slotValue(p: Publication, catId: Category): string | null {
  switch (catId) {
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

export function ExhibitMode() {
  const { state, dispatch } = useStore();
  const { materials, publications, exChar } = state;
  const published = publications.filter((p) => p.ipfsUrl !== '');

  const characters = materials.filter(
    (m) => m.category === 'character' && published.some((p) => p.char === m.id),
  );

  if (exChar === null) {
    return <ExhibitList characters={characters} published={published} onSelect={(id) => dispatch({ type: 'SELECT_EX_CHAR', id })} />;
  }

  const character = characters.find((c) => c.id === exChar);
  const items = published.filter((p) => p.char === exChar);
  if (!character) {
    return (
      <>
        <MainHeader title="展示" meta={`${characters.length} キャラクター`} />
        <div className="empty-state">キャラクターが見つかりません</div>
      </>
    );
  }

  return (
    <ExhibitDetail
      character={character}
      items={items}
      materials={materials}
      onBack={() => dispatch({ type: 'SELECT_EX_CHAR', id: null })}
    />
  );
}

function ExhibitList({
  characters,
  published,
  onSelect,
}: {
  characters: Material[];
  published: Publication[];
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <MainHeader title="展示" meta={`${characters.length} キャラクター`} />
      <div className="exhibit-grid">
        {characters.map((c) => {
          const pubs = published.filter((p) => p.char === c.id);
          const totalImages = pubs.reduce((sum, p) => sum + p.count, 0);
          return (
            <button key={c.id} type="button" className="exhibit-card" onClick={() => onSelect(c.id)}>
              {c.refImage ? (
                <img src={c.refImage} alt="" className="exhibit-card__visual exhibit-card__visual--img" />
              ) : (
                <StripedThumb className="exhibit-card__visual" label="character key visual" />
              )}
              <div className="exhibit-card__body">
                <div className="exhibit-card__name">{c.name}</div>
                <div className="exhibit-card__tag">{c.tags.join(', ')}</div>
                <div className="exhibit-card__meta">
                  {pubs.length} 展示  ·  {totalImages} 枚
                </div>
              </div>
            </button>
          );
        })}
        {characters.length === 0 && <div className="empty-state">公開済みの展示がまだありません</div>}
      </div>
    </>
  );
}

function ExhibitDetail({
  character,
  items,
  materials,
  onBack,
}: {
  character: Material;
  items: Publication[];
  materials: Material[];
  onBack: () => void;
}) {
  const { isCopied, copy } = useCopy();
  const totalImages = items.reduce((sum, p) => sum + p.count, 0);

  return (
    <>
      <MainHeader title={character.name} meta={`${items.length} 展示  ·  ${totalImages} 枚`} />
      <div className="exhibit-detail">
        <div className="exhibit-detail__main">
          <div className="back-link" onClick={onBack}>
            ← キャラクター一覧
          </div>
          <div className="exhibit-detail__list">
            {items.map((p) => (
              <ExhibitEntry key={p.id} p={p} materials={materials} isCopied={isCopied} copy={copy} />
            ))}
          </div>
        </div>

        <aside className="exhibit-aside">
          <div className="field">
            <div className="section-label">キャラクター</div>
            {character.refImage ? (
              <img src={character.refImage} alt="" className="exhibit-aside__visual exhibit-aside__visual--img" />
            ) : (
              <StripedThumb className="exhibit-aside__visual" label="reference" />
            )}
          </div>
          <div className="field">
            <div className="section-label">登録タグ</div>
            <div className="fragment-box">{character.tags.join(', ')}</div>
          </div>
          <div className="exhibit-aside__footer">画像は IPFS から取得します</div>
        </aside>
      </div>
    </>
  );
}

function ExhibitEntry({
  p,
  materials,
  isCopied,
  copy,
}: {
  p: Publication;
  materials: Material[];
  isCopied: (key: string) => boolean;
  copy: (key: string, text: string) => void;
}) {
  const gallery = [p.thumbnail, ...p.heroImages].filter((src): src is string => !!src);
  const [active, setActive] = useState<string | null>(gallery[0] ?? null);
  const openUrl = p.httpUrl || p.ipfsUrl;
  const findMat = (cat: Category, id: string | null) =>
    id ? materials.find((m) => m.category === cat && m.id === id) : undefined;

  return (
    <div className="exhibit-item">
      <div className="exhibit-item__gallery">
        {active ? (
          <img src={active} alt="" className="exhibit-item__visual exhibit-item__visual--img" />
        ) : (
          <StripedThumb className="exhibit-item__visual" label="key visual" />
        )}
        {gallery.length > 1 && (
          <div className="exhibit-item__thumbs">
            {gallery.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className={`exhibit-item__thumb ${active === src ? 'is-active' : ''}`}
                onClick={() => setActive(src)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="exhibit-item__body">
        <div className="exhibit-item__title-row">
          <div className="exhibit-item__name">{p.name}</div>
          <div className="exhibit-item__meta">
            {p.count} 枚  ·  {p.updatedAt}
          </div>
        </div>
        <div className="exhibit-item__chips">
          {DETAIL_CHIP_CATEGORIES.map((cat) => {
            const mat = findMat(cat.id, slotValue(p, cat.id));
            return (
              <div key={cat.id} className={`exhibit-chip ${mat ? 'is-set' : 'is-unset'}`}>
                <span className="exhibit-chip__cat">{cat.abbr}</span>
                {mat ? mat.name : '—'}
              </div>
            );
          })}
        </div>
        <div className="exhibit-item__addrs">
          <div className="exhibit-item__addr-row">
            <div className="exhibit-item__addr-label" style={{ color: 'var(--accent-dark)' }}>
              IPFS
            </div>
            <div className="exhibit-item__addr-value" style={{ color: 'var(--accent-bright)' }}>
              {p.ipfsUrl || '—'}
            </div>
          </div>
          <div className="exhibit-item__addr-row">
            <div className="exhibit-item__addr-label" style={{ color: 'var(--text-faintest)' }}>
              HTTP
            </div>
            <div className="exhibit-item__addr-value" style={{ color: 'var(--text-weaker)' }}>
              {p.httpUrl || '—'}
            </div>
          </div>
        </div>
      </div>
      <div className="exhibit-item__actions">
        <div className="btn-open" onClick={() => openUrl && window.open(openUrl, '_blank', 'noopener,noreferrer')}>
          開く
        </div>
        <div className="btn-link" onClick={() => openUrl && copy(`${p.id}:link`, openUrl)}>
          {isCopied(`${p.id}:link`) ? 'コピー済み ✓' : 'リンク'}
        </div>
      </div>
    </div>
  );
}
