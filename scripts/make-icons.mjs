/**
 * Regenerates every raster icon from public/logo.svg.
 *
 *   node scripts/make-icons.mjs [repoRoot]
 *
 * puppeteer-core is not a project dependency — this runs rarely. Install it
 * anywhere, then pass the repo root as the first argument if the script is run
 * from outside this tree.
 *
 * The mark is a single thin ribbon, which falls apart below about 32px: at 16px
 * the stroke lands under one pixel and turns to mush. Small sizes therefore get
 * an optically bolder cut — the outline is dilated with a stroke of its own
 * colour — and fill more of the frame. This is ordinary practice for small
 * logo sizes, not a hack.
 *
 * Icons also carry the desk's ground and light, because the mark is monochrome
 * on transparency and would vanish against a matching tab strip or dock.
 */
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const REPO =
  process.argv[2] ?? new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const source = readFileSync(`${REPO}/public/logo.svg`, 'utf8');
const path = /<path[^>]*\sd="([^"]+)"/.exec(source)?.[1];
if (!path) throw new Error('no path found in public/logo.svg');

const DESK = '#0e1411';
const GLOW = 'rgb(186 255 219 / 16%)';

/** `dilate` is in viewBox units; the mark sits on a 1024 grid. */
function markup({ size, inset, dilate, ground }) {
  const mark = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"
         style="width:${Math.round(size * inset)}px;height:${Math.round(size * inset)}px;display:block">
      <path d="${path}" fill="#fff" fill-rule="evenodd"
            ${dilate ? `stroke="#fff" stroke-width="${dilate}" stroke-linejoin="round"` : ''} />
    </svg>`;

  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    .icon{
      width:${size}px;height:${size}px;display:grid;place-items:center;
      ${ground ? `background: radial-gradient(90% 70% at 50% 0%, ${GLOW}, transparent 70%), ${DESK};` : ''}
    }
  </style><div class="icon">${mark}</div>`;
}

const jobs = [
  // Tab icons. Nothing crops them, so the mark runs large; the smaller the
  // size, the more the outline has to be fattened to survive.
  // Values found by sweeping: past roughly 20 the two loops merge into a blob,
  // which is worse than a thin mark. 16px is the honest limit of this logo.
  { file: 'favicon-16.png', size: 16, inset: 0.94, dilate: 18, ground: true },
  { file: 'favicon-32.png', size: 32, inset: 0.9, dilate: 12, ground: true },
  { file: 'favicon-48.png', size: 48, inset: 0.86, dilate: 7, ground: true },
  // Installed icons keep the mark inside the maskable safe zone (middle 80%).
  { file: 'icons/icon-192.png', size: 192, inset: 0.6, dilate: 0, ground: true },
  { file: 'icons/icon-512.png', size: 512, inset: 0.6, dilate: 0, ground: true },
  // Apple applies its own rounding, so this one can sit slightly larger.
  { file: 'icons/apple-touch-icon.png', size: 180, inset: 0.68, dilate: 0, ground: true },
];

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});
const tab = await browser.newPage();

for (const job of jobs) {
  await tab.setViewport({ width: job.size, height: job.size });
  await tab.setContent(markup(job), { waitUntil: 'load' });
  await tab.screenshot({ path: `${REPO}/public/${job.file}` });
  console.log(`public/${job.file}  ${job.size}x${job.size}  dilate ${job.dilate}`);
}

await browser.close();
