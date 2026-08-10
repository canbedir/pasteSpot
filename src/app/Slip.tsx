import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { patina } from './age';
import { detectKind, formatStamp, groupDigits, splitLink } from './detect';
import { fitOnDesk } from './fit';
import { formatKeywords, parseKeywords } from './keywords';
import { restAngle, seedOf, tornEdge } from './textures';
import { type Slip as SlipModel, type SlipKind } from './types';
import styles from './Slip.module.css';

interface SlipProps {
  slip: SlipModel;
  grain: string;
  dimmed: boolean;
  /** A search sent us here: lift it and ring it until the person has seen it. */
  revealed: boolean;
  settleDelay: number | null;
  autoFocus: boolean;
  /** Replaced when the window resizes, so a slip re-measures where it fits. */
  viewport: { w: number; h: number };
  /** The typography settings, for the same reason: they change the paper size. */
  metrics: string;
  onChange: (id: string, body: string) => void;
  onKeywords: (id: string, keywords: string[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  /** Speak to a screen reader, which none of this slip's feedback is visible to. */
  onSay: (message: string) => void;
}

/**
 * Paint the contenteditable imperatively.
 *
 * React never renders the body, because re-rendering a focused contenteditable
 * collapses the caret to the start on every keystroke. The DOM is the source of
 * truth while editing; the store catches up on input.
 *
 * What is painted is a *presentation* of the body, not the body: a link shows its
 * host emphasised and its scheme dropped, and a long card number is regrouped in
 * fours. Neither is what gets stored, which is why `showTruth` below has to run
 * the moment the text becomes editable.
 */
function paint(element: HTMLElement, body: string, kind: SlipKind): void {
  if (kind !== 'link') {
    element.textContent = groupDigits(body) ?? body;
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
  grain,
  dimmed,
  revealed,
  settleDelay,
  autoFocus,
  viewport,
  metrics,
  onChange,
  onKeywords,
  onRemove,
  onMove,
  onSay,
}: SlipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [labelling, setLabelling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const kind = detectKind(slip.body);
  const keywords = slip.keywords ?? [];
  // Tied to the slip, not to where it happens to sit in the array.
  const seed = seedOf(slip.id);

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    // Never repaint the element the user is typing into.
    if (document.activeElement === element) return;
    paint(element, slip.body, kind);
  }, [slip.body, kind]);

  /**
   * Whether the text runs past the cap, so the fade and the "more" action only
   * appear when there is genuinely something below the fold.
   *
   * Skipped while expanded: opening the slip removes the cap, which would make it
   * measure as un-clipped and take the "less" action away again.
   */
  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element || expanded) return;
    setClipped(element.scrollHeight > element.clientHeight + 2);
  }, [slip.body, expanded, viewport, metrics]);

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
  }, [
    place,
    slip.x,
    slip.y,
    slip.body,
    slip.keywords,
    labelling,
    expanded,
    clipped,
    viewport,
    metrics,
  ]);

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

  /**
   * Replace the presentation with the real text, and leave the caret at the end.
   *
   * `handleInput` stores whatever is in the element, so anything the element shows
   * that is not the body is a way to lose data. A link painted as host and path
   * had already dropped its `https://`: typing one character into it stored the
   * shortened text and the scheme was gone for good.
   */
  const showTruth = () => {
    const element = bodyRef.current;
    if (!element || element.textContent === slip.body) return;

    element.textContent = slip.body;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
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
    // The cap comes back on blur, so the paper shrinks and has to be re-fitted.
    element.scrollTop = 0;
    place(slip.x, slip.y);
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
      onSay('Copied');
    } catch {
      // Clipboard permission can be denied; say nothing rather than lie.
      onSay('Could not copy');
    }
  };

  const className = [
    styles.slip,
    clipped ? styles.clipped : '',
    expanded ? styles.expanded : '',
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
        ['--rest-angle' as string]: restAngle(seed),
        ['--settle-delay' as string]: settleDelay !== null ? `${settleDelay}ms` : undefined,
      }}
    >
      <div
        ref={paperRef}
        className={`${styles.paper} ${styles[kind]}`}
        style={{
          clipPath: tornEdge(seed),
          ['--grain' as string]: grain,
          // Age is read from when the slip was made, never from when it was last
          // touched: editing a note from March does not make the paper new again.
          ['--patina' as string]: patina(slip.createdAt),
        }}
      >
        <div
          ref={bodyRef}
          className={styles.body}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          role="textbox"
          aria-label={`${kind} slip`}
          data-placeholder="paste or type"
          onInput={handleInput}
          onFocus={() => {
            showTruth();
            // Focus also lifts the height cap so the caret stays visible, which
            // changes the paper's size and therefore where it fits.
            place(slip.x, slip.y);
          }}
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
            {clipped && (
              <button
                type="button"
                className={styles.action}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded ? 'less' : 'more'}
              </button>
            )}
            {/*
              "label", not "keyword": the actions are invisible until hover but
              still size the paper, since the slip is width:max-content. The
              longer word pushed every six-digit code from 138px to 190px.
            */}
            <button
              type="button"
              className={styles.action}
              onClick={() => setLabelling(true)}
              title="Words to find this by"
            >
              {keywords.length ? 'edit' : 'label'}
            </button>
            {/*
              Copy is also the drag handle for taking the text out of the browser.
              It cannot live on the timestamp, which already owns dragging the slip
              around the desk — a native drag and a pointer drag on one element are
              mutually exclusive, since the browser takes over the pointer stream.
              Putting it here costs no new chrome and means the same thing: take
              this text somewhere else.
            */}
            <button
              type="button"
              className={styles.action}
              draggable
              title="Copy, or drag it into another window"
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', slip.body);
                // A link dropped on a tab strip or a browser window should open.
                if (kind === 'link') event.dataTransfer.setData('text/uri-list', slip.body);
                event.dataTransfer.effectAllowed = 'copy';
                // Drag the paper, not the word "copy".
                const paper = paperRef.current;
                if (paper) event.dataTransfer.setDragImage(paper, 24, 18);
              }}
              onClick={handleCopy}
            >
              {copied ? 'copied' : 'copy'}
            </button>
            <button
              type="button"
              className={`${styles.action} ${styles.remove}`}
              onClick={() => {
                onRemove(slip.id);
                onSay(`Deleted. ${modifierKey()}Z puts it back`);
              }}
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
              const words = parseKeywords(event.target.value);
              onKeywords(slip.id, words);
              onSay(words.length ? `Findable as ${words.join(', ')}` : 'Keywords cleared');
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

      {seed % 3 === 0 && <Paperclip />}
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

/** Mac keyboards say Cmd, everything else says Ctrl. */
function modifierKey(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+';
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? 'Cmd+' : 'Ctrl+';
}
