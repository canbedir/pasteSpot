// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Needed for canonical and og:url. Update if the domain changes.
  site: 'https://pastespot.app',
  // The dev toolbar docks to the bottom edge, exactly where the page tabs live.
  devToolbar: { enabled: false },
  integrations: [react()],
});
