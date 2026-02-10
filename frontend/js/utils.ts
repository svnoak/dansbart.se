export function formatDuration(ms: number | undefined | null): string {
  if (!ms) return '';
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  const sec = Number(seconds);
  return minutes + ':' + (sec < 10 ? '0' : '') + sec;
}
