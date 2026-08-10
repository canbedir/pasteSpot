/** What a slip's text turned out to be. Derived on render, never stored. */
export type SlipKind = 'code' | 'link' | 'text';

export type DeskTone = 'moss' | 'walnut' | 'ink' | 'graphite' | 'plum';
export type DeskSurface = 'pool' | 'contour' | 'flat';

/**
 * The face a prose slip is set in. Codes stay monospace and links stay sans
 * whatever this says — those two are typeset for what they are, not for taste.
 *
 * Only faces the site already ships are offered. Anything else would mean new font
 * files, and an offline-first app that has to fetch a font is not offline-first.
 */
export type ProseFace = 'serif' | 'sans';

/** How large the writing on a slip is. Comfort, and an accessibility floor. */
export type TextSize = 'small' | 'normal' | 'large';

export interface Slip {
  id: string;
  pageId: string;
  /** Exactly what was typed or pasted. Never normalised. */
  body: string;
  /**
   * Words this slip should also be findable by, added after it was made. Absent
   * on almost every slip, which is why it is optional rather than an empty array.
   */
  keywords?: string[];
  /** 0-100, percentage of desk width. Percentages survive a resize; pixels do not. */
  x: number;
  /** 0-100, percentage of desk height. */
  y: number;
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface Settings {
  tone: DeskTone;
  surface: DeskSurface;
  prose: ProseFace;
  size: TextSize;
}

/** The desk's measured size in px. Never stored; it belongs to the screen. */
export interface Viewport {
  w: number;
  h: number;
}

export interface Snapshot {
  version: number;
  pages: Page[];
  slips: Slip[];
  settings: Settings;
}

export const DESK_TONES: readonly DeskTone[] = ['moss', 'walnut', 'ink', 'graphite', 'plum'];
export const DESK_SURFACES: readonly DeskSurface[] = ['pool', 'contour', 'flat'];
export const PROSE_FACES: readonly ProseFace[] = ['serif', 'sans'];
export const TEXT_SIZES: readonly TextSize[] = ['small', 'normal', 'large'];

export const DEFAULT_SETTINGS: Settings = {
  tone: 'moss',
  surface: 'pool',
  prose: 'serif',
  size: 'normal',
};

/**
 * The range a stored position may hold, in percent.
 *
 * This is a sanity rail, not a layout rule. It used to stop at 64% across
 * because it had to assume the widest slip that could ever exist, which cost a
 * narrow slip a quarter of the desk. What a given slip can actually reach is
 * decided from its measured size in `fit.ts`.
 */
export const SLIP_BOUNDS = { minX: 0, maxX: 100, minY: 0, maxY: 100 } as const;

export function clampToDesk(x: number, y: number): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = SLIP_BOUNDS;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}
