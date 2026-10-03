export class ProviderAuthError extends Error {}

export class ProviderGoneError extends Error {}

export async function fetchAudioBlob(
  url: string,
  accessToken: string,
  init?: { range?: string },
): Promise<Blob> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (init?.range) headers.Range = init.range;
  const response = await fetch(url, { headers });
  if (response.status === 401 || response.status === 403) {
    throw new ProviderAuthError(`Provider refused access: ${response.status}`);
  }
  if (response.status === 404) {
    throw new ProviderGoneError('Provider file not found: 404');
  }
  if (!response.ok) {
    throw new Error(`Provider request failed: ${response.status}`);
  }
  return response.blob();
}
