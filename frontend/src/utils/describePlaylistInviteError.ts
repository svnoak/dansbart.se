import { ApiError } from '@/api/http-client';

export function describePlaylistInviteError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return 'Du kan inte bjuda in dig själv.';
      case 403:
        return 'Du har inte behörighet att bjuda in till den här spellistan.';
      case 404:
        return 'Ingen användare heter så. Kontrollera stavningen.';
      case 409:
        return 'Personen är redan inbjuden.';
    }
  }

  return 'Det gick inte att skicka inbjudan. Försök igen.';
}
