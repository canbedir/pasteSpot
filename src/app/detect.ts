import type { SlipKind } from './types';

/** A bare URL, with or without a scheme. Must be the whole string. */
const LINK = /^(https?:\/\/|www\.)\S+$/i;

/** Long enough for an IBAN with spaces, short enough to exclude prose. */
const CODE_MAX_LENGTH = 44;

/**
 * A code is short, contains a digit, and has no lower-case letters.
 *
 * That covers the cases this product exists for — 146704, 8712-4460,
 * TR33 0006 1005 1978, ORDER-99312, 9789750736070 — while keeping ordinary
 * writing out, because prose almost always carries lower-case letters.
 *
 * Comparing against the upper-cased string rather than testing a Latin
 * character class keeps this working for non-Latin scripts too.
 *
 * The known trade-off: a short shouty phrase containing a number, like
 * "MEETING AT 3", is typeset as a code. Rare enough to accept, and the slip is
 * still perfectly readable when it happens.
 */
function isCode(text: string): boolean {
  if (text.length > CODE_MAX_LENGTH) return false;
  if (!/\d/.test(text)) return false;
  return text === text.toUpperCase();
}

export function detectKind(body: string): SlipKind {
  const text = body.trim();
  if (!text) return 'text';
  if (LINK.test(text)) return 'link';
  if (isCode(text)) return 'code';
  return 'text';
}

/**
 * A long unbroken run of digits, regrouped in fours so it can be read back.
 *
 * `4242424242424242` and `TR330006100519786457841326` are the shapes people paste
 * from a banking app, and both are almost impossible to read aloud or check
 * against a form. Cards and IBANs are conventionally written in fours, so this is
 * how they are meant to look.
 *
 * Returns null when the string should be left alone. Two deliberate exclusions:
 *
 * - Anything already containing a space is presented the way it was pasted.
 * - Anything under 14 characters. A Turkish mobile is 11 digits and reads as
 *   `0532 118 4470`, and an ISBN is 13 and groups as `978-975-07-3607-0`; fours
 *   would be wrong for both, and wrong grouping is worse than none.
 *
 * This is a *rendering*, never the stored text. The body keeps exactly what was
 * pasted, which is what a copy hands back.
 */
const GROUPABLE = /^(?:[A-Z]{2})?\d{12,}$/;

export function groupDigits(body: string): string | null {
  const text = body.trim();
  if (text.length < 14 || /\s/.test(text)) return null;
  if (!GROUPABLE.test(text)) return null;

  return text.match(/.{1,4}/g)?.join(' ') ?? null;
}

/** Split a link into host and path so the host can carry the emphasis. */
export function splitLink(body: string): { host: string; path: string } {
  const bare = body.trim().replace(/^https?:\/\//i, '');
  const slash = bare.indexOf('/');
  if (slash === -1) return { host: bare, path: '' };
  return { host: bare.slice(0, slash), path: bare.slice(slash) };
}

/** Short, local-time stamp for a slip's foot. */
export function formatStamp(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const sameDay = new Date(now).toDateString() === date.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
