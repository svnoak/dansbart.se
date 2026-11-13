import { useCallback, useState } from 'react';
import { toast } from '@/ui';

export interface UseShareLinkResult {
  shareToken: string | null;
  shareUrl: string | null;
  createLink: () => Promise<void>;
  removeLink: () => Promise<void>;
  copyLink: () => void;
  clearErrors: () => void;
  createLinkError: string | null;
  copyLinkError: string | null;
  removeLinkError: string | null;
}

export interface ShareLinkApi {
  /** Creates a new token and returns the list with it. */
  generate: (listId: string) => Promise<{ shareToken?: string }>;
  invalidate: (listId: string) => Promise<unknown>;
  /** The path the token is appended to, such as `/shared/`. */
  pathPrefix: string;
}

/** Owns the share token for a list and the actions that create, remove, and copy its link. */
export function useShareLink(
  listId: string | undefined,
  initialShareToken: string | undefined,
  { generate, invalidate, pathPrefix }: ShareLinkApi,
): UseShareLinkResult {
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken ?? null);
  const [syncedInitial, setSyncedInitial] = useState(initialShareToken);
  if (initialShareToken !== syncedInitial) {
    setSyncedInitial(initialShareToken);
    setShareToken(initialShareToken ?? null);
  }

  const [createLinkError, setCreateLinkError] = useState<string | null>(null);
  const [copyLinkError, setCopyLinkError] = useState<string | null>(null);
  const [removeLinkError, setRemoveLinkError] = useState<string | null>(null);

  const createLink = useCallback(async () => {
    if (!listId) return;
    setCreateLinkError(null);
    try {
      const updated = await generate(listId);
      setShareToken(updated.shareToken ?? null);
      toast('Delningslänk skapad');
    } catch {
      setCreateLinkError('Kunde inte skapa delningslänk');
    }
  }, [listId, generate]);

  const removeLink = useCallback(async () => {
    if (!listId) return;
    setRemoveLinkError(null);
    try {
      await invalidate(listId);
      setShareToken(null);
      toast('Delningslänk ogiltigförklarad');
    } catch {
      setRemoveLinkError('Kunde inte ogiltigförklara länk');
    }
  }, [listId, invalidate]);

  const copyLink = useCallback(() => {
    if (!shareToken) return;
    setCopyLinkError(null);
    const url = `${window.location.origin}${pathPrefix}${shareToken}`;
    navigator.clipboard.writeText(url).then(() => toast('Länk kopierad')).catch(() => setCopyLinkError('Det gick inte att kopiera länken.'));
  }, [shareToken, pathPrefix]);

  const clearErrors = useCallback(() => {
    setCreateLinkError(null);
    setCopyLinkError(null);
    setRemoveLinkError(null);
  }, []);

  const shareUrl = shareToken ? `${window.location.origin}${pathPrefix}${shareToken}` : null;

  return {
    shareToken,
    shareUrl,
    createLink,
    removeLink,
    copyLink,
    clearErrors,
    createLinkError,
    copyLinkError,
    removeLinkError,
  };
}
