import { useState } from 'react';
import { useScreenWakeLock } from './hooks/useScreenWakeLock';
import { usePlayer } from './usePlayer';

const STORAGE_KEY = 'dansbart.keepScreenOn';

function loadStoredCheckState(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/** A labelled switch that keeps the screen on while music plays. Hidden where the browser cannot do that. */
export function WakeLockToggle() {
  const [checked, setChecked] = useState(() => loadStoredCheckState());
  const { isPlaying } = usePlayer();

  useScreenWakeLock(checked && isPlaying);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.currentTarget.checked;
    setChecked(newChecked);
    try {
      localStorage.setItem(STORAGE_KEY, String(newChecked));
    } catch (error) {
      void error;
    }
  };

  if (!navigator.wakeLock) {
    return null;
  }

  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[rgb(var(--color-text))]">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        onChange={handleChange}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative inline-block h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[rgb(var(--color-focus))] ${
          checked ? 'bg-[rgb(var(--color-selected))]' : 'bg-[rgb(var(--color-border-strong))]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      Håll skärmen tänd medan musiken spelar
    </label>
  );
}
