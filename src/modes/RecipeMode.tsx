import { MainHeader } from '../components/MainHeader';
import { StripedThumb } from '../components/StripedThumb';
import { CATEGORIES, categoryMeta } from '../state/categories';
import { comboUsageCount, composePrompt, exhibitUsageCount } from '../state/prompt';
import { useStore } from '../state/store';
import { useCopy } from '../state/useCopy';

export function RecipeMode() {
  const { state, dispatch } = useStore();
  const { materials, publications, editSlots, activeSlot, lockedSlots, randomWeighted } = state;
  const { isCopied, copy } = useCopy();

  const composed = composePrompt(materials, editSlots);
  const comboCount = comboUsageCount(publications, editSlots.character, editSlots.situation, editSlots.outfit);
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
          <div className="recipe__random-bar">
            <button type="button" className="btn-outline" onClick={() => dispatch({ type: 'RANDOMIZE_SLOTS' })}>
              ランダム
            </button>
            <label className="recipe__random-mode">
              <input
                type="checkbox"
                checked={randomWeighted}
                onChange={() => dispatch({ type: 'TOGGLE_RANDOM_WEIGHTED' })}
              />
              展示の少ない素材を優先
            </label>
            <div className="recipe__combo-count" title="今のキャラ・状況・服装の組み合わせが展示に何件あるか">
              この組み合わせ: 展示 {comboCount} 件
            </div>
          </div>

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
                    material.refImage ? (
                      <img src={material.refImage} alt="" className="slot-row__thumb slot-row__thumb--img" />
                    ) : (
                      <StripedThumb size="sm" className="slot-row__thumb" />
                    )
                  ) : (
                    <div className="slot-row__thumb is-empty" />
                  )}
                  <div className="slot-row__body">
                    <div className={`slot-row__name ${material ? '' : 'is-empty'}`}>{material?.name ?? '未設定'}</div>
                    <div className={`slot-row__tag ${material ? '' : 'is-empty'}`}>
                      {material ? material.tags.join(', ') : 'クリックして選ぶ'}
                    </div>
                  </div>
                  <label className="slot-row__lock" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={lockedSlots[cat.id]}
                      onChange={() => dispatch({ type: 'TOGGLE_SLOT_LOCK', category: cat.id })}
                    />
                    固定
                  </label>
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
                  const usage = exhibitUsageCount(publications, activeSlot, item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`picker__row ${selected ? 'is-selected' : ''}`}
                      onClick={() => dispatch({ type: 'SET_SLOT', category: activeSlot, materialId: item.id })}
                    >
                      {item.refImage ? (
                        <img src={item.refImage} alt="" className="picker__thumb picker__thumb--img" />
                      ) : (
                        <StripedThumb size="md" className="picker__thumb" />
                      )}
                      <div className="picker__body">
                        <div className="picker__name">{item.name}</div>
                        <div className="picker__tag">{item.tags.join(', ')}</div>
                      </div>
                      <div className="picker__usage" title="展示に登録済みの件数">
                        展示 {usage}
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
