import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { detectKind, formatStamp, splitLink } from './detect';
import { fitOnDesk } from './fit';
import { formatKeywords, parseKeywords } from './keywords';
import { restAngle, tornEdge } from './textures';
import { type Slip as SlipModel, type SlipKind } from './types';
import styles from './Slip.module.css';

interface SlipProps {
  slip: SlipModel;
  index: number;
  grain: string;
  dimmed: boolean;
  /** A search sent us here: lift it and ring it until the person has seen it. */
  revealed: boolean;
  settleDelay: number | null;
  autoFocus: boolean;
  /** Replaced when the window resizes, so a slip re-measures where it fits. */
  viewport: { w: number; h: number };
  onChange: (id: string, body: string) => void;
  onKeywords: (id: string, keywords: string[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

/**
 * Paint the contenteditable imperatively.
 *
 * React never renders the body, because re-rendering a focused contenteditable
 * collapses the caret to the start on every keystroke. The DOM is the source of
 * truth while editing; the store catches up on input.
 */
function paint(element: HTMLElement, body: string, kind: SlipKind): void {
  if (kind !== 'link') {
    element.textContent = body;
    return;
  }
  const { host, path } = splitLink(body);
  element.textContent = '';
  const hostEl = document.createElement('span');
  hostEl.className = styles.host!;
  hostEl.textContent = host;
  element.append(hostEl);
  if (path) {
    const pathEl = document.createElement('span');
    pathEl.className = styles.path!;
    pathEl.textContent = path;
    element.append(pathEl);
  }
}

function Slip({
  slip,
  index,
  grain,
  dimmed,
  revealed,
  settleDelay,
  autoFocus,
  viewport,
  onChange,
  onKeywords,
  onRemove,
  onMove,
}: SlipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [labelling, setLabelling] = useState(false);
  const kind = detectKind(slip.body);
  const keywords = slip.keywords ?? [];

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    // Never repaint the element the user is typing into.
    if (document.activeElement === element) return;
    paint(element, slip.body, kind);
  }, [slip.body, kind]);

  /**
   * Position is written here rather than through the style prop, because where a
   * slip fits depends on how big it turned out to be — which is only knowable
   * once it is laid out. Declared after the paint effect so the measurement sees
   * the real text.
   *
   * This runs again when the text grows and when the window resizes, so a slip
   * cannot end up half off the desk on a narrower screen than it was placed on.
   */
  const place = useCallback((x: number, y: number) => {
    const root = rootRef.current;
    const desk = root?.parentElement;
    if (!root || !desk) return null;

    const fit = fitOnDesk({
      x,
      y,
      slipW: root.offsetWidth,
      slipH: root.offsetHeight,
      deskW: desk.clientWidth,
      deskH: desk.clientHeight,
    });
    root.style.left = `${fit.x}%`;
    root.style.top = `${fit.y}%`;
    return fit;
  }, []);

  // Anything that changes the paper's size changes what fits: the text, the
  // keyword line appearing, the field that edits it, and the window itself.
  useLayoutEffect(() => {
    place(slip.x, slip.y);
  }, [place, slip.x, slip.y, slip.body, slip.keywords, labelling, viewport]);

  useEffect(() => {
    if (!autoFocus) return;
    bodyRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleInput = () => {
    onChange(slip.id, bodyRef.current?.textContent ?? '');
  };

  const handleBlur = () => {
    const element = bodyRef.current;
    if (!element) return;
    const text = element.textContent ?? '';
    // An empty slip was a misclick. Remove it rather than leaving a ghost.
    if (!text.trim()) {
      onRemove(slip.id);
      return;
    }
    paint(element, text, detectKind(text));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      bodyRef.current?.blur();
    }
  };

  /**
   * Dragging is bound to the foot, not the paper, so grabbing a slip can never
   * be confused with selecting the text inside it.
   *
   * Each pointer move writes straight to this element's style and nothing else.
   * Going through the store instead meant a new slips array per move, which
   * re-rendered every slip on the desk: measured at 112ms a frame with 60 pages
   * open, against 6ms with one. The store hears about it once, on release.
   */
  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const page = event.currentTarget.closest('[data-page]') as HTMLElement | null;
    if (!page) return;

    event.preventDefault();
    const rect = page.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = slip.x;
    const originY = slip.y;
    let landed = { x: originX, y: originY };

    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setDragging(true);

    const onPointerMove = (move: PointerEvent) => {
      landed =
        place(
          originX + ((move.clientX - startX) / rect.width) * 100,
          originY + ((move.clientY - startY) / rect.height) * 100,
        ) ?? landed;
    };

    const onPointerUp = () => {
      setDragging(false);
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
      if (landed.x !== originX || landed.y !== originY) onMove(slip.id, landed.x, landed.y);
    };

    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(slip.body);
      setCopied(true);
    } catch {
      // Clipboard permission can be denied; say nothing rather than lie.
    }
  };

