import { useEffect, useRef, useState } from 'react';
import CommandPalette from './CommandPalette';
import SettingsPanel from './SettingsPanel';
import Slip from './Slip';
import {
  matchCountOnPage,
  matchesQuery,
  PAGE_CAPACITY,
  slipsOnPage,
  useDesk,
} from './store';
import { drawContour, grainTile } from './textures';
import styles from './Board.module.css';

/** Keep a new slip clear of the tab strip and the top chrome. */
const MIN_X = 2;
const MAX_X = 64;
const MIN_Y = 5;
const MAX_Y = 72;

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
    updateSlip,
    removeSlip,
    setActivePage,
  } = state;

  const contourRef = useRef<HTMLCanvasElement>(null);
  const [grain, setGrain] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void load();
    setGrain(grainTile());
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
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, MIN_X, MAX_X);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, MIN_Y, MAX_Y);

    // A full desk opens the next page rather than stacking slips on top of each other.
    if (slipsOnPage(state, activePageId).length >= PAGE_CAPACITY) {
      addPage();
    }
    setFocusId(addSlip(x, y));
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

      <p className={`${styles.hint} ${hasAnySlip ? styles.hintHidden : ''}`}>
        click an empty spot
      </p>

      {!hasAnySlip && (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>Nothing here yet.</span>
          <span className={styles.emptyHint}>click anywhere, then paste</span>
        </div>
      )}

      <div
        className={styles.track}
        style={{ transform: `translateX(${-activeIndex * 100}%)` }}
      >
        {pages.map((page) => (
          <div key={page.id} className={styles.page} onClick={handlePageClick}>
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
          return (
            <button
              key={page.id}
              type="button"
              className={styles.tab}
              aria-current={page.id === activePageId}
              onClick={() => goToPage(page.id)}
            >
              {page.name}
              {page.id !== activePageId && matches > 0 && (
                <span className={styles.badge}>{matches}</span>
              )}
            </button>
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
