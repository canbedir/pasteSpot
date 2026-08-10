/**
 * Textures are generated at runtime rather than shipped as image assets. They
 * are a few hundred bytes of code instead of a few hundred kilobytes of PNG,
 * and the contour field has to be redrawn on resize anyway.
 */

let grainCache: string | null = null;

/** Fine film grain, tiled. This is what stops the desk reading as flat digital. */
export function grainTile(size = 140): string {
  if (grainCache) return grainCache;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) return '';

  const image = context.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = 118 + Math.random() * 42;
    image.data[i] = value;
    image.data[i + 1] = value;
    image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);

  grainCache = `url(${canvas.toDataURL('image/png')})`;
  return grainCache;
}

/**
 * Iso-lines through a sum of sines. Reads as a contour map: organic, and
 * pointedly not the dot grid every other canvas tool uses.
 *
 * Drawn at half resolution and scaled up by CSS, which softens the lines and
 * quarters the pixel work.
 */
export function drawContour(canvas: HTMLCanvasElement, rgb: string): void {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const width = Math.max(1, Math.round(rect.width / 2));
  const height = Math.max(1, Math.round(rect.height / 2));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return;

  const [r, g, b] = rgb.split(/\s+/).map(Number) as [number, number, number];
  const image = context.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const v = y / height;
      const field =
        Math.sin(u * 5.1 + v * 2.3) +
        Math.sin(u * 2.7 - v * 6.4 + 1.7) * 0.75 +
        Math.sin((u + v) * 4.2 + 0.6) * 0.55 +
        Math.sin(v * 8.3 - u * 1.4) * 0.3;

      const band = field * 2.6;
      const distance = Math.abs(band - Math.round(band));
      const alpha = Math.max(0, 1 - distance / 0.09);

      const i = (y * width + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = Math.round(alpha * alpha * 30);
    }
  }

  context.putImageData(image, 0, 0);
}

/**
 * A stable seed for one slip, derived from its id.
 *
 * This used to be the slip's index in the array, which meant the paper re-tore
 * and re-rotated whenever anything shifted: deleting one slip changed the torn
 * edge, the resting angle and the paperclip of every slip after it. An id never
 * changes, so the paper is torn once and stays that way.
 */
export function seedOf(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 100000);
}

/**
 * A torn bottom edge as a clip-path polygon.
 *
 * Seeded from the slip itself so a re-render never re-tears the paper. Note
 * that a clipped element needs `filter: drop-shadow`, not `box-shadow` —
 * box-shadow ignores the clip and draws a rectangle underneath.
 */
export function tornEdge(seed: number, teeth = 18, depth = 3.4): string {
  const points = ['0% 0%', '100% 0%'];
  for (let i = 0; i <= teeth; i += 1) {
    const x = 100 - (i / teeth) * 100;
    const noise = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const jitter = noise - Math.floor(noise);
    points.push(`${x.toFixed(2)}% ${(100 - jitter * depth).toFixed(2)}%`);
  }
  return `polygon(${points.join(', ')})`;
}

/** ±1.3°, derived from the slip's own seed so it never jumps to a new angle. */
export function restAngle(seed: number): string {
  return `${(((seed * 37) % 7) - 3) * 0.42}deg`;
}
