export default {
    props: ['track'],
    emits: ['edit'], 
    data() {
        return {
            // States: 'hidden', 'verify', 'menu', 'fix-style', 'fix-tempo', 'success', 'bonus'
            step: 'hidden', 
            
            // Mode determines the intent: 'correction' (Fixing primary) or 'addition' (Adding secondary)
            mode: 'correction', 
            
            correction: { style: '', tempo: 'ok' },
            isSubmitting: false,
            availableStyles: ["Hambo", "Polska", "Slängpolska", "Vals", "Schottis", "Snoa", "Polka", "Mazurka", "Engelska"]
        }
    },
    computed: {
        tempoLabel() {
            if (!this.track) return '';
            const labels = { 'Slow': 'Lugn', 'Medium': 'Lagom', 'Fast': 'Rask', 'Turbo': 'Ösigt' };
            return labels[this.track.tempo_category] || 'Lagom';
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
            handler(newTrack) {
                if (newTrack) {
                    const hasFeedback = localStorage.getItem(`fb_${newTrack.id}`);
                    this.step = hasFeedback ? 'hidden' : 'verify';
                    this.mode = 'correction'; // Default mode
                    this.resetForm();
                }
            }
        }
    },
    methods: {
        resetForm() {
            this.correction.style = this.track.dance_style || "Polska";
            this.correction.tempo = 'ok';
        },

        // --- PUBLIC METHOD CALLED BY PARENT ---
        openManualEdit() {
            this.resetForm();
            this.step = 'menu'; // Open the new Menu
        },

        // --- NAVIGATION ---
        startCorrection() {
            this.mode = 'correction';
            this.step = 'fix-style';
        },
        startAddition() {
            this.mode = 'addition';
            this.correction.style = ''; // Reset selection for clean add
            this.step = 'fix-style';
        },

        // --- SUBMISSION ---
        async submit(payload, nextState = 'success') {
            this.isSubmitting = true;
            try {
                await fetch(`/api/tracks/${this.track.id}/feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                localStorage.setItem(`fb_${this.track.id}`, 'true');
                
                if (nextState === 'bonus') {
                    this.step = 'bonus';
                } else {
                    this.step = 'success';
                    setTimeout(() => { this.step = 'hidden'; }, 2000);
                }

            } catch(e) {
                console.error(e);
                this.step = 'hidden';
            } finally {
                this.isSubmitting = false;
            }
        },
        
        confirmVerify() { 
            this.submit({ style: this.track.dance_style, tempo_correction: 'ok' }, 'bonus');
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
            
            <div v-if="step === 'verify'" class="bg-indigo-600 p-3 pb-4 text-white flex justify-between items-center">
                <div class="text-xs leading-tight">
                    <p class="opacity-80">Stämmer detta?</p>
                    <p class="font-bold">{{ track.dance_style }} • {{ tempoLabel }}</p>
                </div>
                <div class="flex gap-2">
                    <button @click="startCorrection" class="bg-indigo-800 hover:bg-indigo-900 text-[10px] font-bold px-3 py-1.5 rounded transition-colors">
                        Nej
                    </button>
                    <button @click="confirmVerify" :disabled="isSubmitting" class="bg-white text-indigo-700 hover:bg-indigo-50 text-[10px] font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1">
                        <span>Ja</span>
                    </button>
                </div>
                <button @click="step = 'hidden'" class="absolute top-1 right-2 text-indigo-300 hover:text-white text-xs">×</button>
            </div>

            <div v-else-if="step === 'menu'" class="bg-gray-800 p-3 pb-4 text-white">
                <div class="flex justify-between items-center mb-2">
                    <p class="text-xs font-bold text-gray-400 uppercase">Redigera</p>
                    <button @click="step = 'hidden'" class="text-gray-400 hover:text-white text-xs">Stäng</button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <button @click="startCorrection" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded flex flex-col items-center">
                        <span>Rätta Huvudstil</span>
                        <span class="text-[9px] opacity-75 font-normal">Detta är fel</span>
                    </button>
                    <button @click="startAddition" class="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 rounded flex flex-col items-center">
                        <span>Lägg till Alt.</span>
                        <span class="text-[9px] opacity-75 font-normal">Detta är också...</span>
                    </button>
                </div>
            </div>

            <div v-else-if="step === 'fix-style'" :class="[colorClasses.bg, 'p-3 pb-4 text-white flex justify-between items-center gap-2']">
                <div class="flex-1">
                    <p class="text-[10px] opacity-80 uppercase font-bold mb-1">
                        {{ mode === 'addition' ? 'Lägg till stil:' : 'Korrekt dansstil:' }}
                    </p>
                    <select v-model="correction.style" class="w-full text-xs text-gray-900 rounded p-1 text-black">
                        <option value="" disabled>Välj...</option>
                        <option v-for="s in availableStyles" :key="s" :value="s">{{ s }}</option>
                    </select>
                </div>
                <div class="flex items-end self-end">
                    <button @click="step = 'fix-tempo'" class="bg-white hover:bg-gray-50 text-[10px] font-bold px-3 py-1.5 rounded transition-colors" :class="colorClasses.text">
                        Nästa →
                    </button>
                </div>
                <button @click="step = 'menu'" class="absolute top-1 right-2 text-xs" :class="colorClasses.textLight">Tillbaka</button>
            </div>

            <div v-else-if="step === 'fix-tempo'" :class="[colorClasses.bgDark, 'p-3 pb-4 text-white']">
                <div class="flex justify-between items-center mb-2">
                    <p class="text-[10px] opacity-80 uppercase font-bold">
                        Är {{ correction.style || 'dansen' }} {{ tempoLabel }}?
                    </p>
                    <button @click="step = 'fix-style'" class="text-[10px] hover:text-white" :class="colorClasses.textLight">← Tillbaka</button>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <button @click="correction.tempo = 'half'; submitFix()" :class="[colorClasses.btn, 'border border-white/20 text-[10px] py-2 rounded leading-tight transition-colors']">Den är <br>långsammare</button>
                    <button @click="correction.tempo = 'ok'; submitFix()" class="bg-white hover:bg-gray-50 font-bold text-[10px] py-2 rounded" :class="colorClasses.text">Ja, det är<br>rätt</button>
                    <button @click="correction.tempo = 'double'; submitFix()" :class="[colorClasses.btn, 'border border-white/20 text-[10px] py-2 rounded leading-tight transition-colors']">Den är<br>snabbare</button>
                </div>
            </div>

            <div v-else-if="step === 'success'" class="bg-green-600 p-4 text-white flex justify-center items-center rounded-xl">
                <div class="text-sm font-bold flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Tack för hjälpen!
                </div>
            </div>

            <div v-else-if="step === 'bonus'" class="bg-teal-600 p-3 pb-4 text-white flex justify-between items-center rounded-xl">
                <div class="text-xs leading-tight">
                    <p class="font-bold opacity-90">Tack! Går det att<br>dansa något annat?</p>
                </div>
                <div class="flex gap-2">
                    <button @click="step = 'hidden'" class="bg-teal-800 hover:bg-teal-900 text-[10px] font-bold px-3 py-1.5 rounded transition-colors">
                        Nej
                    </button>
                    <button @click="startAddition" class="bg-white text-teal-700 hover:bg-teal-50 text-[10px] font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1">
                        <span>+ Lägg till</span>
                    </button>
                </div>
                <button @click="step = 'hidden'" class="absolute top-1 right-2 text-teal-200 hover:text-white text-xs">×</button>
            </div>

        </div>
    </transition>
    `
}