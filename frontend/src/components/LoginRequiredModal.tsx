import { Link } from 'react-router-dom';
import { CloseIcon } from '@/icons';
import { Modal } from '@/ui/Modal';

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
}

export function LoginRequiredModal({ open, onClose, message }: LoginRequiredModalProps) {
  return (
    <Modal open={open} onClose={onClose} label={message}>
      <button
        type="button"
        aria-label="Stäng"
        onClick={onClose}
        className="absolute right-3 top-3 rounded p-1 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
      >
        <CloseIcon className="h-4 w-4" aria-hidden />
      </button>

      <p className="pr-6 text-sm text-[rgb(var(--color-text))]">{message}</p>

      <div className="mt-4 flex gap-2">
        <Link
          to="/login"
          onClick={onClose}
          className="flex-1 rounded-lg bg-[rgb(var(--color-accent))] px-4 py-2 text-center text-sm font-medium text-white hover:opacity-90"
        >
          Logga in
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[rgb(var(--color-border))] px-4 py-2 text-sm text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-border))]/50"
        >
          Avbryt
        </button>
      </div>
    </Modal>
  );
}
