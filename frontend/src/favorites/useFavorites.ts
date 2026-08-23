import { useContext } from 'react';
import type { FavoritesContextValue } from './context';
import { FavoritesContext } from './context';

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
