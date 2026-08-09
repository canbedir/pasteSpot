import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { detectKind, formatStamp, splitLink } from './detect';
import { restAngle, tornEdge } from './textures';
import type { Slip as SlipModel, SlipKind } from './types';
import styles from './Slip.module.css';

interface SlipProps {
  slip: SlipModel;
  index: number;
  grain: string;
  dimmed: boolean;
  settleDelay: number | null;
  autoFocus: boolean;
  onChange: (id: string, body: string) => void;
  onRemove: (id: string) => void;
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

export default function Slip({
  slip,
  index,
  grain,
  dimmed,
  settleDelay,
  autoFocus,
  onChange,
  onRemove,
}: SlipProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const kind = detectKind(slip.body);

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    // Never repaint the element the user is typing into.
    if (document.activeElement === element) return;
    paint(element, slip.body, kind);
  }, [slip.body, kind]);

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
    settleDelay !== null ? styles.settling : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{
        left: `${slip.x}%`,
        top: `${slip.y}%`,
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
          <span>{formatStamp(slip.updatedAt)}</span>
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

      {index % 3 === 0 && <Paperclip />}
    </div>
  );
}

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
