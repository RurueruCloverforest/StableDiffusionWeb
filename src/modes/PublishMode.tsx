import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { MainHeader } from '../components/MainHeader';
import { StripedThumb } from '../components/StripedThumb';
import { Toggle } from '../components/Toggle';
import { CATEGORIES } from '../state/categories';
import { readAndResizeImage } from '../state/image';
import { composePrompt, matchPromptToMaterials, type SlotMap } from '../state/prompt';
import { useStore } from '../state/store';
import { useCopy } from '../state/useCopy';
import type { Category, Publication, PublicationOptions } from '../types';

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

const PUB_OPTS: { key: keyof PublicationOptions; label: string; desc: string }[] = [
  { key: 'prompt', label: '合成プロンプト', desc: 'ipfs://…/prompt.txt として同梱' },
  { key: 'parts', label: '素材の内訳', desc: 'キャラ・状況・服装・背景・演出の一覧' },
  { key: 'params', label: '生成パラメータ', desc: 'steps / cfg / seed / model' },
];

function partId(p: Publication, catId: Category): string | null {
  switch (catId) {
    case 'character':
      return p.char;
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

type UploadTarget = { kind: 'thumb' } | { kind: 'hero'; index: number };

export function PublishMode() {
  const { state, dispatch } = useStore();
  const { materials, publications, pubTab, pubId } = state;
  const { isCopied, copy } = useCopy();
  const [justSaved, setJustSaved] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');
  const [matchError, setMatchError] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<UploadTarget | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flashSaved = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1200);
  };

  const items = publications.filter((p) => (pubTab === 'published' ? p.ipfsUrl !== '' : p.ipfsUrl === ''));
  const selected = publications.find((p) => p.id === pubId) ?? null;

  useEffect(() => {
    if (!selected) return;
    const slots: SlotMap = {
      character: selected.char,
      situation: selected.situation,
      outfit: selected.outfit,
      background: selected.background,
      effect: selected.effect,
    };
    setPromptDraft(composePrompt(materials, slots));
    setMatchError(null);
    // 選択中の公開エントリが切り替わった時だけ初期値を入れ直す（編集中の内容は保持する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const openFilePicker = (target: UploadTarget) => {
    setPendingUpload(target);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = pendingUpload;
    setPendingUpload(null);
    if (!file || !selected || !target) return;
    try {
      const dataUrl = await readAndResizeImage(file);
      if (target.kind === 'thumb') {
        dispatch({ type: 'SET_PUB_THUMBNAIL', id: selected.id, dataUrl });
      } else {
        dispatch({ type: 'SET_PUB_HERO', id: selected.id, index: target.index, dataUrl });
      }
    } catch {
      setMatchError('画像の読み込みに失敗しました。別のファイルでお試しください。');
    }
  };

  const handleApplyPrompt = () => {
    if (!selected) return;
    const matched = matchPromptToMaterials(materials, promptDraft);
    if (!matched || !matched.character) {
      setMatchError(
        '登録済みの素材の組み合わせと完全に一致しませんでした。レシピタブで組んだプロンプトをそのまま貼り付けてください。',
      );
      return;
    }
    dispatch({
      type: 'SET_PUB_PARTS',
      id: selected.id,
      char: matched.character,
      situation: matched.situation,
      outfit: matched.outfit,
      background: matched.background,
      effect: matched.effect,
    });
    setMatchError(null);
  };

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
              {p.thumbnail ? (
                <img src={p.thumbnail} alt="" className="pub-row__thumb pub-row__thumb--img" />
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

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <div className="pub-detail__media">
              <div className="pub-thumb-field">
                <div className="section-label">サムネイル</div>
                <div className="pub-thumb-wrap">
                  {selected.thumbnail ? (
                    <>
                      <img
                        src={selected.thumbnail}
                        alt=""
                        className="pub-thumb pub-thumb--img"
                        onClick={() => openFilePicker({ kind: 'thumb' })}
                      />
                      <div
                        className="img-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: 'SET_PUB_THUMBNAIL', id: selected.id, dataUrl: null });
                        }}
                      >
                        ×
                      </div>
                    </>
                  ) : (
                    <div className="thumb-empty pub-thumb" onClick={() => openFilePicker({ kind: 'thumb' })}>
                      thumbnail 16:10
                    </div>
                  )}
                </div>
                <div className="field__hint">一覧・OGP で使われます</div>
              </div>

              <div className="pub-hero-field">
                <div className="field__label-row">
                  <div className="section-label">代表画像</div>
                  <div className="field__hint">最大3枚。残りは IPFS から取得します</div>
                </div>
                <div className="pub-hero-slots">
                  {[0, 1, 2].map((i) => {
                    const src = selected.heroImages[i];
                    return src ? (
                      <div
                        key={i}
                        className="pub-hero-slot is-filled"
                        onClick={() => openFilePicker({ kind: 'hero', index: i })}
                      >
                        <img src={src} alt="" className="pub-hero-slot__img" />
                        <div className="pub-hero-badge">{i + 1}</div>
                        <div
                          className="img-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: 'SET_PUB_HERO', id: selected.id, index: i, dataUrl: null });
                          }}
                        >
                          ×
                        </div>
                      </div>
                    ) : (
                      <div
                        key={i}
                        className="thumb-empty pub-hero-slot is-empty"
                        onClick={() => openFilePicker({ kind: 'hero', index: i })}
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

            <div className="prompt-field">
              <div className="field__label-row">
                <div className="section-label">プロンプト</div>
                <div className="field__hint">
                  レシピタブで組んだプロンプトを貼り付けて「素材から設定」を押すと、内訳（キャラ・状況・服装・背景・演出）を自動判定します
                </div>
              </div>
              <textarea
                className="prompt-textarea"
                value={promptDraft}
                onChange={(e) => {
                  setPromptDraft(e.target.value);
                  setMatchError(null);
                }}
                placeholder="1girl, silver hair, ..."
              />
              <div className="prompt-actions">
                <button type="button" className="btn-outline" onClick={handleApplyPrompt}>
                  素材から設定
                </button>
                <div className="prompt-breakdown">
                  現在の内訳：
                  {CATEGORIES.map((c) => {
                    const mat = materials.find((m) => m.id === partId(selected, c.id));
                    return `${c.abbr}=${mat ? mat.name : '—'}`;
                  }).join('  ')}
                </div>
              </div>
              {matchError && <div className="prompt-error">{matchError}</div>}
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
