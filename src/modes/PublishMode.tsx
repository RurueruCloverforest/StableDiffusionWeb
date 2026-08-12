import { useState } from 'react';
import { MainHeader } from '../components/MainHeader';
import { StripedThumb } from '../components/StripedThumb';
import { Toggle } from '../components/Toggle';
import { useStore } from '../state/store';
import { useCopy } from '../state/useCopy';
import type { PublicationOptions } from '../types';

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

const PUB_OPTS: { key: keyof PublicationOptions; label: string; desc: string }[] = [
  { key: 'prompt', label: '合成プロンプト', desc: 'ipfs://…/prompt.txt として同梱' },
  { key: 'parts', label: '素材の内訳', desc: 'キャラ・状況・服装・背景・演出の一覧' },
  { key: 'params', label: '生成パラメータ', desc: 'steps / cfg / seed / model' },
];

export function PublishMode() {
  const { state, dispatch } = useStore();
  const { publications, pubTab, pubId } = state;
  const { isCopied, copy } = useCopy();
  const [justSaved, setJustSaved] = useState(false);

  const flashSaved = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const items = publications.filter((p) => (pubTab === 'published' ? p.ipfsUrl !== '' : p.ipfsUrl === ''));
  const selected = publications.find((p) => p.id === pubId) ?? null;

  return (
    <>
      <MainHeader
        title={pubTab === 'published' ? 'アドレス設定済み' : '未設定'}
        meta={`${items.length} 件`}
        showActions
        actionLabel="＋ 新しい公開"
        onAction={() => dispatch({ type: 'NEW_PUB' })}
      />
      <div className="publish">
        <div className="pub-list">
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pub-row ${pubId === p.id ? 'is-selected' : ''}`}
              onClick={() => dispatch({ type: 'SELECT_PUB', id: p.id })}
            >
              {p.hasThumbnail ? (
                <StripedThumb size="md" className="pub-row__thumb" />
              ) : (
                <div className="pub-row__thumb is-empty" />
              )}
              <div className="pub-row__body">
                <div className="pub-row__name">{p.name}</div>
                <div className={`pub-row__addr ${p.ipfsUrl ? 'is-set' : 'is-unset'}`}>
                  {p.ipfsUrl ? truncate(p.ipfsUrl, 26) : 'アドレス未設定'}
                </div>
                <div className="pub-row__meta">
                  {p.count} 枚{p.ipfsUrl ? `  ·  更新 ${p.updatedAt}` : ''}
                </div>
              </div>
            </button>
          ))}
          {items.length === 0 && <div className="empty-state">該当する公開エントリがありません</div>}
        </div>

        {selected ? (
          <div className="pub-detail">
            <div className="pub-detail__title-row">
              <input
                className="pub-detail__name-input"
                value={selected.name}
                onChange={(e) => dispatch({ type: 'SET_PUB_NAME', id: selected.id, value: e.target.value })}
              />
              <div className="pub-detail__meta">
                {selected.ipfsUrl ? `更新 ${selected.updatedAt}` : 'アドレス未設定 · 展示には出ません'}
              </div>
            </div>

            <div className="pub-detail__media">
              <div className="pub-thumb-field">
                <div className="section-label">サムネイル</div>
                {selected.hasThumbnail ? (
                  <StripedThumb className="pub-thumb" />
                ) : (
                  <div
                    className="thumb-empty pub-thumb"
                    onClick={() => dispatch({ type: 'TOGGLE_PUB_THUMB', id: selected.id })}
                  >
                    thumbnail 16:10
                  </div>
                )}
                <div className="field__hint">一覧・OGP で使われます</div>
              </div>

              <div className="pub-hero-field">
                <div className="field__label-row">
                  <div className="section-label">代表画像</div>
                  <div className="field__hint">最大3枚。残りは IPFS から取得します</div>
                </div>
                <div className="pub-hero-slots">
                  {[0, 1, 2].map((i) => {
                    const filled = i < selected.heroCount;
                    return filled ? (
                      <div
                        key={i}
                        className="thumb pub-hero-slot is-filled"
                        onClick={() => dispatch({ type: 'TOGGLE_PUB_HERO', id: selected.id, index: i })}
                      >
                        <div className="pub-hero-badge">{i + 1}</div>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="thumb-empty pub-hero-slot is-empty"
                        onClick={() => dispatch({ type: 'TOGGLE_PUB_HERO', id: selected.id, index: i })}
                      >
                        ＋
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pub-hero-images">
              <div className="section-label">収録画像</div>
              <div className="pub-hero-row">
                <div className="pub-hero-row__thumbs">
                  {[0, 1, 2, 3].map((i) => (
                    <StripedThumb key={i} size="sm" className="pub-hero-row__thumb" />
                  ))}
                </div>
                <div className="pub-hero-row__count">
                  {selected.ipfsUrl
                    ? `${selected.count} 枚（IPFS から取得）`
                    : `${selected.count} 枚 · アドレスを入力すると取得します`}
                </div>
                <div className="pub-hero-row__note">アプリ側では保持しません</div>
              </div>
            </div>

            <div className="addr-field">
              <div className="field__label-row">
                <div className="section-label">アドレス</div>
                <div className="field__hint">ローカルでアップロードした先を貼り付けます</div>
              </div>
              <div className="addr-row addr-row--ipfs">
                <div className="addr-row__label">IPFS</div>
                <input
                  className="addr-row__input"
                  value={selected.ipfsUrl}
                  placeholder="ipfs://bafybei…"
                  onChange={(e) => dispatch({ type: 'SET_PUB_IPFS', id: selected.id, value: e.target.value })}
                />
                <div
                  className="addr-row__copy"
                  onClick={() => selected.ipfsUrl && copy(`${selected.id}:ipfs`, selected.ipfsUrl)}
                >
                  {isCopied(`${selected.id}:ipfs`) ? '✓' : '⧉'}
                </div>
              </div>
              <div className="addr-row addr-row--http">
                <div className="addr-row__label">HTTP</div>
                <input
                  className="addr-row__input"
                  value={selected.httpUrl}
                  placeholder="https://…（予備・ゲートウェイ）"
                  onChange={(e) => dispatch({ type: 'SET_PUB_HTTP', id: selected.id, value: e.target.value })}
                />
                <div
                  className="addr-row__copy"
                  onClick={() => selected.httpUrl && copy(`${selected.id}:http`, selected.httpUrl)}
                >
                  {isCopied(`${selected.id}:http`) ? '✓' : '⧉'}
                </div>
              </div>
              <div className="field__hint">IPFS が引けないときは HTTP 側を使います</div>
            </div>

            <div className="pub-opts">
              <div className="section-label">公開に含める情報</div>
              <div className="pub-opts__list">
                {PUB_OPTS.map((o) => (
                  <div
                    key={o.key}
                    className="pub-opt-row"
                    onClick={() => dispatch({ type: 'TOGGLE_PUB_OPTION', id: selected.id, key: o.key })}
                  >
                    <Toggle
                      on={selected.options[o.key]}
                      onClick={() => dispatch({ type: 'TOGGLE_PUB_OPTION', id: selected.id, key: o.key })}
                    />
                    <div className="pub-opt-row__label">{o.label}</div>
                    <div className="pub-opt-row__desc">{o.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pub-detail__buttons">
              <button type="button" className="btn-accent" onClick={flashSaved}>
                {justSaved ? '保存しました ✓' : '保存'}
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => copy('share', selected.httpUrl || selected.ipfsUrl)}
              >
                {isCopied('share') ? 'コピーしました ✓' : '共有リンクをコピー'}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">左のリストから公開エントリを選ぶか、新しく作成してください</div>
        )}
      </div>
    </>
  );
}
