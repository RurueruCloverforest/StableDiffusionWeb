import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Category, Material, MaterialDraft, Mode, Publication } from '../types';
import { seedMaterials, seedPublications } from '../data/seed';
import { idbGet, idbSet } from './idb';
import { mergeImportedMaterials } from './materialsIO';
import { mergeImportedPublications } from './publicationsIO';
import { composeName, emptySlots, randomizeSlots, recategorizePublication, type SlotMap } from './prompt';

// IndexedDB 上のレコードキー。旧バージョンの localStorage キーは移行元としてのみ参照する
const STORAGE_KEY = 'prompt-studio:data';
const LEGACY_LOCAL_STORAGE_KEY = 'prompt-studio:data';

interface PersistedData {
  materials: Material[];
  publications: Publication[];
}

const CATEGORY_VALUES: Category[] = ['character', 'situation', 'outfit', 'background', 'effect'];

// 旧スキーマ（refCount など）で保存されたブラウザのデータでも、また
// インポートされた外部JSONでも、欠けているフィールドを補って安全に読み込めるようにする
export function normalizeMaterial(raw: Record<string, unknown>): Material {
  return {
    id: String(raw.id ?? `mat-${Date.now().toString(36)}`),
    category: CATEGORY_VALUES.includes(raw.category as Category) ? (raw.category as Category) : 'character',
    name: typeof raw.name === 'string' ? raw.name : '無題',
    alternativeName: typeof raw.alternativeName === 'string' ? raw.alternativeName : '',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    note: typeof raw.note === 'string' ? raw.note : '',
    refImage: typeof raw.refImage === 'string' ? raw.refImage : null,
    isReference: raw.isReference === true,
  };
}

// 旧スキーマ（hasThumbnail/heroCount 等）で保存されたブラウザのデータでも
// 欠けているフィールドを補って安全に読み込めるようにする
export function normalizePublication(raw: Record<string, unknown>): Publication {
  const heroSrc: unknown[] = Array.isArray(raw.heroImages) ? raw.heroImages : [];
  return {
    id: String(raw.id ?? `pub-${Date.now().toString(36)}`),
    name: typeof raw.name === 'string' ? raw.name : '無題',
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    char: typeof raw.char === 'string' ? raw.char : '',
    situation: typeof raw.situation === 'string' ? raw.situation : null,
    outfit: typeof raw.outfit === 'string' ? raw.outfit : null,
    background: typeof raw.background === 'string' ? raw.background : null,
    effect: typeof raw.effect === 'string' ? raw.effect : null,
    ipfsUrl: typeof raw.ipfsUrl === 'string' ? raw.ipfsUrl : '',
    httpUrl: typeof raw.httpUrl === 'string' ? raw.httpUrl : '',
    thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : null,
    heroImages: [0, 1, 2].map((i) => (typeof heroSrc[i] === 'string' ? heroSrc[i] : null)),
    count: typeof raw.count === 'number' ? raw.count : 0,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString().slice(0, 10),
    isReference: raw.isReference === true,
  };
}

async function loadPersisted(): Promise<PersistedData> {
  const data = await readPersisted();
  // 保存されているキャラ・状況・服装・背景・演出のID参照は信用せず、保存済みプロンプトを
  // 今の素材データへ毎回再マッチングし直す。これにより素材の削除・変更に自動で追従する
  return { materials: data.materials, publications: data.publications.map((p) => recategorizePublication(data.materials, p)) };
}

function parsePersisted(parsed: unknown): PersistedData {
  const materials = Array.isArray((parsed as Record<string, unknown> | null)?.materials)
    ? ((parsed as Record<string, unknown>).materials as Record<string, unknown>[]).map(normalizeMaterial)
    : seedMaterials;
  const publications = Array.isArray((parsed as Record<string, unknown> | null)?.publications)
    ? ((parsed as Record<string, unknown>).publications as Record<string, unknown>[]).map(normalizePublication)
    : seedPublications;
  return { materials, publications };
}

