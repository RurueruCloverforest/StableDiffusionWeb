import { MainHeader } from '../components/MainHeader';
import { StripedThumb } from '../components/StripedThumb';
import { CATEGORIES, categoryMeta } from '../state/categories';
import { composePrompt } from '../state/prompt';
import { useStore } from '../state/store';
import { useCopy } from '../state/useCopy';

export function RecipeMode() {
  const { state, dispatch } = useStore();
  const { materials, editSlots, activeSlot } = state;
  const { isCopied, copy } = useCopy();

  const composed = composePrompt(materials, editSlots);
  const activeMeta = activeSlot ? categoryMeta(activeSlot) : null;
  const pickerItems = activeSlot ? materials.filter((m) => m.category === activeSlot) : [];

  const handleExport = () => {
    const blob = new Blob([composed], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompt.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <MainHeader title="プロンプトを組む" meta="素材を選ぶとその場で合成されます" />
      <div className="recipe">
        <div className="recipe__left">
          <div className="recipe__slots">
            {CATEGORIES.map((cat) => {
              const materialId = editSlots[cat.id];
              const material = materials.find((m) => m.id === materialId);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`slot-row ${material ? 'has-value' : ''} ${activeSlot === cat.id ? 'is-active' : ''}`}
                  onClick={() => dispatch({ type: 'SELECT_SLOT', category: cat.id })}
                >
                  <div className="slot-row__cat">{cat.abbr}</div>
                  {material ? (
                    <StripedThumb size="sm" className="slot-row__thumb" />
                  ) : (
                    <div className="slot-row__thumb is-empty" />
                  )}
                  <div className="slot-row__body">
                    <div className={`slot-row__name ${material ? '' : 'is-empty'}`}>{material?.name ?? '未設定'}</div>
                    <div className={`slot-row__tag ${material ? '' : 'is-empty'}`}>
                      {material ? material.tags.join(', ') : 'クリックして選ぶ'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="composed">
            <div className="section-label">合成結果</div>
            <div className="composed__box">{composed}</div>
            <div className="recipe__buttons">
              <button type="button" className="btn-accent" onClick={() => copy('recipe-copy', composed)}>
                {isCopied('recipe-copy') ? 'コピーしました ✓' : 'プロンプトをコピー'}
              </button>
              <button type="button" className="btn-outline" onClick={handleExport}>
                .txt で書き出し
              </button>
            </div>
          </div>
        </div>

        <div className="recipe__right">
          {activeSlot && activeMeta ? (
            <div className="picker">
              <div className="section-label">{activeMeta.name}を選ぶ</div>
              <div className="picker__list">
                {pickerItems.length === 0 && (
                  <div className="empty-state">まだ{activeMeta.name}の素材がありません</div>
                )}
                {pickerItems.map((item) => {
                  const selected = editSlots[activeSlot] === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`picker__row ${selected ? 'is-selected' : ''}`}
                      onClick={() => dispatch({ type: 'SET_SLOT', category: activeSlot, materialId: item.id })}
                    >
                      <StripedThumb size="md" className="picker__thumb" />
                      <div className="picker__body">
                        <div className="picker__name">{item.name}</div>
                        <div className="picker__tag">{item.tags.join(', ')}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="picker">
              <div className="section-label">使い方</div>
              <div className="howto">
                スロットをクリックして素材を選ぶと、右下のプロンプトがその場で組み上がります。
                <br />
                <br />
                コピーまたは .txt で書き出して、ローカルの Stable Diffusion で生成します。
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
