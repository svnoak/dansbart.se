import { trackInteraction, AnalyticsEvents } from '../../analytics.js';
import { useFilters } from '../../hooks/filter.js';
import { getAuthHeaders } from '../../utils/voter.js';

export default {
    props: ['track', 'isPlaying'],
    emits: ['edit'],
    setup() {
        const { styleTree } = useFilters();
        return { styleTree };
    },
    data() {
        return {
            step: 'hidden',
            mode: 'correction',
            pendingSecondary: null,
            
            correction: { 
                main: '', 
                style: '',
                tempo: 'ok' 
            },
            isSubmitting: false,
            styleTree: {},
            
            // Timers
            showDelayTimer: null,
            autoDismissTimer: null,
            playbackStartTime: null,
            
            // UI
            dropdownOpen: false
        }
    },
    mounted() {
        document.addEventListener('click', this.closeDropdownHandler);
    },
    beforeUnmount() {
        this.clearTimers();
        document.removeEventListener('click', this.closeDropdownHandler);
    },
    watch: {
        'track.id': {
            immediate: true,
            handler(newId, oldId) {
                console.log('Track changed:', { newId, oldId, isPlaying: this.isPlaying });
                if (newId !== oldId) {
                    this.clearTimers();
                    this.step = 'hidden';
                    this.playbackStartTime = null;
                    this.mode = 'correction';
                    this.resetForm();
                }
            }
        },
        isPlaying: {
            immediate: true, // ← ADD THIS!
            handler(playing, oldPlaying) {
                console.log('isPlaying watcher fired:', { 
                    playing, 
                    oldPlaying,
                    track: this.track?.id,
                    step: this.step,
                    playbackStartTime: this.playbackStartTime,
                    hasFeedback: localStorage.getItem(`fb_${this.track?.id}`)
                });
                
                if (!this.track) {
                    console.log('No track, returning');
                    return;
                }
                
                // Don't process if we're already showing a step (user is interacting)
                if (this.step !== 'hidden' && this.step !== 'verify') {
                    console.log('Step not hidden/verify, returning');
                    return;
                }
                
                const hasFeedback = localStorage.getItem(`fb_${this.track.id}`);
                if (hasFeedback) {
                    console.log('Already has feedback, hiding');
                    this.step = 'hidden';
                    return;
                }

                if (playing && !this.playbackStartTime) {
                    console.log("✅ Starting nudge timer for track:", this.track.id);
                    this.playbackStartTime = Date.now();
                    this.clearTimers();
                    
                    const trackIdAtStart = this.track.id;
                    this.showDelayTimer = setTimeout(() => {
                        console.log('Timer fired! Checking conditions:', {
                            currentTrackId: this.track?.id,
                            trackIdAtStart,
                            isPlaying: this.isPlaying,
                            match: this.track?.id === trackIdAtStart
                        });
                        if (this.track?.id === trackIdAtStart && this.isPlaying) {
                            console.log('✅ Showing nudge!');
                            this.determineInitialStep();
                            this.startAutoDismiss();
                        }
                    }, 7000);
                } else if (!playing && this.step === 'hidden') {
                    console.log('Playback paused, clearing timers');
                    this.clearTimers();
                }
            }
        }
    },
    computed: {
        mainCategories() {
            return Object.keys(this.styleTree).sort();
        },
        currentSubStyles() {
            if (!this.correction.main) return [];
            return this.styleTree[this.correction.main] || [];
        },
        hasStyle() { return this.track?.dance_style && this.track.dance_style !== 'Unknown' && this.track.dance_style !== 'Unclassified'; },
        hasTempo() { return (this.track?.tempo || this.track?.tempo_category) && this.track?.effective_bpm > 0; },
        tempoLabel() {
            if (!this.track) return '';
            if (this.track.tempo?.label) return this.track.tempo.label;
            const labels = { 'Slow': 'Långsamt', 'SlowMed': 'Lugnt', 'Medium': 'Lagom', 'Fast': 'Snabbt', 'Turbo': 'Väldigt snabbt' };
            return labels[this.track.tempo_category] || '';
        },
        secondaryTempoLabel() {
            if (!this.pendingSecondary) return '';
            if (this.pendingSecondary.tempo?.label) return this.pendingSecondary.tempo.label.toLowerCase();
            return '';
        },
        unconfirmedSecondary() {
            if (!this.track?.secondary_styles) return [];
            return this.track.secondary_styles.filter(s => s.confirmations < 3);
        },
        colorClasses() {
            if (this.mode === 'addition') return { bg: 'bg-teal-600', bgDark: 'bg-teal-700', btn: 'bg-teal-800 hover:bg-teal-900', text: 'text-teal-700', textLight: 'text-teal-200' };
            return { bg: 'bg-indigo-600', bgDark: 'bg-indigo-700', btn: 'bg-indigo-800 hover:bg-indigo-900', text: 'text-indigo-700', textLight: 'text-indigo-300' };
        }
    },
    methods: {
        async loadStyles() {
            try {
                const res = await fetch('/api/styles/tree');
                if (res.ok) this.styleTree = await res.json();
            } catch (e) {
                this.styleTree = { "Polska": ["Hambo", "Slängpolska"], "Vals": [] };
            }
        },
        clearTimers() {
            if (this.showDelayTimer) clearTimeout(this.showDelayTimer);
            if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
        },
        startAutoDismiss() {
            // Auto-dismiss after 20 seconds if no interaction
            this.autoDismissTimer = setTimeout(() => {
                if (this.step === 'verify') {
                    // Track abandonment
                    trackInteraction(AnalyticsEvents.NUDGE_DISMISSED, this.track?.id, {
                        reason: 'auto_timeout'
                    });
                    this.step = 'hidden';
                }
            }, 20000);
        },
        resetForm() {
            this.correction.main = '';
            this.correction.style = this.track?.dance_style || "";
            this.correction.tempo = 'ok';
        },
        closeDropdownHandler(e) {
            if (this.dropdownOpen && !e.target.closest('.relative')) this.dropdownOpen = false;
        },
        
        // --- SELECTION LOGIC ---
        
        selectMain(mainStyle) {
            this.correction.main = mainStyle;
            this.dropdownOpen = false;
            
            const subs = this.styleTree[mainStyle];
            
            // If no substyles, the Main Style IS the Style
            if (!subs || subs.length === 0) {
                this.correction.style = mainStyle;
                this.step = (this.mode === 'addition' || this.step.startsWith('fix')) ? 'fix-tempo' : 'ask-tempo';
            } else {
                this.step = (this.mode === 'addition' || this.step.startsWith('fix')) ? 'fix-sub' : 'ask-sub';
            }
        },
        
        selectSub(subStyle) {
            this.correction.style = subStyle;
            this.dropdownOpen = false;
            this.step = (this.mode === 'addition' || this.step.startsWith('fix')) ? 'fix-tempo' : 'ask-tempo';
        },

        startCorrection() {
            this.clearTimers();
            this.mode = 'correction';
            this.step = 'fix-main';
        },
        startAddition() {
            this.clearTimers();
            this.mode = 'addition';
            this.correction.main = '';
            this.correction.style = '';
            this.step = 'fix-main';
        },
        determineInitialStep() {
            trackInteraction(AnalyticsEvents.NUDGE_SHOWN, this.track?.id, { has_style: this.hasStyle, has_tempo: this.hasTempo });
            if (!this.hasStyle && !this.hasTempo) {
                this.mode = 'correction';
                this.step = 'ask-main';
            } else if (this.hasStyle && !this.hasTempo) {
                this.step = 'verify-style-only';
            } else {
                this.step = 'verify';
            }
        },
        confirmVerify() {
            const specificStyle = this.track.sub_style || this.track.dance_style;
            this.submit({
                style: specificStyle,
                main_style: this.track.dance_style,
                tempo_correction: 'ok'
            }).then(() => {
                this.showSecondaryConfirm();
            });
        },
        confirmStyleOnly() {
            this.clearTimers();
            this.correction.style = this.track.dance_style;
            this.step = 'ask-tempo';
        },
        rejectStyleOnly() {
            this.clearTimers();
            this.mode = 'correction';
            this.correction.style = '';
            this.correction.main = '';
            this.step = 'ask-main';
        },
        submitFix() {
            this.submit({
                style: this.correction.style,
                main_style: this.correction.main || this.correction.style,
                tempo_correction: this.correction.tempo
            }, 'success');
        },
        submitTempoSelection(tempoCategory) {
            const categoryMap = { 'Slow': 'Långsamt', 'SlowMed': 'Lugnt', 'Medium': 'Lagom', 'Fast': 'Snabbt', 'Turbo': 'Väldigt snabbt' };
            this.submit({ 
                style: this.correction.style, 
                main_style: this.correction.main || this.correction.style,
                tempo_correction: 'ok', 
                tempo_category: categoryMap[tempoCategory] || 'Lagom'
            }, 'success');
        },
        
        async submit(payload, nextState = null) {
            this.clearTimers();
            this.isSubmitting = true;
            try {
                const res = await fetch(`/api/tracks/${this.track.id}/feedback`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.updates) Object.assign(this.track, data.updates);
                localStorage.setItem(`fb_${this.track.id}`, 'true');
                if (nextState === 'bonus') this.step = 'bonus';
                else if (nextState === 'success') { this.step = 'success'; setTimeout(() => { this.step = 'hidden'; }, 2500); }
            } catch(e) { this.step = 'hidden'; } 
            finally { this.isSubmitting = false; }
        },
        
        toggleDropdown() { this.dropdownOpen = !this.dropdownOpen; },
        
        // Secondary logic
        showSecondaryConfirm() {
            if (this.unconfirmedSecondary.length > 0) {
                this.pendingSecondary = this.unconfirmedSecondary[0];
                this.step = 'confirm-secondary';
            } else { this.step = 'bonus'; }
        },
        async confirmSecondary() {
            if (!this.pendingSecondary) return;
            this.clearTimers();
            this.isSubmitting = true;
            
            try {
                const res = await fetch(`/api/tracks/${this.track.id}/confirm-secondary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        style: this.pendingSecondary.style, 
                        tempo_correction: 'ok' 
                    })
                });
                
                if (res.ok) {
                    const data = await res.json();
                    // Update the local secondary style confirmation count
                    if (data.updates && this.track.secondary_styles) {
                        const sec = this.track.secondary_styles.find(s => s.style === this.pendingSecondary.style);
                        if (sec) {
                            sec.confirmations = data.updates.confirmations;
                        }
                    }
                }
                
                localStorage.setItem(`fb_${this.track.id}`, 'true');
                this.step = 'success';
                setTimeout(() => { this.step = 'hidden'; }, 2500);
                
            } catch(e) {
                console.error(e);
                this.step = 'hidden';
            } finally {
                this.isSubmitting = false;
            }
        },
        rejectSecondary() { 
            this.pendingSecondary = null;
            this.step = 'bonus';
        }
    },
    template: /*html*/`
    <transition enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-to-class="opacity-0">
        <div v-if="step !== 'hidden'" class="w-full relative z-0 mb-2 shadow-xl rounded-xl font-sans">
            
            <div v-if="step === 'verify'" class="bg-indigo-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center rounded-xl">
                <div class="text-sm md:text-xs leading-tight">
                    <p class="opacity-80">Stämmer detta?</p>
                    <p class="font-bold text-base md:text-sm">
                        {{ track.dance_style }}
                        <span v-if="track.sub_style && track.sub_style !== track.dance_style" class="font-normal opacity-90">
                            ({{ track.sub_style }})
                        </span>
                        • {{ tempoLabel }}
                    </p>
                </div>
                <div class="flex gap-3 md:gap-2">
                    <button @click="startCorrection" class="bg-indigo-800 hover:bg-indigo-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">Nej</button>
                    <button @click="confirmVerify" :disabled="isSubmitting" class="bg-white text-indigo-700 hover:bg-indigo-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1"><span>Ja</span></button>
                </div>
            </div>

            <div v-else-if="step === 'verify-style-only'" class="bg-indigo-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center rounded-xl">
                <div class="text-sm md:text-xs leading-tight">
                    <p class="opacity-80">Är detta en</p>
                    <p class="font-bold text-base md:text-sm">
                        {{ track.dance_style }}
                        <span v-if="track.sub_style && track.sub_style !== track.dance_style" class="font-normal opacity-90">
                            ({{ track.sub_style }})
                        </span>?
                    </p>
                </div>
                <div class="flex gap-3 md:gap-2">
                    <button @click="rejectStyleOnly" class="bg-indigo-800 hover:bg-indigo-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">Nej</button>
                    <button @click="confirmStyleOnly" :disabled="isSubmitting" class="bg-white text-indigo-700 hover:bg-indigo-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1"><span>Ja</span></button>
                </div>
            </div>

            <div v-else-if="step === 'ask-main'" class="bg-purple-600 p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl">
                <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold mb-3 md:mb-2">Vad kan man dansa?</p>
                <div class="relative mb-3 md:mb-2">
                    <button @click.stop="toggleDropdown" class="w-full bg-purple-700 hover:bg-purple-800 border border-purple-500 text-white text-left px-4 py-3 md:py-2 rounded text-sm md:text-xs font-medium flex justify-between items-center">
                        <span>{{ correction.main || 'Välj kategori...' }}</span>
                        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-purple-200 max-h-48 overflow-y-auto">
                        <button v-for="cat in mainCategories" :key="cat" @click="selectMain(cat)" class="w-full text-left px-4 py-2.5 md:py-2 text-sm md:text-xs text-gray-800 hover:bg-purple-100 transition-colors">
                            {{ cat }}
                        </button>
                    </div>
                </div>
                <div class="flex justify-end gap-2"><button @click="step = 'hidden'; dropdownOpen = false" class="bg-purple-800 hover:bg-purple-900 text-sm md:text-[10px] font-bold px-4 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">Vet ej</button></div>
            </div>

            <div v-else-if="step === 'ask-sub'" class="bg-purple-600 p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl">
                <div class="flex justify-between items-center mb-2">
                    <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold">Vilken typ av {{ correction.main }}?</p>
                    <button @click="step = 'ask-main'; correction.main = ''" class="text-xs md:text-[10px] text-purple-300 hover:text-white">← Ändra</button>
                </div>
                <div class="relative mb-3 md:mb-2">
                    <button @click.stop="toggleDropdown" class="w-full bg-purple-700 hover:bg-purple-800 border border-purple-500 text-white text-left px-4 py-3 md:py-2 rounded text-sm md:text-xs font-medium flex justify-between items-center">
                        <span>Välj variant...</span>
                        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-purple-200 max-h-48 overflow-y-auto">
                        <button @click="selectSub(correction.main)" class="w-full text-left px-4 py-2.5 md:py-2 text-sm md:text-xs text-purple-900 bg-purple-50 hover:bg-purple-100 font-bold border-b border-purple-100">
                            Vet ej / Allmän {{ correction.main }}
                        </button>
                        <button v-for="sub in currentSubStyles" :key="sub" @click="selectSub(sub)" class="w-full text-left px-4 py-2.5 md:py-2 text-sm md:text-xs text-gray-800 hover:bg-purple-100 transition-colors">
                            {{ sub }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-else-if="step === 'ask-tempo'" class="bg-purple-700 p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl">
               <div class="flex justify-between items-center mb-3 md:mb-2">
                    <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold">Hur snabb är {{ correction.style }}n?</p>
                    <button @click="step = currentSubStyles.length ? 'ask-sub' : 'ask-main'" class="text-xs md:text-[10px] text-purple-300 hover:text-white">← Tillbaka</button>
                </div>
                <div class="grid grid-cols-5 gap-2 md:gap-1">
                    <button @click="submitTempoSelection('Slow')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded">Långsamt</button>
                    <button @click="submitTempoSelection('SlowMed')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded">Lugnt</button>
                    <button @click="submitTempoSelection('Medium')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded">Lagom</button>
                    <button @click="submitTempoSelection('Fast')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded">Snabbt</button>
                    <button @click="submitTempoSelection('Turbo')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded">V. snabbt</button>
                </div>
            </div>

            <div v-else-if="step === 'fix-main'" :class="[colorClasses.bg, 'p-4 md:p-3 pb-5 md:pb-4 text-white relative rounded-xl']">
                <button @click="step = 'menu'" class="absolute top-2 md:top-1 right-3 md:right-2 text-sm md:text-xs" :class="colorClasses.textLight">← Tillbaka</button>
                <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold mb-3 md:mb-2">{{ mode === 'addition' ? 'Lägg till stil' : 'Korrekt dansstil' }}</p>
                <div class="relative mb-3 md:mb-2">
                    <button @click.stop="toggleDropdown" :class="[colorClasses.btn, 'w-full border border-white/20 text-white text-left px-4 py-3 md:py-2 rounded text-sm md:text-xs font-medium flex justify-between items-center']">
                        <span>{{ correction.main || 'Välj kategori...' }}</span>
                        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto">
                        <button v-for="cat in mainCategories" :key="cat" @click="selectMain(cat)" class="w-full text-left px-4 py-2.5 md:py-2 text-sm md:text-xs text-gray-800 hover:bg-gray-100 transition-colors">
                            {{ cat }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-else-if="step === 'fix-sub'" :class="[colorClasses.bg, 'p-4 md:p-3 pb-5 md:pb-4 text-white relative rounded-xl']">
                <button @click="step = 'fix-main'" class="absolute top-2 md:top-1 right-3 md:right-2 text-sm md:text-xs" :class="colorClasses.textLight">← Tillbaka</button>
                <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold mb-3 md:mb-2">Vilken typ av {{ correction.main }}?</p>
                <div class="relative mb-3 md:mb-2">
                    <button @click.stop="toggleDropdown" :class="[colorClasses.btn, 'w-full border border-white/20 text-white text-left px-4 py-3 md:py-2 rounded text-sm md:text-xs font-medium flex justify-between items-center']">
                        <span>Välj variant...</span>
                        <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <div v-if="dropdownOpen" class="absolute z-[200] w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto">
                        <button @click="selectSub(correction.main)" class="w-full text-left px-4 py-2.5 md:py-2 text-sm md:text-xs text-indigo-900 bg-indigo-50 hover:bg-indigo-100 font-bold border-b border-indigo-100">
                            Vet ej / Allmän {{ correction.main }}
                        </button>
                        <button v-for="sub in currentSubStyles" :key="sub" @click="selectSub(sub)" class="w-full text-left px-4 py-2.5 md:py-2 text-sm md:text-xs text-gray-800 hover:bg-gray-100 transition-colors">
                            {{ sub }}
                        </button>
                    </div>
                </div>
            </div>

            <div v-else-if="step === 'fix-tempo'" :class="[colorClasses.bgDark, 'p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl']">
                <div class="flex justify-between items-center mb-3 md:mb-2">
                    <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold">Är {{ correction.style || 'dansen' }} {{ tempoLabel }}?</p>
                    <button @click="step = currentSubStyles.length ? 'fix-sub' : 'fix-main'" class="text-xs md:text-[10px] hover:text-white" :class="colorClasses.textLight">← Tillbaka</button>
                </div>
                <div class="grid grid-cols-3 gap-3 md:gap-2">
                    <button @click="correction.tempo = 'half'; submitFix()" :class="[colorClasses.btn, 'border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors']">Den är <br>långsammare</button>
                    <button @click="correction.tempo = 'ok'; submitFix()" class="bg-white hover:bg-gray-50 font-bold text-sm md:text-[10px] py-3 md:py-2 rounded" :class="colorClasses.text">Ja, det är<br>rätt</button>
                    <button @click="correction.tempo = 'double'; submitFix()" :class="[colorClasses.btn, 'border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors']">Den är<br>snabbare</button>
                </div>
            </div>

            <div v-else-if="step === 'menu'" class="bg-gray-800 p-4 md:p-3 pb-5 md:pb-4 text-white rounded-xl">
                <div class="flex justify-between items-center mb-3 md:mb-2"><p class="text-sm md:text-xs font-bold text-gray-400 uppercase">Redigera</p><button @click="step = 'hidden'" class="text-gray-400 hover:text-white text-sm md:text-xs">Stäng</button></div>
                <div class="grid grid-cols-2 gap-3 md:gap-2">
                    <button @click="startCorrection" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm md:text-xs font-bold py-3 md:py-2 rounded flex flex-col items-center"><span>Rätta Huvudstil</span><span class="text-xs md:text-[9px] opacity-75 font-normal">Detta är fel</span></button>
                    <button @click="startAddition" class="bg-teal-600 hover:bg-teal-700 text-white text-sm md:text-xs font-bold py-3 md:py-2 rounded flex flex-col items-center"><span>Lägg till Alt.</span><span class="text-xs md:text-[9px] opacity-75 font-normal">Detta är också...</span></button>
                </div>
            </div>
            <div v-else-if="step === 'confirm-secondary'" class="bg-amber-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center rounded-xl">
                <div class="text-sm md:text-xs leading-tight"><p class="opacity-80">Kan man även dansa</p><p class="font-bold text-base md:text-sm">{{ secondaryTempoLabel }} {{ pendingSecondary?.style }}?</p></div>
                <div class="flex gap-3 md:gap-2"><button @click="rejectSecondary" class="bg-amber-800 hover:bg-amber-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">Nej</button><button @click="confirmSecondary" :disabled="isSubmitting" class="bg-white text-amber-700 hover:bg-amber-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1"><span>Ja!</span></button></div>
            </div>
            <div v-else-if="step === 'success'" class="bg-green-600 p-5 md:p-4 text-white flex justify-center items-center rounded-xl">
                <div class="text-base md:text-sm font-bold flex items-center gap-2"><svg class="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Tack för hjälpen!</div>
            </div>
            <div v-else-if="step === 'bonus'" class="bg-teal-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center rounded-xl">
                <div class="text-sm md:text-xs leading-tight"><p class="font-bold opacity-90">Tack! Går det att<br>dansa något annat?</p></div>
                <div class="flex gap-3 md:gap-2"><button @click="step = 'hidden'" class="bg-teal-800 hover:bg-teal-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">Nej</button><button @click="startAddition" class="bg-white text-teal-700 hover:bg-teal-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1"><span>+ Lägg till</span></button></div>
            </div>

        </div>
    </transition>
    `
}