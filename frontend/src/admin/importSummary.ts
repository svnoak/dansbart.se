function count(result: unknown, key: string): number {
  const value = result && typeof result === 'object' ? (result as Record<string, unknown>)[key] : undefined;
  return typeof value === 'number' ? value : 0;
}

/** Says what an import did, from the counts the API returns. */
export function importSummary(result: unknown): string {
  const created = count(result, 'created');
  const existing = count(result, 'existing');
  const failedAlbums = count(result, 'failedAlbums');
  const parts = [`${created} ${created === 1 ? 'låt tillagd' : 'låtar tillagda'}`];
  if (existing > 0) parts.push(`${existing} fanns redan`);
  let text = parts.join(', ') + '.';
  if (failedAlbums > 0) {
    text += ` ${failedAlbums} album gick inte att hämta.`;
  }
  return text;
}
