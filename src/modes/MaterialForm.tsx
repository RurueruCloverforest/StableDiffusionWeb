import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import { MainHeader } from '../components/MainHeader';
import { categoryMeta } from '../state/categories';
import { readAndResizeImage } from '../state/image';
import { buildReferenceImagePrompt, previewFragments } from '../state/prompt';
import { useStore } from '../state/store';
import { useCopy } from '../state/useCopy';

export function MaterialForm() {
  const { state, dispatch } = useStore();
  const { matCat, matEdit, matDraft, matNewTag, editSlots, materials } = state;
  const meta = categoryMeta(matCat);
  const isEdit = typeof matEdit === 'string';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const { isCopied, copy } = useCopy();

  const backMeta = matEdit === 'new'
    ? '新規'
    : editSlots[matCat] === matEdit
      ? '作業中に使用'
      : `${matDraft.tags.length} タグ`;

  const { fragment, rest } = previewFragments(materials, editSlots, matCat, matDraft.tags);
  const hasTags = matDraft.tags.length > 0;
  const refPrompt = buildReferenceImagePrompt(matCat, matDraft.tags);

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dispatch({ type: 'ADD_MAT_TAG' });
    }
  };

  const handleTagInputChange = (value: string) => {
    if (!value.includes(',')) {
      dispatch({ type: 'SET_MAT_NEW_TAG', value });
      return;
    }
    const parts = value.split(',');
    const remainder = parts.pop() ?? '';
    const complete = parts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (complete.length > 0) {
      dispatch({ type: 'ADD_MAT_TAGS', values: complete });
    }
    dispatch({ type: 'SET_MAT_NEW_TAG', value: remainder.trimStart() });
  };

  const handleDelete = () => {
    if (typeof matEdit !== 'string') return;
    if (window.confirm('この素材を削除しますか？')) {
      dispatch({ type: 'DELETE_MAT', id: matEdit });
    }
  };

  const handleRefImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await readAndResizeImage(file);
    dispatch({ type: 'SET_MAT_REF_IMAGE', dataUrl });
  };

  const handleTagDragStart = (index: number) => (e: DragEvent<HTMLDivElement>) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTagDragOver = (index: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex !== null && index !== overIndex) setOverIndex(index);
  };

  const handleTagDrop = (index: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      dispatch({ type: 'REORDER_MAT_TAG', from: dragIndex, to: index });
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleTagDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <>
      <MainHeader title={`${meta.name}を${isEdit ? '編集' : '登録'}`} />
      <div className="mat-form">
        <div className="mat-form__main">
          <div className="mat-form__back-row">
            <div className="back-link" onClick={() => dispatch({ type: 'CANCEL_MAT_EDIT' })}>
              ← 一覧
            </div>
            <div className="mat-form__back-meta">{backMeta}</div>
          </div>

          <div className="field field--name">
            <div className="section-label">名前</div>
            <input
              className="text-input"
              value={matDraft.name}
              placeholder="例：アリス"
              onChange={(e) => dispatch({ type: 'SET_MAT_NAME', value: e.target.value })}
            />
          </div>

          <div className="field">
            <div className="field__label-row">
              <div className="section-label">参照画像</div>
              <div className="field__hint">見た目の確認用。プロンプトには含まれません</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleRefImageChange}
            />
            {matDraft.refImage ? (
              <div className="ref-image-wrap">
                <img
                  src={matDraft.refImage}
                  alt=""
                  className="ref-slot ref-image is-filled"
                  onClick={() => fileInputRef.current?.click()}
                />
                <div
                  className="img-remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'SET_MAT_REF_IMAGE', dataUrl: null });
                  }}
                >
                  ×
                </div>
              </div>
            ) : (
              <div className="thumb-empty ref-slot is-empty" onClick={() => fileInputRef.current?.click()}>
                ＋
              </div>
            )}
          </div>

          <div className="field">
            <div className="field__label-row">
              <div className="section-label">タグ</div>
              <div className="field__hint">Enter または , で追加。この順で連結されます。ドラッグで並べ替え</div>
            </div>
            <div className="tag-input-box">
              {matDraft.tags.map((tag, i) => (
                <div
                  key={`${tag}-${i}`}
                  className={`tag-chip ${dragIndex === i ? 'is-dragging' : ''} ${
                    overIndex === i && dragIndex !== null && dragIndex !== i ? 'is-drop-target' : ''
                  }`}
                  draggable
                  onDragStart={handleTagDragStart(i)}
                  onDragOver={handleTagDragOver(i)}
                  onDrop={handleTagDrop(i)}
                  onDragEnd={handleTagDragEnd}
                >
                  {tag}
                  <div className="tag-chip__remove" onClick={() => dispatch({ type: 'REMOVE_MAT_TAG', index: i })}>
                    ×
                  </div>
                </div>
              ))}
              <input
                className="tag-input"
                value={matNewTag}
                placeholder="タグを入力（, 区切りでまとめて追加できます）"
                onChange={(e) => handleTagInputChange(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
            </div>
          </div>

          <div className="field">
            <div className="section-label">メモ</div>
            <input
              className="text-input field-input--note"
              value={matDraft.note}
              placeholder="任意。使いどころ、相性のいい背景など"
              onChange={(e) => dispatch({ type: 'SET_MAT_NOTE', value: e.target.value })}
            />
          </div>

          <div className="mat-form__buttons">
            <button type="button" className="btn-accent" onClick={() => dispatch({ type: 'SAVE_MAT' })}>
              保存
            </button>
            <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'CANCEL_MAT_EDIT' })}>
              キャンセル
            </button>
            {isEdit && (
              <button type="button" className="btn-text-danger" onClick={handleDelete}>
                削除
              </button>
            )}
          </div>
        </div>

        <aside className="mat-aside">
          <div className="field">
            <div className="section-label">この素材の断片</div>
            <div className="fragment-box">
              {hasTags ? matDraft.tags.join(', ') : 'タグを追加すると、ここに断片が出ます'}
            </div>
          </div>
          <div className="field">
            <div className="field__label-row">
              <div className="section-label">参照画像用プロンプト</div>
              <div className="field__hint">固定タグで仮組みした叩き台。狙い通りの絵になるとは限りません</div>
            </div>
            {hasTags ? (
              <div>
                <div className="fragment-box">{refPrompt}</div>
                <button
                  type="button"
                  className="btn-link ref-prompt-copy"
                  onClick={() => copy('mat-ref-prompt', refPrompt)}
                >
                  {isCopied('mat-ref-prompt') ? 'コピーしました ✓' : 'コピー'}
                </button>
              </div>
            ) : (
              <div className="fragment-box fragment-box--empty">
                タグを追加すると、ここに参照画像生成用のプロンプトが出ます
              </div>
            )}
          </div>
          <div className="field">
            <div className="section-label">合成プレビュー</div>
            {hasTags ? (
              <div>
                <div className="fragment-box fragment-box--preview">
                  <span style={{ color: 'var(--accent-bright)' }}>{fragment}</span>
                  {rest}
                </div>
                <div className="preview-note">作業中のプロンプトに差し込んだ場合</div>
              </div>
            ) : (
              <div className="fragment-box fragment-box--empty">
                タグを追加すると、作業中のプロンプトに差し込んだときの結果をここで確認できます。
              </div>
            )}
          </div>
          <div className="mat-aside__footer">保存後、レシピタブのスロットから選べます</div>
        </aside>
      </div>
    </>
  );
}
