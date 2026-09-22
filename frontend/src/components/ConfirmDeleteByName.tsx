import { useState, useRef, useEffect } from 'react';
import { Button } from '@/ui';

interface ConfirmDeleteByNameProps {
  name: string;
  buttonLabel: string;
  onConfirm: () => void;
}

export function ConfirmDeleteByName({ name, buttonLabel, onConfirm }: ConfirmDeleteByNameProps) {
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (confirming) {
      inputRef.current?.focus();
    }
  }, [confirming]);

  return (
    <div className="space-y-2">
      <Button variant="danger" onClick={() => setConfirming(true)}>
        {buttonLabel}
      </Button>
      {confirming && (
        <div className="space-y-2">
          <label className="block text-sm text-[rgb(var(--color-text-muted))]">
            {`Skriv ${name} för att bekräfta`}
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[rgb(var(--color-error))]/50 bg-[rgb(var(--color-bg))] px-3 py-1.5 text-sm text-[rgb(var(--color-text))] focus:outline-none focus:border-[rgb(var(--color-error))]"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="danger" disabled={text !== name} onClick={onConfirm}>
              Radera permanent
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirming(false);
                setText('');
              }}
            >
              Avbryt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
