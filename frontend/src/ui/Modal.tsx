import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}

let nextModalId = 0;
const openModalStack: number[] = [];

export function Modal({ open, onClose, label, children }: ModalProps) {
  const idRef = useRef<number | null>(null);
  if (idRef.current === null) idRef.current = nextModalId++;
  const id = idRef.current;

  useEffect(() => {
    if (!open) return;
    openModalStack.push(id);
    return () => {
      const index = openModalStack.indexOf(id);
      if (index !== -1) openModalStack.splice(index, 1);
    };
  }, [open, id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openModalStack[openModalStack.length - 1] === id) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, id, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-elevated))] p-6 shadow-xl">
        {children}
      </div>
    </div>,
    document.body,
  );
}
