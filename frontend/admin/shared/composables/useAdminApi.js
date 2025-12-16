/**
 * Admin API Composable
 * Provides authenticated fetch wrapper for admin API calls
 */

import { unref } from 'vue';

export function useAdminApi(token) {
    const fetchWithAuth = async (url, options = {}) => {
        const rawToken = unref(token);
        const tokenValue = (rawToken && typeof rawToken === 'object' && 'value' in rawToken) 
            ? rawToken.value 
            : rawToken;
            
        const headers = {
            'x-admin-token': tokenValue,
            ...options.headers
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
            if (response.status === 401) {
                localStorage.removeItem('admin_token');
                window.location.href = '/admin/index.html';
            }
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(data.detail || 'Request failed');
        }

        return response;
    };

    return { fetchWithAuth };
}
