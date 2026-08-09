import { useEffect } from 'react';
import { useDesk } from './store';
import { DESK_SURFACES, DESK_TONES, type DeskTone } from './types';
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

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, updateSettings } = useDesk();

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
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={styles.title}>pastespot</span>
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

        <p className={styles.note}>
          Everything stays in this browser. Nothing is uploaded.
        </p>
      </div>
    </div>
  );
}
