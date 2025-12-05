export default {
    props: ['track', 'activeVersion'], 
    
    data() {
        return {
            // States: 'hidden' | 'verify' | 'success'
            step: 'hidden', 
            isSubmitting: false
        }
    },

    watch: {
        // Watch for data changes to decide visibility
        activeVersion: {
            immediate: true, // Run immediately on load
            handler(newVal) {
                if(newVal) this.evaluateState();
            }
        },
        // Also watch track ID in case we skip to next song
        'track.id': function() {
            this.evaluateState();
        }
    },

    methods: {
        evaluateState() {
            // Safety check: Don't show if data is missing
            if (!this.track || !this.activeVersion) {
                this.step = 'hidden';
                return;
            }

            // 1. Check GLOBAL LOCK (Did we vote YES on this track?)
            // I changed the key to 'structure_vote_v1' to reset your previous tests
            const hasConfirmed = localStorage.getItem(`structure_vote_v1_${this.track.id}`);
            
            if (hasConfirmed) {
                // If yes, we never show this component again for this track
                this.step = 'hidden';
            } else {
                // If no global lock, we show the question
                this.step = 'verify';
            }
        },

        async castVote(voteType) {
            if (this.isSubmitting) return;
            this.isSubmitting = true;

            // 1. API Call (Optimistic - we don't wait for it to finish to update UI)
            if (this.activeVersion && this.activeVersion.id) {
                try {
                    fetch(`/api/structure-versions/${this.activeVersion.id}/vote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            vote_type: voteType === 'yes' ? 'up' : 'down' 
                        })
                    });
                } catch (e) {
                    console.error("Voting failed:", e);
                }
            }

            // 2. Logic Branching
            if (voteType === 'yes') {
                // YES: Lock it globally. The user is happy with the structure.
                localStorage.setItem(`structure_vote_v1_${this.track.id}`, 'true');
            } else {
                // NO: We do NOT set localStorage. 
                // We just hide it for this session/view.
                // If they reload or toggle versions, it will appear again.
            }

            // 3. Show "Thanks" feedback
            this.step = 'success';
            
            // 4. Hide after delay
            setTimeout(() => {
                this.step = 'hidden';
            }, 2000);

            this.isSubmitting = false;
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
        <div v-if="step !== 'hidden'" class="w-full relative z-0 shadow-xl rounded-xl overflow-hidden font-sans">
            
            <div v-if="step === 'verify'" class="bg-indigo-600 p-3 pb-4 text-white flex justify-between items-center">
                <div class="text-xs leading-tight">
                    <p class="opacity-80">Stämmer repriserna?</p>
                </div>
                <div class="flex gap-2">
                    <button 
                        @click="castVote('no')" 
                        :disabled="isSubmitting"
                        class="bg-indigo-800 hover:bg-indigo-900 text-[10px] font-bold px-3 py-1.5 rounded transition-colors"
                    >
                        Nej
                    </button>
                    <button 
                        @click="castVote('yes')" 
                        :disabled="isSubmitting"
                        class="bg-white text-indigo-700 hover:bg-indigo-50 text-[10px] font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                    >
                        <span>Ja</span>
                    </button>
                </div>
                <button @click="step = 'hidden'" class="absolute top-1 right-2 text-indigo-300 hover:text-white text-xs">×</button>
            </div>

            <div v-else-if="step === 'success'" class="bg-green-600 p-4 text-white flex justify-center items-center">
                <div class="text-sm font-bold flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Tack för feedback!
                </div>
            </div>

        </div>
    </transition>
    `
}