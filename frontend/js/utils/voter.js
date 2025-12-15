const VOTER_KEY = 'dansbart_voter_id_v1';

function isStorageAvailable() {
    try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
    } catch {
        return false;
    }
}

export function getVoterId() {
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

export function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-Voter-ID': getVoterId()
    };
}