import { toRaw } from 'vue';
import FlagIcon from '../../icons/FlagIcon.js';
import { trackInteraction, AnalyticsEvents } from '../../analytics.js';

export default {
    props: ['track', 'isOpen'],
    emits: ['close', 'refresh'],
    components: { FlagIcon },
    data() {
        return {
            view: 'menu',
            isSubmitting: false,
            error: null,
            successMessage: '',
            // Style/tempo correction
            correction: { style: '', tempo: 'ok' },
            availableStyles: ["Hambo", "Polska", "Slängpolska", "Vals", "Schottis", "Snoa", "Polka", "Mazurka", "Engelska", "Gånglåt"],
            dropdownOpen: false
        }
    },
    watch: {
        isOpen(newVal) {
            if (newVal) {
                this.view = 'menu';
                this.error = null;
                this.isSubmitting = false;
                this.dropdownOpen = false;
                this.resetCorrection();
                // Track modal opened
                trackInteraction(AnalyticsEvents.MODAL_FLAG_TRACK_OPENED, this.track?.id);
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
        },
        hasStyle() {
            const style = this.track?.dance_style;
            return style && style !== 'Unknown' && style !== 'Unclassified';
        },
        hasTempo() {
            return (this.track?.tempo || this.track?.tempo_category) && this.track?.effective_bpm > 0;
        },
        tempoLabel() {
            if (!this.track) return '';
            if (this.track.tempo?.label) {
                return this.track.tempo.label;
            }
            const labels = { 'Slow': 'Långsamt', 'SlowMed': 'Lugnt', 'Medium': 'Lagom', 'Fast': 'Snabbt', 'Turbo': 'Väldigt snabbt' };
            return labels[this.track.tempo_category] || '';
        }
    },
    methods: {
        resetCorrection() {
            this.correction.style = this.track?.dance_style || '';
            this.correction.tempo = 'ok';
        },

        toggleDropdown() {
            this.dropdownOpen = !this.dropdownOpen;
        },

        async submitNotFolk() {
            this.isSubmitting = true;
            this.error = null;
            try {
                const response = await fetch(`/api/tracks/${this.track.id}/flag`, { method: 'POST' });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || "Kunde inte rapportera");
                }
                trackInteraction(AnalyticsEvents.MODAL_FLAG_TRACK_SUBMITTED, this.track.id, { reason: 'not_folk_music' });
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
                const eventType = reason === 'wrong_track' ? AnalyticsEvents.LINK_REPORTED_WRONG_TRACK : AnalyticsEvents.LINK_REPORTED_BROKEN;
                trackInteraction(eventType, this.track.id, { link_id: link.id });
                const msg = reason === 'wrong_track' ? 'Rapporterad: Fel låt' : 'Rapporterad: Trasig länk';
                this.finish(msg);
            } catch (e) {
                this.error = "Kunde inte skicka rapporten";
                this.isSubmitting = false;
            }
        },

        async submitStyleTempo() {
            if (!this.correction.style) {
                this.error = "Välj en dansstil först";
                return;
            }
            this.isSubmitting = true;
            this.error = null;
            try {
                const payload = {
                    style: this.correction.style,
                    tempo_correction: this.correction.tempo
                };
                const response = await fetch(`/api/tracks/${this.track.id}/feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || "Kunde inte skicka");
                }

                const data = await response.json();
                if (data.updates) {
                    Object.assign(this.track, data.updates);
                }

                trackInteraction(AnalyticsEvents.MODAL_FLAG_TRACK_SUBMITTED, this.track.id, {
                    reason: 'style_tempo_correction',
                    style: payload.style,
                    tempo_correction: payload.tempo_correction
                });

                this.finish("Tack för din feedback!");
            } catch (e) {
                this.error = e.message || "Nätverksfel";
                this.isSubmitting = false;
            }
        },

        submitTempoSelection(tempoCategory) {
            const categoryMap = {
                'Slow': 'Långsamt',
                'SlowMed': 'Lugnt',
                'Medium': 'Lagom',
                'Fast': 'Snabbt',
                'Turbo': 'Väldigt snabbt'
            };
            this.correction.tempo = 'ok';
            // Store the tempo category for submission
            this.tempoCategorySelection = categoryMap[tempoCategory] || 'Lagom';
            this.submitStyleTempoWithCategory();
        },

        async submitStyleTempoWithCategory() {
            if (!this.correction.style) {
                this.error = "Välj en dansstil först";
                return;
            }
            this.isSubmitting = true;
            this.error = null;
            try {
                const payload = {
                    style: this.correction.style,
                    tempo_correction: 'ok',
                    tempo_category: this.tempoCategorySelection
                };
                const response = await fetch(`/api/tracks/${this.track.id}/feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || "Kunde inte skicka");
                }

                const data = await response.json();
                if (data.updates) {
                    Object.assign(this.track, data.updates);
                }

                trackInteraction(AnalyticsEvents.MODAL_FLAG_TRACK_SUBMITTED, this.track.id, {
                    reason: 'style_tempo_correction',
                    style: payload.style,
                    tempo_category: payload.tempo_category
                });

                this.finish("Tack för din feedback!");
            } catch (e) {
                this.error = e.message || "Nätverksfel";
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

                <button @click="view = hasStyle && hasTempo ? 'verify_style_tempo' : (hasStyle ? 'verify_style_only' : 'ask_style')"
                    class="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group">
                    <div class="bg-gray-100 group-hover:bg-white text-gray-500 group-hover:text-indigo-600 p-2.5 rounded-full transition-colors">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 text-sm">Dansstil / Tempo</div>
                        <div class="text-xs text-gray-500">Korrigera eller bekräfta</div>
                    </div>
                    <svg class="w-4 h-4 ml-auto text-gray-300 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>

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

            <!-- Verify style + tempo (both known) -->
            <div v-else-if="view === 'verify_style_tempo'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-4">Stämmer detta?</p>
                <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                    <div class="font-bold text-indigo-900 text-lg">{{ track.dance_style }}</div>
                    <div class="text-indigo-700 text-sm">{{ tempoLabel }}</div>
                </div>

                <div class="flex justify-end gap-2">
                    <button @click="view = 'menu'" class="px-3 py-2 text-sm text-gray-500 hover:text-gray-800">Tillbaka</button>
                    <button @click="view = 'fix_style'" class="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded hover:bg-gray-300">
                        Nej, rätta
                    </button>
                    <button @click="submitStyleTempo" :disabled="isSubmitting"
                        class="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                        <svg v-if="isSubmitting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Ja, stämmer</span>
                    </button>
                </div>
            </div>

            <!-- Verify style only (no tempo known) -->
            <div v-else-if="view === 'verify_style_only'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-4">Är detta en</p>
                <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                    <div class="font-bold text-indigo-900 text-lg">{{ track.dance_style }}?</div>
                </div>

                <div class="flex justify-end gap-2">
                    <button @click="view = 'menu'" class="px-3 py-2 text-sm text-gray-500 hover:text-gray-800">Tillbaka</button>
                    <button @click="correction.style = ''; view = 'ask_style'" class="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded hover:bg-gray-300">
                        Nej
                    </button>
                    <button @click="correction.style = track.dance_style; view = 'ask_tempo'"
                        class="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700">
                        Ja
                    </button>
                </div>
            </div>

            <!-- Ask for style (no style known) -->
            <div v-else-if="view === 'ask_style'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-1 font-bold">Vad kan man dansa?</p>
                <p class="text-xs text-gray-500 mb-4">Välj den primära dansstilen för denna låt</p>

                <div class="relative mb-6">
                    <button @click.stop="toggleDropdown"
                        class="w-full bg-white border border-gray-300 text-gray-700 text-left px-4 py-3 rounded-lg text-sm font-medium flex justify-between items-center hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200">
                        <span :class="correction.style ? 'text-gray-900' : 'text-gray-400'">{{ correction.style || 'Välj dansstil...' }}</span>
                        <svg class="w-5 h-5 text-gray-400 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
                        <button v-for="s in availableStyles" :key="s"
                            @click.stop="correction.style = s; dropdownOpen = false"
                            class="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors"
                            :class="correction.style === s ? 'bg-indigo-100 text-indigo-900 font-bold' : 'text-gray-700'">
                            {{ s }}
                        </button>
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <button @click="view = 'menu'; dropdownOpen = false" class="px-3 py-2 text-sm text-gray-500 hover:text-gray-800">Tillbaka</button>
                    <button @click="view = 'ask_tempo'; dropdownOpen = false" :disabled="!correction.style"
                        class="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 disabled:opacity-50">
                        Nästa →
                    </button>
                </div>
            </div>

            <!-- Ask for tempo -->
            <div v-else-if="view === 'ask_tempo'" class="animate-fade-in-up">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <p class="text-sm text-gray-700 font-bold">Hur snabb är {{ correction.style }}n?</p>
                        <p class="text-xs text-gray-500">Välj tempokategori</p>
                    </div>
                    <button @click="view = hasStyle ? 'verify_style_only' : 'ask_style'" class="text-xs text-gray-400 hover:text-gray-600">← Tillbaka</button>
                </div>

                <div class="grid grid-cols-5 gap-2 mb-6">
                    <button @click="submitTempoSelection('Slow')" :disabled="isSubmitting"
                        class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-4 rounded-lg leading-tight transition-colors">
                        Långsamt
                    </button>
                    <button @click="submitTempoSelection('SlowMed')" :disabled="isSubmitting"
                        class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-4 rounded-lg leading-tight transition-colors">
                        Lugnt
                    </button>
                    <button @click="submitTempoSelection('Medium')" :disabled="isSubmitting"
                        class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-4 rounded-lg leading-tight transition-colors">
                        Lagom
                    </button>
                    <button @click="submitTempoSelection('Fast')" :disabled="isSubmitting"
                        class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-4 rounded-lg leading-tight transition-colors">
                        Snabbt
                    </button>
                    <button @click="submitTempoSelection('Turbo')" :disabled="isSubmitting"
                        class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-4 rounded-lg leading-tight transition-colors">
                        V. snabbt
                    </button>
                </div>
            </div>

            <!-- Fix/correct style -->
            <div v-else-if="view === 'fix_style'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-1 font-bold">Korrekt dansstil</p>
                <p class="text-xs text-gray-500 mb-4">Välj rätt dansstil för denna låt</p>

                <div class="relative mb-6">
                    <button @click.stop="toggleDropdown"
                        class="w-full bg-white border border-gray-300 text-gray-700 text-left px-4 py-3 rounded-lg text-sm font-medium flex justify-between items-center hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200">
                        <span :class="correction.style ? 'text-gray-900' : 'text-gray-400'">{{ correction.style || 'Välj dansstil...' }}</span>
                        <svg class="w-5 h-5 text-gray-400 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
                        <button v-for="s in availableStyles" :key="s"
                            @click.stop="correction.style = s; dropdownOpen = false"
                            class="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors"
                            :class="correction.style === s ? 'bg-indigo-100 text-indigo-900 font-bold' : 'text-gray-700'">
                            {{ s }}
                        </button>
                    </div>
                </div>

                <div class="flex justify-end gap-2">
                    <button @click="view = 'menu'; dropdownOpen = false" class="px-3 py-2 text-sm text-gray-500 hover:text-gray-800">Tillbaka</button>
                    <button @click="view = 'fix_tempo'; dropdownOpen = false" :disabled="!correction.style"
                        class="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 disabled:opacity-50">
                        Nästa →
                    </button>
                </div>
            </div>

            <!-- Fix/correct tempo -->
            <div v-else-if="view === 'fix_tempo'" class="animate-fade-in-up">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <p class="text-sm text-gray-700 font-bold">Är {{ correction.style || 'dansen' }} {{ tempoLabel }}?</p>
                        <p class="text-xs text-gray-500">Bekräfta eller korrigera tempot</p>
                    </div>
                    <button @click="view = 'fix_style'" class="text-xs text-gray-400 hover:text-gray-600">← Tillbaka</button>
                </div>

                <div class="grid grid-cols-3 gap-3 mb-6">
                    <button @click="correction.tempo = 'half'; submitStyleTempo()" :disabled="isSubmitting"
                        class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold py-5 rounded-lg leading-tight transition-colors">
                        Den är<br>långsammare
                    </button>
                    <button @click="correction.tempo = 'ok'; submitStyleTempo()" :disabled="isSubmitting"
                        class="bg-white hover:bg-gray-50 border-2 border-indigo-600 text-indigo-700 text-sm font-bold py-5 rounded-lg transition-colors">
                        Ja, det är<br>rätt
                    </button>
                    <button @click="correction.tempo = 'double'; submitStyleTempo()" :disabled="isSubmitting"
                        class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold py-5 rounded-lg leading-tight transition-colors">
                        Den är<br>snabbare
                    </button>
                </div>
            </div>

        </div>
    </div>
    `
}