import { useContext } from 'react';
import type { ConsentContextValue } from './ConsentContext';
import { ConsentContext } from './context';

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider');
  return ctx;
}
