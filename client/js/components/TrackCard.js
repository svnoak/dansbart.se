export default {
    props: ['track', 'currentTrack', 'isSpotifyMode'], 
    emits: ['play', 'refresh'], // We emit 'refresh' so the parent can reload the list if a link is hidden
    template: `
    <div class="card bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        
        <div class="flex-1">
            <div class="flex flex-wrap items-center gap-2 mb-2">
                <span class="px-2 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1 border"
                    :class="track.style_confidence > 0.6 ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-yellow-50 text-yellow-700 border-yellow-200'">
                    {{ track.dance_style }}
                    <span class="ml-1 opacity-70 font-mono font-normal border-l pl-1" 
                        :class="track.style_confidence > 0.6 ? 'border-blue-200' : 'border-yellow-300'">
                        {{ Math.round(track.style_confidence * 100) }}%
                    </span>
                </span>
                <span class="text-gray-500 text-xs flex items-center font-mono border border-gray-100 bg-gray-50 px-2 py-1 rounded-full">
                    {{ track.effective_bpm }} BPM
                </span>
                <span v-if="track.has_vocals" class="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold rounded-full flex items-center gap-1">
                    🎤 Vocals
                </span>
                <span v-else class="px-2 py-1 bg-green-50 text-green-700 border border-green-100 text-xs font-bold rounded-full flex items-center gap-1">
                    🎻 Instr.
                </span>
            </div>
            
            <h3 class="font-bold text-lg text-gray-900 leading-tight mb-1">{{ track.title }}</h3>
            <p class="text-gray-600 text-sm mb-4">{{ track.artist_name }} <span class="text-gray-300 mx-1">•</span> <span class="italic text-gray-500">{{ track.album_name }}</span></p>

            <div class="flex flex-wrap items-center gap-2">

                <button v-if="hasSpotify" 
                        @click="$emit('play', track, 'spotify')"
                        :class="isCurrent && isSpotifyMode ? 'bg-[#1DB954] border-[#1DB954] text-white' : 'bg-green-50 border-green-200 text-green-700'"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border hover:shadow-sm transition-colors">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.181.6.719.241 1.2zm.12-3.36C15.54 8.46 9.059 8.22 5.28 9.361c-.6.181-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.24z"/></svg>
                    Spotify
                </button>
                
                <div v-if="hasYouTube" 
                     class="flex items-center rounded-md border overflow-hidden transition-all shadow-sm group"
                     :class="isCurrent && !isSpotifyMode ? 'bg-red-600 border-red-600 text-white' : 'bg-red-50 border-red-200 text-red-700'">
                    
                    <button @click="$emit('play', track, 'youtube')" 
                            class="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-black/10 transition-colors border-r border-current/20">
                        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                        YouTube
                    </button>

                    <button @click.stop="reportLink('youtube')" 
                            title="Report broken link"
                            class="px-2 py-1.5 hover:bg-black/10 transition-colors flex items-center justify-center">
                        <svg height=16px stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#000000"><path d="M5 15L5.95039 4.54568C5.97849 4.23663 6.23761 4 6.54793 4H20.343C20.6958 4 20.9725 4.30295 20.9405 4.65432L20.0496 14.4543C20.0215 14.7634 19.7624 15 19.4521 15H5ZM5 15L4.4 21" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                    </button>
                </div>                
                <span v-if="!hasYouTube && !hasSpotify" class="text-xs text-gray-400 italic">No audio sources</span>
            </div>
        </div>
    </div>
    `,
    computed: {
        hasYouTube() { return this.getLink('youtube'); },
        hasSpotify() { return this.getLink('spotify'); },
        isCurrent() { return this.currentTrack?.id === this.track.id; }
    },
    methods: {
        // Helper to find the link object for a specific platform
        getLink(type) {
            if (!this.track.playback_links) return null;
            return this.track.playback_links.find(l => {
                const val = l.deep_link || l;
                // Safe check if it's an object or string
                const url = typeof val === 'string' ? val : val.deep_link;
                if (!url) return false;
                
                return type === 'spotify' ? url.includes('spotify') : !url.includes('spotify');
            });
        },
        async reportLink(type) {
            const linkObj = this.getLink(type);
            
            // Safety check: Does the link exist and have an ID?
            if (!linkObj || !linkObj.id) {
                console.error("Cannot report: Missing Link ID");
                return;
            }

            if (!confirm("Is this link broken or incorrect? It will be hidden for review.")) return;

            try {
                // Call the API endpoint
                const response = await fetch(`http://127.0.0.1:8000/api/links/${linkObj.id}/report`, { 
                    method: 'PATCH' 
                });
                
                if (response.ok) {
                    alert("Thanks! We will review this link.");
                    this.$emit('refresh'); // Refresh list to hide the broken link immediately
                } else {
                    alert("Something went wrong reporting the link.");
                }
            } catch (e) {
                console.error("Report failed", e);
            }
        }
    }
};