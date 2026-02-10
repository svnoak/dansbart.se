import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

export default {
  template:
    '<div class="flex items-center justify-center min-h-screen"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>',
  setup() {
    const router = useRouter();

    onMounted(async () => {
      const token = sessionStorage.getItem('pendingShareToken');
      sessionStorage.removeItem('pendingShareToken');

      const { useAuthConfig } = await import('../hooks/useAuthConfig');
      const { waitForAuthConfig, authEnabled } = useAuthConfig();
      await waitForAuthConfig();
      const fallbackRoute = authEnabled.value ? { name: 'playlists' } : { name: 'discovery' };

      if (!token) {
        await router.push(fallbackRoute);
        return;
      }

      try {
        const response = await fetch(`/api/playlists/share/${token}`);
        if (response.ok) {
          const playlist = (await response.json()) as { id: string };
          await router.replace({ name: 'playlist', params: { id: playlist.id } });
        } else {
          await router.push(fallbackRoute);
        }
      } catch (error) {
        console.error('Failed to resolve share token:', error);
        await router.push(fallbackRoute);
      }
    });

    return {};
  },
};
