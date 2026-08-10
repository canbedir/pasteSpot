/**
 * Where a slip actually fits on the desk.
 *
 * Position is stored as a percentage so a resize does not scramble the desk, but
 * whether a slip *fits* depends on pixels: a six-digit code is 140px wide and a
 * pasted paragraph is 300px, and the same 88% is comfortable for one and off the
 * screen for the other.
 *
 * So the stored percentage is an intent, and this is the only thing that decides
 * where the paper lands. It runs on drag, on render, and after a resize, which is
 * why a slip that fitted on a wide window stays reachable on a narrow one.
 */

/** Breathing room at the desk edge, in px. Paper never touches the rim. */
export const DESK_EDGE = 10;

/** Kept clear at the bottom for the tab strip, in px. */
export const TAB_RESERVE = 40;

/**
 * Kept clear at the top for the corner buttons, in px.
 *
 * This only started to matter once the right-hand side of the desk became
 * reachable: a slip placed at the top right used to be impossible, and now lands
 * under `search / pages / settings`. Allows for the paperclip, which overhangs
 * the paper by 11px.
 */
export const TOP_RESERVE = 64;

export interface FitInput {
  /** Requested top-left, in percent of the desk. */
  x: number;
  y: number;
  /** The slip's own rendered size, in px. */
  slipW: number;
  slipH: number;
  /** The desk's size, in px. */
  deskW: number;
  deskH: number;
  /**
   * How much of the top to keep clear, in px. Defaults to the corner buttons'
   * band; the "not saving" bar adds its own height on top, because a warning that
   * covers the slip it is warning you about is worse than none.
   */
  topReserve?: number;
}

/**
 * Clamp a requested position to what the desk can hold, and hand it back in
 * percent. A slip larger than the desk pins to the top-left rather than being
 * pushed off it — unreadable beats unreachable.
 */
export function fitOnDesk({
  x,
  y,
  slipW,
  slipH,
  deskW,
  deskH,
  topReserve = TOP_RESERVE,
}: FitInput): { x: number; y: number } {
  // Before first layout there is nothing to measure against; keep the intent.
  if (deskW <= 0 || deskH <= 0) return { x, y };

  // No band may claim more than half the desk. Without this, a reserve taller than
  // the window pushed every slip off the bottom of it.
  const reserve = Math.min(topReserve, deskH / 2);

  const maxLeft = Math.max(DESK_EDGE, deskW - slipW - DESK_EDGE);
  const maxTop = Math.max(reserve, deskH - slipH - TAB_RESERVE);

  const left = Math.min(Math.max((x / 100) * deskW, DESK_EDGE), maxLeft);
  const top = Math.min(Math.max((y / 100) * deskH, reserve), maxTop);

  return { x: (left / deskW) * 100, y: (top / deskH) * 100 };
}
