import { toRaw } from 'vue';
import { showError } from '../../hooks/useToast.js';

export default {
  props: {
    brokenState: { type: Object, default: null }, // Expects { track, badLink } or null
    structureMode: { type: String, default: 'none' },
    inlineMode: { type: Boolean, default: false }, // When true, renders inline instead of fixed
  },
  emits: ['close'],
  data() {
    return {
      view: 'ask', // 'ask' or 'success'
    };
  },
  computed: {
    // Calculate the bottom offset for desktop positioning
    bottomOffset() {
      const playerHeight = 80;
      const progressBarHeight = this.structureMode !== 'none' ? 32 : 6;
      return playerHeight + progressBarHeight + 12; // 12px margin
    },
  },
  watch: {
    brokenState() {
      this.view = 'ask'; // Reset when a new broken link pops up
    },
  },
  methods: {
    async confirm(reason) {
      // 1. Show Success UI immediately
      this.view = 'success';

      const { badLink } = toRaw(this.brokenState);

      // 2. Perform API call in background
      try {
        if (badLink && badLink.id) {
          await fetch(`/api/links/${badLink.id}/report?reason=${reason}`, { method: 'PATCH' });
        }
      } catch {
        showError();
      }

      // 3. Close after delay
      setTimeout(() => {
        this.$emit('close');
        this.view = 'ask';
      }, 2500);
    },
  },
  template: /*html*/ `
    <transition
        enter-active-class="transform ease-out duration-300 transition"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
        mode="out-in"
    >
        <!-- Inline Mode (for mobile player) -->
        <div v-if="brokenState && inlineMode" :key="'inline-' + view" 
             class="w-full relative z-0 mb-2 shadow-xl rounded-xl overflow-hidden font-sans">
            
            <div v-if="view === 'ask'" class="bg-gray-800 p-4 md:p-3 pb-5 md:pb-4 text-white">
                <div class="flex items-center gap-3 w-full mb-4">
                    <div class="p-2.5 md:p-2 bg-gray-700 rounded-full shrink-0">
                        <svg class="w-6 h-6 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div class="flex-1">
                        <p class="text-base md:text-sm font-bold text-white">Slutade du lyssna?</p>
                        <p class="text-sm md:text-xs text-gray-400">Var det något fel på länken?</p>
                    </div>
                </div>

                <div class="flex items-center gap-3 md:gap-2 w-full justify-end">
                    <button @click="$emit('close')" class="text-gray-500 hover:text-white text-sm md:text-xs px-3 py-2 md:px-2 md:py-1 transition-colors">Nej</button>
                    <button @click="confirm('wrong_track')" class="bg-orange-600 hover:bg-orange-700 text-white text-sm md:text-xs font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded-md transition-colors whitespace-nowrap">Fel Låt</button>
                    <button @click="confirm('broken')" class="bg-red-600 hover:bg-red-700 text-white text-sm md:text-xs font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded-md transition-colors whitespace-nowrap">Trasig</button>
                </div>
                <button @click="$emit('close')" class="absolute top-1 right-1 p-2 text-gray-500 hover:text-white text-lg md:text-sm leading-none">×</button>
            </div>

            <div v-else class="bg-green-600 p-5 md:p-4 text-white flex justify-center items-center">
                <div class="text-base md:text-sm font-bold flex items-center gap-2">
                    <svg class="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    Tack för rapporten!
                </div>
            </div>
        </div>

        <!-- Fixed Mode (for desktop) -->
        <div v-else-if="brokenState && !inlineMode" :key="'fixed-' + view" 
             class="fixed left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 z-[100] max-w-md w-[calc(100%-2rem)] md:w-full bg-gray-900 text-white shadow-2xl rounded-lg p-5 md:p-4 border border-gray-700 font-sans transition-all duration-300"
             :style="{ bottom: bottomOffset + 'px' }">
            
            <div v-if="view === 'ask'" class="flex flex-col gap-4">
                <div class="flex items-center gap-3 w-full">
                    <div class="p-2.5 md:p-2 bg-gray-800 rounded-full shrink-0">
                        <svg class="w-6 h-6 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div class="flex-1">
                        <p class="text-base md:text-sm font-bold text-white">Slutade du lyssna?</p>
                        <p class="text-sm md:text-xs text-gray-400">Var det något fel på länken?</p>
                    </div>
                </div>

                <div class="flex items-center gap-3 md:gap-2 w-full justify-end">
                    <button @click="$emit('close')" class="text-gray-500 hover:text-white text-sm md:text-xs px-3 py-2 md:px-2 md:py-1 transition-colors">Nej</button>
                    <button @click="confirm('wrong_track')" class="bg-orange-600 hover:bg-orange-700 text-white text-sm md:text-xs font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded-md transition-colors whitespace-nowrap">Fel Låt</button>
                    <button @click="confirm('broken')" class="bg-red-600 hover:bg-red-700 text-white text-sm md:text-xs font-bold px-5 py-2.5 md:px-3 md:py-1.5 rounded-md transition-colors whitespace-nowrap">Trasig</button>
                </div>
            </div>

            <div v-else class="flex items-center justify-center gap-2 text-green-400 py-2 md:py-1">
                <svg class="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span class="font-bold text-base md:text-sm">Tack för rapporten!</span>
            </div>

        </div>
    </transition>
    `,
};
