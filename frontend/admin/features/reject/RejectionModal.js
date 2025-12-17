/**
 * Rejection Confirmation Modal Component
 * Modal for confirming artist rejection with details
 */

export default {
  props: {
    modalData: {
      type: Object,
      required: true,
    },
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    const handleConfirm = () => {
      emit('confirm');
    };

    const handleCancel = () => {
      emit('cancel');
    };

    return { handleConfirm, handleCancel };
  },
  template: /*html*/ `
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div class="bg-gray-800 rounded-lg border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <h3 class="text-xl font-bold mb-4">⚠️ Confirm Artist Rejection</h3>

                    <div class="mb-6">
                        <p class="text-gray-300 mb-4">
                            Are you sure you want to reject <strong>{{ modalData.artistName }}</strong>?
                        </p>

                        <div class="bg-gray-900 rounded p-4 space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span class="text-gray-400">Pending tracks to delete:</span>
                                <span class="font-medium">{{ modalData.pendingTracks }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Analyzed tracks to keep:</span>
                                <span class="font-medium text-green-400">{{ modalData.analyzedTracks }}</span>
                            </div>
                        </div>

                        <div v-if="!modalData.isIsolated" class="mt-4 p-4 bg-amber-900/30 border border-amber-600/50 rounded">
                            <div class="flex items-start gap-2">
                                <span class="text-xl">⚠️</span>
                                <div class="flex-1">
                                    <p class="font-medium text-amber-400 mb-2">
                                        Collaboration Warning
                                    </p>
                                    <p class="text-sm text-gray-300 mb-2">
                                        This artist collaborates with {{ modalData.sharedWith.length }} other artist(s):
                                    </p>
                                    <div class="flex flex-wrap gap-2">
                                        <span v-for="artist in modalData.sharedWith" :key="artist"
                                              class="px-2 py-1 bg-amber-800/50 rounded text-xs">
                                            {{ artist }}
                                        </span>
                                    </div>
                                    <p class="text-xs text-gray-400 mt-2">
                                        {{ modalData.sharedTracks }} shared track(s) and their albums will NOT be deleted.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <button @click="handleConfirm" :disabled="modalData.confirming"
                                class="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 px-4 py-2 rounded font-medium">
                            {{ modalData.confirming ? 'Rejecting...' : '🗑️ Reject Artist' }}
                        </button>
                        <button @click="handleCancel" :disabled="modalData.confirming"
                                class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 rounded font-medium">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
};
