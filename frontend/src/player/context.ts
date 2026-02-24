import { createContext } from 'react';
import type { PlayerContextValue } from './PlayerContext';

export const PlayerContext = createContext<PlayerContextValue | null>(null);
