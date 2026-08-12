import type { Mode } from '../types';

export const MODES: { id: Mode; glyph: string; label: string }[] = [
  { id: 'recipe', glyph: '作', label: 'レシピ' },
  { id: 'material', glyph: '素', label: '素材' },
  { id: 'publish', glyph: '公', label: '公開' },
  { id: 'exhibit', glyph: '展', label: '展示' },
];
