/** What a slip's text turned out to be. Derived on render, never stored. */
export type SlipKind = 'code' | 'link' | 'text';

export type DeskTone = 'moss' | 'walnut' | 'ink' | 'graphite' | 'plum';
export type DeskSurface = 'pool' | 'contour' | 'flat';

export interface Slip {
  id: string;
  pageId: string;
  /** Exactly what was typed or pasted. Never normalised. */
  body: string;
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
}

export interface Snapshot {
  version: number;
  pages: Page[];
  slips: Slip[];
  settings: Settings;
}

export const DESK_TONES: readonly DeskTone[] = ['moss', 'walnut', 'ink', 'graphite', 'plum'];
export const DESK_SURFACES: readonly DeskSurface[] = ['pool', 'contour', 'flat'];

export const DEFAULT_SETTINGS: Settings = {
  tone: 'moss',
  surface: 'pool',
};

/**
 * Where a slip's top-left corner may sit, in percent. The right and bottom
 * limits leave room for the slip's own width and for the tab strip, so a slip
 * can never be dropped somewhere it cannot be read or reached.
 */
export const SLIP_BOUNDS = { minX: 2, maxX: 64, minY: 5, maxY: 72 } as const;

export function clampToDesk(x: number, y: number): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = SLIP_BOUNDS;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}