  const className = [
    styles.slip,
    dimmed ? styles.dimmed : '',
    revealed ? styles.revealed : '',
    dragging ? styles.dragging : '',
    // A settling slip must not also be mid-drag, or the two transforms fight.
    settleDelay !== null && !dragging ? styles.settling : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={className}
      // left and top are deliberately absent: they are owned by the layout
      // effect above, which is the only thing that knows what fits.
      style={{
        ['--rest-angle' as string]: restAngle(index),
        ['--settle-delay' as string]: settleDelay !== null ? `${settleDelay}ms` : undefined,
      }}
    >
      <div
        className={`${styles.paper} ${styles[kind]}`}
        style={{
          clipPath: tornEdge(index),
          ['--grain' as string]: grain,
        }}
      >
        <div
          ref={bodyRef}
          className={styles.body}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          role="textbox"
          aria-label="Slip"
          data-placeholder="paste or type"
          onInput={handleInput}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <div className={styles.foot}>
          <span
            className={styles.handle}
            onPointerDown={handleDragStart}
            title="Drag to move"
          >
            {formatStamp(slip.updatedAt)}
          </span>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              onClick={() => setLabelling(true)}
              title="Words to find this by"
            >
              {keywords.length ? 'edit' : 'keyword'}
            </button>
            <button type="button" className={styles.action} onClick={handleCopy}>
              {copied ? 'copied' : 'copy'}
            </button>
            <button
              type="button"
              className={`${styles.action} ${styles.remove}`}
              onClick={() => onRemove(slip.id)}
            >
              delete
            </button>
          </div>
        </div>

        {/*
          Written in the margin, after the fact. A slip with no keywords shows
          nothing at all here — the capture path must stay two actions, so this
          can never be something to fill in on the way past.
        */}
        {labelling ? (
          <input
            className={styles.keywordField}
            defaultValue={formatKeywords(slip.keywords)}
            autoFocus
            spellCheck={false}
            placeholder="lol, kredi kartı"
            aria-label="Words to find this slip by"
            onBlur={(event) => {
              onKeywords(slip.id, parseKeywords(event.target.value));
              setLabelling(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.stopPropagation();
                setLabelling(false);
              }
            }}
          />
        ) : (
          keywords.length > 0 && (
            <div className={styles.keywords}>
              {keywords.map((keyword) => (
                <span key={keyword} className={styles.keyword}>
                  {keyword}
                </span>
              ))}
            </div>
          )
        )}
      </div>

      {index % 3 === 0 && <Paperclip />}
    </div>
  );
}

/**
 * Memoised because a search keystroke changes `dimmed` on a handful of slips and
 * nothing on the rest, and because the store handing back a new slips array must
 * not mean every slip on the desk re-renders.
 */
export default memo(Slip);

function Paperclip() {
  return (
    <svg className={styles.clip} width="19" height="29" viewBox="0 0 19 29" aria-hidden="true">
      <defs>
        <linearGradient id="pastespot-clip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8eaed" />
          <stop offset="0.45" stopColor="#9aa0a6" />
          <stop offset="0.72" stopColor="#c6cad0" />
          <stop offset="1" stopColor="#7c838b" />
        </linearGradient>
      </defs>
      <path
        d="M13.4 7.2v11.9a4.8 4.8 0 0 1-9.6 0V6a3.1 3.1 0 0 1 6.2 0v12.8a1.35 1.35 0 0 1-2.7 0V7.9"
        fill="none"
        stroke="url(#pastespot-clip)"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}
