import { useEffect, useRef, useState } from 'react';

export interface ActionItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

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
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-text))]/6 hover:text-[rgb(var(--color-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
        aria-label="Åtgärder"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-[var(--radius)] border border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-bg-elevated))] py-1 shadow-[var(--color-card-shadow)]">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              className={`min-h-11 w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-[rgb(var(--color-pill-bg))] ${
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
