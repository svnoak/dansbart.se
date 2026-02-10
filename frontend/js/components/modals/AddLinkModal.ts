export default {
  props: ['track', 'isOpen'],
  emits: ['close', 'refresh'],
  data() {
    return {
      url: '',
      isSubmitting: false,
      error: null,
    };
  },
  methods: {
    async submit() {
      if (!this.url) return;
      this.isSubmitting = true;
      this.error = null;

      try {
        const res = await fetch(`/api/tracks/${this.track.id}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: this.url }),
        });

        const data = await res.json();

        if (!res.ok) {
          this.error = data.detail || 'Failed to add link';
        } else {
          alert('Tack! Länken har lagts till.');
          this.$emit('refresh'); // Tell parent to reload track
          this.$emit('close');
          this.url = '';
        }
      } catch {
        this.error = 'Network error';
      } finally {
        this.isSubmitting = false;
      }
    },
  },
  template: /*html*/ `
    <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>
        
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <h3 class="font-bold text-lg mb-2">Lägg till YouTube-länk</h3>
            <p class="text-sm text-gray-500 mb-4">
                Klistra in en länk till <strong>{{ track.title }}</strong>. Vi kontrollerar längden automatiskt.
            </p>

            <input 
                v-model="url" 
                placeholder="https://youtu.be/..." 
                class="w-full border border-gray-300 rounded p-2 mb-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >

            <p v-if="error" class="text-red-600 text-xs mb-3 flex items-center gap-1">
                ⚠️ {{ error }}
            </p>

            <div class="flex justify-end gap-2 mt-2">
                <button @click="$emit('close')" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Avbryt</button>
                <button 
                    @click="submit" 
                    :disabled="isSubmitting || !url"
                    class="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                    <span v-if="isSubmitting" class="animate-spin">C</span>
                    <span>Lägg till</span>
                </button>
            </div>
        </div>
    </div>
    `,
};
