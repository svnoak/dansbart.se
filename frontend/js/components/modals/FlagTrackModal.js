import { toRaw } from 'vue';
import FlagIcon from '../../icons/FlagIcon.js'; // Ensure extension matches your setup

export default {
    props: ['track', 'isOpen'],
    emits: ['close', 'refresh'],
    components: { FlagIcon },
    data() {
        return {
            view: 'menu',
            isSubmitting: false,
            error: null,
            successMessage: ''
        }
    },
    watch: {
        isOpen(newVal) {
            if (newVal) {
                this.view = 'menu';
                this.error = null;
                this.isSubmitting = false;
            }
        }
    },
    computed: {
        youtubeLink() {
            if (!this.track || !this.track.playback_links) return null;
            return this.track.playback_links.find(l => {
                if (l.platform === 'youtube') return true;
                const url = l.deep_link || (typeof l === 'string' ? l : '');
                return url.includes('youtube') || url.includes('youtu.be');
            });
        }
    },
    methods: {
        async submitNotFolk() {
            this.isSubmitting = true;
            this.error = null;
            try {
                const response = await fetch(`/api/tracks/${this.track.id}/flag`, { method: 'POST' });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || "Kunde inte rapportera");
                } 
                this.finish("Rapporterad som ej folkmusik");
            } catch (e) {
                this.error = e.message || "Nätverksfel";
                this.isSubmitting = false;
            }
        },

        async submitBrokenLink(reason) {
            const link = this.youtubeLink;
            if (!link || !link.id) {
                this.error = "Hittade ingen YouTube-länk att rapportera.";
                return;
            }
            this.isSubmitting = true;
            try {
                await fetch(`/api/links/${link.id}/report?reason=${reason}`, { method: 'PATCH' });
                const msg = reason === 'wrong_track' ? 'Rapporterad: Fel låt' : 'Rapporterad: Trasig länk';
                this.finish(msg);
            } catch (e) {
                this.error = "Kunde inte skicka rapporten";
                this.isSubmitting = false;
            }
        },

        finish(message) {
            this.successMessage = message;
            this.view = 'success';
            setTimeout(() => {
                this.$emit('refresh');
                this.$emit('close');
            }, 1500);
        }
    },
    template: /*html*/`
    <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4 font-sans">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 overflow-hidden transition-all duration-300">
            
            <button 
                @click="$emit('close')" 
                class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                title="Stäng"
            >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            
            <h3 class="font-bold text-lg mb-5 flex items-center gap-2 text-gray-800 border-b border-gray-100 pb-3 pr-8">
                <span v-if="view === 'success'" class="text-green-500">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                <span v-else class="text-amber-600">
                    <flag-icon class="w-5 h-5" />
                </span>
                <span>{{ view === 'success' ? 'Tack!' : 'Rapportera problem' }}</span>
            </h3>

            <div v-if="error" class="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 flex items-start gap-2 border border-red-100">
                <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{{ error }}</span>
            </div>

            <div v-if="view === 'menu'" class="flex flex-col gap-3">
                <p class="text-sm text-gray-600 mb-1">Vad är fel med den här låten?</p>
                
                <button @click="view = 'confirm_folk'" 
                    class="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left group">
                    <div class="bg-gray-100 group-hover:bg-white text-gray-500 group-hover:text-amber-600 p-2.5 rounded-full transition-colors">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke-dasharray="2 2" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 text-sm">Inte folkmusik</div>
                        <div class="text-xs text-gray-500">Felaktig genre</div>
                    </div>
                    <svg class="w-4 h-4 ml-auto text-gray-300 group-hover:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>

                <button @click="view = 'options_link'" :disabled="!youtubeLink"
                    class="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed">
                    <div class="bg-gray-100 group-hover:bg-white text-gray-500 group-hover:text-red-600 p-2.5 rounded-full transition-colors">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 text-sm">Länk / Uppspelning</div>
                        <div class="text-xs text-gray-500">Trasig länk eller fel låt</div>
                    </div>
                    <svg class="w-4 h-4 ml-auto text-gray-300 group-hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            <div v-else-if="view === 'confirm_folk'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-4">
                    Är du säker på att du vill rapportera <strong>{{ track.title }}</strong> som <strong>ej folkmusik</strong>?
                </p>
                <div class="text-xs text-gray-600 mb-6 bg-amber-50 border border-amber-200 rounded p-3 flex gap-2">
                    <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p>Låten göms från flödet tills en admin granskar den.</p>
                </div>
                
                <div class="flex justify-end gap-2">
                    <button @click="view = 'menu'" class="px-3 py-2 text-sm text-gray-500 hover:text-gray-800">Tillbaka</button>
                    <button @click="submitNotFolk" :disabled="isSubmitting"
                        class="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
                        <svg v-if="isSubmitting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Rapportera</span>
                    </button>
                </div>
            </div>

            <div v-else-if="view === 'options_link'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-4 font-medium">
                    Vad är fel med YouTube-länken?
                </p>

                <div class="grid grid-cols-2 gap-3 mb-6">
                    <button @click="submitBrokenLink('wrong_track')" :disabled="isSubmitting"
                        class="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 transition-colors group h-28">
                        <svg class="w-8 h-8 opacity-70 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="font-bold text-sm">Fel låt</span>
                    </button>

                    <button @click="submitBrokenLink('broken')" :disabled="isSubmitting"
                        class="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 transition-colors group h-28">
                        <svg class="w-8 h-8 opacity-70 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span class="font-bold text-sm">Trasig</span>
                    </button>
                </div>

                <div class="text-center">
                    <button @click="view = 'menu'" class="text-xs text-gray-400 hover:text-gray-600 underline">Avbryt / Tillbaka</button>
                </div>
            </div>

            <div v-else-if="view === 'success'" class="text-center py-6 animate-scale-in">
                <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h4 class="font-bold text-gray-900 text-lg">Tack!</h4>
                <p class="text-sm text-gray-600 mt-1">{{ successMessage }}</p>
            </div>

        </div>
    </div>
    `
}