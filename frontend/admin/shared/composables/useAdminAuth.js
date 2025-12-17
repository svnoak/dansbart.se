/**
 * Admin Authentication Composable
 * Manages admin token in localStorage and provides auth utilities
 */

const adminToken = { value: localStorage.getItem('admin_token') || '' };

export function useAdminAuth() {
  const setToken = token => {
    adminToken.value = token;
    localStorage.setItem('admin_token', token);
  };

  const clearToken = () => {
    adminToken.value = '';
    localStorage.removeItem('admin_token');
    window.location.href = '/admin/index.html';
  };

  return {
    adminToken,
    setToken,
    clearToken,
  };
}
