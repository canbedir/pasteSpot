import { create } from 'zustand';
import { loadSnapshot, queueSave } from './db';
import {
  DEFAULT_SETTINGS,
  type DeskSurface,
  type DeskTone,
  type Page,
  type Settings,
  type Slip,
  type Snapshot,
} from './types';

/** How many slips make a desk feel full enough to open the next page. */
export const PAGE_CAPACITY = 14;

interface DeskState {
  ready: boolean;
  pages: Page[];
  slips: Slip[];
  settings: Settings;
  activePageId: string;
  query: string;

  load: () => Promise<void>;
  addSlip: (x: number, y: number) => string;
  updateSlip: (id: string, body: string) => void;
  moveSlip: (id: string, x: number, y: number) => void;
  removeSlip: (id: string) => void;
  addPage: (name?: string) => string;
  renamePage: (id: string, name: string) => void;
  setActivePage: (id: string) => void;
  setQuery: (query: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function makePage(order: number, name?: string): Page {
  return {
    id: newId(),
    name: name ?? (order === 0 ? 'desk' : `page ${order + 1}`),
    order,
    createdAt: Date.now(),
  };
}

export const useDesk = create<DeskState>((set, get) => ({
  ready: false,
  pages: [],
  slips: [],
  settings: { ...DEFAULT_SETTINGS },
  activePageId: '',
  query: '',

  load: async () => {
    const snapshot = await loadSnapshot();
    const pages = snapshot.pages.length ? snapshot.pages : [makePage(0)];
    set({
      ready: true,
      pages,
      slips: snapshot.slips,
      settings: snapshot.settings,
      activePageId: pages[0]!.id,
    });
  },

  addSlip: (x, y) => {
    const id = newId();
    const now = Date.now();
    set((state) => ({
      slips: [
        ...state.slips,
        { id, pageId: state.activePageId, body: '', x, y, createdAt: now, updatedAt: now },
      ],
    }));
    return id;
  },

  updateSlip: (id, body) =>
    set((state) => ({
      slips: state.slips.map((slip) =>
        slip.id === id ? { ...slip, body, updatedAt: Date.now() } : slip,
      ),
    })),

  moveSlip: (id, x, y) =>
    set((state) => ({
      slips: state.slips.map((slip) =>
        slip.id === id ? { ...slip, x, y, updatedAt: Date.now() } : slip,
      ),
    })),

  removeSlip: (id) =>
    set((state) => ({ slips: state.slips.filter((slip) => slip.id !== id) })),

  addPage: (name) => {
    const page = makePage(get().pages.length, name);
    set((state) => ({ pages: [...state.pages, page], activePageId: page.id }));
    return page.id;
  },

  renamePage: (id, name) =>
    set((state) => ({
      pages: state.pages.map((page) => (page.id === id ? { ...page, name } : page)),
    })),

  setActivePage: (id) => set({ activePageId: id }),
  setQuery: (query) => set({ query }),

  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),
}));

/* -------------------------------------------------------------------------- */
/* selectors                                                                  */
/* -------------------------------------------------------------------------- */

export const slipsOnPage = (state: DeskState, pageId: string): Slip[] =>
  state.slips.filter((slip) => slip.pageId === pageId);

export const isFull = (state: DeskState, pageId: string): boolean =>
  slipsOnPage(state, pageId).length >= PAGE_CAPACITY;

/**
 * A search does not produce a list. Matching slips stay exactly where they are
 * and the rest dim, so spatial memory survives the search.
 */
export const matchesQuery = (slip: Slip, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return slip.body.toLowerCase().includes(needle);
};

export const matchCountOnPage = (state: DeskState, pageId: string): number => {
  if (!state.query.trim()) return 0;
  return slipsOnPage(state, pageId).filter((slip) => matchesQuery(slip, state.query)).length;
};

/* -------------------------------------------------------------------------- */
/* persistence                                                                */
/* -------------------------------------------------------------------------- */

let lastPersisted: Snapshot | null = null;

useDesk.subscribe((state) => {
  if (!state.ready) return;
  const snapshot: Snapshot = {
    version: 1,
    pages: state.pages,
    slips: state.slips,
    settings: state.settings,
  };
  // Query and active page are session state, not saved state.
  if (
    lastPersisted &&
    lastPersisted.pages === snapshot.pages &&
    lastPersisted.slips === snapshot.slips &&
    lastPersisted.settings === snapshot.settings
  ) {
    return;
  }
  lastPersisted = snapshot;
  queueSave(snapshot);
});

export type { DeskState, DeskSurface, DeskTone };
