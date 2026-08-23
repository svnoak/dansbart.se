import { httpClient } from '@/api/http-client';
import type { TrackListDto } from '@/api/models/trackListDto';
import { getVoterId } from '@/utils/voter';

/**
 * Hand-written call to GET /api/tracks/classify-queue, not Orval-generated. This endpoint
 * is new and there was no way to run the backend to export a fresh OpenAPI spec / run
 * `npm run api:update` in the environment this was written in. Once that's been run, this
 * can be replaced with the generated client function from src/api/generated/tracks/tracks.ts.
 *
 * Returns the personalized fast-classification queue: unconfirmed tracks this voter
 * hasn't already voted on, lowest-confidence-first.
 */
export async function getClassifyQueue(limit = 20): Promise<TrackListDto[]> {
  return httpClient<TrackListDto[]>(`/api/tracks/classify-queue?limit=${limit}`, {
    headers: { 'X-Voter-ID': getVoterId() },
  });
}
