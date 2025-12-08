export default {
    props: ['isPlaying', 'isShuffled', 'repeatMode', 'hasSpotify', 'structureMode', 'fullMode', 'activeSource'],
    emits: ['toggle-play', 'next', 'prev', 'shuffle', 'toggle-repeat', 'jump'],

    computed: {
        jumpAmount() {
            return this.structureMode !== 'none' ? 4 : 10;
        },
        jumpLabel() {
            return this.structureMode !== 'none' ? '4 Bars' : '10 Seconds';
        },
        isSpotifyActive() {
            return this.activeSource === 'spotify';
        }
    },

    template: /*html*/`
    <div class="flex items-center justify-center w-full" 
         :class="fullMode ? 'gap-4 justify-evenly' : 'gap-2 md:gap-4'">
        
        <!-- Shuffle -->
        <button @click="$emit('shuffle')" 
            class="group relative w-8 h-8 flex items-center justify-center transition-colors" 
            :class="[
                isShuffled ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600',
                fullMode ? 'flex' : 'hidden md:flex'
            ]"
            title="Shuffle">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
        </button>

        <!-- Jump Back - Now works with Spotify IFrame API -->
        <button @click="$emit('jump', -1)" 
                class="group relative w-10 h-10 items-center justify-center text-gray-500 hover:text-indigo-600 transition-colors" 
                :class="fullMode ? 'flex' : 'hidden md:flex'"
                :title="'Rewind ' + jumpLabel">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
            </svg>
            <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px] text-[8px] font-bold select-none pointer-events-none text-gray-600 group-hover:text-indigo-600">
                {{ jumpAmount }}
            </span>
        </button>

        <!-- Previous Track -->
        <button @click="$emit('prev')" class="text-gray-800 hover:text-indigo-600 transition-colors" title="Previous Track">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>

        <!-- Main Play Button -->
        <button @click="$emit('toggle-play')" 
            class="rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 shrink-0 aspect-square"
            :class="[
                fullMode ? 'w-16 h-16' : 'w-12 h-12',
                isSpotifyActive ? 'bg-[#1DB954] hover:bg-[#1ed760]' : 'bg-indigo-600 hover:bg-indigo-700'
            ]"
            :title="isPlaying ? 'Pause' : 'Play'">
            
            <!-- Spotify branded play/pause when Spotify is active -->
            <svg v-if="!isPlaying" :class="fullMode ? 'w-8 h-8' : 'w-6 h-6'" class="ml-1 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <svg v-else :class="fullMode ? 'w-8 h-8' : 'w-6 h-6'" class="text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>

        <!-- Next Track -->
        <button @click="$emit('next')" class="text-gray-800 hover:text-indigo-600 transition-colors" title="Next Track">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>

        <!-- Jump Forward - Now works with Spotify IFrame API -->
        <button @click="$emit('jump', 1)" 
                class="group relative w-10 h-10 items-center justify-center text-gray-500 hover:text-indigo-600 transition-colors" 
                :class="fullMode ? 'flex' : 'hidden md:flex'"
                :title="'Forward ' + jumpLabel">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
            </svg>
            <span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px] text-[8px] font-bold select-none pointer-events-none text-gray-600 group-hover:text-indigo-600">
                {{ jumpAmount }}
            </span>
        </button>

        <!-- Repeat -->
        <button @click="$emit('toggle-repeat')" 
            class="group relative w-8 h-8 items-center justify-center transition-colors" 
            :class="[
                repeatMode !== 'none' ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600',
                fullMode ? 'flex' : 'hidden md:flex'
            ]"
            title="Repeat">
            
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>

            <span v-if="repeatMode === 'one'" 
                  class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-extrabold bg-white px-0.5 leading-none shadow-sm rounded-sm text-indigo-700">
                1
            </span>
        </button>
        
    </div>
    `
}