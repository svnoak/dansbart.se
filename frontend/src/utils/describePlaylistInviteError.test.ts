import { describe, it, expect } from 'vitest';
import { describePlaylistInviteError } from './describePlaylistInviteError';
import { ApiError } from '../api/http-client';

describe('describePlaylistInviteError', () => {
  it('returns correct message for ApiError 400', () => {
    const error = new ApiError('Bad Request', 400);
    expect(describePlaylistInviteError(error)).toBe(
      'Du kan inte bjuda in dig själv.',
    );
  });

  it('returns correct message for ApiError 403', () => {
    const error = new ApiError('Forbidden', 403);
    expect(describePlaylistInviteError(error)).toBe(
      'Du har inte behörighet att bjuda in till den här spellistan.',
    );
  });

  it('returns correct message for ApiError 404', () => {
    const error = new ApiError('Not Found', 404);
    expect(describePlaylistInviteError(error)).toBe(
      'Ingen användare heter så. Kontrollera stavningen.',
    );
  });

  it('returns correct message for ApiError 409', () => {
    const error = new ApiError('Conflict', 409);
    expect(describePlaylistInviteError(error)).toBe(
      'Personen är redan inbjuden.',
    );
  });

  it('returns fallback message for ApiError 500', () => {
    const error = new ApiError('Internal Server Error', 500);
    expect(describePlaylistInviteError(error)).toBe(
      'Det gick inte att skicka inbjudan. Försök igen.',
    );
  });

  it('returns fallback message for plain Error', () => {
    const error = new Error('Some error');
    expect(describePlaylistInviteError(error)).toBe(
      'Det gick inte att skicka inbjudan. Försök igen.',
    );
  });

  it('returns fallback message for unknown error', () => {
    expect(describePlaylistInviteError('unknown')).toBe(
      'Det gick inte att skicka inbjudan. Försök igen.',
    );
  });
});
