import type { SlipKind } from './types';

/** A bare URL, with or without a scheme. Must be the whole string. */
const LINK = /^(https?:\/\/|www\.)\S+$/i;

/**
 * Digit-led strings: codes, IBANs, phone numbers, ISBNs, order references.
 * Letters are allowed after the first character so "TR33 0006..." and
 * "2026-0884" both match, but the string has to start with a digit — otherwise
 * ordinary sentences beginning with a word would be typeset as codes.
 */
const CODE = /^[0-9][0-9a-z\s\-/.]*$/i;

/** Long enough for an IBAN with spaces, short enough to exclude prose. */
const CODE_MAX_LENGTH = 44;

export function detectKind(body: string): SlipKind {
  const text = body.trim();
  if (!text) return 'text';
  if (LINK.test(text)) return 'link';
  if (text.length <= CODE_MAX_LENGTH && CODE.test(text)) return 'code';
  return 'text';
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
