/**
 * Admin API Composable
 * Provides authenticated fetch wrapper for admin API calls
 */

export function useAdminApi(token) {
    const fetchWithAuth = async (url, options = {}) => {
        const headers = {
            'x-admin-token': token.value,
            ...options.headers
        };

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            // Token invalid, redirect to login
            localStorage.removeItem('admin_token');
            window.location.href = '/admin/index.html';
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
