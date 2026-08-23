import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { getFavoriteIds, toggleFavorite as apiToggle } from '@/api/generated/favorites/favorites';
import { FavoritesContext } from './context';

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getFavoriteIds()
      .then((ids) => { if (!cancelled) setFavoriteIds(new Set(ids)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const isFavorited = useCallback(
    (trackId: string) => isAuthenticated && favoriteIds.has(trackId),
    [favoriteIds, isAuthenticated],
  );

  const toggleFavorite = useCallback(async (trackId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
    try {
      const result = await apiToggle(trackId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (result['favorited']) next.add(trackId);
        else next.delete(trackId);
        return next;
      });
    } catch {
      getFavoriteIds()
        .then((ids) => setFavoriteIds(new Set(ids)))
        .catch(() => {});
    }
  }, []);

  return (
    <FavoritesContext.Provider value={{ isFavorited, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}
