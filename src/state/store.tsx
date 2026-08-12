import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Category, Material, MaterialDraft, Mode, Publication } from '../types';
import { seedMaterials, seedPublications } from '../data/seed';
import { emptySlots, type SlotMap } from './prompt';

const STORAGE_KEY = 'prompt-studio:data';

interface PersistedData {
  materials: Material[];
  publications: Publication[];
}

function loadPersisted(): PersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedData;
  } catch {
    // 壊れたデータは無視してシードにフォールバック
  }
  return { materials: seedMaterials, publications: seedPublications };
}

interface AppState extends PersistedData {
  mode: Mode;

  // レシピ
  editSlots: SlotMap;
  activeSlot: Category | null;

  // 素材
  matCat: Category;
  matEdit: null | 'new' | string;
  matDraft: MaterialDraft;
  matNewTag: string;

  // 公開
  pubTab: 'published' | 'draft';
  pubId: string | null;

  // 展示
  exChar: string | null;
}

const emptyDraft: MaterialDraft = { name: '', tags: [], note: '', refCount: 0 };

function initialState(): AppState {
  const persisted = loadPersisted();
  const firstPub = persisted.publications.find((p) => p.ipfsUrl !== '') ?? persisted.publications[0] ?? null;
  return {
    ...persisted,
    mode: 'recipe',
    editSlots: emptySlots(),
    activeSlot: null,
    matCat: 'character',
    matEdit: null,
    matDraft: emptyDraft,
    matNewTag: '',
    pubTab: firstPub && firstPub.ipfsUrl !== '' ? 'published' : 'draft',
    pubId: firstPub?.id ?? null,
    exChar: null,
  };
}

