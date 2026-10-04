import { useState, useRef, useEffect, useId } from 'react';
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
  const inputId = useId();

  useEffect(() => {
    if (confirming) {
      inputRef.current?.focus();
    }
  }, [confirming]);

  return (
    <div className="space-y-3">
      <Button variant="danger" onClick={() => setConfirming(true)}>
        {buttonLabel}
      </Button>
      {confirming && (
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-4">
          <label htmlFor={inputId} className="block text-[14px] font-semibold text-[rgb(var(--color-text))]">
            {`Skriv ${name} för att bekräfta`}
          </label>
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            className="min-h-11 w-full rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] px-3 py-2 text-[15px] text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-focus))]"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" disabled={text !== name} onClick={onConfirm}>
              Radera permanent
            </Button>
            <Button
              variant="outline"
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
