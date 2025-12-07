import AddLinkModal from "./modals/AddLinkModal.js";
import SparklesIcon from "../icons/SparklesIcon.js";

export default {
    props: ['track', 'currentTrack', 'isSpotifyMode', 'isPlaying'], 
    emits: ['play', 'stop', 'refresh'], 
    components: { AddLinkModal, SparklesIcon },
    
    data() { 
        return {
            showLinkModal: false
        } 
    },

    template: /*html*/`
    <div class="card bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-100 flex flex-row items-center justify-between gap-4 transition-all hover:shadow-md group">
        
        <div class="flex-1 min-w-0">
            
            <div class="flex flex-wrap items-center gap-2 mb-2">
                
                <template v-if="track.dance_style && track.dance_style !== 'Unknown' && track.dance_style !== 'Unclassified'">
                    <span v-if="track.style_confidence >= 1.0" class="px-2 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200">
                        {{ track.dance_style }}
                    </span>
                    <span v-else-if="track.style_confidence > 0.75" class="px-2 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200">
                        {{ track.dance_style }} <sparkles-icon class="w-3 h-3 text-blue-400" />
                    </span>
                    <span v-else class="px-2 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200">
                        {{ track.dance_style }} <sparkles-icon class="w-3 h-3 text-amber-400" />
                    </span>
                </template>

                <template v-else>
                    <span class="px-2 py-1 bg-gray-100 text-gray-600 border border-gray-300 text-xs font-bold rounded-full flex items-center gap-1 cursor-help">
                        ❓ Okänd stil
                    </span>
                </template>

                <span class="text-gray-500 text-xs flex items-center font-medium border border-gray-100 bg-gray-50 px-2 py-1 rounded-full whitespace-nowrap">
                    {{ tempoLabel }}
                </span>

                <span v-if="track.has_vocals" class="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold rounded-full flex items-center gap-1">🎤 Vocals</span>
                <span v-else class="px-2 py-1 bg-green-50 text-green-700 border border-green-100 text-xs font-bold rounded-full flex items-center gap-1">🎻 Instr.</span>

                <span v-if="formattedDuration" class="px-2 py-1 text-gray-400 text-xs font-mono flex items-center gap-1 ml-auto sm:ml-0">🕒 {{ formattedDuration }}</span>
            </div>
            
            <h3 class="font-bold text-lg text-gray-900 leading-tight mb-1 truncate">{{ track.title }}</h3>
            
            <p class="text-gray-600 text-sm mb-1 truncate flex items-center gap-1">
                <span class="font-medium text-gray-700">
                    {{ artistDisplayString }}
                </span>
            </p>
            <p class="text-gray-600 text-sm mb-3 truncate flex items-center gap-1">                
                <span v-if="track.album" class="italic text-gray-500">
                    {{ track.album.title }}
                </span>
            </p>

            <div class="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500">
                
                <button v-if="hasSpotify" @click="$emit('play', track, 'spotify')" 
                        class="flex items-center gap-1 hover:text-[#1DB954] transition-colors" 
                        :class="{ 'text-[#1DB954] font-bold': isCurrent && isSpotifyMode }">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.181.6.719.241 1.2zm.12-3.36C15.54 8.46 9.059 8.22 5.28 9.361c-.6.181-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.24z"/></svg> 
                    <span>Spotify</span>
                </button>
                
                <button v-if="hasYouTube" @click="$emit('play', track, 'youtube')" 
                        class="flex items-center gap-1 hover:text-red-600 transition-colors" 
                        :class="{ 'text-red-600 font-bold': isCurrent && !isSpotifyMode }">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg> 
                    <span>YouTube</span>
                </button>

                <button v-if="!hasYouTube" @click="showLinkModal = true" class="text-xs text-gray-400 hover:text-red-500 border border-transparent hover:border-red-200 px-2 py-0.5 rounded transition-colors flex items-center gap-1">
                    <span>+ Lägg till länk</span>
                </button>
            </div>
        </div>

        <div class="shrink-0 pt-1">
            <button 
                @click.stop="playPrimary"
                :disabled="!primarySource"
                class="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                :class="[
                    !primarySource ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 
                    (isCurrent && isPlaying) ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-500' : 
                    'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 shadow-md hover:shadow-lg'
                ]"
                :title="playButtonTitle"
            >
                <svg v-if="isCurrent && isPlaying" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /> </svg>
                <svg v-else class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </button>
        </div>

        <add-link-modal 
            :is-open="showLinkModal" 
            :track="track" 
            @close="showLinkModal = false"
            @refresh="$emit('refresh')"
        ></add-link-modal>
    </div>
    `,
    computed: {
        // --- NEW: Helper for Artist Display ---
        artistDisplayString() {
            if (!this.track.artists || this.track.artists.length === 0) return 'Okänd artist';
            
            // Format: "Primary, Primary feat. Featured"
            const primary = this.track.artists.filter(a => a.role === 'primary').map(a => a.name);
            const feat = this.track.artists.filter(a => a.role === 'featured').map(a => a.name);
            
            let text = primary.join(', ');
            if (feat.length > 0) {
                text += ' feat. ' + feat.join(', ');
            }
            // Fallback if roles aren't set correctly
            if (!text) text = this.track.artists.map(a => a.name).join(', ');
            
            return text;
        },
        
        hasYouTube() { return this.getLink('youtube'); },
        hasSpotify() { return this.getLink('spotify'); },
        isCurrent() { return this.currentTrack?.id === this.track.id; },
        
        primarySource() {
            if (this.hasYouTube) return 'youtube';
            if (this.hasSpotify) return 'spotify';
            return null;
        },
        playButtonTitle() {
            if (this.isCurrent && this.isPlaying) return 'Pausa';
            if (this.isCurrent && !this.isPlaying) return 'Spela'
            return 'Spela upp';
        },
        formattedDuration() {
            const ms = this.track.duration;
            if (!ms) return null;
            const min = Math.floor(ms / 60000);
            const sec = ((ms % 60000) / 1000).toFixed(0);
            return min + ":" + (sec < 10 ? '0' : '') + sec;
        },
        tempoLabel() {
            if (!this.track) return '';
            if (this.track.dance_style === 'Unknown' || this.track.dance_style === 'Unclassified') {
               return 'Tempo?';
            }
            const labels = { 'Slow': 'Lugn', 'Medium': 'Lagom', 'Fast': 'Rask', 'Turbo': 'Ösigt' };
            return labels[this.track.tempo_category] || 'Lagom';
        }
    },
    methods: {
        getLink(type) {
            if (!this.track.playback_links) return null;
            return this.track.playback_links.find(l => {
                // Ensure we handle both object and string formats safely
                const url = l.deep_link || (typeof l === 'string' ? l : null);
                if (!url) return false;
                return type === 'spotify' ? url.includes('spotify') : !url.includes('spotify');
            });
        },
        playPrimary() {
            if (this.isCurrent && this.isPlaying) {
                this.$emit('stop'); 
            } else if (this.isCurrent && !this.isPlaying) {
                this.$emit('play', this.track, this.primarySource);
            } else if (this.primarySource) {
                this.$emit('play', this.track, this.primarySource);
            }
        },
    }
};