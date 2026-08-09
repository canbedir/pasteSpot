import { SCHEMA_VERSION } from './db';
import { clampToDesk, type Page, type Settings, type Slip } from './types';

/**
 * Getting data back out is the price of asking someone to keep it in a browser.
 * Clearing site data is one menu click away, so an export has to exist before
 * anyone can reasonably rely on this.
 */

export interface ExportFile {
  format: 'pastespot';
  version: number;
  exportedAt: string;
  pages: Page[];
  slips: Slip[];
  settings: Settings;
}

export function buildExport(pages: Page[], slips: Slip[], settings: Settings): ExportFile {
  return {
    format: 'pastespot',
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    pages,
    slips,
    settings,
  };
}

/**
 * The plain-text export is the one that still opens in ten years. It is grouped
 * by page and ordered oldest first, so it reads as a log rather than a dump.
 */
export function toPlainText(pages: Page[], slips: Slip[]): string {
  const stamp = (value: number) => new Date(value).toLocaleString();
  const lines: string[] = [`pastespot export · ${new Date().toLocaleString()}`];

  for (const page of [...pages].sort((a, b) => a.order - b.order)) {
    const onPage = slips
      .filter((slip) => slip.pageId === page.id)
      .sort((a, b) => a.createdAt - b.createdAt);

    lines.push('', `# ${page.name}`, '');
    if (onPage.length === 0) {
      lines.push('(empty)');
      continue;
    }
    for (const slip of onPage) {
      lines.push(slip.body, `  — ${stamp(slip.createdAt)}`, '');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export class ImportError extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Parse an export back into pages and slips.
 *
 * Every id is remapped, so importing can only ever add. A backup restored onto
 * a desk that already has slips duplicates them; it never overwrites them.
 * Losing work to an import would be far worse than a duplicate.
 */
export function parseImport(raw: string): { pages: Page[]; slips: Slip[] } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ImportError('That file is not valid JSON.');
  }

  if (!isObject(data) || data.format !== 'pastespot') {
    throw new ImportError('That is not a pastespot export.');
  }
  if (!Array.isArray(data.pages) || !Array.isArray(data.slips)) {
    throw new ImportError('That export is missing its pages or slips.');
  }

  const now = Date.now();
  const idMap = new Map<string, string>();
  const pages: Page[] = [];

  for (const raw of data.pages) {
    if (!isObject(raw) || typeof raw.id !== 'string') continue;
    const id = newId();
    idMap.set(raw.id, id);
    pages.push({
      id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'imported',
      order: pages.length,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    });
  }

  if (pages.length === 0) {
    throw new ImportError('That export has no pages in it.');
  }

  const slips: Slip[] = [];
  for (const raw of data.slips) {
    if (!isObject(raw)) continue;
    if (typeof raw.body !== 'string' || !raw.body.trim()) continue;

    // A slip whose page is missing would be invisible forever; put it on the first.
    const pageId =
      (typeof raw.pageId === 'string' ? idMap.get(raw.pageId) : undefined) ?? pages[0]!.id;

    const spot = clampToDesk(
      typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : 8,
      typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : 8,
    );

    slips.push({
      id: newId(),
      pageId,
      body: raw.body,
      x: spot.x,
      y: spot.y,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    });
  }

  return { pages, slips };
}

/** Hand a generated file to the browser. */
export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // Some browsers ignore a click on a link that is not in the document.
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking straight after the click can cancel the download before it starts,
  // because the click is handled asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function exportFilename(extension: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `pastespot-${day}.${extension}`;
}
