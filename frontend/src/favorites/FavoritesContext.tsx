import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { getFavoriteIds, toggleFavorite as apiToggle } from '@/api/generated/favorites/favorites';

interface FavoritesContextValue {
  isFavorited: (trackId: string) => boolean;
  toggleFavorite: (trackId: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      return;
    }
    let cancelled = false;
    getFavoriteIds()
      .then((ids) => { if (!cancelled) setFavoriteIds(new Set(ids)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const isFavorited = useCallback((trackId: string) => favoriteIds.has(trackId), [favoriteIds]);

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

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
