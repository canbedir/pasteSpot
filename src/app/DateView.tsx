import { useMemo, useState } from 'react';
import {
  countByDay,
  dayKey,
  monthGrid,
  monthsWithSlips,
  shiftMonth,
  slipsOnDay,
  type Month,
} from './calendar';
import { detectKind } from './detect';
import { useDesk } from './store';
import type { Slip } from './types';
import styles from './DateView.module.css';

interface DateViewProps {
  onClose: () => void;
}

/**
 * Weekday initials in the reader's own locale, Monday first.
 *
 * Three letters, not two: Turkish truncates Pazartesi and Pazar to "Pz" and "Pa",
 * which are the two ends of the week and the easiest pair to confuse.
 */
const WEEKDAYS = (() => {
  const format = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(2024, 0, 1 + index)).slice(0, 3),
  );
})();

const monthName = (month: Month): string =>
  new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(month.year, month.month, 1),
  );

const timeOf = (value: number): string =>
  new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );

/**
 * What was captured when.
 *
 * A month at a time, with the busy days weighted so a glance shows where the work
 * was, and the chosen day's slips listed underneath. Choosing one goes to it on
 * its own page, the same way a search result does.
 */
export default function DateView({ onClose }: DateViewProps) {
  const { slips, pages, setActivePage, revealSlip } = useDesk();

  const counts = useMemo(() => countByDay(slips), [slips]);
  const months = useMemo(() => monthsWithSlips(slips), [slips]);

  // Open on the month holding the most recent slip, not on today: an empty
  // current month would say nothing about a desk full of older work.
  const [month, setMonth] = useState<Month>(
    () => months[0] ?? { year: new Date().getFullYear(), month: new Date().getMonth() },
  );
  const [chosen, setChosen] = useState<string | null>(() => {
    const newest = slips.reduce<number | null>(
      (latest, slip) => (latest === null || slip.createdAt > latest ? slip.createdAt : latest),
      null,
    );
    return newest === null ? null : dayKey(newest);
  });

  const cells = useMemo(() => monthGrid(month.year, month.month), [month]);
  const busiest = useMemo(
    () => Math.max(1, ...cells.filter(Boolean).map((cell) => counts.get(cell!.key) ?? 0)),
    [cells, counts],
  );
  const inMonth = cells.reduce(
    (total, cell) => total + (cell ? (counts.get(cell.key) ?? 0) : 0),
    0,
  );

  const onDay = chosen ? slipsOnDay(slips, chosen) : [];
  const today = dayKey(Date.now());

  const pageName = (pageId: string) => pages.find((page) => page.id === pageId)?.name ?? '';

  const goTo = (slip: Slip) => {
    setActivePage(slip.pageId);
    revealSlip(slip.id);
    onClose();
  };

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label="What was captured when"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.head}>
          <button
            type="button"
            className={styles.step}
            aria-label="Previous month"
            onClick={() => setMonth((at) => shiftMonth(at, -1))}
          >
            ‹
          </button>
          <span className={styles.month}>{monthName(month)}</span>
          <button
            type="button"
            className={styles.step}
            aria-label="Next month"
            onClick={() => setMonth((at) => shiftMonth(at, 1))}
          >
            ›
          </button>
          <span className={styles.total}>
            {inMonth} {inMonth === 1 ? 'slip' : 'slips'}
          </span>
          <button type="button" className={styles.close} onClick={onClose}>
            esc
          </button>
        </div>

        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAYS.map((day, index) => (
            <span key={index}>{day}</span>
          ))}
        </div>

        <div className={styles.grid}>
          {cells.map((cell, index) => {
            if (!cell) return <span key={`blank-${index}`} className={styles.blank} />;
            const count = counts.get(cell.key) ?? 0;

            return (
              <button
                key={cell.key}
                type="button"
                className={styles.day}
                disabled={count === 0}
                aria-pressed={cell.key === chosen}
                data-today={cell.key === today || undefined}
                // Weight rather than count: the eye reads density faster than
                // it reads numbers, and the exact figure is one click away.
                style={{ ['--weight' as string]: count === 0 ? 0 : count / busiest }}
                title={`${count} ${count === 1 ? 'slip' : 'slips'}`}
                onClick={() => setChosen(cell.key)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <div className={styles.list}>
          {chosen === null && <p className={styles.note}>Nothing captured yet.</p>}

          {chosen !== null && onDay.length === 0 && (
            <p className={styles.note}>Nothing on that day.</p>
          )}

          {onDay.map((slip) => (
            <button
              key={slip.id}
              type="button"
              className={styles.entry}
              onClick={() => goTo(slip)}
            >
              <span className={styles.time}>{timeOf(slip.createdAt)}</span>
              <span className={styles.body} data-kind={detectKind(slip.body)}>
                {slip.body}
              </span>
              <span className={styles.page}>{pageName(slip.pageId)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
