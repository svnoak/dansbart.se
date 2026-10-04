export type StylePillState = 'confirmed' | 'guess' | 'unknown';

/** Derive the pill state from a track's style and confidence. */
export function stylePillState(
  danceStyle: string | null | undefined,
  confidence: number | null | undefined,
): StylePillState {
  const hasStyle = typeof danceStyle === 'string' && danceStyle.length > 0;
  if (!hasStyle) return 'unknown';
  return (confidence ?? 0) >= 1 ? 'confirmed' : 'guess';
}
