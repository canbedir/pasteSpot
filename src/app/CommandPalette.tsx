import { useEffect, useRef } from 'react';
import { matchesQuery, useDesk } from './store';
import styles from './Overlay.module.css';

interface CommandPaletteProps {
  onClose: () => void;
}

const MAX_RESULTS = 8;

/**
 * Search does not replace the desk with a list. Typing dims non-matching slips
 * in place, and this panel only offers a way to jump to a match on another page.
 */
export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const { slips, pages, query, setQuery, setActivePage } = useDesk();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clearing the query on close stops the desk being left permanently dimmed.
  useEffect(() => () => setQuery(''), [setQuery]);

  const matches = query.trim()
    ? slips.filter((slip) => matchesQuery(slip, query)).slice(0, MAX_RESULTS)
    : [];

  const pageName = (pageId: string) =>
    pages.find((page) => page.id === pageId)?.name ?? '';

  const jumpTo = (pageId: string) => {
    setActivePage(pageId);
    onClose();
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
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'Enter' && matches[0]) jumpTo(matches[0].pageId);
          }}
        />

        {query.trim() && matches.length === 0 && (
          <p className={styles.note}>No slip matches that.</p>
        )}

        {matches.length > 0 && (
          <div className={styles.results}>
            {matches.map((slip) => (
              <button
                key={slip.id}
                type="button"
                className={styles.result}
                onClick={() => jumpTo(slip.pageId)}
              >
                <span className={styles.resultBody}>{slip.body}</span>
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
