import { useEffect, useRef } from 'react';
import { detectKind } from './detect';
import { matchesQuery, slipsOnPage, useDesk } from './store';
import styles from './Overview.module.css';

interface PageOverviewProps {
  onClose: () => void;
}

/** Slips shown per thumbnail. A page holds 14, so this only guards bad data. */
const MARKS_PER_PAGE = 24;

/**
 * Every page at once, each drawn as a small desk with its slips where they
 * actually sit.
 *
 * The tab strip is for a handful of pages; this is for the rest. It is a
 * thumbnail grid rather than a list because the desk's whole argument is that
 * you remember *where* you put something — a list of names throws that away,
 * and a name like "page 47" was never worth remembering anyway.
 */
export default function PageOverview({ onClose }: PageOverviewProps) {
  const state = useDesk();
  const { pages, activePageId, query, addPage, setActivePage } = state;
  const gridRef = useRef<HTMLDivElement>(null);

  // Open with the page you are on already under the cursor's reach.
  useEffect(() => {
    const active = gridRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]');
    active?.focus();
    active?.scrollIntoView({ block: 'nearest' });
  }, []);

  const jumpTo = (pageId: string) => {
    setActivePage(pageId);
    onClose();
  };

  /**
   * Arrow keys walk the grid. The column count is read from the layout rather
   * than assumed, because the grid reflows with the window.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 0, ArrowUp: 0 }[event.key];
    if (step === undefined) return;

    const cards = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('[data-card]') ?? [])];
    const here = cards.findIndex((card) => card === document.activeElement);
    if (here === -1) return;

    const columns = cards.filter((card) => card.offsetTop === cards[0]!.offsetTop).length;
    const delta =
      event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns : step;

    const next = cards[Math.min(cards.length - 1, Math.max(0, here + delta))];
    if (next) {
      event.preventDefault();
      next.focus();
      next.scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label="All pages"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.head}>
        <span className={styles.title}>
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </span>
        <button type="button" className={styles.close} onClick={onClose}>
          esc
        </button>
      </div>

      <div className={styles.grid} ref={gridRef} onKeyDown={handleKeyDown}>
        {pages.map((page) => {
          const slips = slipsOnPage(state, page.id);
          return (
            <button
              key={page.id}
              type="button"
              data-card
              className={styles.card}
              aria-current={page.id === activePageId}
              onClick={() => jumpTo(page.id)}
            >
              <span className={styles.mini}>
                {slips.slice(0, MARKS_PER_PAGE).map((slip) => (
                  <span
                    key={slip.id}
                    className={styles.mark}
                    data-kind={detectKind(slip.body)}
                    // A search stays lit through the overview, so a match can be
                    // found across pages without leaving it.
                    data-lit={query.trim() ? matchesQuery(slip, query) : undefined}
                    style={{ left: `${slip.x}%`, top: `${slip.y}%` }}
                  />
                ))}
                {slips.length === 0 && <span className={styles.empty}>empty</span>}
              </span>
              <span className={styles.label}>
                <span className={styles.name}>{page.name}</span>
                <span className={styles.count}>{slips.length}</span>
              </span>
            </button>
          );
        })}

        {/* The tab strip is hidden behind this view, so its one job that has no
            other home comes along. */}
        <button
          type="button"
          data-card
          className={styles.card}
          onClick={() => {
            addPage();
            onClose();
          }}
        >
          <span className={`${styles.mini} ${styles.add}`}>+</span>
          <span className={styles.label}>
            <span className={styles.name}>new page</span>
          </span>
        </button>
      </div>
    </div>
  );
}
