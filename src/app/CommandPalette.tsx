import { useEffect, useRef, useState } from 'react';
import { matchesQuery, recentSlips, useDesk } from './store';
import type { Slip } from './types';
import styles from './Overlay.module.css';

interface CommandPaletteProps {
  onClose: () => void;
}

const MAX_RESULTS = 8;

/** How long "copied" stays up before the desk takes over. One beat, not a pause. */
const CONFIRM_MS = 420;

/**
 * Search does not replace the desk with a list. Typing dims non-matching slips
 * in place, and this panel is how you reach a match that is on another page.
 *
 * It is also how you get a slip back *out*. Capture costs two actions, so
 * retrieval should not cost five: choosing a result copies the slip to the
 * clipboard and then goes to it, which is what someone searching for a code
 * almost always wanted. With nothing typed it offers the most recent captures,
 * so the thing you just put down is one Enter away.
 */
export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const state = useDesk();
  const { slips, pages, query, setQuery, setActivePage, revealSlip } = state;
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clearing the query on close stops the desk being left permanently dimmed.
  useEffect(() => () => setQuery(''), [setQuery]);

  const searching = query.trim() !== '';
  const results = searching
    ? slips.filter((slip) => matchesQuery(slip, query)).slice(0, MAX_RESULTS)
    : recentSlips(state, MAX_RESULTS);

  // A new query means a new first result; keep the cursor on something real.
  useEffect(() => setSelected(0), [query]);

  const pageName = (pageId: string) =>
    pages.find((page) => page.id === pageId)?.name ?? '';

  const goTo = (slip: Slip) => {
    setActivePage(slip.pageId);
    revealSlip(slip.id);
    onClose();
  };

  /**
   * Take the slip: clipboard first, then the desk. The confirmation is shown
   * here rather than after closing, because once the panel is gone there is
   * nowhere honest left to say whether the copy worked.
   */
  const take = async (slip: Slip) => {
    let copied = true;
    try {
      await navigator.clipboard.writeText(slip.body);
    } catch {
      // Clipboard permission can be denied. Still go to the slip — the person
      // can copy it by hand — but do not claim it was copied.
      copied = false;
    }
    setSaid(copied ? 'copied' : 'could not copy — showing it instead');
    setTimeout(() => goTo(slip), CONFIRM_MS);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (said) return;

    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key === 'Enter') {
      const slip = results[selected] ?? results[0];
      if (!slip) return;
      event.preventDefault();
      // Shift skips the clipboard for the times you only want to go and look.
      if (event.shiftKey) goTo(slip);
      else void take(slip);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (results.length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setSelected((at) => (at + step + results.length) % results.length);
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

        {searching && results.length === 0 && (
          <p className={styles.note}>No slip matches that.</p>
        )}

        {results.length > 0 && (
          <>
            {!searching && <p className={styles.note}>Just captured</p>}
            <div className={styles.results}>
              {results.map((slip, index) => (
                <button
                  key={slip.id}
                  type="button"
                  className={styles.result}
                  aria-selected={index === selected}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => void take(slip)}
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
          </>
        )}

        <p className={styles.note} aria-live="polite">
          {said ?? (results.length > 0 ? '↵ copy it · ⇧↵ just show me' : 'Matches stay where they are. Everything else dims.')}
        </p>
      </div>
    </div>
  );
}
