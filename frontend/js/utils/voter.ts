const VOTER_KEY = 'dansbart_voter_id_v1';

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
    if (!window._tempVoterId) {
      window._tempVoterId = crypto.randomUUID();
    }
    return window._tempVoterId;
  }

  let id = localStorage.getItem(VOTER_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VOTER_KEY, id);
  }

  return id;
}

export function getAuthHeaders(): { 'Content-Type': string; 'X-Voter-ID': string } {
  return {
    'Content-Type': 'application/json',
    'X-Voter-ID': getVoterId(),
  };
}