async function readPersisted(): Promise<PersistedData> {
  try {
    const stored = await idbGet<PersistedData>(STORAGE_KEY);
    if (stored) return parsePersisted(stored);

    // IndexedDB にまだ何も無い場合、旧バージョンで使っていた localStorage からの
    // 一度きりの移行を試みる（localStorage は 5〜10MB 程度で容量が厳しいため IndexedDB へ移行した）。
    // 移行元の localStorage のデータは削除せず、そのまま残しておく
    const legacyRaw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
    if (legacyRaw) {
      const data = parsePersisted(JSON.parse(legacyRaw));
      await idbSet(STORAGE_KEY, data).catch(() => {});
      return data;
    }
  } catch {
    // 壊れたデータは無視してシードにフォールバック
  }
  return { materials: seedMaterials, publications: seedPublications };
}

interface AppState extends PersistedData {
  /** IndexedDB からの初回読み込みが完了したか。完了前は永続化用の書き込みを行わない */
  loaded: boolean;
  mode: Mode;

  // レシピ
  editSlots: SlotMap;
  activeSlot: Category | null;
  lockedSlots: Record<Category, boolean>;
  randomWeighted: boolean;

  // 素材
  matCat: Category;
  matEdit: null | 'new' | string;
  matDraft: MaterialDraft;
  matNewTag: string;

  // 公開
  pubTab: 'published' | 'draft';
  pubId: string | null;

  // 展示（キャラ→状況→服装の階層。string | null: 選択中の素材id、または EXHIBIT_UNSET センチネル）
  exChar: string | null;
  exSituation: string | null;
  exOutfit: string | null;
}

const emptyDraft: MaterialDraft = { name: '', alternativeName: '', tags: [], note: '', refImage: null };

const emptyLocks = (): Record<Category, boolean> => ({
  character: false,
  situation: false,
  outfit: false,
  background: false,
  effect: false,
});

// IndexedDB からの読み込みは非同期なので、読み込み完了までは空データで待機する
function initialState(): AppState {
  return {
    materials: [],
    publications: [],
    loaded: false,
    mode: 'recipe',
    editSlots: emptySlots(),
    activeSlot: null,
    lockedSlots: emptyLocks(),
    randomWeighted: false,
    matCat: 'character',
    matEdit: null,
    matDraft: emptyDraft,
    matNewTag: '',
    pubTab: 'draft',
    pubId: null,
    exChar: null,
    exSituation: null,
    exOutfit: null,
  };
}

