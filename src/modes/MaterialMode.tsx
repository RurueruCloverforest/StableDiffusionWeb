import { useStore } from '../state/store';
import { MaterialForm } from './MaterialForm';
import { MaterialList } from './MaterialList';

export function MaterialMode() {
  const { state } = useStore();
  return state.matEdit === null ? <MaterialList /> : <MaterialForm />;
}
