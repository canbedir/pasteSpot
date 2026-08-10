/**
 * Where a desk lives, read from the manifest.
 *
 * The manifest's content-script matches are already the authority on which origins
 * the bridge runs on. Everything else derives from that list rather than repeating
 * it — the popup once kept its own copy and it went stale, which made it report
 * that a capture was waiting while the desk was open in the next tab.
 */

/** Match patterns, e.g. `https://pastespot.vercel.app/*`. */
export function deskMatches() {
  return chrome.runtime.getManifest().content_scripts.flatMap((script) => script.matches);
}

/**
 * The URL to load when no desk is open.
 *
 * The first https match wins: localhost is only there so the extension can be
 * tested against a dev server, and loading it on someone's machine would either
 * fail or, worse, quietly reach a different desk.
 */
export function deskUrl() {
  const pattern = deskMatches().find((match) => match.startsWith('https://'));
  return pattern ? pattern.replace(/\*$/, '') : null;
}
