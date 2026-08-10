import { useEffect, useRef, useState } from 'react';
import { matchesQuery, useDesk } from './store';
import type { Slip } from './types';
import styles from './Overlay.module.css';

interface CommandPaletteProps {
  onClose: () => void;
}

const MAX_RESULTS = 8;

/**
 * Search does not replace the desk with a list. Typing dims non-matching slips
 * in place, and this panel is how you reach a match that is on another page.
 *
 * Choosing a result goes to the slip, not merely to its page: landing on the
 * right page and leaving the person to spot it among fourteen others is the job
 * the search was meant to do.
 */
export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const { slips, pages, query, setQuery, setActivePage, revealSlip } = useDesk();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clearing the query on close stops the desk being left permanently dimmed.
  useEffect(() => () => setQuery(''), [setQuery]);

  const matches = query.trim()
    ? slips.filter((slip) => matchesQuery(slip, query)).slice(0, MAX_RESULTS)
    : [];

  // A new query means a new first result; keep the cursor on something real.
  useEffect(() => setSelected(0), [query]);

  const pageName = (pageId: string) =>
    pages.find((page) => page.id === pageId)?.name ?? '';

  const jumpTo = (slip: Slip) => {
    setActivePage(slip.pageId);
    revealSlip(slip.id);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key === 'Enter') {
      const slip = matches[selected] ?? matches[0];
      if (slip) jumpTo(slip);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (matches.length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setSelected((at) => (at + step + matches.length) % matches.length);
    }
  };

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label="Search slips"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <input
          ref={inputRef}
          className={styles.field}
          type="search"
          value={query}
          placeholder="Search everything"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        {query.trim() && matches.length === 0 && (
          <p className={styles.note}>No slip matches that.</p>
        )}

        {matches.length > 0 && (
          <div className={styles.results}>
            {matches.map((slip, index) => (
              <button
                key={slip.id}
                type="button"
                className={styles.result}
                aria-selected={index === selected}
                onMouseEnter={() => setSelected(index)}
                onClick={() => jumpTo(slip)}
              >
                <span className={styles.resultBody}>
                  {slip.body}
                  {/* Shown so a match on a keyword does not look like a mistake. */}
                  {slip.keywords?.length ? (
                    <span className={styles.resultKeywords}>{slip.keywords.join(' · ')}</span>
                  ) : null}
                </span>
                <span className={styles.resultPage}>{pageName(slip.pageId)}</span>
              </button>
            ))}
          </div>
        )}

        {!query.trim() && (
          <p className={styles.note}>
            Matches stay where they are. Everything else dims.
          </p>
        )}
      </div>
    </div>
  );
}
