import { create } from 'zustand';
import { loadSnapshot, queueSave, SCHEMA_VERSION } from './db';
import { findFreeSpot } from './placement';
import {
  DEFAULT_SETTINGS,
  type DeskSurface,
  type DeskTone,
  type Page,
  type Settings,
  type Slip,
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
  addSlip: (x: number, y: number, body?: string) => string;
  captureText: (body: string) => string | null;
  updateSlip: (id: string, body: string) => void;
  moveSlip: (id: string, x: number, y: number) => void;
  removeSlip: (id: string) => void;
  addPage: (name?: string) => string;
  renamePage: (id: string, name: string) => void;
  removePage: (id: string) => void;
  setActivePage: (id: string) => void;
  stepPage: (delta: number) => void;
  importSnapshot: (pages: Page[], slips: Slip[]) => void;
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
    const known = new Set(pages.map((page) => page.id));
    set({
      ready: true,
      pages,
      // Defensive: drop blanks written by an older build, and orphans whose
      // page no longer exists, so neither can haunt the desk invisibly.
      slips: snapshot.slips.filter((slip) => isRealSlip(slip) && known.has(slip.pageId)),
      settings: snapshot.settings,
      activePageId: pages[0]!.id,
    });
  },

  addSlip: (x, y, body = '') => {
    const id = newId();
    const now = Date.now();
    set((state) => ({
      slips: [
        ...state.slips,
        { id, pageId: state.activePageId, body, x, y, createdAt: now, updatedAt: now },
      ],
    }));
    return id;
  },

  /**
   * Take text that arrived without a click — a keyboard paste, or a capture
   * handed over by the extension — and put it somewhere sensible.
   *
   * The single path for every click-free capture, so the keyboard and the
   * extension cannot drift apart on placement or page overflow.
   */
  captureText: (body) => {
    const text = body.trim();
    if (!text) return null;

    if (slipsOnPage(get(), get().activePageId).length >= PAGE_CAPACITY) {
      get().addPage();
    }
    const spot = findFreeSpot(slipsOnPage(get(), get().activePageId));
    return get().addSlip(spot.x, spot.y, text);
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
      pages: state.pages.map((page) =>
        page.id === id ? { ...page, name: name.trim() || page.name } : page,
      ),
    })),

  removePage: (id) =>
    set((state) => {
      // Never leave the desk with no page at all; there would be nowhere to click.
      if (state.pages.length <= 1) return state;

      const index = state.pages.findIndex((page) => page.id === id);
      const pages = state.pages
        .filter((page) => page.id !== id)
        .map((page, order) => ({ ...page, order }));
      const nextActive =
        state.activePageId === id
          ? pages[Math.min(index, pages.length - 1)]!.id
          : state.activePageId;

      return {
        pages,
        slips: state.slips.filter((slip) => slip.pageId !== id),
        activePageId: nextActive,
      };
    }),

  setActivePage: (id) => set({ activePageId: id }),

  stepPage: (delta) =>
    set((state) => {
      const index = state.pages.findIndex((page) => page.id === state.activePageId);
      if (index === -1) return state;
      const next = index + delta;
      if (next < 0 || next >= state.pages.length) return state;
      return { activePageId: state.pages[next]!.id };
    }),
  setQuery: (query) => set({ query }),

  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),

  /**
   * Imports only ever add. The ids arrive already remapped by parseImport, so
   * restoring a backup onto a desk that already has slips duplicates them
   * rather than replacing anything.
   */
  importSnapshot: (pages, slips) =>
    set((state) => {
      // Restoring onto an untouched desk should not leave the empty starter
      // page behind, or a backup of "desk" arrives next to an empty "desk".
      const untouched = state.pages.length === 1 && state.slips.length === 0;
      const existing = untouched ? [] : state.pages;

      const appended = pages.map((page, index) => ({
        ...page,
        order: existing.length + index,
      }));

      return {
        pages: [...existing, ...appended],
        slips: [...state.slips, ...slips],
        activePageId: appended[0]?.id ?? state.activePageId,
      };
    }),
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

/** Last persisted source references, so an unrelated change does not trigger a write. */
let lastSources: Pick<DeskState, 'pages' | 'slips' | 'settings'> | null = null;

/** A slip that was never typed into is a misclick, not data. */
const isRealSlip = (slip: Slip): boolean => slip.body.trim() !== '';

useDesk.subscribe((state) => {
  if (!state.ready) return;

  // Query and active page are session state, not saved state.
  if (
    lastSources &&
    lastSources.pages === state.pages &&
    lastSources.slips === state.slips &&
    lastSources.settings === state.settings
  ) {
    return;
  }
  lastSources = { pages: state.pages, slips: state.slips, settings: state.settings };

  queueSave({
    version: SCHEMA_VERSION,
    pages: state.pages,
    // Filtered on the way out so closing the tab on an untouched slip does not
    // resurrect a blank one on the next visit.
    slips: state.slips.filter(isRealSlip),
    settings: state.settings,
  });
});

export type { DeskState, DeskSurface, DeskTone };
