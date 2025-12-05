import SmartNudge from './SmartNudge.js';
import SectionVoting from './SectionVoting.js';
import YouTubeEngine from './player/YouTubeEngine.js';
import PlayerControls from './player/PlayerControls.js';
import ProgressBar from './player/ProgressBar.js';
import { usePlayer } from '../player.js'; 
import StructureEditor from './StructureEditor.js';
import SparklesIcon from '../icons/SparklesIcon.js';

export default {
    components: { 
        SmartNudge, 
        SectionVoting,
        YouTubeEngine, 
        PlayerControls, 
        ProgressBar, 
        StructureEditor,
        SparklesIcon
    },
    
    setup() {
        const playerStore = usePlayer();
        return { ...playerStore };
    },
    
    data() {
        return {
            // Source of Truth
            realTime: 0,
            duration: 0,
            
            // Visual State
            visualTime: 0,
            lastTick: 0,
            rafId: null,

            // Video Window State
            ytPlayer: null,
            videoPos: { x: 16, y: 96 }, 
            isDraggingVideo: false,
            dragOffset: { x: 0, y: 0 },
            
            // UI State
            structureMode: 'none',
            showStructureEditor: false,
            
            // RESPONSIVE STATE (CRITICAL)
            isExpanded: false, // Mobile overlay open?
            windowWidth: window.innerWidth, // Track screen width
            
            // Version Carousel
            availableVersions: [],
            currentVersionIndex: 0,
            isFetchingVersions: false,
        }
    },

    mounted() {
        this.ytPlayer = null; 
        this.initYouTube();
        this.startSmoothLoop();
        
        // Drag Events (Mouse)
        window.addEventListener('mousemove', this.onDrag);
        window.addEventListener('mouseup', this.stopDrag);
        
        // Drag Events (Touch)
        window.addEventListener('touchmove', this.onDrag, { passive: false });
        window.addEventListener('touchend', this.stopDrag);

        // Resize Listener (For responsive video logic)
        window.addEventListener('resize', this.onResize);
    },

    beforeUnmount() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        window.removeEventListener('mousemove', this.onDrag);
        window.removeEventListener('mouseup', this.stopDrag);
        window.removeEventListener('touchmove', this.onDrag);
        window.removeEventListener('touchend', this.stopDrag);
        window.removeEventListener('resize', this.onResize);
    },

    watch: {
        isPlaying(val) {
            if (this.activeSource === 'youtube' && this.$refs.ytEngine) {
                val ? this.$refs.ytEngine.play() : this.$refs.ytEngine.pause();
            }
            if (val) this.lastTick = performance.now();
        },
        
        activeSource(val) {
            if (val === 'spotify') {
                this.realTime = 0;
                this.visualTime = 0;
                this.duration = 0;
                this.videoPos = { x: 16, y: 96 }; 
            }
        },
        'currentTrack.id': {
            immediate: true,
            handler(newId) {
                if (newId) this.fetchVersions(newId);
            }
        }
    },

    methods: {
        onResize() {
            this.windowWidth = window.innerWidth;
            // If user resizes window to desktop size, close mobile overlay
            if (this.windowWidth >= 768) {
                this.isExpanded = false;
            }
        },

        // --- VERSION HANDLING ---
        async fetchVersions(trackId) {
            this.availableVersions = [];
            this.currentVersionIndex = 0;
            this.isFetchingVersions = true;
            try {
                const res = await fetch(`api/tracks/${trackId}/structure-versions`);
                if (res.ok) {
                    this.availableVersions = await res.json();
                    const activeIdx = this.availableVersions.findIndex(v => v.is_active);
                    this.currentVersionIndex = activeIdx >= 0 ? activeIdx : 0;
                }
            } catch (e) { console.warn("Could not fetch versions", e); } 
            finally { this.isFetchingVersions = false; }
        },

        cycleVersion(direction) {
            if (!Array.isArray(this.availableVersions) || this.availableVersions.length <= 1) return;
            const len = this.availableVersions.length;
            const dir = Number(direction) || 0;
            if (dir === 0) return;

            const newIndex = (this.currentVersionIndex + dir + len) % len;
            this.currentVersionIndex = newIndex;
            const version = this.availableVersions[newIndex];

            this.handleVersionPreview(version?.structure_data);
            if (this.structureMode === 'none') this.structureMode = 'sections';
        },

        handleVersionPreview(structureData) {
            if (this.currentTrack && structureData) {
                this.currentTrack.bars = structureData.bars || [];
                this.currentTrack.sections = structureData.sections || [];
                this.currentTrack.section_labels = structureData.labels || [];
            }
        },

        // --- CONTROLS ---
        handleJump(direction) {
            if (this.structureMode !== 'none' && this.currentTrack?.bars?.length > 0) {
                const bars = this.currentTrack.bars;
                let nextBarIdx = bars.findIndex(b => b > this.visualTime);
                let currentIdx = nextBarIdx === -1 ? bars.length - 1 : Math.max(0, nextBarIdx - 1);
                let targetIdx = currentIdx + (direction * 4);
                if (targetIdx < 0) targetIdx = 0;
                if (targetIdx >= bars.length) targetIdx = bars.length - 1;
                this.handleSeek(bars[targetIdx]);
            } else {
                let newTime = this.visualTime + (direction * 10);
                if (newTime < 0) newTime = 0;
                if (newTime > this.duration) newTime = this.duration;
                this.handleSeek(newTime);
            }
        },
        
        handleToggleRepeat() {
            this.cycleRepeatMode();
        },

        // --- ANIMATION & SEEK ---
        startSmoothLoop() {
            const loop = (now) => {
                if (this.isPlaying && this.activeSource === 'youtube' && this.duration > 0) {
                    const delta = (now - this.lastTick) / 1000;
                    if (delta < 1.0) { 
                        this.visualTime = Math.min(this.visualTime + delta, this.duration);
                    }
                }
                this.lastTick = now;
                this.rafId = requestAnimationFrame(loop);
            };
            this.rafId = requestAnimationFrame(loop);
        },
        onTimeUpdate({ currentTime, duration }) {
            this.realTime = currentTime;
            this.duration = duration;
            if (Math.abs(this.visualTime - this.realTime) > 0.5) {
                this.visualTime = this.realTime;
            }
        },
        handleSeek(seconds) {
            this.visualTime = seconds; 
            if (this.activeSource === 'youtube' && this.$refs.ytEngine) {
                this.$refs.ytEngine.seekTo(seconds);
            }
        },
        handleTrackEnd() {
            if (this.showStructureEditor) {
                this.isPlaying = false;
                return;
            }
            if (this.repeatMode === 'one') {
                this.handleSeek(0);
                if(this.$refs.ytEngine) this.$refs.ytEngine.play(); 
            } else {
                this.nextTrack();
            }
        },
        handleMainButton() {
            if (this.activeSource === 'youtube') this.togglePlay();
        },

        // --- DRAGGING ---
        startDrag(e) {
            this.isDraggingVideo = true;
            const rect = this.$refs.videoContainer.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            this.dragOffset = {
                x: clientX - rect.left,
                y: window.innerHeight - rect.bottom 
            };
        },
        onDrag(e) {
            if (this.isExpanded) return; // No dragging in expanded mode
            if (!this.isDraggingVideo) return;
            if (e.cancelable) e.preventDefault(); 
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;

            let newLeft = clientX - this.dragOffset.x;
            let newBottom = (window.innerHeight - clientY) - this.dragOffset.y;
            const maxX = window.innerWidth - 260; 
            const maxY = window.innerHeight - 200;
            
            this.videoPos.x = Math.max(0, Math.min(newLeft, maxX));
            this.videoPos.y = Math.max(80, Math.min(newBottom, maxY)); 
        },
        stopDrag() {
            this.isDraggingVideo = false;
        },

        // --- MISC HELPERS ---
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
        onYtStateChange(stateCode) {
            if (stateCode === 1) {
                this.isPlaying = true;
                this.lastTick = performance.now();
            }
            if (stateCode === 2) {
                this.isPlaying = false;
            }
            if (stateCode === 0) {
                this.handleTrackEnd();
            }
        },
        handlePlayerError(e) {
            console.warn("YouTube Error:", e);
            if (this.playerStore && this.playerStore.handlePlayerError) {
                this.playerStore.handlePlayerError(e.data);
            } else {
                // Fallback if usePlayer isn't directly exposed as 'playerStore'
                // (Since you returned { ...playerStore } in setup, this might be available directly)
                // Try calling the mapped action directly if it exists in your template scope
                this.nextTrack(); 
            }
        },
        createPlayer() {
            // (Standard YT create logic if needed, but <youtube-engine> handles most)
        },
        openEditor() {
            this.showStructureEditor = true;
            if (this.isPlaying) this.togglePlay(); 
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
        fmtCurrent() { return this.formatTime(this.visualTime) },
        fmtDuration() { return this.formatTime(this.duration) },
        structureButtonLabel() {
            if (this.structureMode === 'sections') return 'Visa takter';
            if (this.structureMode === 'bars') return 'Dölj';
            return 'Visa repriser';
        },
        structureButtonIcon() {
            if (this.structureMode === 'none') return `<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`; 
            if (this.structureMode === 'sections') return `<path d="M4 4h16v16H4z M12 4v16"/>`;
            return `<path d="M4 6h1v12H4zm5 0h1v12H9zm5 0h1v12h-1zm5 0h1v12h-1z"/>`;
        }
    },

template: /*html*/`
    <div v-if="currentTrack">

        <div class="fixed inset-0 bg-white z-[100] flex flex-col transition-transform duration-300 ease-in-out md:hidden"
             :class="isExpanded ? 'translate-y-0' : 'translate-y-full'">
            
            <div class="flex items-center justify-between px-6 pt-12 pb-4 shrink-0 bg-white z-10">
                <button @click="isExpanded = false" class="text-gray-500 p-2 -ml-2">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                
                <div class="flex bg-gray-100 rounded-lg p-1 gap-1">
                    <button @click="setSource('youtube')" 
                            class="px-3 py-1 text-[10px] font-bold uppercase rounded transition-all"
                            :class="activeSource === 'youtube' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'">
                        YouTube
                    </button>
                    <button @click="setSource('spotify')" 
                            class="px-3 py-1 text-[10px] font-bold uppercase rounded transition-all"
                            :class="activeSource === 'spotify' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'">
                        Spotify
                    </button>
                </div>
            </div>

            <div class="flex-1 flex flex-col px-6 overflow-y-auto min-h-0 pb-10">
                
                <div class="w-full aspect-video bg-gray-50 rounded-xl mb-6 shadow-inner shrink-0 border border-gray-100"></div>

                <div class="mb-6 shrink-0">
                    <h2 class="text-2xl font-extrabold text-gray-900 leading-tight mb-0.5">
                        {{ currentTrack.title }}
                    </h2>
                    
                    <p class="text-lg text-indigo-600 font-bold mb-2">
                        {{ currentTrack.artist_name || 'Okänd artist' }}
                    </p>

                    <div class="flex items-center flex-wrap gap-x-2 text-sm text-gray-500 font-medium">
                        <span v-if="currentTrack.album" class="truncate max-w-[200px]">
                            {{ currentTrack.album_name }}
                        </span>
                        
                        <span v-if="currentTrack.album && currentTrack.dance_style" class="text-gray-300">•</span>
                        
                        <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs uppercase tracking-wide font-bold">
                            {{ currentTrack.dance_style || 'Style' }}
                        </span>
                    </div>
                </div>

                <div class="flex-1 min-h-100"></div>

                <div class="mb-4 shrink-0">
                    <smart-nudge :track="currentTrack"></smart-nudge>
                    <version-voting 
                        v-if="structureMode !== 'none'" 
                        :track="currentTrack" 
                        :active-version="availableVersions[currentVersionIndex]"
                    ></version-voting>
                </div>

                <div class="flex-1"></div>

                <div class="flex justify-between items-end mb-2 shrink-0">
                    <div v-if="availableVersions.length > 1" class="flex items-center bg-gray-100 rounded-full border border-gray-200 px-2 py-1 h-8">
                        <button @click="cycleVersion(-1)" class="w-6 h-full flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold">‹</button>
                        <span class="text-xs font-mono font-bold text-gray-700 px-2 pt-0.5">v.{{ currentVersionIndex + 1 }}</span>
                        <button @click="cycleVersion(1)" class="w-6 h-full flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold">›</button>
                    </div>
                    <div v-else></div> 

                    <button @click="toggleStructureMode" 
                            class="flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wide transition-all h-8"
                            :class="structureMode !== 'none' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-500 border-gray-200'">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="structureButtonIcon" stroke-width="2"></svg>
                        {{ structureButtonLabel }}
                    </button>
                </div>

                <div class="h-12 mb-4 relative w-full shrink-0 flex items-end">
                     <progress-bar :current-time="visualTime" :duration="duration" :disabled="activeSource !== 'youtube'" :structure-mode="structureMode" :track="currentTrack" @seek="handleSeek"></progress-bar>
                </div>

                <div class="shrink-0">
                    <player-controls 
                        :is-playing="isPlaying" :is-shuffled="isShuffled" :repeat-mode="repeatMode"
                        :has-spotify="activeSource === 'spotify'" :structure-mode="structureMode" :full-mode="true"              
                        @toggle-play="togglePlay" @next="nextTrack" @prev="prevTrack" @shuffle="toggleShuffle" @toggle-repeat="handleToggleRepeat" @jump="handleJump"
                    ></player-controls>
                </div>

            </div>
        </div>

        <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-up z-50 flex flex-col transition-all duration-300"
             :class="isExpanded ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100'">
             
             <structure-editor :is-open="showStructureEditor" :track="currentTrack" :current-time="visualTime" :duration="duration" :is-playing="isPlaying" @close="showStructureEditor = false" @seek="handleSeek" @toggle-play="togglePlay"></structure-editor>

            <div class="flex absolute bottom-full left-0 right-0 md:left-auto md:right-4 mb-2 md:mb-7 z-40 flex-col gap-2 pointer-events-auto px-2 md:px-0 md:w-80">
                <smart-nudge :track="currentTrack"></smart-nudge>
                <version-voting v-if="structureMode !== 'none'" :track="currentTrack" :active-version="availableVersions[currentVersionIndex]"></version-voting>
            </div>

            <div class="hidden md:block relative w-full">
                <progress-bar :current-time="visualTime" :duration="duration" :disabled="activeSource !== 'youtube'" :structure-mode="structureMode" :track="currentTrack" @seek="handleSeek"></progress-bar>
            </div>
            
            <div class="md:hidden w-full h-1 bg-gray-200">
                <div class="h-full bg-indigo-600" :style="{ width: (duration ? (visualTime/duration)*100 : 0) + '%' }"></div>
            </div>

            <div class="flex items-center justify-between px-4 py-3 h-20 bg-white cursor-pointer md:cursor-default" 
                 @click.self="!$event.target.closest('button') && (isExpanded = true)">
                 
                 <div class="flex items-center w-2/3 md:w-1/3 gap-3" @click="isExpanded = true">
                    <div class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-xl shrink-0">🎵</div>
                    <div class="min-w-0">
                        <div class="font-bold truncate text-sm md:text-base">{{ currentTrack.title }}</div>
                        <div class="text-[10px] text-gray-400 md:hidden">Tap to expand</div>
                        <div class="text-[10px] text-gray-400 font-mono hidden md:block" v-if="activeSource === 'youtube'">{{ fmtCurrent }} / {{ fmtDuration }}</div>
                        
                        <div class="hidden md:flex items-center gap-2 mt-1">
                            <button v-if="currentTrack.sections?.length" @click.stop="toggleStructureMode" class="text-[9px] font-bold uppercase border px-1.5 rounded" :class="structureMode!=='none'?'bg-indigo-100 text-indigo-700':'bg-white text-gray-400'">{{ structureButtonLabel }}</button>
                             <div v-if="availableVersions.length > 1 && structureMode !== 'none'" class="flex items-center bg-gray-50 rounded-full border px-1">
                                <button @click.stop="cycleVersion(-1)" class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold text-[10px]">‹</button>
                                <span class="text-[9px] font-mono font-bold text-gray-700 px-1">v{{ currentVersionIndex + 1 }}</span>
                                <button @click.stop="cycleVersion(1)" class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold text-[10px]">›</button>
                            </div>
                        </div>
                    </div>
                 </div>

                 <div class="flex justify-end md:justify-center w-1/3 md:w-1/3">
                    <player-controls :is-playing="isPlaying" :is-shuffled="isShuffled" :repeat-mode="repeatMode" :has-spotify="activeSource === 'spotify'" :structure-mode="structureMode" :full-mode="false" @toggle-play="togglePlay" @next="nextTrack" @prev="prevTrack" @shuffle="toggleShuffle" @toggle-repeat="handleToggleRepeat" @jump="handleJump"></player-controls>
                 </div>
                 
                 <div class="hidden md:flex w-1/3 justify-end items-center gap-2">
                    <span class="text-[10px] text-gray-400 font-bold uppercase mr-2">Källa</span>
                    <button @click="setSource('youtube')" :disabled="!hasYt" class="p-1.5 rounded border transition-all" :class="activeSource === 'youtube' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white text-gray-400 hover:text-gray-600 opacity-50'">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                    </button>
                    <button @click="setSource('spotify')" :disabled="!hasSpot" class="p-1.5 rounded border transition-all" :class="activeSource === 'spotify' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white text-gray-400 hover:text-gray-600 opacity-50'">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.181.6.719.241 1.2zm.12-3.36C15.54 8.46 9.059 8.22 5.28 9.361c-.6.181-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.24z"/></svg>
                    </button>
                 </div>
            </div>
        </div>

        <div ref="videoContainer"
             class="fixed bg-black shadow-2xl transition-all duration-500 ease-in-out overflow-hidden border border-gray-700"
             :class="[
                 activeSource === 'youtube' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                 (isExpanded && windowWidth < 768) ? 'z-[101] rounded-xl' : 'z-[60] rounded-lg'
             ]"
             :style="(isExpanded && windowWidth < 768) ? {
                 /* ALIGNMENT: Header=~88px. Top=92px. */
                 top: '92px', 
                 left: '1.5rem', 
                 width: 'calc(100% - 3rem)', 
                 height: 'auto', 
                 aspectRatio: '16/9', 
                 bottom: 'auto'
             } : {
                 /* MINI PLAYER */
                 width: '160px', 
                 height: '90px', 
                 left: videoPos.x + 'px', 
                 bottom: (videoPos.y + (structureMode !== 'none' ? 32 : 0)) + 'px'
             }"
        >
            <div v-if="!isExpanded || windowWidth >= 768"
                 @mousedown="startDrag" @touchstart.prevent="startDrag"
                 @click="!isExpanded && windowWidth < 768 && (isExpanded = true)"
                 class="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/80 to-transparent z-20 cursor-move flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div class="w-8 h-1 bg-white/30 rounded-full"></div>
            </div>
            <you-tube-engine ref="ytEngine" :video-id="currentVideoId" :active-source="activeSource" @state-change="onYtStateChange" @time-update="onTimeUpdate" @next="handleTrackEnd" @error="handlePlayerError"></you-tube-engine>
        </div>
        
        <div v-if="activeSource === 'spotify'" class="fixed left-4 w-80 h-20 shadow-xl z-[60] rounded-lg overflow-hidden border border-gray-200 animate-fade-in bg-[#282828] transition-all duration-300" :class="structureMode !== 'none' ? 'bottom-32' : 'bottom-24'">
            <iframe :src="spotifySrc" class="w-full h-full block" frameborder="0" scrolling="no" allow="autoplay; encrypted-media"></iframe>
        </div>

    </div>
    `
}