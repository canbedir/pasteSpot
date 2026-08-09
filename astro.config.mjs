// @ts-check
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

/**
 * Rewrites dist/sw.js with the real asset names once the build has emitted them.
 *
 * Without this the worker can only cache what a page happened to request while
 * it was already in control, which on a first visit is almost nothing — the app
 * then appears to work offline only because Chrome's own HTTP cache still has
 * the bundle, which is not something to rely on.
 *
 * Hand-rolled because the whole manifest is a dozen files; a Workbox build
 * plugin would be more machinery than the problem deserves.
 */
function precacheServiceWorker() {
  /**
   * Everything needed to paint the desk with no network at all.
   * @param {string} path
   * @returns {boolean}
   */
  const shouldPrecache = (path) =>
    path.startsWith('_astro/') ||
    path.startsWith('fonts/') ||
    path.startsWith('icons/') ||
    /^favicon(-\d+)?\.(png|svg)$/.test(path) ||
    path === 'logo.svg' ||
    path === 'site.webmanifest';

  /**
   * @param {URL} dir
   * @param {string} base
   * @returns {Promise<string[]>}
   */
  async function walk(dir, base = '') {
    const entries = await readdir(new URL(base, dir), { withFileTypes: true });
    /** @type {string[]} */
    const found = [];
    for (const entry of entries) {
      const path = base ? `${base}${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        found.push(...(await walk(dir, `${path}/`)));
      } else {
        found.push(path);
      }
    }
    return found;
  }

  // Typed through a variable rather than on the return, so the hook parameters
  // pick up their contextual types.
  /** @type {import('astro').AstroIntegration} */
  const integration = {
    name: 'pastespot:precache',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const swUrl = new URL('sw.js', dir);
        let source;
        try {
          source = await readFile(swUrl, 'utf8');
        } catch {
          logger.warn('sw.js missing from the build; skipping precache');
          return;
        }

        const assets = (await walk(dir))
          .filter(shouldPrecache)
          .map((path) => `/${path}`)
          .sort();
        const urls = ['/', ...assets];

        // A content hash means a new build gets a new cache, and the old one is
        // dropped on activate rather than serving a mix of two deploys.
        const build = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 8);

        const updated = source
          .replace(/^const BUILD = .*; \/\/ @build$/m, `const BUILD = '${build}'; // @build`)
          .replace(
            /^const PRECACHE = .*; \/\/ @precache$/m,
            `const PRECACHE = ${JSON.stringify(urls)}; // @precache`,
          );

        if (updated === source) {
          logger.warn('sw.js markers not found; precache list was not injected');
          return;
        }

        await writeFile(swUrl, updated);
        logger.info(`precached ${urls.length} files as pastespot-${build}`);
      },
    },
  };

  return integration;
}

// https://astro.build/config
export default defineConfig({
  // Needed for canonical and og:url. Update if the domain changes.
  site: 'https://pastespot.app',
  // The dev toolbar docks to the bottom edge, exactly where the page tabs live.
  devToolbar: { enabled: false },
  integrations: [react(), precacheServiceWorker()],
});
