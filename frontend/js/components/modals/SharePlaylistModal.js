/**
 * Share Playlist Modal.
 *
 * Allows playlist owners to:
 * - Toggle public/private visibility
 * - Copy share link (when public)
 * - Invite collaborators by username
 * - Manage collaborator permissions
 */
import { ref, computed, watch } from 'vue';
import { usePlaylists } from '../../hooks/usePlaylists.js';
import { useAuth } from '../../hooks/useAuth.js';

export default {
  name: 'SharePlaylistModal',

  props: {
    playlist: {
      type: Object,
      required: true,
    },
    show: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['close', 'updated'],

  setup(props, { emit }) {
    const {
      updatePlaylist,
      copyShareLink,
      inviteUserToPlaylist,
      fetchPlaylistCollaborators,
      updateCollaboratorPermission,
      removeCollaborator,
      searchUsers,
    } = usePlaylists();
    const { user: currentUser } = useAuth();

    const isPublic = ref(props.playlist.is_public);
    const collaborators = ref([]);
    const loadingCollaborators = ref(false);
    const inviteUsername = ref('');
    const invitePermission = ref('view');
    const inviting = ref(false);
    const userSearchResults = ref([]);
    const searchTimeout = ref(null);
    const linkCopied = ref(false);

    const isOwner = computed(() => {
      return props.playlist.owner?.id === currentUser.value?.id ||
             props.playlist.user_id === currentUser.value?.id;
    });

    const shareUrl = computed(() => {
      if (props.playlist.is_public) {
        return `${window.location.origin}/playlist/${props.playlist.id}`;
      }
      return null;
    });

    // Load collaborators when modal opens
    watch(() => props.show, async (newVal) => {
      if (newVal && isOwner.value) {
        loadingCollaborators.value = true;
        collaborators.value = await fetchPlaylistCollaborators(props.playlist.id);
        loadingCollaborators.value = false;
      }
    }, { immediate: true });

    // Sync isPublic with playlist prop
    watch(() => props.playlist.is_public, (newVal) => {
      isPublic.value = newVal;
    });

    // Search users as they type
    const handleUsernameInput = () => {
      if (searchTimeout.value) {
        clearTimeout(searchTimeout.value);
      }
      searchTimeout.value = setTimeout(async () => {
        if (inviteUsername.value.length >= 2) {
          userSearchResults.value = await searchUsers(inviteUsername.value);
        } else {
          userSearchResults.value = [];
        }
      }, 300);
    };

    const selectUser = (user) => {
      inviteUsername.value = user.username;
      userSearchResults.value = [];
    };

    const togglePublic = async () => {
      const newValue = !isPublic.value;
      const updated = await updatePlaylist(props.playlist.id, { is_public: newValue });
      if (updated) {
        isPublic.value = newValue;
        emit('updated', updated);
      }
    };

    const handleCopyLink = async () => {
      const success = await copyShareLink(props.playlist);
      if (success) {
        linkCopied.value = true;
        setTimeout(() => {
          linkCopied.value = false;
        }, 2000);
      }
    };

    const handleInvite = async () => {
      if (!inviteUsername.value.trim()) return;

      inviting.value = true;
      const result = await inviteUserToPlaylist(
        props.playlist.id,
        inviteUsername.value.trim(),
        invitePermission.value
      );

      if (result) {
        inviteUsername.value = '';
        invitePermission.value = 'view';
        // Refresh collaborators list
        collaborators.value = await fetchPlaylistCollaborators(props.playlist.id);
      }
      inviting.value = false;
    };

    const handlePermissionChange = async (collab, newPermission) => {
      await updateCollaboratorPermission(props.playlist.id, collab.id, newPermission);
      // Update local state
      const index = collaborators.value.findIndex(c => c.id === collab.id);
      if (index !== -1) {
        collaborators.value[index].permission = newPermission;
      }
    };

    const handleRemoveCollaborator = async (collab) => {
      if (confirm(`Ta bort @${collab.user.username} som medarbetare?`)) {
        const success = await removeCollaborator(props.playlist.id, collab.id);
        if (success) {
          collaborators.value = collaborators.value.filter(c => c.id !== collab.id);
        }
      }
    };

    const close = () => {
      emit('close');
    };

    return {
      isPublic,
      isOwner,
      shareUrl,
      collaborators,
      loadingCollaborators,
      inviteUsername,
      invitePermission,
      inviting,
      userSearchResults,
      linkCopied,
      togglePublic,
      handleCopyLink,
      handleInvite,
      handleUsernameInput,
      selectUser,
      handlePermissionChange,
      handleRemoveCollaborator,
      close,
    };
  },

  template: `
    <Teleport to="body">
      <div
        v-if="show"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click.self="close"
      >
        <div class="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b">
            <h2 class="text-xl font-bold text-gray-900">Dela spellista</h2>
            <button
              @click="close"
              class="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-4 overflow-y-auto flex-1 space-y-6">
            <!-- Public/Private Toggle (Owner only) -->
            <div v-if="isOwner" class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900">Offentlig spellista</h3>
                  <p class="text-sm text-gray-500">
                    {{ isPublic ? 'Alla med länken kan se spellistan' : 'Endast du och inbjudna kan se spellistan' }}
                  </p>
                </div>
                <button
                  @click="togglePublic"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  :class="isPublic ? 'bg-indigo-600' : 'bg-gray-300'"
                >
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    :class="isPublic ? 'translate-x-6' : 'translate-x-1'"
                  />
                </button>
              </div>

              <!-- Share Link (when public) -->
              <div v-if="isPublic && shareUrl" class="mt-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Delningslänk</label>
                <div class="flex gap-2">
                  <input
                    :value="shareUrl"
                    readonly
                    class="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600"
                  >
                  <button
                    @click="handleCopyLink"
                    class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 text-sm font-medium flex items-center gap-1"
                  >
                    <svg v-if="!linkCopied" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                    <svg v-else class="w-4 h-4 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    {{ linkCopied ? 'Kopierad!' : 'Kopiera' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Invite Collaborators (Owner only) -->
            <div v-if="isOwner">
              <h3 class="font-medium text-gray-900 mb-3">Bjud in medarbetare</h3>
              <div class="space-y-3">
                <div class="relative">
                  <input
                    v-model="inviteUsername"
                    @input="handleUsernameInput"
                    type="text"
                    placeholder="Sök efter användarnamn..."
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
                  >
                  <!-- Search Results Dropdown -->
                  <div
                    v-if="userSearchResults.length > 0"
                    class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    <button
                      v-for="user in userSearchResults"
                      :key="user.id"
                      @click="selectUser(user)"
                      class="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                    >
                      <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                        {{ user.display_name?.[0] || user.username?.[0] || '?' }}
                      </div>
                      <div>
                        <p class="font-medium text-gray-900">{{ user.display_name || user.username }}</p>
                        <p class="text-sm text-gray-500">@{{ user.username }}</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div class="flex gap-2">
                  <select
                    v-model="invitePermission"
                    class="border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="view">Kan visa</option>
                    <option value="edit">Kan redigera</option>
                  </select>
                  <button
                    @click="handleInvite"
                    :disabled="!inviteUsername.trim() || inviting"
                    class="flex-1 bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {{ inviting ? 'Bjuder in...' : 'Bjud in' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Current Collaborators -->
            <div v-if="isOwner">
              <h3 class="font-medium text-gray-900 mb-3">Medarbetare</h3>

              <div v-if="loadingCollaborators" class="text-center py-4">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto"></div>
              </div>

              <div v-else-if="collaborators.length === 0" class="text-center py-6 text-gray-500">
                <p>Inga medarbetare ännu</p>
                <p class="text-sm">Bjud in andra för att låta dem se eller redigera spellistan</p>
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="collab in collaborators"
                  :key="collab.id"
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                      {{ collab.user.display_name?.[0] || collab.user.username?.[0] || '?' }}
                    </div>
                    <div>
                      <p class="font-medium text-gray-900">{{ collab.user.display_name || collab.user.username }}</p>
                      <p class="text-sm text-gray-500">@{{ collab.user.username }}</p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- Status badge -->
                    <span
                      v-if="collab.status === 'pending'"
                      class="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded"
                    >
                      Väntar
                    </span>

                    <!-- Permission dropdown -->
                    <select
                      :value="collab.permission"
                      @change="handlePermissionChange(collab, $event.target.value)"
                      :disabled="collab.status === 'pending'"
                      class="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="view">Visa</option>
                      <option value="edit">Redigera</option>
                    </select>

                    <!-- Remove button -->
                    <button
                      @click="handleRemoveCollaborator(collab)"
                      class="text-red-500 hover:text-red-700 p-1"
                      title="Ta bort medarbetare"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Non-owner view -->
            <div v-if="!isOwner" class="text-center py-6 text-gray-500">
              <p>Du kan inte hantera delning för denna spellista</p>
              <p class="text-sm">Endast ägaren kan bjuda in medarbetare</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t">
            <button
              @click="close"
              class="w-full bg-gray-100 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-200 font-medium"
            >
              Stäng
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  `,
};
