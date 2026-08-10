import { create } from 'zustand';
import { loadSnapshot, queueSave, SCHEMA_VERSION } from './db';
import { deskLayout } from './layout';
import { findFreeSpot } from './placement';
import {
  DEFAULT_SETTINGS,
  type DeskSurface,
  type DeskTone,
  type Page,
  type Settings,
  type Slip,
  type Snapshot,
  type Viewport,
} from './types';

/** The desk before anything has measured it. */
const UNMEASURED: Viewport = { w: 0, h: 0 };

/**
 * How far back Ctrl+Z reaches. Each step holds two array references, and every
 * mutation is immutable, so the untouched slips are shared rather than copied.
 */
const HISTORY_LIMIT = 40;

/**
 * The desk as it was before one change.
 *
 * A whole-state snapshot rather than an inverse operation: there are a dozen ways
 * to change a desk and only one way to put it back, and the one way cannot drift
 * out of step with the others.
 */
interface HistoryStep {
  pages: Page[];
  slips: Slip[];
  activePageId: string;
  /** Lit after undoing, so the thing that came back says so itself. */
  revealId?: string;
}

interface DeskState {
  ready: boolean;
  pages: Page[];
  slips: Slip[];
  settings: Settings;
  activePageId: string;
  query: string;
  /** The slip a search just sent us to. Session state; never persisted. */
  revealedId: string | null;
  /** Undo steps, oldest first. Session state: history does not survive a reload. */
  history: HistoryStep[];
  /**
   * The desk's measured size. Session state, and the store's only knowledge of the
   * screen — how many slips a page holds and where they go both depend on it, and
   * a phone answers both differently from a laptop.
   */
  viewport: Viewport;

  load: () => Promise<void>;
  addSlip: (x: number, y: number, body?: string) => string;
  captureText: (body: string) => string | null;
  updateSlip: (id: string, body: string) => void;
  setKeywords: (id: string, keywords: string[]) => void;
  moveSlip: (id: string, x: number, y: number) => void;
  removeSlip: (id: string) => void;
  addPage: (name?: string) => string;
  renamePage: (id: string, name: string) => void;
  removePage: (id: string) => void;
  setActivePage: (id: string) => void;
  stepPage: (delta: number) => void;
  importSnapshot: (pages: Page[], slips: Slip[]) => void;
  adoptSnapshot: (snapshot: Snapshot) => void;
  setQuery: (query: string) => void;
  setViewport: (viewport: Viewport) => void;
  revealSlip: (id: string | null) => void;
  undo: () => void;
  canUndo: () => boolean;
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

export const useDesk = create<DeskState>((set, get) => {
  /**
   * Put the desk as it stands onto the undo stack.
   *
   * Called before the change, never after. Typing is deliberately not recorded:
   * a contenteditable already has the browser's own undo, and one step per
   * keystroke would bury everything worth going back to.
   */
  const remember = (revealId?: string) =>
    set((state) => ({
      history: [
        ...state.history.slice(-(HISTORY_LIMIT - 1)),
        {
          pages: state.pages,
          slips: state.slips,
          activePageId: state.activePageId,
          ...(revealId ? { revealId } : {}),
        },
      ],
    }));

  return {
  ready: false,
  pages: [],
  slips: [],
  settings: { ...DEFAULT_SETTINGS },
  activePageId: '',
  query: '',
  revealedId: null,
  history: [],
  viewport: UNMEASURED,

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
    // A slip made by a click is provisional until it holds something, so it does
    // not belong on the undo stack; a capture that arrived with text does.
    if (body.trim()) remember();
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

    const layout = deskLayout(get().viewport.w, get().viewport.h);
    if (slipsOnPage(get(), get().activePageId).length >= layout.capacity) {
      get().addPage();
    }
    const spot = findFreeSpot(slipsOnPage(get(), get().activePageId), layout);
    return get().addSlip(spot.x, spot.y, text);
  },

  updateSlip: (id, body) =>
    set((state) => ({
      slips: state.slips.map((slip) =>
        slip.id === id ? { ...slip, body, updatedAt: Date.now() } : slip,
      ),
    })),

  /**
   * Keywords are metadata, not content, so this deliberately leaves updatedAt
   * alone: labelling a slip months later must not make it look freshly written.
   */
  setKeywords: (id, keywords) => {
    remember(id);
    set((state) => ({
      slips: state.slips.map((slip) =>
        slip.id === id
          ? { ...slip, keywords: keywords.length ? keywords : undefined }
          : slip,
      ),
    }));
  },

  /**
   * A moved slip also comes to the front.
   *
   * Paint order is array order, so a slip dropped onto an older one used to end
   * up underneath it with no way to raise it — its text simply gone. Moving is
   * the gesture for arranging, so it is the right moment to restack, and paper
   * you have just handled sitting on top is what paper does.
   */
  moveSlip: (id, x, y) => {
    remember(id);
    set((state) => {
      const moved = state.slips.find((slip) => slip.id === id);
      if (!moved) return state;
      return {
        slips: [
          ...state.slips.filter((slip) => slip.id !== id),
          { ...moved, x, y, updatedAt: Date.now() },
        ],
      };
    });
  },

  removeSlip: (id) => {
    // A blank slip is a misclick being cleaned up, not a deletion to regret.
    if (get().slips.find((slip) => slip.id === id)?.body.trim()) remember(id);
    set((state) => ({ slips: state.slips.filter((slip) => slip.id !== id) }));
  },

  addPage: (name) => {
    remember();
    const page = makePage(get().pages.length, name);
    set((state) => ({ pages: [...state.pages, page], activePageId: page.id }));
    return page.id;
  },

  renamePage: (id, name) => {
    remember();
    set((state) => ({
      pages: state.pages.map((page) =>
        page.id === id ? { ...page, name: name.trim() || page.name } : page,
      ),
    }));
  },

  removePage: (id) => {
    remember();
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
    });
  },

