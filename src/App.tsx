import { ModeRail } from './components/ModeRail';
import { SecondPanel } from './components/SecondPanel';
import { ExhibitMode } from './modes/ExhibitMode';
import { MaterialMode } from './modes/MaterialMode';
import { PublishMode } from './modes/PublishMode';
import { RecipeMode } from './modes/RecipeMode';
import { useStore } from './state/store';

export default function App() {
  const { state } = useStore();

  if (!state.loaded) {
    return <div className="app-loading">読み込み中…</div>;
  }

  return (
    <div className="app">
      <ModeRail />
      <SecondPanel />
      <main className="main">
        {state.mode === 'recipe' && <RecipeMode />}
        {state.mode === 'material' && <MaterialMode />}
        {state.mode === 'publish' && <PublishMode />}
        {state.mode === 'exhibit' && <ExhibitMode />}
      </main>
    </div>
  );
}
