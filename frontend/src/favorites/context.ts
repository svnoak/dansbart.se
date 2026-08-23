import { createContext } from 'react';

export interface FavoritesContextValue {
  isFavorited: (trackId: string) => boolean;
  toggleFavorite: (trackId: string) => Promise<void>;
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);
