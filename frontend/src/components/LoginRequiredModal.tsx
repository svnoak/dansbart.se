import { Link } from 'react-router-dom';
import { CloseIcon } from '@/icons';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
}

export function LoginRequiredModal({ open, onClose, message }: LoginRequiredModalProps) {
  return (
    <Modal open={open} onClose={onClose} label={message}>
      <IconButton aria-label="Stäng" onClick={onClose} className="absolute right-3 top-3">
        <CloseIcon className="h-5 w-5" aria-hidden />
      </IconButton>

      <h2 className="mb-2 pr-12 text-[20px] font-bold leading-tight text-[rgb(var(--color-text))]">
        Logga in först
      </h2>
      <p className="pr-12 text-[15px] text-[rgb(var(--color-text))]">{message}</p>

      <div className="mt-5 flex gap-2">
        <Link
          to="/login"
          onClick={onClose}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius)] bg-[rgb(var(--color-accent))] px-4 py-2 text-sm font-semibold text-[rgb(var(--color-accent-foreground))] transition-colors hover:bg-[rgb(var(--color-accent-hover))] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--color-focus))]"
        >
          Logga in
        </Link>
        <Button variant="outline" onClick={onClose}>
          Avbryt
        </Button>
      </div>
    </Modal>
  );
}