  setActivePage: (id) => set({ activePageId: id }),

  stepPage: (delta) =>
    set((state) => {
      const index = state.pages.findIndex((page) => page.id === state.activePageId);
      if (index === -1) return state;
      const next = index + delta;
      if (next < 0 || next >= state.pages.length) return state;
      return { activePageId: state.pages[next]!.id };
    }),
  /**
   * Take on a desk that another tab wrote.
   *
   * `lastSources` is primed with the incoming arrays before the state is set, so the
   * persistence subscriber sees nothing new and does not write this straight back —
   * which would broadcast again, and again, between the two tabs forever.
   *
   * The undo stack is dropped. Its steps describe a desk that no longer exists, and
   * undoing into one of them would quietly revert the other tab's work.
   */
  adoptSnapshot: (snapshot) =>
    set((state) => {
      // A snapshot with no pages means nothing has been saved yet, which is never
      // worth adopting over a desk that is already open.
      if (snapshot.pages.length === 0) return state;

      const slips = snapshot.slips.filter(isRealSlip);
      lastSources = { pages: snapshot.pages, slips, settings: snapshot.settings };

      return {
        pages: snapshot.pages,
        slips,
        settings: snapshot.settings,
        // The page we were looking at may have been deleted in the other tab.
        activePageId: snapshot.pages.some((page) => page.id === state.activePageId)
          ? state.activePageId
          : (snapshot.pages[0]?.id ?? state.activePageId),
        history: [],
      };
    }),

  setQuery: (query) => set({ query }),

  setViewport: (viewport) =>
    set((state) =>
      state.viewport.w === viewport.w && state.viewport.h === viewport.h
        ? state
        : { viewport },
    ),

  /**
   * Marks the one slip a search was looking for. Search used to jump to the page
   * and stop there, which left the person to find the slip among fourteen others
   * by eye — the work the search was supposed to do.
   */
  revealSlip: (id) => set({ revealedId: id }),

