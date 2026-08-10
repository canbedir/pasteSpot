import { useEffect, useRef, useState } from 'react';
import { storageHealth, type StorageHealth } from './db';
import { useDesk } from './store';
import {
  buildExport,
  download,
  exportFilename,
  ImportError,
  parseImport,
  toPlainText,
} from './transfer';
import {
  DEFAULT_SETTINGS,
  DESK_SURFACES,
  DESK_TONES,
  PROSE_FACES,
  TEXT_SIZES,
  type DeskTone,
  type ProseFace,
} from './types';
import styles from './Overlay.module.css';

interface SettingsPanelProps {
  onClose: () => void;
}

/** Swatch previews. These mirror the ground values in tokens.css. */
const TONE_SWATCH: Record<DeskTone, string> = {
  moss: '#0e1411',
  walnut: '#17130e',
  ink: '#0d111a',
  graphite: '#141618',
  plum: '#14101a',
};

const SURFACE_LABEL = {
  pool: 'light pool',
  contour: 'contour',
  flat: 'flat',
} as const;

const PROSE_LABEL = { serif: 'serif', sans: 'sans' } as const;

/** Each option previews itself, which beats any label describing a typeface. */
const PROSE_FONT: Record<ProseFace, string> = {
  serif: 'var(--font-display)',
  sans: 'var(--font-body)',
};

/** Sizes people recognise, not exact ones. A desk of text is always small. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings, pages, slips, importSnapshot } = useDesk();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [health, setHealth] = useState<StorageHealth | null>(null);

  useEffect(() => {
    void storageHealth().then(setHealth);
  }, []);

  const changed = (Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>).some(
    (key) => settings[key] !== DEFAULT_SETTINGS[key],
  );

  const handleImport = async (file: File) => {
    try {
      const result = parseImport(await file.text());
      importSnapshot(result.pages, result.slips);
      setNotice(
        `Added ${result.slips.length} slip${result.slips.length === 1 ? '' : 's'} across ${result.pages.length} page${result.pages.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      setNotice(
        error instanceof ImportError ? error.message : 'That file could not be read.',
      );
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className={`${styles.scrim} ${styles.scrimCentred}`}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.head}>
          <img
            className={styles.lockup}
            src="/lockup-white.svg"
            alt="pastespot"
            width="114"
            height="22"
          />
          <button type="button" className={styles.close} onClick={onClose}>
            esc
          </button>
        </div>

        <div className={styles.group}>
          <p className={styles.legend}>Desk tone</p>
          <div className={styles.row}>
            {DESK_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                className={styles.swatch}
                style={{ ['--swatch' as string]: TONE_SWATCH[tone] }}
                aria-label={tone}
                aria-pressed={settings.tone === tone}
                onClick={() => updateSettings({ tone })}
              />
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <p className={styles.legend}>Surface</p>
          <div className={styles.row}>
            {DESK_SURFACES.map((surface) => (
              <button
                key={surface}
                type="button"
                className={styles.choice}
                aria-pressed={settings.surface === surface}
                onClick={() => updateSettings({ surface })}
              >
                {SURFACE_LABEL[surface]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <p className={styles.legend}>Writing</p>
          <div className={styles.row}>
            {PROSE_FACES.map((prose) => (
              <button
                key={prose}
                type="button"
                className={styles.choice}
                // Set in the face it is offering, so the choice shows itself.
                style={{ fontFamily: PROSE_FONT[prose] }}
                aria-pressed={settings.prose === prose}
                onClick={() => updateSettings({ prose })}
              >
                {PROSE_LABEL[prose]}
              </button>
            ))}
          </div>
          <div className={`${styles.row} ${styles.rowSpaced}`}>
            {TEXT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={styles.choice}
                aria-pressed={settings.size === size}
                onClick={() => updateSettings({ size })}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.group}>
          <p className={styles.legend}>Your data</p>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.choice}
              onClick={() =>
                download(
                  exportFilename('json'),
                  JSON.stringify(buildExport(pages, slips, settings), null, 2),
                  'application/json',
                )
              }
            >
              export json
            </button>
            <button
              type="button"
              className={styles.choice}
              onClick={() =>
                download(exportFilename('txt'), toPlainText(pages, slips), 'text/plain')
              }
            >
              export text
            </button>
            <button
              type="button"
              className={styles.choice}
              onClick={() => fileRef.current?.click()}
            >
              import
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset so choosing the same file twice still fires a change.
              event.target.value = '';
              if (file) void handleImport(file);
            }}
          />
          {notice && <p className={styles.notice}>{notice}</p>}
        </div>

        {/* Only offered once something has actually been changed, so the panel does
            not carry a button that undoes nothing. Appearance only: it cannot
            touch a slip, which is why it needs no confirmation. */}
        {changed && (
          <div className={styles.group}>
            <button
              type="button"
              className={styles.choice}
              onClick={() => {
                updateSettings(DEFAULT_SETTINGS);
                setNotice('Appearance back to default. Your slips are untouched.');
              }}
            >
              reset appearance
            </button>
          </div>
        )}

        <p className={styles.note}>
          {slips.length} slip{slips.length === 1 ? '' : 's'} on{' '}
          {pages.length} page{pages.length === 1 ? '' : 's'}
          {health && `, using ${formatSize(health.usage)}`}.
          <br />
          {health?.persisted
            ? 'This browser has been asked to keep them, so they survive storage pressure.'
            : 'Everything stays in this browser. Clearing site data deletes it, so export before you do.'}
        </p>
      </div>
    </div>
  );
}
