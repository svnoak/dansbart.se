import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/ui';
import { MoreVerticalIcon } from '@/icons';

export interface ActionItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

/**
 * A row's overflow menu: a 44 px trigger and a floating card of 44 px rows.
 * A destructive item is drawn in the error colour.
 */
export function ActionMenu({ actions }: { actions: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <IconButton
        aria-label="Åtgärder"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
      >
        <MoreVerticalIcon className="h-5 w-5" aria-hidden />
      </IconButton>
      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1 w-56 rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-[var(--color-card-shadow)]"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              className={`flex w-full min-h-11 items-center px-4 text-left text-[15px] transition-colors hover:bg-[rgb(var(--color-accent-muted))] ${
                action.variant === 'danger'
                  ? 'text-[rgb(var(--color-error))]'
                  : 'text-[rgb(var(--color-text))]'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
