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
    <label className="flex min-h-11 items-center gap-2 text-sm text-[rgb(var(--color-text))]">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="h-5 w-5 rounded border-[rgb(var(--color-border))]"
      />
      Håll skärmen tänd medan musiken spelar
    </label>
  );
}
