import { createContext } from 'react';
import type { ConsentContextValue } from './ConsentContext';

export const ConsentContext = createContext<ConsentContextValue | null>(null);