type Action =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SELECT_SLOT'; category: Category }
  | { type: 'SET_SLOT'; category: Category; materialId: string }
  | { type: 'SET_MAT_CAT'; category: Category }
  | { type: 'OPEN_MAT_NEW' }
  | { type: 'OPEN_MAT_EDIT'; id: string }
  | { type: 'CANCEL_MAT_EDIT' }
  | { type: 'SET_MAT_NAME'; value: string }
  | { type: 'SET_MAT_NOTE'; value: string }
  | { type: 'SET_MAT_NEW_TAG'; value: string }
  | { type: 'ADD_MAT_TAG' }
  | { type: 'REMOVE_MAT_TAG'; index: number }
  | { type: 'TOGGLE_MAT_REF'; index: number }
  | { type: 'SAVE_MAT' }
  | { type: 'DELETE_MAT'; id: string }
  | { type: 'SET_PUB_TAB'; tab: 'published' | 'draft' }
  | { type: 'SELECT_PUB'; id: string }
  | { type: 'NEW_PUB' }
  | { type: 'SET_PUB_NAME'; id: string; value: string }
  | { type: 'SET_PUB_IPFS'; id: string; value: string }
  | { type: 'SET_PUB_HTTP'; id: string; value: string }
  | { type: 'TOGGLE_PUB_OPTION'; id: string; key: 'prompt' | 'parts' | 'params' }
  | { type: 'TOGGLE_PUB_THUMB'; id: string }
  | { type: 'TOGGLE_PUB_HERO'; id: string; index: number }
  | { type: 'SELECT_EX_CHAR'; id: string | null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.mode, activeSlot: null, matEdit: null };

    case 'SELECT_SLOT':
      return { ...state, activeSlot: state.activeSlot === action.category ? null : action.category };

    case 'SET_SLOT': {
      const current = state.editSlots[action.category];
      const next = current === action.materialId ? null : action.materialId;
      return { ...state, editSlots: { ...state.editSlots, [action.category]: next } };
    }

    case 'SET_MAT_CAT':
      return { ...state, matCat: action.category, matEdit: null };

    case 'OPEN_MAT_NEW':
      return { ...state, matEdit: 'new', matDraft: emptyDraft, matNewTag: '' };

    case 'OPEN_MAT_EDIT': {
      const mat = state.materials.find((m) => m.id === action.id);
      if (!mat) return state;
      return {
        ...state,
        matEdit: action.id,
        matDraft: { name: mat.name, tags: [...mat.tags], note: mat.note, refCount: mat.refCount },
        matNewTag: '',
      };
    }

    case 'CANCEL_MAT_EDIT':
      return { ...state, matEdit: null };

    case 'SET_MAT_NAME':
      return { ...state, matDraft: { ...state.matDraft, name: action.value } };

    case 'SET_MAT_NOTE':
      return { ...state, matDraft: { ...state.matDraft, note: action.value } };

    case 'SET_MAT_NEW_TAG':
      return { ...state, matNewTag: action.value };

    case 'ADD_MAT_TAG': {
      const value = state.matNewTag.trim();
      if (!value) return { ...state, matNewTag: '' };
      return {
        ...state,
        matDraft: { ...state.matDraft, tags: [...state.matDraft.tags, value] },
        matNewTag: '',
      };
    }

    case 'REMOVE_MAT_TAG':
      return {
        ...state,
        matDraft: { ...state.matDraft, tags: state.matDraft.tags.filter((_, i) => i !== action.index) },
      };

    case 'TOGGLE_MAT_REF': {
      const { refCount } = state.matDraft;
      const next = action.index < refCount ? refCount - 1 : Math.min(3, refCount + 1);
      return { ...state, matDraft: { ...state.matDraft, refCount: next } };
    }

    case 'SAVE_MAT': {
      const name = state.matDraft.name.trim();
      if (!name) return state;
      if (state.matEdit === 'new') {
        const material: Material = {
          id: `mat-${Date.now().toString(36)}`,
          category: state.matCat,
          name,
          tags: state.matDraft.tags,
          note: state.matDraft.note,
          refCount: state.matDraft.refCount,
        };
        return { ...state, materials: [...state.materials, material], matEdit: null };
      }
      if (typeof state.matEdit === 'string') {
        const id = state.matEdit;
        return {
          ...state,
          materials: state.materials.map((m) =>
            m.id === id
              ? { ...m, name, tags: state.matDraft.tags, note: state.matDraft.note, refCount: state.matDraft.refCount }
              : m,
          ),
          matEdit: null,
        };
      }
      return state;
    }

    case 'DELETE_MAT':
      return { ...state, materials: state.materials.filter((m) => m.id !== action.id), matEdit: null };

    case 'SET_PUB_TAB':
      return { ...state, pubTab: action.tab };

    case 'SELECT_PUB':
      return { ...state, pubId: action.id };

    case 'NEW_PUB': {
      const firstChar = state.materials.find((m) => m.category === 'character');
      const pub: Publication = {
        id: `pub-${Date.now().toString(36)}`,
        name: '新しい公開',
        char: firstChar?.id ?? '',
        situation: null,
        outfit: null,
        background: null,
        effect: null,
        ipfsUrl: '',
        httpUrl: '',
        hasThumbnail: false,
        heroCount: 0,
        count: 0,
        updatedAt: new Date().toISOString().slice(0, 10),
        options: { prompt: true, parts: true, params: false },
      };
      return { ...state, publications: [...state.publications, pub], pubId: pub.id, pubTab: 'draft' };
    }

    case 'SET_PUB_NAME':
      return {
        ...state,
        publications: state.publications.map((p) => (p.id === action.id ? { ...p, name: action.value } : p)),
      };

    case 'SET_PUB_IPFS':
      return {
        ...state,
        publications: state.publications.map((p) =>
          p.id === action.id
            ? { ...p, ipfsUrl: action.value, updatedAt: new Date().toISOString().slice(0, 10) }
            : p,
        ),
      };

    case 'SET_PUB_HTTP':
      return {
        ...state,
        publications: state.publications.map((p) =>
          p.id === action.id
            ? { ...p, httpUrl: action.value, updatedAt: new Date().toISOString().slice(0, 10) }
            : p,
        ),
      };

    case 'TOGGLE_PUB_OPTION':
      return {
        ...state,
        publications: state.publications.map((p) =>
          p.id === action.id ? { ...p, options: { ...p.options, [action.key]: !p.options[action.key] } } : p,
        ),
      };

    case 'TOGGLE_PUB_THUMB':
      return {
        ...state,
        publications: state.publications.map((p) =>
          p.id === action.id ? { ...p, hasThumbnail: !p.hasThumbnail } : p,
        ),
      };

    case 'TOGGLE_PUB_HERO':
      return {
        ...state,
        publications: state.publications.map((p) => {
          if (p.id !== action.id) return p;
          const next = action.index < p.heroCount ? p.heroCount - 1 : Math.min(3, p.heroCount + 1);
          return { ...p, heroCount: next };
        }),
      };

    case 'SELECT_EX_CHAR':
      return { ...state, exChar: action.id };

    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    const data: PersistedData = { materials: state.materials, publications: state.publications };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [state.materials, state.publications]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export type { AppState, Action };
