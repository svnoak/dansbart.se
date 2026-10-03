import { Link } from 'react-router-dom';
import { CloseIcon } from '@/icons';
import { Modal } from '@/ui/Modal';
import { Button, IconButton } from '@/ui';
import { buttonClassName } from '@/ui/buttonStyles';

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
}

export function LoginRequiredModal({ open, onClose, message }: LoginRequiredModalProps) {
  return (
    <Modal open={open} onClose={onClose} label={message}>
      <IconButton aria-label="Stäng" onClick={onClose} className="absolute right-3 top-3">
        <CloseIcon className="h-4 w-4" aria-hidden />
      </IconButton>

      <p className="pr-10 text-base text-[rgb(var(--color-text))]">{message}</p>

      <div className="mt-4 flex gap-2">
        <Link to="/login" onClick={onClose} className={buttonClassName('primary', 'md', 'flex-1')}>
          Logga in
        </Link>
        <Button variant="ghost" onClick={onClose}>
          Avbryt
        </Button>
      </div>
    </Modal>
  );
}
