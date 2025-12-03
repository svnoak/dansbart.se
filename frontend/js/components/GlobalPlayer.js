import SmartNudge from './SmartNudge.js';
import YouTubeEngine from './player/YouTubeEngine.js';
import PlayerControls from './player/PlayerControls.js';
import ProgressBar from './player/ProgressBar.js';
import { usePlayer } from '../player.js'; 
import { ref, nextTick } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

export default {
    components: { SmartNudge, YouTubeEngine, PlayerControls, ProgressBar },
    setup() {
        const playerStore = usePlayer();
        return { ...playerStore };
    },
    
    data() {
        return {
            // Source of Truth (from API)
            realTime: 0,
            duration: 0,
            
            // Visual State (Interpolated for smoothness)
            visualTime: 0,
            lastTick: 0,
            rafId: null,

            // Video Window State
            ytPlayer: null,
            
            // Dragging State for Video Window
            videoPos: { x: 16, y: 96 }, // Default bottom-left offset (bottom: 96px, left: 16px)
            isDraggingVideo: false,
            dragOffset: { x: 0, y: 0 },
            
            structureMode: 'none'
        }
    },

    mounted() {
        this.ytPlayer = null; 
        this.initYouTube();
        this.startSmoothLoop();
        
        // Global event listeners for dragging
        window.addEventListener('mousemove', this.onDrag);
        window.addEventListener('mouseup', this.stopDrag);
    },

    beforeUnmount() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        window.removeEventListener('mousemove', this.onDrag);
        window.removeEventListener('mouseup', this.stopDrag);
    },

    watch: {
        isPlaying(val) {
            if (this.activeSource === 'youtube' && this.$refs.ytEngine) {
                val ? this.$refs.ytEngine.play() : this.$refs.ytEngine.pause();
            }
            // Reset interpolation timestamp when state changes
            if (val) this.lastTick = performance.now();
        },
        
        activeSource(val) {
            if (val === 'spotify') {
                this.realTime = 0;
                this.visualTime = 0;
                this.duration = 0;
                this.videoPos = { x: 16, y: 96 }; // Reset position
            }
        }
    },

    methods: {
        // --- 1. SMOOTH ANIMATION LOOP ---
        startSmoothLoop() {
            const loop = (now) => {
                if (this.isPlaying && this.activeSource === 'youtube' && this.duration > 0) {
                    // Calculate delta time since last frame
                    const delta = (now - this.lastTick) / 1000;
                    
                    // Predict where we are (don't go past duration)
                    if (delta < 1.0) { // Avoid huge jumps if tab was backgrounded
                        this.visualTime = Math.min(this.visualTime + delta, this.duration);
                    }
                }
                this.lastTick = now;
                this.rafId = requestAnimationFrame(loop);
            };
            this.rafId = requestAnimationFrame(loop);
        },

        // Called when YouTube Engine sends a "Real" update (every ~500ms)
        onTimeUpdate({ currentTime, duration }) {
            this.realTime = currentTime;
            this.duration = duration;
            
            // Sync Visual time to Real time
            // If they drifted too far apart (> 0.5s), snap visually.
            // Otherwise, trust the visual time to look smooth.
            if (Math.abs(this.visualTime - this.realTime) > 0.5) {
                this.visualTime = this.realTime;
            }
        },

        // --- 2. DRAGGABLE VIDEO LOGIC ---
        startDrag(e) {
            this.isDraggingVideo = true;
            // Calculate offset from the bottom-left corner
            // We use bottom/left CSS positioning
            const rect = this.$refs.videoContainer.getBoundingClientRect();
            
            // Store offset relative to mouse position
            // Note: using clientX/Y vs window dimensions
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: window.innerHeight - rect.bottom // Distance from bottom
            };
        },
        onDrag(e) {
            if (!this.isDraggingVideo) return;
            e.preventDefault();
            
            // Calculate new Left/Bottom values
            let newLeft = e.clientX - this.dragOffset.x;
            let newBottom = (window.innerHeight - e.clientY) - this.dragOffset.y;

            // Boundaries (Keep it on screen)
            const maxX = window.innerWidth - 260; // Width of player
            const maxY = window.innerHeight - 200;
            
            this.videoPos.x = Math.max(0, Math.min(newLeft, maxX));
            this.videoPos.y = Math.max(80, Math.min(newBottom, maxY)); // Min 80px to clear player bar
        },
        stopDrag() {
            this.isDraggingVideo = false;
        },

        // --- EXISTING LOGIC ---
        onYtStateChange(stateCode) {
            if (stateCode === 1) {
                this.isPlaying = true;
                this.lastTick = performance.now(); // Resync timer
            }
            if (stateCode === 2) this.isPlaying = false;
        },
        handleSeek(seconds) {
            this.visualTime = seconds; // Instant visual update
            if (this.activeSource === 'youtube' && this.$refs.ytEngine) {
                this.$refs.ytEngine.seekTo(seconds);
            }
        },
        handleMainButton() {
            if (this.activeSource === 'youtube') this.togglePlay();
        },
        toggleStructureMode() {
            if (this.structureMode === 'none') this.structureMode = 'sections';
            else if (this.structureMode === 'sections') this.structureMode = 'bars';
            else this.structureMode = 'none';
        },
        formatTime(s) {
            if (!s || isNaN(s)) return "0:00";
            const m = Math.floor(s / 60);
            const sc = Math.floor(s % 60);
            return `${m}:${sc < 10 ? '0' : ''}${sc}`;
        },
        // ... (Init/Create Player methods same as before) ...
        initYouTube() {
            if (window.YT && window.YT.Player) { this.createPlayer(); } 
            else {
                window.onYouTubeIframeAPIReady = () => this.createPlayer();
                if (!document.getElementById('yt-api-script')) {
                    const tag = document.createElement('script');
                    tag.id = 'yt-api-script';
                    tag.src = "https://www.youtube.com/iframe_api";
                    document.head.appendChild(tag);
                }
            }
        },
        createPlayer() {
            if (!document.getElementById('hidden-yt-player')) return;
            if (this.ytPlayer) return;
            this.ytPlayer = new YT.Player('hidden-yt-player', {
                height: '100%',
                width: '100%',
                playerVars: { 'autoplay': 1, 'controls': 1 }, 
                events: {
                    'onReady': (event) => {
                        if (this.currentVideoId && this.activeSource === 'youtube') {
                            event.target.loadVideoById(this.currentVideoId);
                        }
                    },
                    'onStateChange': (e) => {
                        if (e.data === YT.PlayerState.ENDED) this.nextTrack();
                        if (e.data === YT.PlayerState.PLAYING) this.isPlaying = true;
                        if (e.data === YT.PlayerState.PAUSED) this.isPlaying = false;
                    },
                    'onError': (e) => console.warn("YT Error:", e.data)
                }
            });
        },
        loadYt(id) {
            if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
                this.ytPlayer.loadVideoById(id);
            } else {
                this.createPlayer();
            }
        }
    },
    
    computed: {
        spotifySrc() {
            if (!this.currentTrack?.playback_links) return '';
            let link = this.currentTrack.playback_links.find(l => {
                const val = l.deep_link || l;
                return typeof val === 'string' && val.includes('spotify');
            });
            if (!link) return '';
            const url = link.deep_link || link;
            const match = url.match(/track\/([a-zA-Z0-9]+)/);
            return match ? `https://open.spotify.com/embed/track/${match[1]}?utm_source=generator&theme=0&autoplay=1` : '';
        },
        hasYt() { return !!this.getYouTubeId(this.currentTrack); },
        hasSpot() { return !!this.getSpotifyId(this.currentTrack); },
        
        // USE VISUAL TIME HERE
        fmtCurrent() { return this.formatTime(this.visualTime) },
        fmtDuration() { return this.formatTime(this.duration) },
        
        structureButtonLabel() {
            if (this.structureMode === 'none') return 'Visa Struktur';
            if (this.structureMode === 'sections') return 'Visar Repriser';
            return 'Visar Takter';
        },
        structureButtonIcon() {
            if (this.structureMode === 'none') return `<path d="M4 6h16M4 12h16M4 18h16"/>`;
            if (this.structureMode === 'sections') return `<path d="M4 4h16v16H4z M12 4v16"/>`;
            return `<path d="M4 6h1v12H4zm5 0h1v12H9zm5 0h1v12h-1zm5 0h1v12h-1z"/>`;
        }
    },

    template: /*html*/`
    <div v-if="currentTrack" class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-up z-50 flex flex-col">
        
        <div class="absolute bottom-full right-4 mb-2 w-80 z-40">
            <smart-nudge :track="currentTrack"></smart-nudge>
        </div>

        <progress-bar 
            :current-time="visualTime" 
            :duration="duration" 
            :disabled="activeSource !== 'youtube'"
            :structure-mode="structureMode"
            :track="currentTrack"
            @seek="handleSeek"
        ></progress-bar>

        <div class="flex items-center justify-between px-4 py-3 h-20 bg-white z-50 relative">
            
            <div class="flex items-center w-1/3 min-w-0 gap-3">
                <div class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center shrink-0 border border-gray-200 text-xl">🎵</div>
                <div class="flex flex-col min-w-0">
                    <div class="font-bold text-gray-900 truncate">{{ currentTrack.title }}</div>
                    <div class="flex items-center gap-2 mt-0.5">
                        <div class="text-[10px] text-gray-400 font-mono" v-if="activeSource === 'youtube'">
                            {{ fmtCurrent }} / {{ fmtDuration }}
                        </div>
                        <div class="text-[10px] text-green-600 font-bold" v-else>Spotify Active</div>
                        
                        <button 
                            v-if="currentTrack.sections && currentTrack.sections.length > 0"
                            @click="toggleStructureMode"
                            class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1"
                            :class="structureMode !== 'none' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'text-gray-400 border-gray-200 hover:border-gray-300'"
                            :title="structureButtonLabel"
                        >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="structureButtonIcon" stroke-width="2" stroke-linecap="round"></svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="flex flex-col items-center w-1/3">
                <player-controls 
                    :is-playing="isPlaying"
                    :is-shuffled="isShuffled"
                    :has-spotify="activeSource === 'spotify'"
                    @toggle-play="togglePlay"
                    @next="nextTrack"
                    @prev="prevTrack"
                    @shuffle="toggleShuffle"
                    @main-action="handleMainButton"
                ></player-controls>
            </div>

            <div class="w-1/3 flex justify-end items-center gap-2">
                <span class="text-[10px] text-gray-400 font-bold uppercase mr-2 hidden sm:inline">Källa</span>
                <button @click="setSource('youtube')" :disabled="!hasYt" class="p-1.5 rounded border transition-all" :class="activeSource === 'youtube' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white text-gray-400 hover:text-gray-600 opacity-50'">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                </button>
                <button @click="setSource('spotify')" :disabled="!hasSpot" class="p-1.5 rounded border transition-all" :class="activeSource === 'spotify' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white text-gray-400 hover:text-gray-600 opacity-50'">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.181.6.719.241 1.2zm.12-3.36C15.54 8.46 9.059 8.22 5.28 9.361c-.6.181-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.24z"/></svg>
                </button>
            </div>
        </div>

        <div ref="videoContainer"
             class="fixed bg-black shadow-2xl transition-shadow duration-300 overflow-hidden z-[60] rounded-lg border border-gray-700"
             :class="activeSource === 'youtube' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
             :style="{ width: '256px', height: '144px', left: videoPos.x + 'px', bottom: videoPos.y + 'px' }"
        >
            <div @mousedown="startDrag" class="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/80 to-transparent z-20 cursor-move flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div class="w-8 h-1 bg-white/30 rounded-full"></div>
            </div>

            <you-tube-engine 
                ref="ytEngine"
                :video-id="currentVideoId" 
                :active-source="activeSource"
                @state-change="onYtStateChange"
                @time-update="onTimeUpdate"
                @next="nextTrack"
                @error="handlePlayerError"
            ></you-tube-engine>
        </div>

        <div v-if="activeSource === 'spotify'" 
             class="fixed bottom-24 left-4 w-80 h-20 shadow-xl z-[60] rounded-lg overflow-hidden border border-gray-200 animate-fade-in bg-[#282828]">
            <iframe :src="spotifySrc" class="w-full h-full block" frameborder="0" scrolling="no" allow="autoplay; encrypted-media"></iframe>
        </div>

    </div>
    `
}