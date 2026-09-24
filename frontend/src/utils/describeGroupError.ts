import { ApiError } from '@/api/http-client';

export function describeGroupError(
  error: unknown,
  action: 'leave' | 'remove' | 'updatePermissions' | 'invite' | 'saveName',
): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      switch (action) {
        case 'leave':
          return 'Du kan inte lämna gruppen. En grupp måste ha minst en administratör.';
        case 'remove':
          return 'Personen kan inte tas bort. En grupp måste ha minst en administratör.';
        case 'updatePermissions':
          return 'Ändringen går inte att spara. Personen har inte tackat ja ännu, eller gruppen skulle sakna administratör.';
        case 'invite':
          return 'Personen är redan inbjuden eller medlem.';
        case 'saveName':
          return 'Det finns redan en grupp som heter så.';
      }
    }

    if (error.status === 403) {
      return 'Du har inte behörighet att göra det här i gruppen.';
    }

    if (error.status === 422 && action === 'invite') {
      return 'Ingen användare heter så. Kontrollera stavningen.';
    }
  }

  return 'Det gick inte att genomföra ändringen. Försök igen.';
}