type Action =
  | { type: 'HYDRATE'; materials: Material[]; publications: Publication[] }
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SELECT_SLOT'; category: Category }
  | { type: 'SET_SLOT'; category: Category; materialId: string }
  | { type: 'TOGGLE_SLOT_LOCK'; category: Category }
  | { type: 'TOGGLE_RANDOM_WEIGHTED' }
  | { type: 'RANDOMIZE_SLOTS' }
  | { type: 'SET_MAT_CAT'; category: Category }
  | { type: 'OPEN_MAT_NEW' }
  | { type: 'OPEN_MAT_EDIT'; id: string }
  | { type: 'CANCEL_MAT_EDIT' }
  | { type: 'SET_MAT_NAME'; value: string }
  | { type: 'SET_MAT_ALT_NAME'; value: string }
  | { type: 'SET_MAT_NOTE'; value: string }
  | { type: 'SET_MAT_NEW_TAG'; value: string }
  | { type: 'ADD_MAT_TAG' }
  | { type: 'REMOVE_MAT_TAG'; index: number }
  | { type: 'REORDER_MAT_TAG'; from: number; to: number }
  | { type: 'ADD_MAT_TAGS'; values: string[] }
  | { type: 'SET_MAT_REF_IMAGE'; dataUrl: string | null }
  | { type: 'SAVE_MAT' }
  | { type: 'DELETE_MAT'; id: string }
  | { type: 'IMPORT_MATERIALS'; materials: Material[]; asReference: boolean }
  | { type: 'IMPORT_PUBLICATIONS'; publications: Publication[]; asReference: boolean }
  | { type: 'SET_PUB_TAB'; tab: 'published' | 'draft' }
  | { type: 'SELECT_PUB'; id: string }
  | { type: 'NEW_PUB' }
  | { type: 'DELETE_PUB'; id: string }
  | { type: 'SET_PUB_IPFS'; id: string; value: string }
  | { type: 'SET_PUB_HTTP'; id: string; value: string }
  | { type: 'SET_PUB_COUNT'; id: string; value: number }
  | { type: 'SET_PUB_THUMBNAIL'; id: string; dataUrl: string | null }
  | { type: 'SET_PUB_HERO'; id: string; index: number; dataUrl: string | null }
  | {
      type: 'SET_PUB_PARTS';
      id: string;
      prompt: string;
      char: string;
      situation: string | null;
      outfit: string | null;
      background: string | null;
      effect: string | null;
    }
  | { type: 'SELECT_EX_CHAR'; id: string | null }
  | { type: 'SELECT_EX_SITUATION'; id: string | null }
  | { type: 'SELECT_EX_OUTFIT'; id: string | null };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE': {
      const firstPub = action.publications.find((p) => p.ipfsUrl !== '') ?? action.publications[0] ?? null;
      return {
        ...state,
        materials: action.materials,
        publications: action.publications,
        loaded: true,
        pubTab: firstPub && firstPub.ipfsUrl !== '' ? 'published' : 'draft',
        pubId: firstPub?.id ?? null,
      };
    }

    case 'SET_MODE':
      return { ...state, mode: action.mode, activeSlot: null, matEdit: null };

    case 'SELECT_SLOT':
      return { ...state, activeSlot: state.activeSlot === action.category ? null : action.category };

    case 'SET_SLOT': {
      const current = state.editSlots[action.category];
      const next = current === action.materialId ? null : action.materialId;
      return { ...state, editSlots: { ...state.editSlots, [action.category]: next } };
    }

    case 'TOGGLE_SLOT_LOCK':
      return {
        ...state,
        lockedSlots: { ...state.lockedSlots, [action.category]: !state.lockedSlots[action.category] },
      };

    case 'TOGGLE_RANDOM_WEIGHTED':
      return { ...state, randomWeighted: !state.randomWeighted };

    case 'RANDOMIZE_SLOTS':
      return {
        ...state,
        editSlots: randomizeSlots(
          state.materials,
          state.publications,
          state.editSlots,
          state.lockedSlots,
          state.randomWeighted,
        ),
      };

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
        matDraft: {
          name: mat.name,
          alternativeName: mat.alternativeName,
          tags: [...mat.tags],
          note: mat.note,
          refImage: mat.refImage,
        },
        matNewTag: '',
      };
    }

    case 'CANCEL_MAT_EDIT':
      return { ...state, matEdit: null };

    case 'SET_MAT_NAME':
      return { ...state, matDraft: { ...state.matDraft, name: action.value } };

    case 'SET_MAT_ALT_NAME':
      return { ...state, matDraft: { ...state.matDraft, alternativeName: action.value } };

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

    case 'ADD_MAT_TAGS':
      return {
        ...state,
        matDraft: { ...state.matDraft, tags: [...state.matDraft.tags, ...action.values] },
      };

    case 'REORDER_MAT_TAG': {
      if (action.from === action.to) return state;
      const tags = [...state.matDraft.tags];
      const [moved] = tags.splice(action.from, 1);
      tags.splice(action.to, 0, moved);
      return { ...state, matDraft: { ...state.matDraft, tags } };
    }

    case 'SET_MAT_REF_IMAGE':
      return { ...state, matDraft: { ...state.matDraft, refImage: action.dataUrl } };

    case 'SAVE_MAT': {
      const name = state.matDraft.name.trim();
      if (!name) return state;
      if (state.matEdit === 'new') {
        const material: Material = {
          id: `mat-${Date.now().toString(36)}`,
          category: state.matCat,
          name,
          alternativeName: state.matDraft.alternativeName.trim(),
          tags: state.matDraft.tags,
          note: state.matDraft.note,
          refImage: state.matDraft.refImage,
          isReference: false,
        };
        return { ...state, materials: [...state.materials, material], matEdit: null };
      }
      if (typeof state.matEdit === 'string') {
        const id = state.matEdit;
        return {
          ...state,
          materials: state.materials.map((m) =>
            m.id === id
              ? {
                  ...m,
                  name,
                  alternativeName: state.matDraft.alternativeName.trim(),
                  tags: state.matDraft.tags,
                  note: state.matDraft.note,
                  refImage: state.matDraft.refImage,
                }
              : m,
          ),
          matEdit: null,
        };
      }
      return state;
    }

    case 'DELETE_MAT':
      return { ...state, materials: state.materials.filter((m) => m.id !== action.id), matEdit: null };

    case 'IMPORT_MATERIALS':
      return {
        ...state,
        materials: mergeImportedMaterials(state.materials, action.materials, action.asReference).merged,
      };

    case 'IMPORT_PUBLICATIONS': {
      const merged = mergeImportedPublications(state.publications, action.publications, action.asReference).merged;
      // 素材ID参照はインポート元と食い違いうるため、今の素材データへその場で再マッチングし直す
      return { ...state, publications: merged.map((p) => recategorizePublication(state.materials, p)) };
    }

    case 'SET_PUB_TAB':
      return { ...state, pubTab: action.tab };

    case 'SELECT_PUB':
      return { ...state, pubId: action.id };

    case 'DELETE_PUB':
      return {
        ...state,
        publications: state.publications.filter((p) => p.id !== action.id),
        pubId: state.pubId === action.id ? null : state.pubId,
      };

    case 'NEW_PUB': {
      const firstChar = state.materials.find((m) => m.category === 'character');
      const slots: SlotMap = {
        character: firstChar?.id ?? null,
        situation: null,
        outfit: null,
        background: null,
        effect: null,
      };
      const pub: Publication = {
        id: `pub-${Date.now().toString(36)}`,
        name: composeName(state.materials, slots),
        prompt: '',
        char: firstChar?.id ?? '',
        situation: null,
        outfit: null,
        background: null,
        effect: null,
        ipfsUrl: '',
        httpUrl: '',
        thumbnail: null,
        heroImages: [null, null, null],
        count: 0,
        updatedAt: new Date().toISOString().slice(0, 10),
        isReference: false,
      };
      return { ...state, publications: [...state.publications, pub], pubId: pub.id, pubTab: 'draft' };
    }

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

    case 'SET_PUB_COUNT':
      return {
        ...state,
        publications: state.publications.map((p) =>
          p.id === action.id
            ? { ...p, count: action.value, updatedAt: new Date().toISOString().slice(0, 10) }
            : p,
        ),
      };

    case 'SET_PUB_THUMBNAIL':
      return {
        ...state,
        publications: state.publications.map((p) =>
          p.id === action.id ? { ...p, thumbnail: action.dataUrl } : p,
        ),
      };

    case 'SET_PUB_HERO':
      return {
        ...state,
        publications: state.publications.map((p) => {
          if (p.id !== action.id) return p;
          const heroImages = [...p.heroImages];
          heroImages[action.index] = action.dataUrl;
          return { ...p, heroImages };
        }),
      };

    case 'SET_PUB_PARTS': {
      const slots: SlotMap = {
        character: action.char,
        situation: action.situation,
        outfit: action.outfit,
        background: action.background,
        effect: action.effect,
      };
      const name = composeName(state.materials, slots);
      return {
        ...state,
        publications: state.publications.map((p) =>
          p.id === action.id
            ? {
                ...p,
                name,
                prompt: action.prompt,
                char: action.char,
                situation: action.situation,
                outfit: action.outfit,
                background: action.background,
                effect: action.effect,
                updatedAt: new Date().toISOString().slice(0, 10),
              }
            : p,
        ),
      };
    }

    case 'SELECT_EX_CHAR':
      return { ...state, exChar: action.id, exSituation: null, exOutfit: null };

    case 'SELECT_EX_SITUATION':
      return { ...state, exSituation: action.id, exOutfit: null };

    case 'SELECT_EX_OUTFIT':
      return { ...state, exOutfit: action.id };

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

  // 初回のみ、IndexedDB（無ければ旧 localStorage から移行）を読み込んで反映する
  useEffect(() => {
    let cancelled = false;
    loadPersisted().then(({ materials, publications }) => {
      if (!cancelled) dispatch({ type: 'HYDRATE', materials, publications });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 初回読み込みが終わるまでは、空データで上書き保存してしまわないよう書き込みを止める
  useEffect(() => {
    if (!state.loaded) return;
    const data: PersistedData = { materials: state.materials, publications: state.publications };
    idbSet(STORAGE_KEY, data).catch(() => {
      // 書き込み失敗（容量超過など）はここでは通知しない。今後 UI 側で表示する余地はある
    });
  }, [state.loaded, state.materials, state.publications]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export type { AppState, Action };
