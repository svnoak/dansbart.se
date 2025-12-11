export default {
    props: ['track', 'isOpen'],
    emits: ['close', 'refresh'],
    data() {
        return {
            isSubmitting: false,
            error: null
        }
    },
    methods: {
        async submit() {
            this.isSubmitting = true;
            this.error = null;

            try {
                const response = await fetch(`/api/tracks/${this.track.id}/flag`, {
                    method: 'POST'
                });

                if (!response.ok) {
                    const data = await response.json();
                    this.error = data.detail || "Failed to flag track";
                } else {
                    this.$emit('refresh');
                    this.$emit('close');
                }
            } catch (e) {
                console.error('Error flagging track:', e);
                this.error = "Network error";
            } finally {
                this.isSubmitting = false;
            }
        }
    },
    template: /*html*/`
    <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>

        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <h3 class="font-bold text-lg mb-2 flex items-center gap-2">
                <span class="text-amber-600">⚠️</span>
                Rapportera låt
            </h3>
            <p class="text-sm text-gray-600 mb-4">
                Är du säker på att du vill rapportera <strong>{{ track.title }}</strong> som <strong>ej folkmusik</strong>?
            </p>
            <p class="text-xs text-gray-500 mb-4 bg-amber-50 border border-amber-200 rounded p-3">
                Låten kommer att gömmas från flödet tills en admin granskar den.
            </p>

            <p v-if="error" class="text-red-600 text-xs mb-3 flex items-center gap-1">
                ⚠️ {{ error }}
            </p>

            <div class="flex justify-end gap-2 mt-4">
                <button @click="$emit('close')"
                        :disabled="isSubmitting"
                        class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">
                    Avbryt
                </button>
                <button
                    @click="submit"
                    :disabled="isSubmitting"
                    class="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                >
                    <span v-if="isSubmitting" class="animate-spin">⏳</span>
                    <span>{{ isSubmitting ? 'Rapporterar...' : 'Rapportera' }}</span>
                </button>
            </div>
        </div>
    </div>
    `
}
