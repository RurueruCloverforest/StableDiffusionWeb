import { useState } from 'react';
import { MainHeader } from '../components/MainHeader';
import { StripedThumb } from '../components/StripedThumb';
import { categoryMeta } from '../state/categories';
import { publicationSlotValue } from '../state/prompt';
import { useStore } from '../state/store';
import { useCopy } from '../state/useCopy';
import type { Category, Material, Publication } from '../types';

const DETAIL_CHIP_CATEGORIES: Category[] = ['background', 'effect'];

/** 「状況/服装が未設定」グループを表すセンチネル。素材idと衝突しない専用文字列 */
const UNSET_GROUP = '__unset__';

interface GroupEntry {
  id: string;
  label: string;
  tags: string[];
  refImage: string | null;
  items: Publication[];
}

function groupByCategory(items: Publication[], materials: Material[], cat: Category): GroupEntry[] {
  const map = new Map<string, Publication[]>();
  for (const p of items) {
    const key = publicationSlotValue(p, cat) ?? UNSET_GROUP;
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  }

  const entries: GroupEntry[] = [];
  for (const [key, list] of map) {
    if (key === UNSET_GROUP) {
      entries.push({ id: UNSET_GROUP, label: '未設定', tags: [], refImage: null, items: list });
    } else {
      const mat = materials.find((m) => m.id === key);
      entries.push({
        id: key,
        label: mat?.name ?? '不明な素材',
        tags: mat?.tags ?? [],
        refImage: mat?.refImage ?? null,
        items: list,
      });
    }
  }

  // 未設定は最後に、それ以外は展示数が多い順
  entries.sort((a, b) => {
    if (a.id === UNSET_GROUP) return 1;
    if (b.id === UNSET_GROUP) return -1;
    return b.items.length - a.items.length;
  });
  return entries;
}

function matchesGroup(p: Publication, cat: Category, groupId: string): boolean {
  const val = publicationSlotValue(p, cat);
  return groupId === UNSET_GROUP ? val === null : val === groupId;
}

export function ExhibitMode() {
  const { state, dispatch } = useStore();
  const { materials, publications, exChar, exSituation, exOutfit } = state;
  const published = publications.filter((p) => p.ipfsUrl !== '');

  const characters = materials.filter(
    (m) => m.category === 'character' && published.some((p) => p.char === m.id),
  );

  if (exChar === null) {
    return (
      <ExhibitCharacterList
        characters={characters}
        published={published}
        onSelect={(id) => dispatch({ type: 'SELECT_EX_CHAR', id })}
      />
    );
  }

  const character = characters.find((c) => c.id === exChar);
  if (!character) {
    return (
      <>
        <MainHeader title="展示" meta={`${characters.length} キャラクター`} />
        <div className="empty-state">キャラクターが見つかりません</div>
      </>
    );
  }

  const charItems = published.filter((p) => p.char === exChar);

  if (exSituation === null) {
    const groups = groupByCategory(charItems, materials, 'situation');
    return (
      <ExhibitGroupList
        groups={groups}
        category="situation"
        headerTitle={character.name}
        headerMeta={`${groups.length} シチュエーション  ·  ${charItems.length} 展示`}
        backLabel="← キャラクター一覧"
        onSelect={(id) => dispatch({ type: 'SELECT_EX_SITUATION', id })}
        onBack={() => dispatch({ type: 'SELECT_EX_CHAR', id: null })}
      />
    );
  }

  const situationItems = charItems.filter((p) => matchesGroup(p, 'situation', exSituation));
  const situationLabel =
    exSituation === UNSET_GROUP ? '未設定' : materials.find((m) => m.id === exSituation)?.name ?? '不明な素材';

  if (exOutfit === null) {
    const groups = groupByCategory(situationItems, materials, 'outfit');
    return (
      <ExhibitGroupList
        groups={groups}
        category="outfit"
        headerTitle={situationLabel}
        headerMeta={`${groups.length} 服装  ·  ${situationItems.length} 展示`}
        backLabel="← シチュエーション一覧"
        onSelect={(id) => dispatch({ type: 'SELECT_EX_OUTFIT', id })}
        onBack={() => dispatch({ type: 'SELECT_EX_SITUATION', id: null })}
      />
    );
  }

  const outfitItems = situationItems.filter((p) => matchesGroup(p, 'outfit', exOutfit));
  const outfitLabel = exOutfit === UNSET_GROUP ? '未設定' : materials.find((m) => m.id === exOutfit)?.name ?? '不明な素材';

  return (
    <ExhibitItemList
      character={character}
      outfitLabel={outfitLabel}
      items={outfitItems}
      materials={materials}
      onBack={() => dispatch({ type: 'SELECT_EX_OUTFIT', id: null })}
    />
  );
}

function ExhibitCharacterList({
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

function ExhibitGroupList({
  groups,
  category,
  headerTitle,
  headerMeta,
  backLabel,
  onSelect,
  onBack,
}: {
  groups: GroupEntry[];
  category: Category;
  headerTitle: string;
  headerMeta: string;
  backLabel: string;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const meta = categoryMeta(category);
  return (
    <>
      <MainHeader title={headerTitle} meta={headerMeta} />
      <div className="exhibit-grid-page">
        <div className="back-link" onClick={onBack}>
          {backLabel}
        </div>
        <div className="exhibit-grid exhibit-grid--nested">
          {groups.map((g) => {
            const totalImages = g.items.reduce((sum, p) => sum + p.count, 0);
            return (
              <button key={g.id} type="button" className="exhibit-card" onClick={() => onSelect(g.id)}>
                {g.refImage ? (
                  <img src={g.refImage} alt="" className="exhibit-card__visual exhibit-card__visual--img" />
                ) : (
                  <StripedThumb className="exhibit-card__visual" label={meta.thumbLabel} />
                )}
                <div className="exhibit-card__body">
                  <div className="exhibit-card__name">{g.label}</div>
                  {g.tags.length > 0 && <div className="exhibit-card__tag">{g.tags.join(', ')}</div>}
                  <div className="exhibit-card__meta">
                    {g.items.length} 展示  ·  {totalImages} 枚
                  </div>
                </div>
              </button>
            );
          })}
          {groups.length === 0 && <div className="empty-state">該当する展示がありません</div>}
        </div>
      </div>
    </>
  );
}

function ExhibitItemList({
  character,
  outfitLabel,
  items,
  materials,
  onBack,
}: {
  character: Material;
  outfitLabel: string;
  items: Publication[];
  materials: Material[];
  onBack: () => void;
}) {
  const { isCopied, copy } = useCopy();
  const totalImages = items.reduce((sum, p) => sum + p.count, 0);

  return (
    <>
      <MainHeader title={outfitLabel} meta={`${items.length} 展示  ·  ${totalImages} 枚`} />
      <div className="exhibit-detail">
        <div className="exhibit-detail__main">
          <div className="back-link" onClick={onBack}>
            ← 服装一覧
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
            const mat = findMat(cat, publicationSlotValue(p, cat));
            return (
              <div key={cat} className={`exhibit-chip ${mat ? 'is-set' : 'is-unset'}`}>
                <span className="exhibit-chip__cat">{categoryMeta(cat).abbr}</span>
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
