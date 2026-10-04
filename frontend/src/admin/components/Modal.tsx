import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/ui';
import { CloseIcon } from '@/icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A centred dialog with a title row and a close control. Escape and a click
 * on the backdrop close it.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] shadow-[var(--color-card-shadow)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--color-border))] py-3 pl-6 pr-3">
          <h2 className="text-xl font-bold leading-tight text-[rgb(var(--color-text))]">
            {title}
          </h2>
          <IconButton
            aria-label="Stäng"
            onClick={onClose}
            className="shrink-0 text-[rgb(var(--color-text-muted))]"
          >
            <CloseIcon className="h-5 w-5" aria-hidden />
          </IconButton>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