  canUndo: () => get().history.length > 0,

  /**
   * Put the desk back one step.
   *
   * A slip's delete button was one click, unconfirmed and final, on a product
   * whose whole claim is that nothing gets lost. The answer to a destructive
   * click is being able to take it back rather than being asked twice, which is
   * why deleting a slip still asks nothing. Deleting a page keeps its
   * confirmation: it takes fourteen slips with it, and undo is session-only.
   */
  undo: () =>
    set((state) => {
      const step = state.history.at(-1);
      if (!step) return state;

      return {
        pages: step.pages,
        slips: step.slips,
        // Undoing a new page leaves the desk pointing at one that no longer
        // exists, so the restored page has to be checked before it is trusted.
        activePageId: step.pages.some((page) => page.id === step.activePageId)
          ? step.activePageId
          : (step.pages[0]?.id ?? state.activePageId),
        // Lighting up what came back is the whole acknowledgement: no toast, no
        // banner, and no doubt about which slip it was.
        revealedId: step.revealId ?? null,
        history: state.history.slice(0, -1),
      };
    }),

  updateSettings: (patch) =>
    set((state) => ({ settings: { ...state.settings, ...patch } })),

  /**
   * Imports only ever add. The ids arrive already remapped by parseImport, so
   * restoring a backup onto a desk that already has slips duplicates them
   * rather than replacing anything.
   */
  importSnapshot: (pages, slips) => {
    // An import that turns out to be the wrong file drops a whole second desk
    // onto this one, so it is worth one undo step of its own.
    remember();
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
    });
  },
  };
});

/* -------------------------------------------------------------------------- */
/* selectors                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Slips grouped by page, rebuilt only when the slips array itself changes.
 *
 * `slipsOnPage` is called once per page and once per tab on every render, so
 * filtering the whole array each time made rendering cost pages x slips: 560,000
 * comparisons for a 200-page desk, on every keystroke of a search. Grouping once
 * makes it a map lookup, and returning the same array each time lets a memoised
 * slip skip re-rendering entirely.
 */
let groupedFrom: Slip[] | null = null;
let grouped = new Map<string, Slip[]>();
const NO_SLIPS: Slip[] = [];

function byPage(slips: Slip[]): Map<string, Slip[]> {
  if (groupedFrom === slips) return grouped;
  const next = new Map<string, Slip[]>();
  for (const slip of slips) {
    const list = next.get(slip.pageId);
    if (list) list.push(slip);
    else next.set(slip.pageId, [slip]);
  }
  groupedFrom = slips;
  grouped = next;
  return next;
}

export const slipsOnPage = (state: DeskState, pageId: string): Slip[] =>
  byPage(state.slips).get(pageId) ?? NO_SLIPS;

/** How many slips this desk holds before the next page opens. */
export const pageCapacity = (state: DeskState): number =>
  deskLayout(state.viewport.w, state.viewport.h).capacity;

export const isFull = (state: DeskState, pageId: string): boolean =>
  slipsOnPage(state, pageId).length >= pageCapacity(state);

/**
 * The most recently captured slips, newest first.
 *
 * This is what an empty search box should offer. The thing a person most often
 * wants back is the thing they just put down, and asking them to remember and
 * type part of it first is work the desk can do for them.
 */
export const recentSlips = (state: DeskState, limit: number): Slip[] =>
  [...state.slips].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);

/**
 * A search does not produce a list. Matching slips stay exactly where they are
 * and the rest dim, so spatial memory survives the search.
 *
 * Keywords are searched alongside the body: a slip whose text is `a123fff4` can
 * only be found by something a person would actually think to type.
 */
export const matchesQuery = (slip: Slip, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (slip.body.toLowerCase().includes(needle)) return true;
  return slip.keywords?.some((keyword) => keyword.includes(needle)) ?? false;
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
