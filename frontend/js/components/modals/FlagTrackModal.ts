import FlagIcon from '../../icons/FlagIcon';
import { trackInteraction, AnalyticsEvents } from '../../analytics';
import { useFilters } from '../../hooks/filter';
import { getAuthHeaders } from '../../utils/voter';
import { showError } from '../../hooks/useToast';

export default {
  props: ['track', 'isOpen', 'excludeCorrection'],
  emits: ['close', 'refresh'],
  components: { FlagIcon },
  setup() {
    const { styleTree } = useFilters();
    return { styleTree };
  },
  data() {
    return {
      view: 'menu',
      isSubmitting: false,
      error: null,
      successMessage: '',

      // Correction State
      correction: {
        main: '',
        style: '', // Final string sent to API
        tempo: 'ok',
      },

      // Data
      styleTree: {},
      dropdownOpen: false,
    };
  },
  computed: {
    mainCategories() {
      return Object.keys(this.styleTree).sort();
    },
    currentSubStyles() {
      if (!this.correction.main) return [];
      return this.styleTree[this.correction.main] || [];
    },

    // Helpers
    youtubeLink() {
      if (!this.track || !this.track.playbackLinks) return null;
      return this.track.playbackLinks.find(l => {
        if (l.platform === 'youtube') return true;
        const url = l.deepLink || (typeof l === 'string' ? l : '');
        return url.includes('youtube') || url.includes('youtu.be');
      });
    },
    hasStyle() {
      return (
        this.track?.danceStyle &&
        this.track.danceStyle !== 'Unknown' &&
        this.track.danceStyle !== 'Unclassified'
      );
    },
    hasTempo(): boolean {
      const t = this.track as {
        tempo?: { label?: string };
        tempoCategory?: string;
        tempo_category?: string;
        effectiveBpm?: number;
        effective_bpm?: number;
      } | undefined;
      return Boolean((t?.tempo ?? t?.tempoCategory ?? t?.tempo_category) && ((t?.effectiveBpm ?? t?.effective_bpm) ?? 0) > 0);
    },
    tempoLabel(): string {
      if (!this.track) return '';
      if (this.track.tempo?.label) return this.track.tempo.label;
      const labels: Record<string, string> = {
        Slow: 'Långsamt',
        SlowMed: 'Lugnt',
        Medium: 'Lagom',
        Fast: 'Snabbt',
        Turbo: 'Väldigt snabbt',
      };
      const t = this.track as { tempoCategory?: string; tempo_category?: string };
      const category = t.tempoCategory ?? t.tempo_category;
      return (category && labels[category]) ?? '';
    },
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        this.view = 'menu';
        this.error = null;
        this.isSubmitting = false;
        this.resetCorrection();
        trackInteraction(AnalyticsEvents.MODAL_FLAG_TRACK_OPENED, this.track?.id);
      }
    },
  },
  methods: {
    async loadStyles() {
      try {
        const res = await fetch('/api/styles/tree');
        if (res.ok) this.styleTree = await res.json();
      } catch {
        showError();
      }
    },
    resetCorrection() {
      this.correction.main = this.track?.danceStyle || '';
      this.correction.style = this.track?.subStyle || this.track?.danceStyle || '';
      this.correction.tempo = 'ok';
    },
    toggleDropdown() {
      this.dropdownOpen = !this.dropdownOpen;
    },

    // --- NEW SELECTION LOGIC ---

    // Generic Select Main (Used by both ASK and FIX flows)
    selectMain(cat, flowType) {
      // flowType is 'ask' or 'fix'
      this.correction.main = cat;
      this.dropdownOpen = false;

      const subs = this.styleTree[cat];

      if (!subs || subs.length === 0) {
        // No substyles -> Go straight to tempo
        this.correction.style = cat;
        this.view = flowType === 'fix' ? 'fix_tempo' : 'ask_tempo';
      } else {
        // Has substyles -> Go to sub step
        this.view = flowType === 'fix' ? 'fix_sub' : 'ask_sub';
      }
    },

    // Generic Select Sub
    selectSub(sub, flowType) {
      this.correction.style = sub;
      this.dropdownOpen = false;
      this.view = flowType === 'fix' ? 'fix_tempo' : 'ask_tempo';
    },

    // --- SUBMISSION ---
    async submitNotFolk() {
      this.isSubmitting = true;
      try {
        const response = await fetch(`/api/tracks/${this.track.id}/flag`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error('Kunde inte rapportera');
        trackInteraction(AnalyticsEvents.MODAL_FLAG_TRACK_SUBMITTED, this.track.id, {
          reason: 'not_folk_music',
        });
        this.finish('Rapporterad som ej folkmusik');
      } catch (e) {
        this.error = e.message;
        this.isSubmitting = false;
      }
    },
    async submitBrokenLink(reason) {
      const link = this.youtubeLink;
      if (!link) {
        this.error = 'Ingen länk';
        return;
      }
      this.isSubmitting = true;
      try {
        await fetch(`/api/links/${link.id}/report?reason=${reason}`, {
          method: 'PATCH',
        });
        trackInteraction(
          reason === 'wrong_track'
            ? AnalyticsEvents.LINK_REPORTED_WRONG_TRACK
            : AnalyticsEvents.LINK_REPORTED_BROKEN,
          this.track.id,
          { link_id: link.id }
        );
        this.finish(reason === 'wrong_track' ? 'Rapporterad: Fel låt' : 'Rapporterad: Trasig länk');
      } catch {
        this.error = 'Kunde inte skicka';
        this.isSubmitting = false;
      }
    },

    // Submit Style + Tempo (Used by Fix Flow)
    async submitStyleTempo() {
      if (!this.correction.style) {
        this.error = 'Välj stil';
        return;
      }
      this.isSubmitting = true;
      try {
        const payload = {
          style: this.correction.style,
          mainStyle: this.correction.main || this.correction.style,
          tempo_correction: this.correction.tempo,
        };

        const res = await fetch(`/api/tracks/${this.track.id}/feedback`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error('Fel');
        const data = await res.json();

        if (data.updates) Object.assign(this.track, data.updates);
        trackInteraction(AnalyticsEvents.MODAL_FLAG_TRACK_SUBMITTED, this.track.id, {
          reason: 'style_correction',
          ...payload,
        });

        this.finish('Tack för att du bidrar till att göra sidan bättre!');
      } catch (e) {
        this.error = e.message;
        this.isSubmitting = false;
      }
    },

    // Submit Tempo Category (Used by Ask Flow)
    submitTempoSelection(tempoCategory) {
      const map = {
        Slow: 'Långsamt',
        SlowMed: 'Lugnt',
        Medium: 'Lagom',
        Fast: 'Snabbt',
        Turbo: 'Väldigt snabbt',
      };
      this.correction.tempo = 'ok';
      this.tempoCategorySelection = map[tempoCategory] || 'Lagom';
      this.submitStyleTempoWithCategory();
    },
    async submitStyleTempoWithCategory() {
      if (!this.correction.style) {
        this.error = 'Välj stil';
        return;
      }
      this.isSubmitting = true;
      try {
        const payload = {
          style: this.correction.style,
          tempo_correction: 'ok',
          tempo_category: this.tempoCategorySelection,
        };
        const res = await fetch(`/api/tracks/${this.track.id}/feedback`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Fel');
        const data = await res.json();
        if (data.updates) Object.assign(this.track, data.updates);
        trackInteraction(AnalyticsEvents.MODAL_FLAG_TRACK_SUBMITTED, this.track.id, {
          reason: 'style_correction',
          ...payload,
        });
        this.finish('Tack för att du bidrar till att göra sidan bättre!');
      } catch (e) {
        this.error = e.message;
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
    },
  },
  template: /*html*/ `
    <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4 font-sans">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transition-all duration-300">
            <button @click="$emit('close')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            <h3 class="font-bold text-lg mb-5 flex items-center gap-2 text-gray-800 border-b border-gray-100 pb-3 pr-8">
                <span v-if="view === 'success'" class="text-green-500"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
                <span v-else class="text-amber-600"><flag-icon class="w-5 h-5" /></span>
                <span>{{ view === 'success' ? 'Tack!' : 'Rapportera problem' }}</span>
            </h3>
            <div v-if="error" class="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4 flex items-start gap-2 border border-red-100">{{ error }}</div>

            <div v-if="view === 'menu'" class="flex flex-col gap-3">
                <p class="text-sm text-gray-600 mb-1">Vad är fel med den här låten?</p>
                <button v-if="!excludeCorrection" @click="view = hasStyle && hasTempo ? 'verify_style_tempo' : (hasStyle ? 'verify_style_only' : 'ask_main')" class="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group">
                    <div class="bg-gray-100 group-hover:bg-white text-gray-500 group-hover:text-indigo-600 p-2.5 rounded-full">
                        <svg
                            class="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                                />
                        </svg>
                    </div>
                    <div>
                    <div class="font-bold text-gray-800 text-sm">Dansstil / Tempo</div>
                    <div class="text-xs text-gray-500">Korrigera eller bekräfta</div>
                </div>
                </button>
                <button @click="view = 'confirm_folk'" class="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left group">
                    <div class="bg-gray-100 group-hover:bg-white text-gray-500 group-hover:text-amber-600 p-2.5 rounded-full">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke-dasharray="2 2" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 text-sm">Inte folkmusik</div>
                        <div class="text-xs text-gray-500">Felaktig genre</div>
                    </div>
                </button>
                <button @click="view = 'options_link'" :disabled="!youtubeLink" class="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all text-left group disabled:opacity-50">
                    <div class="bg-gray-100 group-hover:bg-white text-gray-500 group-hover:text-red-600 p-2.5 rounded-full">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <div class="font-bold text-gray-800 text-sm">Länk / Uppspelning</div>
                        <div class="text-xs text-gray-500">Trasig länk eller fel låt</div>
                    </div>
                </button>
            </div>

            <div v-else-if="view === 'confirm_folk'" class="animate-fade-in-up"><p class="text-sm text-gray-700 mb-4">Är du säker på att du vill rapportera <strong>{{ track.title }}</strong> som <strong>ej folkmusik</strong>?</p><div class="flex justify-end gap-2"><button @click="view = 'menu'" class="px-3 py-2 text-sm text-gray-500">Tillbaka</button><button @click="submitNotFolk" :disabled="isSubmitting" class="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded">Rapportera</button></div></div>
            <div v-else-if="view === 'options_link'" class="animate-fade-in-up"><p class="text-sm text-gray-700 mb-4">Vad är fel med YouTube-länken?</p><div class="grid grid-cols-2 gap-3 mb-6"><button @click="submitBrokenLink('wrong_track')" :disabled="isSubmitting" class="p-4 border rounded bg-orange-50 text-orange-800">Fel låt</button><button @click="submitBrokenLink('broken')" :disabled="isSubmitting" class="p-4 border rounded bg-red-50 text-red-800">Trasig</button></div><div class="text-center"><button @click="view = 'menu'" class="text-xs text-gray-400 underline">Tillbaka</button></div></div>
            <div v-else-if="view === 'success'" class="text-center py-6 animate-scale-in"><h4 class="font-bold text-gray-900 text-lg">Tack!</h4><p class="text-sm text-gray-600 mt-1">{{ successMessage }}</p></div>
            
            <div v-else-if="view === 'verify_style_tempo'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-4">Stämmer detta?</p>
                <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                    <div class="font-bold text-indigo-900 text-lg">
                        {{ track.danceStyle }}
                        <span v-if="track.subStyle && track.subStyle !== track.danceStyle" class="font-normal text-indigo-700">
                            ({{ track.subStyle }})
                        </span>
                    </div>
                    <div class="text-indigo-700 text-sm">{{ tempoLabel }}</div>
                </div>
                <div class="flex justify-end gap-2">
                    <button @click="view = 'menu'" class="px-3 py-2 text-sm text-gray-500">Tillbaka</button>
                    <button @click="view = 'fix_main'" class="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded">Nej, rätta</button>
                    <button @click="submitStyleTempo" :disabled="isSubmitting" class="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded">Ja, stämmer</button>
                </div>
            </div>
            <div v-else-if="view === 'verify_style_only'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-4">Är detta en</p>
                <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                    <div class="font-bold text-indigo-900 text-lg">
                        {{ track.danceStyle }}
                        <span v-if="track.subStyle && track.subStyle !== track.danceStyle" class="font-normal text-indigo-700">
                            ({{ track.subStyle }})
                        </span>?
                    </div>
                </div>
                <div class="flex justify-end gap-2">
                    <button @click="view = 'menu'" class="px-3 py-2 text-sm text-gray-500">Tillbaka</button>
                    <button @click="correction.style = ''; view = 'ask_main'" class="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded">Nej</button>
                    
                    <button 
                        @click="correction.style = track.subStyle || track.danceStyle; view = 'ask_tempo'"
                        class="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded"
                    >
                        Ja
                    </button>
                </div>
            </div>

            <div v-else-if="view === 'ask_main'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-1 font-bold">Vad kan man dansa?</p>
                <p class="text-xs text-gray-500 mb-4">Välj huvudkategori</p>
                <div class="relative mb-6">
                    <button @click.stop="toggleDropdown" class="w-full bg-white border border-gray-300 text-gray-700 text-left px-4 py-3 rounded-lg text-sm font-medium flex justify-between items-center hover:border-indigo-400">
                        <span>{{ correction.main || 'Välj kategori...' }}</span>
                        <svg class="w-5 h-5 text-gray-400 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
                        <button v-for="cat in mainCategories" :key="cat" @click="selectMain(cat, 'ask')" class="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors text-gray-700">
                            {{ cat }}
                        </button>
                    </div>
                </div>
                <div class="flex justify-end gap-2"><button @click="view = 'menu'; dropdownOpen = false" class="px-3 py-2 text-sm text-gray-500">Tillbaka</button></div>
            </div>

            <div v-else-if="view === 'ask_sub'" class="animate-fade-in-up">
                <div class="flex justify-between items-center mb-1">
                    <p class="text-sm text-gray-700 font-bold">Vilken typ av {{ correction.main }}?</p>
                    <button @click="view = 'ask_main'; correction.main = ''" class="text-xs text-indigo-500 hover:text-indigo-700">← Ändra</button>
                </div>
                <div class="relative mb-6">
                    <button @click.stop="toggleDropdown" class="w-full bg-white border border-gray-300 text-gray-700 text-left px-4 py-3 rounded-lg text-sm font-medium flex justify-between items-center hover:border-indigo-400">
                        <span>Välj variant...</span>
                        <svg class="w-5 h-5 text-gray-400 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
                        <button @click="selectSub(correction.main, 'ask')" class="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors text-indigo-700 font-bold border-b border-indigo-50">
                            Vet ej / Allmän {{ correction.main }}
                        </button>
                        <button v-for="sub in currentSubStyles" :key="sub" @click="selectSub(sub, 'ask')" class="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors text-gray-700">
                            {{ sub }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-else-if="view === 'ask_tempo'" class="animate-fade-in-up">
                <div class="flex justify-between items-center mb-4"><div><p class="text-sm text-gray-700 font-bold">Hur snabb är {{ correction.style }}n?</p><p class="text-xs text-gray-500">Välj tempokategori</p></div><button @click="view = currentSubStyles.length ? 'ask_sub' : 'ask_main'" class="text-xs text-gray-400">← Tillbaka</button></div>
                <div class="grid grid-cols-5 gap-2 mb-6"><button @click="submitTempoSelection('Slow')" :disabled="isSubmitting" class="bg-indigo-600 text-white text-xs font-bold py-4 rounded">Långsamt</button><button @click="submitTempoSelection('SlowMed')" :disabled="isSubmitting" class="bg-indigo-600 text-white text-xs font-bold py-4 rounded">Lugnt</button><button @click="submitTempoSelection('Medium')" :disabled="isSubmitting" class="bg-indigo-600 text-white text-xs font-bold py-4 rounded">Lagom</button><button @click="submitTempoSelection('Fast')" :disabled="isSubmitting" class="bg-indigo-600 text-white text-xs font-bold py-4 rounded">Snabbt</button><button @click="submitTempoSelection('Turbo')" :disabled="isSubmitting" class="bg-indigo-600 text-white text-xs font-bold py-4 rounded">V. snabbt</button></div>
            </div>

            <div v-else-if="view === 'fix_main'" class="animate-fade-in-up">
                <p class="text-sm text-gray-700 mb-1 font-bold">Korrekt dansstil</p>
                <p class="text-xs text-gray-500 mb-4">Välj huvudkategori</p>
                <div class="relative mb-6">
                    <button @click.stop="toggleDropdown" class="w-full bg-white border border-gray-300 text-gray-700 text-left px-4 py-3 rounded-lg text-sm font-medium flex justify-between items-center hover:border-indigo-400">
                        <span>{{ correction.main || 'Välj kategori...' }}</span>
                        <svg class="w-5 h-5 text-gray-400 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
                        <button v-for="cat in mainCategories" :key="cat" @click="selectMain(cat, 'fix')" class="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors text-gray-700">
                            {{ cat }}
                        </button>
                    </div>
                </div>
                <div class="flex justify-end gap-2"><button @click="view = 'menu'; dropdownOpen = false" class="px-3 py-2 text-sm text-gray-500">Tillbaka</button></div>
            </div>

            <div v-else-if="view === 'fix_sub'" class="animate-fade-in-up">
                <div class="flex justify-between items-center mb-1">
                    <p class="text-sm text-gray-700 font-bold">Vilken typ av {{ correction.main }}?</p>
                    <button @click="view = 'fix_main'; correction.main = ''" class="text-xs text-indigo-500 hover:text-indigo-700">← Ändra</button>
                </div>
                <div class="relative mb-6">
                    <button @click.stop="toggleDropdown" class="w-full bg-white border border-gray-300 text-gray-700 text-left px-4 py-3 rounded-lg text-sm font-medium flex justify-between items-center hover:border-indigo-400">
                        <span>Välj variant...</span>
                        <svg class="w-5 h-5 text-gray-400 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
                        <button @click="selectSub(correction.main, 'fix')" class="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors text-indigo-700 font-bold border-b border-indigo-50">
                            Vet ej / Allmän {{ correction.main }}
                        </button>
                        <button v-for="sub in currentSubStyles" :key="sub" @click="selectSub(sub, 'fix')" class="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors text-gray-700">
                            {{ sub }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-else-if="view === 'fix_tempo'" class="animate-fade-in-up">
                <div class="flex justify-between items-center mb-4">
                    <div><p class="text-sm text-gray-700 font-bold">Är {{ correction.style || 'dansen' }} {{ tempoLabel }}?</p><p class="text-xs text-gray-500">Bekräfta eller korrigera tempot</p></div>
                    <button @click="view = currentSubStyles.length ? 'fix_sub' : 'fix_main'" class="text-xs text-gray-400 hover:text-gray-600">← Tillbaka</button>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-6">
                    <button @click="correction.tempo = 'half'; submitStyleTempo()" :disabled="isSubmitting" class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold py-5 rounded-lg leading-tight">Den är<br>långsammare</button>
                    <button @click="correction.tempo = 'ok'; submitStyleTempo()" :disabled="isSubmitting" class="bg-white hover:bg-gray-50 border-2 border-indigo-600 text-indigo-700 text-sm font-bold py-5 rounded-lg">Ja, det är<br>rätt</button>
                    <button @click="correction.tempo = 'double'; submitStyleTempo()" :disabled="isSubmitting" class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold py-5 rounded-lg leading-tight">Den är<br>snabbare</button>
                </div>
            </div>

        </div>
    </div>
    `,
};
