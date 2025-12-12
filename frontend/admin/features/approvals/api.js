/**
 * Approvals API
 * API methods for artist approval management
 */

import { useAdminApi } from '../../shared/composables/useAdminApi.js';

export function useApprovalsApi(token) {
    const { fetchWithAuth } = useAdminApi(token);

    const loadPending = async (limit = 100) => {
        const res = await fetchWithAuth(`/api/admin/pending-artists?status=pending&limit=${limit}`);
        return res.json();
    };

    const approve = async (approvalId) => {
        const res = await fetchWithAuth(`/api/admin/pending-artists/${approvalId}/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        return res.json();
    };

    const reject = async (approvalId, reason) => {
        const res = await fetchWithAuth(`/api/admin/pending-artists/${approvalId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason })
        });
        return res.json();
    };

    return { loadPending, approve, reject };
}
