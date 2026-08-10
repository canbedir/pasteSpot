import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import CommandPalette from './CommandPalette';
import DateView from './DateView';
import PageOverview from './PageOverview';
import SettingsPanel from './SettingsPanel';
import Slip from './Slip';
import {
  loadSnapshot,
  onRemoteSave,
  onStorageTrouble,
  requestPersistentStorage,
} from './db';
import { listenForExtensionCaptures } from './extension';
import { registerServiceWorker } from './offline';
import { matchCountOnPage, matchesQuery, pageCapacity, slipsOnPage, useDesk } from './store';
import { TOP_RESERVE } from './fit';
import { tabCapacity, tabWindow } from './tabs';
import { drawContour, grainTile, tornEdge } from './textures';
import { clampToDesk } from './types';
import styles from './Board.module.css';

/**
 * The first-run hint, drawn as a ghost of the thing it asks for: it shows the
 * shape of the outcome rather than describing it.
 *
 * Placed inside the pool of light rather than at the first free spot. Matching
 * the paste position would only be meaningful for the keyboard path — a click
 * lands wherever the pointer is — and this is the one thing a first visitor has
 * to notice, so being seen beats being technically consistent.
 *
 * Never interactive: the click that dismisses it is the same click that creates
 * the real slip underneath.
 */
function GhostSlip() {
  return (
    <div className={styles.ghost} style={{ left: '26%', top: '24%' }} aria-hidden="true">
      <div className={styles.ghostPaper} style={{ clipPath: tornEdge(0) }}>
        <div className={styles.ghostLine}>Click anywhere on the desk.</div>
        <div className={styles.ghostFoot}>or just press {modifierLabel()}V</div>
      </div>
    </div>
  );
}

/** Mac keyboards say Cmd, everything else says Ctrl. */
function modifierLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+';
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl+';
}

