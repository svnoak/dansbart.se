export default {
    // We accept the raw state from the parent
    props: ['track', 'videoId', 'state', 'useSpotify', 'isRestricted'],
    emits: ['close'],
    template: `
    <transition name="player">
        <div class="fixed bottom-6 right-6 z-50 shadow-2xl rounded-xl overflow-hidden bg-black w-80 md:w-96 border border-gray-800">
            
            <div class="flex justify-between items-center bg-gray-900 text-white px-4 py-2 border-b border-gray-800">
                <div class="flex items-center gap-2 overflow-hidden w-full mr-2">
                    
                    <div v-if="state === 1 && !isRestricted && !useSpotify" 
                         class="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0"></div>
                    
                    <div v-if="useSpotify" 
                         class="w-2 h-2 bg-[#1DB954] rounded-full shrink-0"></div>
                    
                    <span class="text-xs font-medium truncate">
                        {{ track?.title || 'Player' }}
                    </span>
                </div>
                
                <button @click="$emit('close')" class="text-gray-400 hovear:text-white transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            
            <div class="relative pb-[56.25%] h-0 bg-black">
                
                <div v-show="!isRestricted && !useSpotify" class="absolute inset-0 bg-black">
                     <iframe 
                        id="youtube-player"
                        width="100%" 
                        height="100%" 
                        src="https://www.youtube.com/embed/?enablejsapi=1&controls=1&modestbranding=1" 
                        frameborder="0" 
                        allowfullscreen 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        referrerpolicy="strict-origin-when-cross-origin">
                    </iframe>
                </div>

                <div v-if="useSpotify" class="absolute inset-0 bg-black">
                    <iframe 
                        style="border-radius:0px" 
                        :src="spotifySrc" 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        allowfullscreen 
                        allow="autoplay *; encrypted-media *; clipboard-write; fullscreen; picture-in-picture" 
                        loading="lazy">
                    </iframe>
                </div>

                <div v-if="isRestricted && !useSpotify" class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
                    <svg class="w-10 h-10 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <p class="text-sm font-semibold mb-1">Playback Restricted</p>
                    <p class="text-xs text-gray-400 mb-4">Opening in new tab...</p>
                    <a :href="\`https://www.youtube.com/watch?v=\${videoId}\`" 
                       target="_blank"
                       class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors flex items-center gap-2">
                        <span>Watch on YouTube</span>
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M10 6.296v11.408l7.681-5.704L10 6.296z"/></svg>
                    </a>
                </div>
            </div>
        </div>
    </transition>
    `,
    computed: {
        spotifySrc() {
            if (!this.track || !this.track.playback_links) return '';
            
            let url = null;
            for (const linkObj of this.track.playback_links) {
                const val = linkObj.deep_link || linkObj;
                if (typeof val === 'string' && val.includes('spotify')) {
                    url = val;
                    break;
                }
            }
            
            if (!url) return '';
            const match = url.match(/track\/([a-zA-Z0-9]+)/);
            const id = match ? match[1] : '';
            return `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;
        }
    }
};