import { describe, it, expect } from 'vitest';
import { describeGroupError } from './describeGroupError';
import { ApiError } from '../api/http-client';

describe('describeGroupError', () => {
  it('returns correct message for ApiError 409 with leave action', () => {
    const error = new ApiError('Conflict', 409);
    expect(describeGroupError(error, 'leave')).toBe(
      'Du kan inte lämna gruppen. En grupp måste ha minst en administratör.',
    );
  });

  it('returns correct message for ApiError 409 with remove action', () => {
    const error = new ApiError('Conflict', 409);
    expect(describeGroupError(error, 'remove')).toBe(
      'Personen kan inte tas bort. En grupp måste ha minst en administratör.',
    );
  });

  it('returns correct message for ApiError 409 with updatePermissions action', () => {
    const error = new ApiError('Conflict', 409);
    expect(describeGroupError(error, 'updatePermissions')).toBe(
      'Ändringen går inte att spara. Personen har inte tackat ja ännu, eller gruppen skulle sakna administratör.',
    );
  });

  it('returns correct message for ApiError 409 with invite action', () => {
    const error = new ApiError('Conflict', 409);
    expect(describeGroupError(error, 'invite')).toBe(
      'Personen är redan inbjuden eller medlem.',
    );
  });

  it('returns correct message for ApiError 403 with any action', () => {
    const error = new ApiError('Forbidden', 403);
    expect(describeGroupError(error, 'leave')).toBe(
      'Du har inte behörighet att göra det här i gruppen.',
    );
    expect(describeGroupError(error, 'remove')).toBe(
      'Du har inte behörighet att göra det här i gruppen.',
    );
    expect(describeGroupError(error, 'updatePermissions')).toBe(
      'Du har inte behörighet att göra det här i gruppen.',
    );
    expect(describeGroupError(error, 'invite')).toBe(
      'Du har inte behörighet att göra det här i gruppen.',
    );
  });

  it('returns correct message for plain Error', () => {
    const error = new Error('Some error');
    expect(describeGroupError(error, 'leave')).toBe(
      'Det gick inte att genomföra ändringen. Försök igen.',
    );
  });

  it('returns correct message for ApiError 400', () => {
    const error = new ApiError('Bad Request', 400);
    expect(describeGroupError(error, 'leave')).toBe(
      'Det gick inte att genomföra ändringen. Försök igen.',
    );
  });

  it('returns correct message for ApiError 500', () => {
    const error = new ApiError('Internal Server Error', 500);
    expect(describeGroupError(error, 'leave')).toBe(
      'Det gick inte att genomföra ändringen. Försök igen.',
    );
  });

  it('returns correct message for ApiError 409 with saveName action', () => {
    const error = new ApiError('Conflict', 409);
    expect(describeGroupError(error, 'saveName' as any)).toBe(
      'Det finns redan en grupp som heter så.',
    );
  });
});
