/**
 * A tool whose whole promise is "your data never leaves this machine" should
 * not need a network to open. Registering is deliberately quiet: if it fails,
 * the desk works exactly as before, just online-only.
 *
 * Development is excluded on purpose — a service worker serving a stale shell
 * over a hot-reloading dev server produces confusing, hard-to-explain bugs.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('pastespot: offline support unavailable', error);
    });
  };

  // The island hydrates lazily, so `load` has usually already fired by the time
  // this runs. Waiting for an event that will never come registers nothing.
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
