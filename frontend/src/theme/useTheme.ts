import { useContext } from 'react';
import { ThemeContext } from './context';
import type { ThemeContextValue } from './ThemeContext';

const LIGHT_FALLBACK: ThemeContextValue = {
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
};

/** The current theme. Outside a ThemeProvider (tests, isolated renders) it reads as light. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? LIGHT_FALLBACK;
}