/**
 * Is the caret somewhere that owns its own keys?
 *
 * Both global handlers below need this, and both would throw on a target that is
 * not an element — `closest` does not exist on the document or the window, and an
 * exception in a window-level keydown listener takes every shortcut down with it.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest('input, textarea') !== null;
}

export default function Board() {
  const state = useDesk();
  const {
    ready,
    pages,
    settings,
    activePageId,
    query,
    revealedId,
    load,
    addSlip,
    addPage,
    captureText,
    updateSlip,
    setKeywords,
    moveSlip,
    removeSlip,
    removePage,
    renamePage,
    revealSlip,
    adoptSnapshot,
    setActivePage,
    setViewport,
    stepPage,
    undo,
    canUndo,
    viewport,
  } = state;

  const contourRef = useRef<HTMLCanvasElement>(null);
  const [grain, setGrain] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [said, setSaid] = useState('');
  const [notSaving, setNotSaving] = useState(false);
  const troubleRef = useRef<HTMLParagraphElement>(null);
  const [troubleHeight, setTroubleHeight] = useState(0);

  /**
   * Say something to a screen reader.
   *
   * Every acknowledgement in this product is visual — a lit slip, a paper that
   * moved, a label that changed to "copied" — which means a screen reader hears
   * nothing at all. The text is cleared afterwards so the same message can be
   * announced twice in a row.
   */
  const say = useCallback((message: string) => {
    setSaid(message);
    window.setTimeout(() => setSaid(''), 4000);
  }, []);


  useEffect(() => {
    void load();
    setGrain(grainTile());
    registerServiceWorker();
    // Ask before there is anything to lose, not after.
    void requestPersistentStorage();
  }, [load]);

  /**
   * A resize changes what fits where, how many tabs the strip shows, how many
   * slips a page holds, and where the next one goes. The store keeps the size
   * because placement needs it too, and a fresh object is the signal a memoised
   * slip needs to know its own measurement went stale.
   */
  useEffect(() => {
    const read = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    read();

    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(read, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [setViewport]);

  // Contour is a canvas, so it has to be redrawn for size and tone changes.
  useEffect(() => {
    if (settings.surface !== 'contour') return;
    const canvas = contourRef.current;
    if (!canvas) return;

    const rgb = getComputedStyle(canvas).getPropertyValue('--contour-rgb').trim();
    const redraw = () => drawContour(canvas, rgb || '255 255 255');
    redraw();

    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(redraw, 180);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [settings.surface, settings.tone, ready]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape backs out of the zoomed-out view. Harmless when it is closed, and
      // a slip's own Escape still blurs it.
      if (event.key === 'Escape') {
        setOverviewOpen(false);
        setDatesOpen(false);
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      /**
       * Undo the last change to the desk. Left alone while the caret is in a
       * slip or a field, where the browser's own text undo is the right one and
       * is the reason typing is not on our stack at all.
       */
      if (event.key === 'z' && !event.shiftKey) {
        if (isTyping(event.target)) return;
        event.preventDefault();
        if (!canUndo()) {
          say(`Nothing left to undo`);
          return;
        }
        undo();
        say(`Undone`);
        return;
      }

      if (event.key === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      // Zooming out to every page at once. Printing a desk means nothing, so
      // the browser's use of this chord is worth taking.
      if (event.key === 'p') {
        event.preventDefault();
        setOverviewOpen((open) => !open);
        return;
      }
      // [ and ] rather than arrows: the browser owns Alt+Arrow for history.
      if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        stepPage(event.key === ']' ? 1 : -1);
        // Read after the move: the hook's copy is a tick behind.
        const now = useDesk.getState();
        const landed = now.pages.find((page) => page.id === now.activePageId);
        if (landed) say(landed.name);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canUndo, say, stepPage, undo]);

  /**
   * Paste with nothing focused and the slip makes itself. This is the product's
   * whole gesture with the click removed, so it is worth a global handler.
   */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTyping(event.target)) return;

      const text = event.clipboardData?.getData('text/plain');
      if (!text?.trim()) return;
      event.preventDefault();
      const before = useDesk.getState().pages.length;
      captureText(text);
      const opened = useDesk.getState().pages.length > before;
      // Never claim a save this browser cannot make.
      say(
        notSaving
          ? `On the desk but not saved: ${text.trim().slice(0, 60)}`
          : `Saved${opened ? ' to a new page' : ''}: ${text.trim().slice(0, 60)}`,
      );
    };

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [captureText, notSaving, say]);

  /**
   * IndexedDB is not always there: private browsing, blocked site data, some
   * embedded webviews. Every call in db.ts is wrapped so a failure cannot take the
   * desk down, which meant the desk looked healthy while saving nothing.
   */
  useEffect(() => onStorageTrouble(() => setNotSaving(true)), []);

  /**
   * The warning bar owns a band at the top of the desk, so measure it rather than
   * guessing: its height depends on how far the text wraps, which depends on the
   * window. A warning that covers the slip it is warning about is worse than none.
   */
  useLayoutEffect(() => {
    setTroubleHeight(notSaving ? (troubleRef.current?.offsetHeight ?? 0) : 0);
  }, [notSaving, viewport]);

  /** Captures handed over by the browser extension arrive the same way. */
  useEffect(() => listenForExtensionCaptures(captureText), [captureText]);

  /**
   * Two tabs of the same desk used to overwrite each other, because a save replaces
   * the whole snapshot under one key and each tab held its own store. Adopting what
   * another tab wrote keeps them in step instead of racing.
   */
  useEffect(() => onRemoteSave(adoptSnapshot), [adoptSnapshot]);

  /**
   * Coming back to a tab, re-read the desk from disk.
   *
   * A tab the browser froze or put in the back/forward cache hears no broadcasts
   * while it sleeps, so it would wake holding a desk from hours ago and write that
   * over everything since. `db.ts` flushes on the way out and this reads on the way
   * back in, which makes the handover between tabs a clean one.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void loadSnapshot().then(adoptSnapshot);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [adoptSnapshot]);

  /**
   * A revealed slip is lit long enough to be seen and then let go, so the desk
   * does not keep a stale highlight from a search made minutes ago.
   */
  useEffect(() => {
    if (!revealedId) return;
    const timer = setTimeout(() => revealSlip(null), 2400);
    return () => clearTimeout(timer);
  }, [revealedId, revealSlip]);

  const activeIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === activePageId),
  );
  const tabs = tabWindow(pages.length, activeIndex, tabCapacity(viewport.w));

  const goToPage = (id: string) => {
    if (id === activePageId) return;
    setActivePage(id);
    setSettling(true);
    // Let the stagger run once, then drop the class so hover transforms work.
    setTimeout(() => setSettling(false), 900);
  };

  /**
   * Only a click on the page's own background makes a slip. Clicks on a slip
   * reach here by bubbling, and those must not spawn a second one behind it.
   */
  const handlePageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const spot = clampToDesk(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );

    // A full desk opens the next page rather than stacking slips on top of each other.
    if (slipsOnPage(state, activePageId).length >= pageCapacity(state)) {
      addPage();
    }
    setFocusId(addSlip(spot.x, spot.y));
  };

  if (!ready) {
    return <div className={styles.board} data-tone={settings.tone} aria-busy="true" />;
  }

  const hasAnySlip = state.slips.length > 0;

  return (
    <div
      className={styles.board}
      data-tone={settings.tone}
      data-surface={settings.surface}
      data-prose={settings.prose}
      data-size={settings.size}
      style={{
        ['--grain' as string]: grain,
        ['--trouble' as string]: `${troubleHeight}px`,
      }}
    >
      <canvas ref={contourRef} className={styles.contour} aria-hidden="true" />

      {!hasAnySlip && <GhostSlip />}

      {notSaving && (
        <p ref={troubleRef} className={styles.trouble} role="alert">
          This browser is not saving. Nothing here survives a reload — use export in
          settings.
        </p>
      )}

      {/*
        The chrome comes before the slips in the DOM so that it comes before them
        in the tab order. Both are absolutely positioned with explicit z-index, so
        moving them here changes nothing on screen — but a keyboard user reaching
        search used to pass through every slip on the page first, which measured 57
        stops on a full desk.
      */}
      {/* The zoomed-out view is a whole screen of its own and carries its own
          chrome, so the desk's buttons and tab strip would only show through the
          scrim as clutter. */}
      <div className={styles.corner} hidden={overviewOpen || datesOpen}>
        <button
          type="button"
          className={styles.cornerButton}
          onClick={() => setPaletteOpen(true)}
        >
          search
        </button>
        <button
          type="button"
          className={styles.cornerButton}
          onClick={() => setOverviewOpen(true)}
          title={`Every page at once (${modifierLabel()}P)`}
        >
          pages
        </button>
        <button
          type="button"
          className={styles.cornerButton}
          onClick={() => setDatesOpen(true)}
          title="What was captured when"
        >
          dates
        </button>
        <button
          type="button"
          className={styles.cornerButton}
          onClick={() => setSettingsOpen(true)}
        >
          settings
        </button>
      </div>

      <div className={styles.tabs} hidden={overviewOpen}>
        {/*
          Only a window of tabs is rendered, so the strip cannot outgrow the
          window and push the new-page button off the screen. The chips at either
          end say how many pages are out of sight and open the zoomed-out view,
          which is the real way around a desk this size.
        */}
        {tabs.start > 0 && (
          <button
            type="button"
            className={`${styles.tab} ${styles.tabMore}`}
            onClick={() => setOverviewOpen(true)}
            title={`${tabs.start} earlier ${tabs.start === 1 ? 'page' : 'pages'}`}
          >
            ‹{tabs.start}
          </button>
        )}

        {pages.slice(tabs.start, tabs.end).map((page) => {
          const matches = matchCountOnPage(state, page.id);
          const isActive = page.id === activePageId;

          if (renamingId === page.id) {
            return (
              <input
                key={page.id}
                className={`${styles.tab} ${styles.tabInput}`}
                defaultValue={page.name}
                autoFocus
                aria-label="Page name"
                onBlur={(event) => {
                  renamePage(page.id, event.target.value);
                  setRenamingId(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') setRenamingId(null);
                }}
              />
            );
          }

          return (
            <span key={page.id} className={styles.tabWrap}>
              <button
                type="button"
                className={styles.tab}
                aria-current={isActive}
                onClick={() => goToPage(page.id)}
                onDoubleClick={() => isActive && setRenamingId(page.id)}
                title={isActive ? 'Double-click to rename' : undefined}
              >
                {page.name}
                {!isActive && matches > 0 && <span className={styles.badge}>{matches}</span>}
              </button>
              {isActive && pages.length > 1 && (
                <button
                  type="button"
                  className={styles.tabClose}
                  aria-label={`Delete page ${page.name}`}
                  onClick={() => {
                    const count = slipsOnPage(state, page.id).length;
                    const ok =
                      count === 0 ||
                      window.confirm(
                        `Delete "${page.name}" and its ${count} slip${count === 1 ? '' : 's'}? ${modifierLabel()}Z puts it back, until you close the tab.`,
                      );
                    if (ok) removePage(page.id);
                  }}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}

        {tabs.end < pages.length && (
          <button
            type="button"
            className={`${styles.tab} ${styles.tabMore}`}
            onClick={() => setOverviewOpen(true)}
            title={`${pages.length - tabs.end} later ${
              pages.length - tabs.end === 1 ? 'page' : 'pages'
            }`}
          >
            {pages.length - tabs.end}›
          </button>
        )}

        <button
          type="button"
          className={`${styles.tab} ${styles.tabAdd}`}
          aria-label="New page"
          onClick={() => addPage()}
        >
          +
        </button>
      </div>

      <div
        className={styles.track}
        style={{ transform: `translateX(${-activeIndex * 100}%)` }}
      >
        {pages.map((page, pageIndex) => (
          <div key={page.id} className={styles.page} data-page onClick={handlePageClick}>
            {/*
              Only the page in view and its two neighbours hold their slips. The
              empty frames stay so the track keeps its geometry and the slide
              still works, but the desk's DOM no longer grows with its history:
              840 slips were mounted at once on a 60-page desk, and dragging one
              cost 112ms a frame.

              The neighbours are mounted rather than the active page alone so a
              page slides in already painted.
            */}
            {Math.abs(pageIndex - activeIndex) <= 1 &&
              slipsOnPage(state, page.id).map((slip, index) => (
                <Slip
                  key={slip.id}
                  slip={slip}
                  grain={grain}
                  // While a search is pointing at one slip, everything else
                  // dims — the same language the desk already uses for a
                  // search, rather than a second one invented for this.
                  dimmed={
                    revealedId ? slip.id !== revealedId : !matchesQuery(slip, query)
                  }
                  revealed={slip.id === revealedId}
                  settleDelay={settling ? index * 45 : null}
                  autoFocus={slip.id === focusId}
                  viewport={viewport}
                  // Typography changes the paper`s size, so it changes what fits.
                  metrics={`${settings.prose}-${settings.size}`}
                  topReserve={TOP_RESERVE + troubleHeight}
                  onChange={updateSlip}
                  onKeywords={setKeywords}
                  onRemove={removeSlip}
                  onMove={moveSlip}
                  onSay={say}
                />
              ))}
          </div>
        ))}
      </div>

      {overviewOpen && <PageOverview onClose={() => setOverviewOpen(false)} />}
      {datesOpen && <DateView onClose={() => setDatesOpen(false)} />}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      <p className={styles.announcer} role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
