import { ApiError } from '@/api/http-client';

export function describePlaylistInviteError(
  error: unknown,
  inviteType: 'user' | 'group' = 'user',
  listKind: 'playlist' | 'danceList' = 'playlist',
): string {
  const listName = listKind === 'danceList' ? 'danslistan' : 'spellistan';
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return 'Du kan inte bjuda in dig själv.';
      case 403:
        return `Du har inte behörighet att bjuda in till den här ${listName}.`;
      case 404:
        return `${listName.charAt(0).toUpperCase()}${listName.slice(1)} finns inte längre.`;
      case 409:
        return inviteType === 'group'
          ? 'Gruppen är redan inbjuden.'
          : 'Personen är redan inbjuden.';
      case 422:
        return inviteType === 'group'
          ? 'Ingen grupp heter så. Kontrollera stavningen.'
          : 'Ingen användare heter så. Kontrollera stavningen.';
    }
  }

  return 'Det gick inte att skicka inbjudan. Försök igen.';
}
