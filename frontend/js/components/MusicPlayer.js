import SmartNudge from './SmartNudge.js';

export default {
    props: ['track', 'videoId', 'state', 'useSpotify', 'isRestricted'],
    emits: ['close', 'edit', 'report-link', 'player-error'],
    components: { SmartNudge },

    data() {
        return {
            ytPlayer: null,
            playbackStartTime: null
        }
    },

    mounted() {
        if (window.YT && window.YT.Player) {
            this.initPlayer();
        } else {
            window.onYouTubeIframeAPIReady = () => this.initPlayer();
            if (!document.getElementById('yt-api-script')) {
                const tag = document.createElement('script');
                tag.id = 'yt-api-script';
                tag.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(tag);
            }
        }
    },

    watch: {
        track: {
            immediate: true,
            handler(newTrack) {
                if (newTrack) {
                    this.playbackStartTime = Date.now();
                    
                    const hasFeedback = localStorage.getItem(`fb_${newTrack.id}`);
                    
                    const isSettled = newTrack.style_confirmations >= 3;
                    
                    if (hasFeedback || isSettled) {
                        this.nudgeStep = 'hidden';
                    } else {
                        this.nudgeStep = 'verify';
                    }
                    
                    this.correction.style = newTrack.dance_style || "Polska";
                    this.correction.tempo = 'ok';
                }
            }
        },
        // 1. STOP AUDIO WHEN SWITCHING TO SPOTIFY
        useSpotify(newVal) {
            if (newVal === true) {
                console.log("Switching to Spotify: Stopping YouTube Audio");
                if (this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
                    this.ytPlayer.stopVideo();
                }
            } else {
                // Optional: If switching back to YouTube, ensure player is ready
                if (this.videoId && this.ytPlayer) {
                    this.ytPlayer.loadVideoById(this.videoId);
                }
            }
        },

        videoId(newId) {
            // Only load YouTube if we are NOT in Spotify mode
            if (newId && !this.useSpotify) {
                this.$nextTick(() => {
                    if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                        this.ytPlayer.loadVideoById(newId);
                    } else {
                        this.initPlayer(); 
                    }
                });
            }
        },

        isRestricted(newVal) {
            if (newVal === true && this.ytPlayer && this.ytPlayer.stopVideo) {
                this.ytPlayer.stopVideo();
            }
        },

        track(newTrack) {
            if (!newTrack && this.ytPlayer && this.ytPlayer.stopVideo) {
                this.ytPlayer.stopVideo();
            }
            if (newTrack) {
                this.playbackStartTime = Date.now();
            }
        }
    },

    computed: {
        spotifySrc() {
             if (!this.track || !this.track.playback_links) return '';
             let url = this.track.playback_links.find(l => (l.deep_link || l).includes('spotify'));
             if (!url) return '';
             const match = (url.deep_link || url).match(/track\/([a-zA-Z0-9]+)/);
             return match ? `https://open.spotify.com/embed/track/${match[1]}?utm_source=generator&theme=0&autoplay=1` : '';
        },
        tempoLabel() {
            if (!this.track) return '';
            const labels = { 'Slow': 'Lugn', 'Medium': 'Lagom', 'Fast': 'Rask', 'Turbo': 'Ösigt' };
            return labels[this.track.tempo_category] || 'Lagom';
        },
        activeLink() {
            if (!this.track || !this.track.playback_links) return null;
            const platform = this.useSpotify ? 'spotify' : 'youtube';
            return this.track.playback_links.find(l => 
                l.platform === platform || (l.deep_link && l.deep_link.includes(platform))
            );
        }
    },

    methods: {
        initPlayer() {
            if (this.ytPlayer) return;
            if (!document.getElementById('youtube-player')) return;
            
            this.ytPlayer = new YT.Player('youtube-player', {
                height: '100%',
                width: '100%',
                playerVars: { 'autoplay': 1, 'playsinline': 1, 'controls': 1 },
                events: {
                    'onReady': (event) => {
                        // Only auto-play if we are supposed to be in YouTube mode
                        if (this.videoId && !this.useSpotify) {
                            event.target.loadVideoById(this.videoId);
                        }
                    },
                    'onError': (e) => {
                        console.warn("YT Error:", e.data);
                        if (this.ytPlayer && this.ytPlayer.stopVideo) this.ytPlayer.stopVideo();
                        this.$emit('player-error', e.data);
                    }
                }
            });
        },

        handleClose() {
            const duration = (Date.now() - this.playbackStartTime) / 1000;
            if (duration < 10 && !this.isRestricted) {
                this.$emit('report-link', { track: this.track, badLink: this.activeLink });
            }
            this.$emit('close');
        }
    },

    template: /*html*/`
    <div>
        <transition name="player">
            <div class="fixed bottom-6 right-6 z-50 w-80 md:w-96 flex flex-col items-end">
                
                <smart-nudge 
                    ref="nudge"
                    :track="track" 
                    @edit="$emit('edit', track)" 
                ></smart-nudge>

                <div class="relative z-10 w-full shadow-2xl rounded-xl overflow-hidden bg-black border border-gray-800">
                    
                    <div class="flex justify-between items-center bg-gray-900 text-white px-4 py-2 border-b border-gray-800">
                        
                        <div class="flex items-center gap-2 overflow-hidden w-full mr-2">
                             <div v-if="state === 1 && !isRestricted && !useSpotify" class="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0"></div>
                             <div v-if="useSpotify" class="w-2 h-2 bg-[#1DB954] rounded-full shrink-0"></div>
                             
                             <div class="flex flex-col overflow-hidden">
                                <span class="text-xs font-medium truncate">{{ track?.title || 'Player' }}</span>
                                <span v-if="track" class="text-[10px] text-gray-400">
                                    {{ track.dance_style }} • {{ tempoLabel }}
                                </span>
                             </div>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <button @click="$refs.nudge?.openManualEdit()" class="text-gray-400 hover:text-indigo-400 p-1 transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            </button>
                            <button @click="handleClose" class="text-gray-400 hover:text-white p-1 transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="relative pb-[56.25%] h-0 bg-black">
                         
                         <div v-show="!isRestricted && !useSpotify" class="absolute inset-0 bg-black">
                             <div id="youtube-player" class="w-full h-full"></div>
                        </div>

                        <div v-if="useSpotify" class="absolute inset-0 bg-black">
                            <iframe 
                                style="border-radius:0px" 
                                :src="spotifySrc" 
                                width="100%" 
                                height="100%" 
                                frameBorder="0" 
                                allowfullscreen 
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy">
                            </iframe>
                        </div>

                        <div v-if="isRestricted && !useSpotify" class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center z-20">
                            <p class="text-xs text-gray-400 mb-4">Playback Restricted</p>
                            <a :href="\`https://www.youtube.com/watch?v=\${videoId}\`" target="_blank" class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-full transition-colors flex items-center gap-2">
                                <span>Watch on YouTube</span>
                            </a>
                        </div>

                    </div>
                </div>

            </div>
        </transition>
    </div>
    `
};