import { useEffect, useRef, useState } from 'react';
import CommandPalette from './CommandPalette';
import SettingsPanel from './SettingsPanel';
import Slip from './Slip';
import { requestPersistentStorage } from './db';
import { listenForExtensionCaptures } from './extension';
import { registerServiceWorker } from './offline';
import {
  matchCountOnPage,
  matchesQuery,
  PAGE_CAPACITY,
  slipsOnPage,
  useDesk,
} from './store';
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

export default function Board() {
  const state = useDesk();
  const {
    ready,
    pages,
    settings,
    activePageId,
    query,
    load,
    addSlip,
    addPage,
    captureText,
    updateSlip,
    moveSlip,
    removeSlip,
    removePage,
    renamePage,
    setActivePage,
    stepPage,
  } = state;

  const contourRef = useRef<HTMLCanvasElement>(null);
  const [grain, setGrain] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    setGrain(grainTile());
    registerServiceWorker();
    // Ask before there is anything to lose, not after.
    void requestPersistentStorage();
  }, [load]);

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
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (event.key === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      // [ and ] rather than arrows: the browser owns Alt+Arrow for history.
      if (event.key === '[') {
        event.preventDefault();
        stepPage(-1);
      } else if (event.key === ']') {
        event.preventDefault();
        stepPage(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stepPage]);

  /**
   * Paste with nothing focused and the slip makes itself. This is the product's
   * whole gesture with the click removed, so it is worth a global handler.
   */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest('input, textarea')) return;

      const text = event.clipboardData?.getData('text/plain');
      if (!text?.trim()) return;
      event.preventDefault();
      captureText(text);
    };

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [captureText]);

  /** Captures handed over by the browser extension arrive the same way. */
  useEffect(() => listenForExtensionCaptures(captureText), [captureText]);

  const activeIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === activePageId),
  );

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
    if (slipsOnPage(state, activePageId).length >= PAGE_CAPACITY) {
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
      style={{ ['--grain' as string]: grain }}
    >
      <canvas ref={contourRef} className={styles.contour} aria-hidden="true" />

      {!hasAnySlip && <GhostSlip />}

      <div
        className={styles.track}
        style={{ transform: `translateX(${-activeIndex * 100}%)` }}
      >
        {pages.map((page) => (
          <div key={page.id} className={styles.page} data-page onClick={handlePageClick}>
            {slipsOnPage(state, page.id).map((slip, index) => (
              <Slip
                key={slip.id}
                slip={slip}
                index={index}
                grain={grain}
                dimmed={!matchesQuery(slip, query)}
                settleDelay={settling ? index * 45 : null}
                autoFocus={slip.id === focusId}
                onChange={updateSlip}
                onRemove={removeSlip}
                onMove={moveSlip}
              />
            ))}
          </div>
        ))}
      </div>

      <div className={styles.corner}>
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
          onClick={() => setSettingsOpen(true)}
        >
          settings
        </button>
      </div>

      <div className={styles.tabs}>
        {pages.map((page) => {
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
                        `Delete "${page.name}" and its ${count} slip${count === 1 ? '' : 's'}? This cannot be undone.`,
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
        <button
          type="button"
          className={`${styles.tab} ${styles.tabAdd}`}
          aria-label="New page"
          onClick={() => addPage()}
        >
          +
        </button>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
