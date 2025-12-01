export default {
    props: ['isPlaying', 'isShuffled', 'hasSpotify'],
    emits: ['toggle-play', 'next', 'prev', 'shuffle', 'main-action'],
    template: /*html*/`
    <div class="flex items-center gap-4">
        <button @click="$emit('shuffle')" :class="isShuffled ? 'text-indigo-600' : 'text-gray-400'" class="hover:text-indigo-500 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
        </button>

        <button @click="$emit('prev')" class="text-gray-700 hover:text-black">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>

        <button 
            @click="$emit('main-action')" 
            class="w-10 h-10 rounded-full flex items-center justify-center hover:scale-105 transition shadow-md"
            :class="hasSpotify ? 'bg-green-100 text-green-600 cursor-default' : 'bg-indigo-600 text-white'"
            :disabled="hasSpotify"
        >
            <svg v-if="hasSpotify" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            
            <svg v-else-if="isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            
            <svg v-else class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>

        <button @click="$emit('next')" class="text-gray-700 hover:text-black">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
    </div>
    `
};