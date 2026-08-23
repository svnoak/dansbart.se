import { httpClient } from '@/api/http-client';
import { getVoterId } from '@/utils/voter';

/**
 * Hand-written calls for the community-suggestions endpoints (POST /api/suggestions,
 * GET/POST /api/admin/suggestions/**), not Orval-generated — these are new endpoints and
 * there was no way to run the backend to export a fresh OpenAPI spec / run
 * `npm run api:update` in the environment this was written in. Once that's been run,
 * these can be replaced with generated client functions.
 */

export interface SuggestionDto {
  id: string;
  kind: 'content' | 'dance_style';
  payload: Record<string, unknown>;
  note?: string;
  voterId?: string;
  status: 'pending' | 'accepted' | 'activated' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  resolvedRefId?: string;
  activatedAt?: string;
  createdAt?: string;
}

export interface SuggestionActivationPreviewDto {
  mainStyle: string;
  subStyle?: string;
  proposedBeatsPerBar: number;
  affectedTrackCount: number;
}

export async function createSuggestion(
  kind: 'content' | 'dance_style',
  payload: Record<string, unknown>,
  note?: string,
): Promise<SuggestionDto> {
  return httpClient<SuggestionDto>('/api/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Voter-ID': getVoterId() },
    body: JSON.stringify({ kind, payload, note }),
  });
}

export async function getAdminSuggestions(
  kind?: string,
  status?: string,
  limit = 20,
  offset = 0,
): Promise<{ items: SuggestionDto[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (status) params.set('status', status);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return httpClient(`/api/admin/suggestions?${params.toString()}`);
}

export async function acceptSuggestion(id: string, reviewNote?: string): Promise<SuggestionDto> {
  return httpClient<SuggestionDto>(`/api/admin/suggestions/${id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewNote }),
  });
}

export async function rejectSuggestion(id: string, reviewNote?: string): Promise<SuggestionDto> {
  return httpClient<SuggestionDto>(`/api/admin/suggestions/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewNote }),
  });
}

export async function getActivationPreview(id: string): Promise<SuggestionActivationPreviewDto> {
  return httpClient<SuggestionActivationPreviewDto>(`/api/admin/suggestions/${id}/activation-preview`);
}

export async function activateSuggestion(id: string): Promise<SuggestionDto> {
  return httpClient<SuggestionDto>(`/api/admin/suggestions/${id}/activate`, { method: 'POST' });
}
