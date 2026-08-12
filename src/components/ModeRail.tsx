import { MODES } from '../state/modes';
import { useStore } from '../state/store';

export function ModeRail() {
  const { state, dispatch } = useStore();

  return (
    <nav className="mode-rail">
      <div className="mode-rail__logo" />
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`mode-rail__btn ${state.mode === m.id ? 'is-active' : ''}`}
          onClick={() => dispatch({ type: 'SET_MODE', mode: m.id })}
        >
          <span className="mode-rail__glyph">{m.glyph}</span>
          <span className="mode-rail__label">{m.label}</span>
        </button>
      ))}
      <div className="mode-rail__settings" title="設定（未実装）">
        設
      </div>
    </nav>
  );
}
