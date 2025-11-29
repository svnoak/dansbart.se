import { toRaw } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

export default {
    props: ['brokenState'], // Expects { track, badLink } or null
    emits: ['close'],
    data() {
        return {
            view: 'ask' // 'ask' or 'success'
        }
    },
    watch: {
        brokenState() {
            this.view = 'ask'; // Reset when a new broken link pops up
        }
    },
    methods: {
        async confirm(reason) {
            // 1. Show Success UI immediately
            this.view = 'success';
            
            const { track, badLink } = toRaw(this.brokenState);

            // 2. Perform API call in background
            try {
                if (badLink && badLink.id) {
                    await fetch(`/api/links/${badLink.id}/report?reason=${reason}`, { method: 'PATCH' });
                }
            } catch (e) {
                console.error(e);
            }

            // 3. Close after delay
            setTimeout(() => {
                this.$emit('close');
                this.view = 'ask';
            }, 2500);
        }
    },
    template: /*html*/`
    <transition
        enter-active-class="transform ease-out duration-300 transition"
        enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
        enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
        mode="out-in"
    >
        <div v-if="brokenState" :key="view" class="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-[100] max-w-md w-full bg-gray-900 text-white shadow-2xl rounded-lg p-4 border border-gray-700 font-sans">
            
            <div v-if="view === 'ask'" class="flex flex-col sm:flex-row items-center gap-4">
                <div class="flex items-center gap-3 w-full sm:w-auto">
                    <div class="p-2 bg-gray-800 rounded-full shrink-0">
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div class="flex-1">
                        <p class="text-sm font-bold text-white">Slutade du lyssna?</p>
                        <p class="text-xs text-gray-400">Var det något fel på länken?</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button @click="$emit('close')" class="text-gray-500 hover:text-white text-xs px-2 py-1 transition-colors">Nej</button>
                    <button @click="confirm('wrong_track')" class="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap">Fel Låt</button>
                    <button @click="confirm('broken')" class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap">Trasig</button>
                </div>
            </div>

            <div v-else class="flex items-center justify-center gap-2 text-green-400 py-1">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span class="font-bold text-sm">Tack för rapporten!</span>
            </div>

        </div>
    </transition>
    `
}