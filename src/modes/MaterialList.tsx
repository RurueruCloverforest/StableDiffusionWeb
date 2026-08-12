import { MainHeader } from '../components/MainHeader';
import { StripedThumb } from '../components/StripedThumb';
import { categoryMeta } from '../state/categories';
import { useStore } from '../state/store';

export function MaterialList() {
  const { state, dispatch } = useStore();
  const { materials, matCat, editSlots } = state;
  const meta = categoryMeta(matCat);
  const items = materials.filter((m) => m.category === matCat);

  return (
    <>
      <MainHeader
        title={meta.name}
        meta={`${items.length} 件`}
        showActions
        actionLabel="＋ 素材を登録"
        onAction={() => dispatch({ type: 'OPEN_MAT_NEW' })}
      />
      <div className="material-grid">
        {items.map((item) => {
          const usedInRecipe = editSlots[matCat] === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className="material-card"
              onClick={() => dispatch({ type: 'OPEN_MAT_EDIT', id: item.id })}
            >
              <StripedThumb className="material-card__thumb" label={meta.thumbLabel} />
              <div className="material-card__body">
                <div className="material-card__name">{item.name}</div>
                <div className="material-card__tag">{item.tags.join(', ')}</div>
                <div className="material-card__meta">
                  {item.tags.length} タグ{usedInRecipe ? '  ·  作業中に使用' : ''}
                </div>
              </div>
            </button>
          );
        })}
        <button type="button" className="material-card--add" onClick={() => dispatch({ type: 'OPEN_MAT_NEW' })}>
          <div className="material-card--add__plus">＋</div>
          <div className="material-card--add__label">素材を登録</div>
        </button>
      </div>
    </>
  );
}
