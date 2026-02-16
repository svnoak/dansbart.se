const VOTER_KEY = 'dansbart_voter_id_v1';

let tempVoterId: string | null = null;

function isStorageAvailable(): boolean {
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    return true;
  } catch {
    return false;
  }
}

export function getVoterId(): string {
  if (!isStorageAvailable()) {
    if (!tempVoterId) {
      tempVoterId = crypto.randomUUID();
    }
    return tempVoterId;
  }

  let id = localStorage.getItem(VOTER_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VOTER_KEY, id);
  }

  return id;
}
