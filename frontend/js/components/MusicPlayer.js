import SmartNudge from './SmartNudge.js';

export default {
    props: ['track', 'videoId', 'state', 'useSpotify', 'isRestricted'],
    emits: ['close', 'edit', 'report-link', 'player-error'],
    components: { SmartNudge },

    data() {
        return {
            ytPlayer: null, // The API instance
            playbackStartTime: null,
            nudgeStep: 'hidden', 
            correction: { style: '', tempo: 'ok' },
            isSubmitting: false,
            availableStyles: ["Hambo", "Polska", "Slängpolska", "Vals", "Schottis", "Snoa", "Polka", "Mazurka", "Engelska"]
        }
    },

    mounted() {
        // Initialize YouTube API when component mounts
        if (window.YT && window.YT.Player) {
            this.initPlayer();
        } else {
            // Bind global callback
            window.onYouTubeIframeAPIReady = () => this.initPlayer();
            // Inject script if missing
            if (!document.getElementById('yt-api-script')) {
                const tag = document.createElement('script');
                tag.id = 'yt-api-script';
                tag.src = "https://www.youtube.com/iframe_api";
                document.head.appendChild(tag);
            }
        }
    },

    watch: {
        // When video ID changes (user clicked play), load it
        videoId(newId) {
            if (newId && !this.useSpotify) {
                // Wait for Vue to update the DOM (v-show)
                this.$nextTick(() => {
                    if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                        this.ytPlayer.loadVideoById(newId);
                    } else {
                        // If player isn't ready yet, init it (it will play newId via onReady)
                        this.initPlayer(); 
                    }
                });
            }
        },
        // Stop video when closing/switching
        track(newTrack) {
            if (!newTrack && this.ytPlayer && this.ytPlayer.stopVideo) {
                this.ytPlayer.stopVideo();
            }
            if (newTrack) {
                // Reset Nudge Logic
                this.playbackStartTime = Date.now();
                const hasFeedback = localStorage.getItem(`fb_${newTrack.id}`);
                this.nudgeStep = hasFeedback ? 'hidden' : 'verify';
                this.correction.style = newTrack.dance_style || "Polska";
                this.correction.tempo = 'ok';
            }
        },
        // Stop audio if we hit an error/restriction
        isRestricted(newVal) {
            if (newVal === true && this.ytPlayer && this.ytPlayer.stopVideo) {
                this.ytPlayer.stopVideo();
            }
        }
    },

    computed: {
        spotifySrc() {
             if (!this.track || !this.track.playback_links) return '';
             let url = this.track.playback_links.find(l => (l.deep_link || l).includes('spotify'));
             if (!url) return '';
             const match = (url.deep_link || url).match(/track\/([a-zA-Z0-9]+)/);
             return match ? `https://open.spotify.com/embed/track/${match[1]}?utm_source=generator&theme=0` : '';
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
            // IMPORTANT: Check for the DIV, not iframe
            if (!document.getElementById('youtube-player')) return;
            
            this.ytPlayer = new YT.Player('youtube-player', {
                height: '100%',
                width: '100%',
                playerVars: { 'autoplay': 1, 'playsinline': 1, 'controls': 1 },
                events: {
                    'onReady': (event) => {
                        // If we have a video ID waiting, play it
                        if (this.videoId) event.target.loadVideoById(this.videoId);
                    },
                    'onError': (e) => {
                        console.warn("YT Error:", e.data);
                        // Stop Ghost Audio
                        if (this.ytPlayer && this.ytPlayer.stopVideo) this.ytPlayer.stopVideo();
                        // Report to Parent
                        this.$emit('player-error', e.data);
                    }
                }
            });
        },

        // --- Nudge Logic ---
        startCorrection() { this.nudgeStep = 'fix-style'; },
        nextToTempo() { this.nudgeStep = 'fix-tempo'; },
        async submitCorrection() {
            this.isSubmitting = true;
            try {
                const payload = {
                    style: this.nudgeStep === 'verify' ? this.track.dance_style : this.correction.style,
                    tempo_correction: this.nudgeStep === 'verify' ? 'ok' : this.correction.tempo
                };
                await fetch(`/api/tracks/${this.track.id}/feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                localStorage.setItem(`fb_${this.track.id}`, 'true');
                
                // Show Success Message
                this.nudgeStep = 'success';
                setTimeout(() => { this.nudgeStep = 'hidden'; }, 2500);
            } catch(e) { console.error(e); this.nudgeStep = 'hidden'; } 
            finally { this.isSubmitting = false; }
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
                
                <transition enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 translate-y-4" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition-all duration-200 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-4" mode="out-in">
                    <div v-if="nudgeStep !== 'hidden'" :key="nudgeStep" class="w-full relative z-0 mb-2 shadow-xl rounded-xl overflow-hidden">
                        
                        <div v-if="nudgeStep === 'verify'" class="bg-indigo-600 p-3 pb-4 text-white flex justify-between items-center">
                            <div class="text-xs leading-tight">
                                <p class="opacity-80">Is this correct?</p>
                                <p class="font-bold">{{ track.dance_style }} • {{ tempoLabel }}</p>
                            </div>
                            <div class="flex gap-2">
                                <button @click="startCorrection" class="bg-indigo-800 hover:bg-indigo-900 text-[10px] font-bold px-3 py-1.5 rounded transition-colors">No / Fix</button>
                                <button @click="submitCorrection" :disabled="isSubmitting" class="bg-white text-indigo-700 hover:bg-indigo-50 text-[10px] font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1">
                                    <span>Yes ✅</span>
                                </button>
                            </div>
                            <button @click="nudgeStep = 'hidden'" class="absolute top-1 right-2 text-indigo-300 hover:text-white text-xs">×</button>
                        </div>

                        <div v-else-if="nudgeStep === 'fix-style'" class="bg-indigo-700 p-3 pb-4 text-white flex justify-between items-center gap-2">
                            <div class="flex-1">
                                <p class="text-[10px] opacity-80 uppercase font-bold mb-1">Actual Style</p>
                                <select v-model="correction.style" class="w-full text-xs text-gray-900 rounded p-1 text-black">
                                    <option v-for="s in availableStyles" :key="s" :value="s">{{ s }}</option>
                                </select>
                            </div>
                            <div class="flex items-end self-end">
                                <button @click="nextToTempo" class="bg-white text-indigo-700 hover:bg-indigo-50 text-[10px] font-bold px-3 py-1.5 rounded transition-colors">Next →</button>
                            </div>
                            <button @click="nudgeStep = 'verify'" class="absolute top-1 right-2 text-indigo-300 hover:text-white text-xs">Back</button>
                        </div>

                        <div v-else-if="nudgeStep === 'fix-tempo'" class="bg-indigo-800 p-3 pb-4 text-white">
                            <div class="flex justify-between items-center mb-2">
                                <p class="text-[10px] opacity-80 uppercase font-bold">Is {{ tempoLabel }} correct?</p>
                                <button @click="nudgeStep = 'fix-style'" class="text-[10px] text-indigo-300 hover:text-white">← Back</button>
                            </div>
                            <div class="grid grid-cols-3 gap-2">
                                <button @click="correction.tempo = 'half'; submitCorrection()" class="bg-indigo-900/50 hover:bg-indigo-900 border border-indigo-500 text-[10px] py-2 rounded leading-tight hover:border-white transition-colors">It's<br>Slower</button>
                                <button @click="correction.tempo = 'ok'; submitCorrection()" class="bg-white text-indigo-800 hover:bg-indigo-50 font-bold text-[10px] py-2 rounded">Yes<br>Correct</button>
                                <button @click="correction.tempo = 'double'; submitCorrection()" class="bg-indigo-900/50 hover:bg-indigo-900 border border-indigo-500 text-[10px] py-2 rounded leading-tight hover:border-white transition-colors">It's<br>Faster</button>
                            </div>
                        </div>

                        <div v-else-if="nudgeStep === 'success'" class="bg-green-600 p-4 text-white flex justify-center items-center rounded-xl">
                            <div class="text-sm font-bold flex items-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                Tack för hjälpen!
                            </div>
                        </div>
                    </div>
                </transition>

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
                            <button @click="nudgeStep = 'fix-style'" class="text-gray-400 hover:text-indigo-400 p-1 transition-colors">
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
                            <iframe style="border-radius:0px" :src="spotifySrc" width="100%" height="100%" frameBorder="0" allowfullscreen allow="autoplay *; encrypted-media *; clipboard-write; fullscreen; picture-in-picture" loading="lazy"></iframe>
                        </div>
                        <div v-if="isRestricted && !useSpotify" class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center z-20">
                            <svg class="w-10 h-10 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            <p class="text-sm font-semibold mb-1">Playback Restricted</p>
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