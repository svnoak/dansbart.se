/**
 * User playlists page.
 *
 * Shows all playlists for the current user with create/delete functionality.
 * Also displays pending invitations and playlists shared with the user.
 */
import { ref, onMounted, computed } from 'vue';
import { usePlaylists } from '../hooks/usePlaylists.js';
import { useRouter } from 'vue-router';

export default {
  name: 'PlaylistsPage',

  setup() {
    const router = useRouter();
    const {
      playlists,
      sharedPlaylists,
      pendingInvitations,
      loading,
      fetchUserPlaylists,
      fetchSharedPlaylists,
      fetchPendingInvitations,
      createPlaylist,
      deletePlaylist,
      respondToInvitation,
    } = usePlaylists();

    const showCreateModal = ref(false);
    const newPlaylistName = ref('');
    const newPlaylistDescription = ref('');
    const creating = ref(false);
    const respondingTo = ref(null);

    // Computed property to check if we have any content to show
    const hasContent = computed(() => {
      return playlists.value.length > 0 ||
             sharedPlaylists.value.length > 0 ||
             pendingInvitations.value.length > 0;
    });

    onMounted(() => {
      fetchUserPlaylists();
      fetchSharedPlaylists();
      fetchPendingInvitations();
    });

    const handleCreate = async () => {
      if (!newPlaylistName.value.trim()) return;

      creating.value = true;
      const playlist = await createPlaylist(
        newPlaylistName.value.trim(),
        newPlaylistDescription.value.trim(),
        false
      );

      if (playlist) {
        showCreateModal.value = false;
        newPlaylistName.value = '';
        newPlaylistDescription.value = '';
        router.push({ name: 'playlist', params: { id: playlist.id } });
      }
      creating.value = false;
    };

    const handleDelete = async (playlist) => {
      if (confirm(`Är du säker på att du vill ta bort "${playlist.name}"?`)) {
        await deletePlaylist(playlist.id);
      }
    };

    const formatDuration = (ms) => {
      const minutes = Math.floor(ms / 60000);
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      return `${hours}h ${remainingMins}m`;
    };

    const handleAcceptInvitation = async (invitation) => {
      respondingTo.value = invitation.id;
      await respondToInvitation(invitation.id, 'accepted');
      respondingTo.value = null;
    };

    const handleRejectInvitation = async (invitation) => {
      respondingTo.value = invitation.id;
      await respondToInvitation(invitation.id, 'rejected');
      respondingTo.value = null;
    };

    const getPermissionLabel = (permission) => {
      return permission === 'edit' ? 'Kan redigera' : 'Kan visa';
    };

    return {
      playlists,
      sharedPlaylists,
      pendingInvitations,
      loading,
      hasContent,
      showCreateModal,
      newPlaylistName,
      newPlaylistDescription,
      creating,
      respondingTo,
      handleCreate,
      handleDelete,
      handleAcceptInvitation,
      handleRejectInvitation,
      formatDuration,
      getPermissionLabel,
    };
  },

  template: `
    <div class="max-w-4xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold text-gray-900">Spellistor</h1>
        <button
          @click="showCreateModal = true"
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 font-medium flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Ny spellista
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="text-gray-600 mt-4">Laddar spellistor...</p>
      </div>

      <div v-else>
        <!-- Pending Invitations Section -->
        <div v-if="pendingInvitations.length > 0" class="mb-8">
          <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            Inbjudningar
            <span class="bg-amber-100 text-amber-800 text-sm px-2 py-0.5 rounded-full">{{ pendingInvitations.length }}</span>
          </h2>
          <div class="space-y-3">
            <div
              v-for="invitation in pendingInvitations"
              :key="invitation.id"
              class="border border-amber-200 bg-amber-50 rounded-lg p-4"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">{{ invitation.playlist?.name || 'Spellista' }}</p>
                  <p class="text-sm text-gray-600">
                    Inbjudan från <span class="font-medium">@{{ invitation.inviter?.username || 'okänd' }}</span>
                    <span class="text-gray-400 mx-1">&bull;</span>
                    {{ getPermissionLabel(invitation.permission) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    @click="handleAcceptInvitation(invitation)"
                    :disabled="respondingTo === invitation.id"
                    class="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-500 disabled:opacity-50 text-sm font-medium"
                  >
                    Acceptera
                  </button>
                  <button
                    @click="handleRejectInvitation(invitation)"
                    :disabled="respondingTo === invitation.id"
                    class="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-sm"
                  >
                    Avvisa
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- My Playlists Section -->
        <div class="mb-8">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Mina spellistor</h2>

          <!-- Empty State for My Playlists -->
          <div v-if="playlists.length === 0" class="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <p class="text-gray-500 mb-2">Du har inga egna spellistor ännu</p>
            <button
              @click="showCreateModal = true"
              class="text-indigo-600 hover:underline font-medium"
            >
              Skapa din första spellista
            </button>
          </div>

          <!-- My Playlists Grid -->
          <div v-else class="grid gap-4">
            <div
              v-for="playlist in playlists"
              :key="playlist.id"
              class="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition cursor-pointer group"
              @click="$router.push({ name: 'playlist', params: { id: playlist.id } })"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-xl font-bold text-gray-900 group-hover:text-indigo-600">
                    {{ playlist.name }}
                  </h3>
                  <p v-if="playlist.description" class="text-gray-600 mt-1">
                    {{ playlist.description }}
                  </p>
                  <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{{ playlist.track_count }} låtar</span>
                    <span>{{ formatDuration(playlist.total_duration_ms) }}</span>
                    <span v-if="playlist.is_public" class="flex items-center gap-1 text-green-600">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      Publik
                    </span>
                  </div>
                </div>
                <button
                  @click.stop="handleDelete(playlist)"
                  class="text-red-500 hover:text-red-700 p-2"
                  title="Ta bort spellista"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Shared With Me Section -->
        <div v-if="sharedPlaylists.length > 0">
          <h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Delade med mig
          </h2>
          <div class="grid gap-4">
            <div
              v-for="item in sharedPlaylists"
              :key="item.playlist?.id || item.id"
              class="border border-indigo-200 bg-indigo-50 rounded-lg p-4 hover:shadow-lg transition cursor-pointer group"
              @click="$router.push({ name: 'playlist', params: { id: item.playlist?.id || item.id } })"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-xl font-bold text-gray-900 group-hover:text-indigo-600">
                    {{ item.playlist?.name || item.name }}
                  </h3>
                  <p v-if="item.playlist?.description || item.description" class="text-gray-600 mt-1">
                    {{ item.playlist?.description || item.description }}
                  </p>
                  <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span class="flex items-center gap-1">
                      <span class="text-gray-400">av</span>
                      <span class="font-medium">@{{ item.playlist?.owner?.username || item.owner?.username }}</span>
                    </span>
                    <span>{{ item.playlist?.track_count || item.track_count || 0 }} låtar</span>
                    <span :class="item.permission === 'edit' ? 'text-green-600' : 'text-blue-600'" class="flex items-center gap-1">
                      <svg v-if="item.permission === 'edit'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                      </svg>
                      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                      {{ getPermissionLabel(item.permission) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create Modal -->
      <div
        v-if="showCreateModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click.self="showCreateModal = false"
      >
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <h2 class="text-2xl font-bold mb-4">Skapa ny spellista</h2>
          <form @submit.prevent="handleCreate" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Namn</label>
              <input
                v-model="newPlaylistName"
                type="text"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Min Polska-spellista"
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Beskrivning (valfritt)</label>
              <textarea
                v-model="newPlaylistDescription"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows="3"
                placeholder="En samling av mina favoritlåtar..."
              ></textarea>
            </div>
            <div class="flex gap-2">
              <button
                type="submit"
                :disabled="!newPlaylistName.trim() || creating"
                class="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {{ creating ? 'Skapar...' : 'Skapa' }}
              </button>
              <button
                type="button"
                @click="showCreateModal = false"
                :disabled="creating"
                class="flex-1 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
};
