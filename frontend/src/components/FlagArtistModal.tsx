import { useState } from 'react';
import { flagArtist } from '@/api/generated/artists/artists';
import { Button, InlineError, Modal, toast } from '@/ui';

interface FlagArtistModalProps {
  open: boolean;
  onClose: () => void;
  artistId: string;
  artistName: string;
}

export function FlagArtistModal({ open, onClose, artistId, artistName }: FlagArtistModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      await flagArtist(artistId);
      toast('Artisten är rapporterad', 'success');
      onClose();
    } catch {
      setError('Kunde inte rapportera artisten. Försök igen.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} label="Rapportera artist">
      <p className="mb-4 text-[rgb(var(--color-text))]">
        Är du säker på att du vill rapportera {artistName} som inte dansbar?
      </p>
      <InlineError>{error}</InlineError>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={handleClose}>Avbryt</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>Rapportera</Button>
      </div>
    </Modal>
  );
}
