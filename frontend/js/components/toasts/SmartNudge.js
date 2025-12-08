export default {
    props: ['track', 'isPlaying'],
    emits: ['edit'], 
    data() {
        return {
            // States: 'hidden', 'verify', 'verify-style-only', 'ask-style', 'ask-tempo', 'confirm-secondary', 'menu', 'fix-style', 'fix-tempo', 'success', 'bonus'
            step: 'hidden', 
            
            // Mode determines the intent: 'correction' (Fixing primary) or 'addition' (Adding secondary)
            mode: 'correction', 
            
            // For confirming secondary styles
            pendingSecondary: null,
            
            correction: { style: '', tempo: 'ok' },
            isSubmitting: false,
            availableStyles: ["Hambo", "Polska", "Slängpolska", "Vals", "Schottis", "Snoa", "Polka", "Mazurka", "Engelska", "Gånglåt"],
            showDelayTimer: null,   // Timer to delay showing the nudge
            autoDismissTimer: null, // Timer to auto-dismiss if no interaction
            playbackStartTime: null // Track when playback actually started
        }
    },
    beforeUnmount() {
        this.clearTimers();
    },
    computed: {
        // Check if track has a known style
        hasStyle() {
            const style = this.track?.dance_style;
            return style && style !== 'Unknown' && style !== 'Unclassified';
        },
        // Check if track has tempo info
        hasTempo() {
            return this.track?.tempo_category && this.track?.effective_bpm > 0;
        },
        tempoLabel() {
            if (!this.track) return '';
            const labels = { 'Slow': 'Lugn', 'Medium': 'Lagom', 'Fast': 'Rask', 'Turbo': 'Ösigt' };
            return labels[this.track.tempo_category] || '';
        },
        // Get tempo label for pending secondary style
        secondaryTempoLabel() {
            if (!this.pendingSecondary?.tempo_category) return '';
            const labels = { 'Slow': 'lugn', 'Medium': 'lagom', 'Fast': 'rask', 'Turbo': 'ösig' };
            return labels[this.pendingSecondary.tempo_category] || '';
        },
        // Get secondary styles that need confirmation (low confirmation count)
        unconfirmedSecondary() {
            if (!this.track?.secondary_styles) return [];
            // Return styles with fewer than 3 confirmations
            return this.track.secondary_styles.filter(s => s.confirmations < 3);
        },
        // Dynamic Color Classes based on Mode
        colorClasses() {
            if (this.mode === 'addition') {
                return {
                    bg: 'bg-teal-600',
                    bgDark: 'bg-teal-700',
                    btn: 'bg-teal-800 hover:bg-teal-900',
                    text: 'text-teal-700',
                    textLight: 'text-teal-200'
                };
            }
            // Default Blue (Correction)
            return {
                bg: 'bg-indigo-600',
                bgDark: 'bg-indigo-700',
                btn: 'bg-indigo-800 hover:bg-indigo-900',
                text: 'text-indigo-700',
                textLight: 'text-indigo-300'
            };
        }
    },
    watch: {
        track: {
            immediate: true,
            handler(newTrack, oldTrack) {
                // When track changes, reset state but don't show nudge yet
                if (newTrack?.id !== oldTrack?.id) {
                    this.clearTimers();
                    this.step = 'hidden';
                    this.playbackStartTime = null;
                    this.mode = 'correction';
                    this.resetForm();
                }
            }
        },
        isPlaying: {
            immediate: true,
            handler(playing) {
                if (!this.track) return;
                
                const hasFeedback = localStorage.getItem(`fb_${this.track.id}`);
                if (hasFeedback) {
                    this.step = 'hidden';
                    return;
                }

                if (playing && !this.playbackStartTime) {
                    // Playback just started - record time and start 7-second timer
                    this.playbackStartTime = Date.now();
                    this.clearTimers();
                    
                    const trackIdAtStart = this.track.id;
                    this.showDelayTimer = setTimeout(() => {
                        // Double-check we're still on the same track and still playing
                        if (this.track?.id === trackIdAtStart && this.isPlaying) {
                            this.determineInitialStep();
                            this.startAutoDismiss();
                        }
                    }, 7000);
                } else if (!playing && this.step === 'hidden') {
                    // Playback paused before nudge appeared - clear timer
                    this.clearTimers();
                }
            }
        }
    },
    methods: {
        clearTimers() {
            if (this.showDelayTimer) {
                clearTimeout(this.showDelayTimer);
                this.showDelayTimer = null;
            }
            if (this.autoDismissTimer) {
                clearTimeout(this.autoDismissTimer);
                this.autoDismissTimer = null;
            }
        },
        startAutoDismiss() {
            // Auto-dismiss after 20 seconds if no interaction
            this.autoDismissTimer = setTimeout(() => {
                if (this.step === 'verify') {
                    this.step = 'hidden';
                }
            }, 20000);
        },
        resetForm() {
            this.correction.style = this.track?.dance_style || "";
            this.correction.tempo = 'ok';
        },
        
        // Determine what to ask based on available data
        determineInitialStep() {
            if (!this.hasStyle && !this.hasTempo) {
                // No style, no tempo -> Ask what dance style
                this.mode = 'correction';
                this.correction.style = '';
                this.step = 'ask-style';
            } else if (this.hasStyle && !this.hasTempo) {
                // Has style but no tempo -> Confirm style first
                this.step = 'verify-style-only';
            } else {
                // Has both -> Normal verify flow
                this.step = 'verify';
            }
        },
        
        // --- NAVIGATION ---
        startCorrection() {
            this.clearTimers(); // User is interacting
            this.mode = 'correction';
            this.step = 'fix-style';
        },
        startAddition() {
            this.clearTimers(); // User is interacting
            this.mode = 'addition';
            this.correction.style = ''; // Reset selection for clean add
            this.step = 'fix-style';
        },

        // --- SUBMISSION ---
        async submit(payload, nextState = null) {
            this.clearTimers(); // User is interacting
            this.isSubmitting = true;
            try {
                const res = await fetch(`/api/tracks/${this.track.id}/feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const data = await res.json(); // <--- Parse JSON

                if (res.ok && data.updates) {
                    Object.assign(this.track, data.updates);
                }
                
                localStorage.setItem(`fb_${this.track.id}`, 'true');
                
                // Only change step if nextState is provided
                if (nextState === 'bonus') {
                    this.step = 'bonus';
                } else if (nextState === 'success') {
                    this.step = 'success';
                    setTimeout(() => { this.step = 'hidden'; }, 2500);
                }
                // If nextState is null, caller handles the next step

            } catch(e) {
                console.error(e);
                this.step = 'hidden';
            } finally {
                this.isSubmitting = false;
            }
        },
        
        confirmVerify() { 
            // Full verify (style + tempo) - confirm primary, then check secondaries
            this.submit({ style: this.track.dance_style, tempo_correction: 'ok' }).then(() => {
                this.showSecondaryConfirm();
            });
        },
        
        // Confirm style only, then ask for tempo
        confirmStyleOnly() {
            this.clearTimers();
            this.correction.style = this.track.dance_style;
            this.step = 'ask-tempo';
        },
        
        // When user says style is wrong in style-only mode
        rejectStyleOnly() {
            this.clearTimers();
            this.mode = 'correction';
            this.correction.style = '';
            this.step = 'ask-style';
        },
        
        // Submit style selection and move to tempo
        submitStyleSelection() {
            if (!this.correction.style) return;
            this.clearTimers();
            this.step = 'ask-tempo';
        },
        
        // Submit tempo and complete the feedback
        submitTempoSelection(tempoCategory) {
            // Map user-friendly names to backend categories
            const categoryMap = {
                'Slow': 'Slow',
                'Medium': 'Medium', 
                'Fast': 'Fast',
                'Turbo': 'Turbo'
            };
            this.submit({ 
                style: this.correction.style, 
                tempo_correction: 'ok',  // Default, won't affect if no BPM
                tempo_category: categoryMap[tempoCategory] || 'Medium'
            }, 'success');
        },
        
        // Show secondary style confirmation prompt
        showSecondaryConfirm() {
            if (this.unconfirmedSecondary.length > 0) {
                this.pendingSecondary = this.unconfirmedSecondary[0];
                this.step = 'confirm-secondary';
            } else {
                this.step = 'bonus';
            }
        },
        
        // Confirm a secondary style
        async confirmSecondary() {
            if (!this.pendingSecondary) return;
            this.clearTimers();
            this.isSubmitting = true;
            
            try {
                // Use dedicated endpoint that doesn't affect primary election
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
        
        // Reject secondary and move to bonus/hidden
        rejectSecondary() {
            this.pendingSecondary = null;
            this.step = 'bonus';
        },
        
        submitFix() {
            // For manual fixes/additions, we just show success and close
            this.submit({ style: this.correction.style, tempo_correction: this.correction.tempo }, 'success');
        }
    },
    template: /*html*/`
    <transition 
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-4"
        mode="out-in"
    >
        <div v-if="step !== 'hidden'" :key="step" class="w-full relative z-0 mb-2 shadow-xl rounded-xl overflow-hidden font-sans">
            
            <div v-if="step === 'verify'" class="bg-indigo-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center">
                <div class="text-sm md:text-xs leading-tight">
                    <p class="opacity-80">Stämmer detta?</p>
                    <p class="font-bold text-base md:text-sm">{{ track.dance_style }} • {{ tempoLabel }}</p>
                </div>
                <div class="flex gap-3 md:gap-2">
                    <button @click="startCorrection" class="bg-indigo-800 hover:bg-indigo-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">
                        Nej
                    </button>
                    <button @click="confirmVerify" :disabled="isSubmitting" class="bg-white text-indigo-700 hover:bg-indigo-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1">
                        <span>Ja</span>
                    </button>
                </div>
            </div>

            <!-- Verify style only (no tempo known) -->
            <div v-else-if="step === 'verify-style-only'" class="bg-indigo-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center">
                <div class="text-sm md:text-xs leading-tight">
                    <p class="opacity-80">Är detta en</p>
                    <p class="font-bold text-base md:text-sm">{{ track.dance_style }}?</p>
                </div>
                <div class="flex gap-3 md:gap-2">
                    <button @click="rejectStyleOnly" class="bg-indigo-800 hover:bg-indigo-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">
                        Nej
                    </button>
                    <button @click="confirmStyleOnly" :disabled="isSubmitting" class="bg-white text-indigo-700 hover:bg-indigo-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1">
                        <span>Ja</span>
                    </button>
                </div>
            </div>

            <!-- Ask for style (no style known) -->
            <div v-else-if="step === 'ask-style'" class="bg-purple-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center gap-3 md:gap-2">
                <div class="flex-1">
                    <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold mb-2 md:mb-1">
                        Vad kan man dansa?
                    </p>
                    <select v-model="correction.style" class="w-full text-sm md:text-xs text-gray-900 rounded p-2 md:p-1">
                        <option value="" disabled>Välj dansstil...</option>
                        <option v-for="s in availableStyles" :key="s" :value="s">{{ s }}</option>
                    </select>
                </div>
                <div class="flex items-end self-end gap-2">
                    <button @click="step = 'hidden'" class="bg-purple-800 hover:bg-purple-900 text-sm md:text-[10px] font-bold px-4 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">
                        Vet ej
                    </button>
                    <button @click="submitStyleSelection" :disabled="!correction.style" class="bg-white hover:bg-gray-50 text-purple-700 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors disabled:opacity-50">
                        Nästa →
                    </button>
                </div>
            </div>

            <!-- Ask for tempo -->
            <div v-else-if="step === 'ask-tempo'" class="bg-purple-700 p-4 md:p-3 pb-5 md:pb-4 text-white">
                <div class="flex justify-between items-center mb-3 md:mb-2">
                    <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold">
                        Hur snabb är {{ correction.style }}n?
                    </p>
                    <button @click="step = hasStyle ? 'verify-style-only' : 'ask-style'" class="text-xs md:text-[10px] text-purple-300 hover:text-white">← Tillbaka</button>
                </div>
                <div class="grid grid-cols-4 gap-2 md:gap-1">
                    <button @click="submitTempoSelection('Slow')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors">
                        Lugn
                    </button>
                    <button @click="submitTempoSelection('Medium')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors">
                        Lagom
                    </button>
                    <button @click="submitTempoSelection('Fast')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors">
                        Rask
                    </button>
                    <button @click="submitTempoSelection('Turbo')" class="bg-purple-800 hover:bg-purple-900 border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors">
                        Ösig
                    </button>
                </div>
            </div>

            <div v-else-if="step === 'confirm-secondary'" class="bg-amber-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center">
                <div class="text-sm md:text-xs leading-tight">
                    <p class="opacity-80">Kan man även dansa</p>
                    <p class="font-bold text-base md:text-sm">{{ secondaryTempoLabel }} {{ pendingSecondary?.style }}?</p>
                </div>
                <div class="flex gap-3 md:gap-2">
                    <button @click="rejectSecondary" class="bg-amber-800 hover:bg-amber-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">
                        Nej
                    </button>
                    <button @click="confirmSecondary" :disabled="isSubmitting" class="bg-white text-amber-700 hover:bg-amber-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1">
                        <span>Ja!</span>
                    </button>
                </div>
            </div>

            <div v-else-if="step === 'menu'" class="bg-gray-800 p-4 md:p-3 pb-5 md:pb-4 text-white">
                <div class="flex justify-between items-center mb-3 md:mb-2">
                    <p class="text-sm md:text-xs font-bold text-gray-400 uppercase">Redigera</p>
                    <button @click="step = 'hidden'" class="text-gray-400 hover:text-white text-sm md:text-xs">Stäng</button>
                </div>
                <div class="grid grid-cols-2 gap-3 md:gap-2">
                    <button @click="startCorrection" class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm md:text-xs font-bold py-3 md:py-2 rounded flex flex-col items-center">
                        <span>Rätta Huvudstil</span>
                        <span class="text-xs md:text-[9px] opacity-75 font-normal">Detta är fel</span>
                    </button>
                    <button @click="startAddition" class="bg-teal-600 hover:bg-teal-700 text-white text-sm md:text-xs font-bold py-3 md:py-2 rounded flex flex-col items-center">
                        <span>Lägg till Alt.</span>
                        <span class="text-xs md:text-[9px] opacity-75 font-normal">Detta är också...</span>
                    </button>
                </div>
            </div>

            <div v-else-if="step === 'fix-style'" :class="[colorClasses.bg, 'p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center gap-3 md:gap-2']">
                <div class="flex-1">
                    <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold mb-2 md:mb-1">
                        {{ mode === 'addition' ? 'Lägg till stil:' : 'Korrekt dansstil:' }}
                    </p>
                    <select v-model="correction.style" class="w-full text-sm md:text-xs text-gray-900 rounded p-2 md:p-1 text-black">
                        <option value="" disabled>Välj...</option>
                        <option v-for="s in availableStyles" :key="s" :value="s">{{ s }}</option>
                    </select>
                </div>
                <div class="flex items-end self-end">
                    <button @click="step = 'fix-tempo'" class="bg-white hover:bg-gray-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors" :class="colorClasses.text">
                        Nästa →
                    </button>
                </div>
                <button @click="step = 'menu'" class="absolute top-2 md:top-1 right-3 md:right-2 text-sm md:text-xs" :class="colorClasses.textLight">Tillbaka</button>
            </div>

            <div v-else-if="step === 'fix-tempo'" :class="[colorClasses.bgDark, 'p-4 md:p-3 pb-5 md:pb-4 text-white']">
                <div class="flex justify-between items-center mb-3 md:mb-2">
                    <p class="text-xs md:text-[10px] opacity-80 uppercase font-bold">
                        Är {{ correction.style || 'dansen' }} {{ tempoLabel }}?
                    </p>
                    <button @click="step = 'fix-style'" class="text-xs md:text-[10px] hover:text-white" :class="colorClasses.textLight">← Tillbaka</button>
                </div>
                <div class="grid grid-cols-3 gap-3 md:gap-2">
                    <button @click="correction.tempo = 'half'; submitFix()" :class="[colorClasses.btn, 'border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors']">Den är <br>långsammare</button>
                    <button @click="correction.tempo = 'ok'; submitFix()" class="bg-white hover:bg-gray-50 font-bold text-sm md:text-[10px] py-3 md:py-2 rounded" :class="colorClasses.text">Ja, det är<br>rätt</button>
                    <button @click="correction.tempo = 'double'; submitFix()" :class="[colorClasses.btn, 'border border-white/20 text-sm md:text-[10px] py-3 md:py-2 rounded leading-tight transition-colors']">Den är<br>snabbare</button>
                </div>
            </div>

            <div v-else-if="step === 'success'" class="bg-green-600 p-5 md:p-4 text-white flex justify-center items-center rounded-xl">
                <div class="text-base md:text-sm font-bold flex items-center gap-2">
                    <svg class="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Tack för hjälpen!
                </div>
            </div>

            <div v-else-if="step === 'bonus'" class="bg-teal-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center rounded-xl">
                <div class="text-sm md:text-xs leading-tight">
                    <p class="font-bold opacity-90">Tack! Går det att<br>dansa något annat?</p>
                </div>
                <div class="flex gap-3 md:gap-2">
                    <button @click="step = 'hidden'" class="bg-teal-800 hover:bg-teal-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors">
                        Nej
                    </button>
                    <button @click="startAddition" class="bg-white text-teal-700 hover:bg-teal-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1">
                        <span>+ Lägg till</span>
                    </button>
                </div>
            </div>

        </div>
    </transition>
    `
}