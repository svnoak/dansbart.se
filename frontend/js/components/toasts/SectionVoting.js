import { showError } from '../../hooks/useToast.js';

export default {
  props: ['track', 'activeVersion'],
  emits: ['open-structure-editor'],

  data() {
    return {
      // States: 'hidden' | 'verify' | 'ask-edit' | 'success'
      step: 'hidden',
      isSubmitting: false,
      showDelayTimer: null, // Timer to delay showing the nudge
      autoDismissTimer: null, // Timer to auto-dismiss if no interaction
    };
  },

  beforeUnmount() {
    this.clearTimers();
  },

  watch: {
    // Watch for data changes to decide visibility
    activeVersion: {
      immediate: true, // Run immediately on load
      handler(newVal) {
        if (newVal) this.evaluateState();
      },
    },
    // Also watch track ID in case we skip to next song
    'track.id': function () {
      this.evaluateState();
    },
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

    evaluateState() {
      // Clear any pending timers when state is re-evaluated
      this.clearTimers();

      // Safety check: Don't show if data is missing
      if (!this.track || !this.activeVersion) {
        this.step = 'hidden';
        return;
      }

      // 1. Check GLOBAL LOCK (Did we vote YES on this track?)
      const hasConfirmed = localStorage.getItem(`structure_vote_v1_${this.track.id}`);

      if (hasConfirmed) {
        // If yes, we never show this component again for this track
        this.step = 'hidden';
      } else {
        // Delay showing the nudge by 5 seconds to let user see the sections first
        this.step = 'hidden';
        this.showDelayTimer = setTimeout(() => {
          // Double-check we're still on the same track/version
          if (this.track && this.activeVersion) {
            this.step = 'verify';
            this.startAutoDismiss();
          }
        }, 5000);
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

    async castVote(voteType) {
      if (this.isSubmitting) return;
      this.isSubmitting = true;

      // Clear auto-dismiss timer since user is interacting
      if (this.autoDismissTimer) {
        clearTimeout(this.autoDismissTimer);
        this.autoDismissTimer = null;
      }

      // 1. API Call (Optimistic - we don't wait for it to finish to update UI)
      if (this.activeVersion && this.activeVersion.id) {
        try {
          fetch(`/api/structure-versions/${this.activeVersion.id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vote_type: voteType === 'yes' ? 'up' : 'down',
            }),
          });
        } catch {
          showError();
        }
      }

      // 2. Logic Branching
      if (voteType === 'yes') {
        // YES: Lock it globally. The user is happy with the structure.
        localStorage.setItem(`structure_vote_v1_${this.track.id}`, 'true');
        // Show "Thanks" feedback
        this.step = 'success';
        setTimeout(() => {
          this.step = 'hidden';
        }, 2000);
      } else {
        // NO: Ask if they want to edit the sections
        this.step = 'ask-edit';
      }

      this.isSubmitting = false;
    },

    openEditor() {
      this.$emit('open-structure-editor');
      this.step = 'hidden';
    },

    declineEdit() {
      // Just thank them and hide
      this.step = 'success';
      setTimeout(() => {
        this.step = 'hidden';
      }, 2000);
    },
  },

  template: /*html*/ `
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
            
            <div v-if="step === 'verify'" class="bg-indigo-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center">
                <div class="text-sm md:text-xs leading-tight">
                    <p class="opacity-80">Stämmer repriserna?</p>
                </div>
                <div class="flex gap-3 md:gap-2">
                    <button 
                        @click="castVote('no')" 
                        :disabled="isSubmitting"
                        class="bg-indigo-800 hover:bg-indigo-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                    >
                        Nej
                    </button>
                    <button 
                        @click="castVote('yes')" 
                        :disabled="isSubmitting"
                        class="bg-white text-indigo-700 hover:bg-indigo-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1"
                    >
                        <span>Ja</span>
                    </button>
                </div>
            </div>

            <div v-else-if="step === 'ask-edit'" class="bg-amber-600 p-4 md:p-3 pb-5 md:pb-4 text-white flex justify-between items-center">
                <div class="text-sm md:text-xs leading-tight">
                    <p class="font-medium">Vill du rätta repriserna?</p>
                </div>
                <div class="flex gap-3 md:gap-2">
                    <button 
                        @click="declineEdit" 
                        class="bg-amber-800 hover:bg-amber-900 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors"
                    >
                        Nej tack
                    </button>
                    <button 
                        @click="openEditor" 
                        class="bg-white text-amber-700 hover:bg-amber-50 text-sm md:text-[10px] font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded transition-colors flex items-center gap-1"
                    >
                        <svg class="w-4 h-4 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        <span>Ja, redigera</span>
                    </button>
                </div>
            </div>

            <div v-else-if="step === 'success'" class="bg-green-600 p-5 md:p-4 text-white flex justify-center items-center">
                <div class="text-base md:text-sm font-bold flex items-center gap-2">
                    <svg class="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Tack för feedback!
                </div>
            </div>

        </div>
    </transition>
    `,
};
