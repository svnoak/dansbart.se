import YouTubeEngine from './YouTubeEngine.js';
import SpotifyEngine from './SpotifyEngine.js';
import StructureEditor from '../modals/StructureEditor.js';
import BrokenLinkToast from '../toasts/BrokenLinkToast.js';
import { usePlayer } from '../../player.js'; 

import PlayerMobileView from './PlayerMobileView.js';
import PlayerDockedView from './PlayerDockedView.js';

export default {
    components: { 
        YouTubeEngine,
        SpotifyEngine,
        StructureEditor,
        BrokenLinkToast,
        PlayerMobileView,
        PlayerDockedView
    },
    
    setup() {
        return { ...usePlayer() };
    },
    
    data() {
        return {
            realTime: 0,
            duration: 0,
            visualTime: 0,
            lastTick: 0,
            rafId: null,
            ytPlayer: null,
            videoPos: { x: 16, y: 96 }, 
            isDraggingVideo: false,
            dragOffset: { x: 0, y: 0 },
            structureMode: 'none',
            showStructureEditor: false,
            isExpanded: false,
            windowWidth: window.innerWidth,
            availableVersions: [],
            currentVersionIndex: 0,
            isFetchingVersions: false,
            isNudgeVisible: false,
            ytPlayStartTime: null, // Track when YouTube playback started
            potentialBrokenState: null // For broken link toast
        }
    },

    mounted() {
        this.initYouTube();
        this.startSmoothLoop();
        window.addEventListener('mousemove', this.onDrag);
        window.addEventListener('mouseup', this.stopDrag);
        window.addEventListener('touchmove', this.onDrag, { passive: false });
        window.addEventListener('touchend', this.stopDrag);
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
            if (this.activeSource === 'spotify' && this.$refs.spotifyEngine) {
                val ? this.$refs.spotifyEngine.resume() : this.$refs.spotifyEngine.pause();
            }
            if (val) this.lastTick = performance.now();
        },
        activeSource(newVal, oldVal) {
            // Check for potential broken link: switching from youtube to spotify within 5 seconds
            if (oldVal === 'youtube' && newVal === 'spotify' && this.ytPlayStartTime) {
                const elapsed = (Date.now() - this.ytPlayStartTime) / 1000;
                if (elapsed < 5) {
                    // Find the YouTube link that was playing
                    const track = this.currentTrack;
                    const badLink = track?.playback_links?.find(l => l.platform === 'youtube');
                    if (badLink) {
                        this.potentialBrokenState = { track, badLink };
                        // Auto-dismiss after 8 seconds
                        setTimeout(() => {
                            if (this.potentialBrokenState?.track.id === track.id) {
                                this.potentialBrokenState = null;
                            }
                        }, 8000);
                    }
                }
            }
            
            if (newVal === 'spotify') {
                this.realTime = 0;
                this.visualTime = 0;
                this.duration = 0;
                this.videoPos = { x: 16, y: 96 };
                this.ytPlayStartTime = null; // Reset when switching away from YouTube
            } else if (newVal === 'youtube') {
                // Will be set when YouTube actually starts playing (in onYtStateChange)
                this.ytPlayStartTime = null;
            }
        },
        'currentTrack.id': {
            immediate: true,
            handler(newId) { 
                if (newId) {
                    this.fetchVersions(newId);
                    this.ytPlayStartTime = null; // Reset on track change
                }
            }
        }
    },

    computed: {
        spotifyTrackId() {
            if (!this.currentTrack?.playback_links) return null;
            // Use platform field to find Spotify link
            let link = this.currentTrack.playback_links.find(l => l.platform === 'spotify');
            if (!link) {
                // Fallback: check for old URL format
                link = this.currentTrack.playback_links.find(l => {
                    const val = l.deep_link || l;
                    return typeof val === 'string' && val.includes('spotify');
                });
            }
            if (!link) return null;
            const val = link.deep_link || link;
            // If it's already just an ID (no URL), return it directly
            if (typeof val === 'string' && !val.includes('/')) {
                return val;
            }
            // Otherwise extract from URL
            const match = val.match(/track\/([a-zA-Z0-9]+)/);
            return match ? match[1] : null;
        },
        spotifySrc() {
            const trackId = this.spotifyTrackId;
            if (!trackId) return '';
            return `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0&autoplay=1`;
        },
        hasYt() { return !!this.getYouTubeId(this.currentTrack); },
        hasSpot() { return !!this.getSpotifyId(this.currentTrack); },
        fmtCurrent() { return this.formatTime(this.visualTime) },
        fmtDuration() { return this.formatTime(this.duration) },
        
        // Calculate the bottom offset for elements above the player
        // Player bar: ~80px, Progress bar: 6px (or 32px with sections)
        playerBottomOffset() {
            const playerHeight = 80;
            const progressBarHeight = this.structureMode !== 'none' ? 32 : 6;
            return playerHeight + progressBarHeight;
        },
        
        // --- UPDATED HELPERS FOR NEW SCHEMA ---
        trackArtist() {
            const t = this.currentTrack;
            if (!t) return 'Unknown Artist';
            
            // 1. New Schema (Array of Objects)
            if (Array.isArray(t.artists) && t.artists.length > 0) {
                // Filter primaries first if you want, or just join all names
                return t.artists.map(a => a.name).join(', ');
            }
            
            // 2. Fallback (Old String)
            if (typeof t.artist_name === 'string' && t.artist_name) return t.artist_name;
            
            return 'Unknown Artist';
        },
        
        trackAlbum() {
            const t = this.currentTrack;
            if (!t) return '';
            
            // 1. New Schema (Object)
            if (t.album && t.album.title) return t.album.title;
            
            // 2. Fallback (Old String)
            if (typeof t.album_name === 'string') return t.album_name;
            
            return '';
        }
    },

    methods: {
        onResize() {
            this.windowWidth = window.innerWidth;
            if (this.windowWidth >= 768) this.isExpanded = false;
        },
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
            this.handleVersionPreview(this.availableVersions[newIndex]?.structure_data);
            if (this.structureMode === 'none') this.structureMode = 'sections';
        },
        handleVersionPreview(structureData) {
            if (this.currentTrack && structureData) {
                this.currentTrack.bars = structureData.bars || [];
                this.currentTrack.sections = structureData.sections || [];
                this.currentTrack.section_labels = structureData.labels || [];
            }
        },
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
        handleToggleRepeat() { this.cycleRepeatMode(); },
        startSmoothLoop() {
            const loop = (now) => {
                // Smooth interpolation for both YouTube and Spotify
                if (this.isPlaying && this.duration > 0) {
                    const delta = (now - this.lastTick) / 1000;
                    if (delta < 1.0) this.visualTime = Math.min(this.visualTime + delta, this.duration);
                }
                this.lastTick = now;
                this.rafId = requestAnimationFrame(loop);
            };
            this.rafId = requestAnimationFrame(loop);
        },
        onTimeUpdate({ currentTime, duration }) {
            this.realTime = currentTime;
            this.duration = duration;
            if (Math.abs(this.visualTime - this.realTime) > 0.5) this.visualTime = this.realTime;
        },
        handleSeek(seconds) {
            this.visualTime = seconds; 
            if (this.activeSource === 'youtube' && this.$refs.ytEngine) this.$refs.ytEngine.seekTo(seconds);
            if (this.activeSource === 'spotify' && this.$refs.spotifyEngine) this.$refs.spotifyEngine.seek(seconds);
        },
        handleTrackEnd() {
            if (this.showStructureEditor) { this.isPlaying = false; return; }
            if (this.repeatMode === 'one') {
                this.handleSeek(0);
                if(this.$refs.ytEngine) this.$refs.ytEngine.play(); 
            } else {
                this.nextTrack();
            }
        },
        handleMainButton() { if (this.activeSource === 'youtube') this.togglePlay(); },
        startDrag(e) {
            this.isDraggingVideo = true;
            const rect = this.$refs.videoContainer.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            this.dragOffset = { x: clientX - rect.left, y: window.innerHeight - rect.bottom };
        },
        onDrag(e) {
            if (this.isExpanded) return;
            if (!this.isDraggingVideo) return;
            // Don't allow dragging on desktop - video is fixed position
            if (this.windowWidth >= 768) return;
            if (e.cancelable) e.preventDefault(); 
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let newLeft = clientX - this.dragOffset.x;
            let newBottom = (window.innerHeight - clientY) - this.dragOffset.y;
            const videoWidth = 160;
            const maxX = window.innerWidth - videoWidth - 16; 
            const maxY = window.innerHeight - 200;
            this.videoPos.x = Math.max(0, Math.min(newLeft, maxX));
            this.videoPos.y = Math.max(80, Math.min(newBottom, maxY)); 
        },
        stopDrag() { this.isDraggingVideo = false; },
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
            if (window.YT && window.YT.Player) { } 
            else {
                window.onYouTubeIframeAPIReady = () => {};
                if (!document.getElementById('yt-api-script')) {
                    const tag = document.createElement('script');
                    tag.id = 'yt-api-script';
                    tag.src = "https://www.youtube.com/iframe_api";
                    document.head.appendChild(tag);
                }
            }
        },
        onSpotifyPlaybackUpdate({ isPaused, position, duration }) {
            if (this.activeSource === 'spotify') {
                this.isPlaying = !isPaused;
                this.duration = duration;
                // Sync position only if drift is significant (like YouTube)
                if (Math.abs(this.visualTime - position) > 0.5) {
                    this.visualTime = position;
                }
                // Reset lastTick when playback state changes for smooth interpolation
                if (!isPaused) {
                    this.lastTick = performance.now();
                }
            }
        },
        onYtStateChange(stateCode) {
            if (stateCode === 1) { 
                this.isPlaying = true; 
                this.lastTick = performance.now();
                // Track when YouTube playback actually started (for broken link detection)
                if (!this.ytPlayStartTime) {
                    this.ytPlayStartTime = Date.now();
                }
            }
            if (stateCode === 2) this.isPlaying = false;
            if (stateCode === 0) this.handleTrackEnd();
        },
        handlePlayerError(e) {
            console.warn("YouTube Error:", e);
            if (this.playerStore && this.playerStore.handlePlayerError) this.playerStore.handlePlayerError(e.data);
            else this.nextTrack(); 
        }
    },

    template: /*html*/`
    <div v-if="currentTrack">
    
        <player-mobile-view
            :current-track="currentTrack"
            :available-versions="availableVersions"
            :current-version-index="currentVersionIndex"
            :is-playing="isPlaying"
            :is-shuffled="isShuffled"
            :repeat-mode="repeatMode"
            :structure-mode="structureMode"
            :active-source="activeSource"
            :visual-time="visualTime"
            :duration="duration"
            :is-expanded="isExpanded"
            :track-artist="trackArtist"
            :track-album="trackAlbum"
            :broken-state="potentialBrokenState"
            :has-yt="hasYt"
            :has-spot="hasSpot"
            @close="isExpanded = false"
            @set-source="setSource"
            @cycle-version="cycleVersion"
            @toggle-structure-mode="toggleStructureMode"
            @seek="handleSeek"
            @toggle-play="togglePlay"
            @next="nextTrack"
            @prev="prevTrack"
            @shuffle="toggleShuffle"
            @toggle-repeat="handleToggleRepeat"
            @jump="handleJump"
            @nudge-visibility="isNudgeVisible = $event"
            @dismiss-broken="potentialBrokenState = null"
        ></player-mobile-view>

        <player-docked-view
            :current-track="currentTrack"
            :available-versions="availableVersions"
            :current-version-index="currentVersionIndex"
            :is-playing="isPlaying"
            :is-shuffled="isShuffled"
            :repeat-mode="repeatMode"
            :structure-mode="structureMode"
            :active-source="activeSource"
            :visual-time="visualTime"
            :duration="duration"
            :is-expanded="isExpanded"
            :has-yt="hasYt"
            :has-spot="hasSpot"
            :fmt-current="fmtCurrent"
            :fmt-duration="fmtDuration"
            @expand="isExpanded = true"
            @set-source="setSource"
            @cycle-version="cycleVersion"
            @toggle-structure-mode="toggleStructureMode"
            @seek="handleSeek"
            @toggle-play="togglePlay"
            @next="nextTrack"
            @prev="prevTrack"
            @shuffle="toggleShuffle"
            @toggle-repeat="handleToggleRepeat"
            @jump="handleJump"
        ></player-docked-view>

        <div ref="videoContainer"
             class="fixed bg-black shadow-2xl transition-all duration-300 ease-in-out overflow-hidden border border-gray-700"
             :class="[
                 activeSource === 'youtube' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                 (isExpanded && windowWidth < 768) ? 'z-[101] rounded-xl' : 'z-[60] rounded-lg'
             ]"
             :style="(isExpanded && windowWidth < 768) ? {
                 top: '120px', 
                 left: '1.5rem', 
                 width: 'calc(100% - 3rem)', 
                 height: 'auto', 
                 aspectRatio: '16/9', 
                 bottom: 'auto'
             } : (windowWidth >= 768) ? {
                 width: '400px', 
                 height: '225px', 
                 left: '16px', 
                 bottom: (playerBottomOffset + 12) + 'px'
             } : {
                 width: '160px', 
                 height: '90px', 
                 left: videoPos.x + 'px', 
                 bottom: (videoPos.y + (structureMode !== 'none' ? 32 : 0) + (isNudgeVisible ? 90 : 0)) + 'px'
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
        
        <div class="fixed shadow-xl rounded-xl overflow-hidden border border-gray-700 bg-[#282828] transition-all duration-300"
             :class="[
                 activeSource === 'spotify' ? 'opacity-100 pointer-events-auto animate-fade-in' : 'opacity-0 pointer-events-none',
                 (isExpanded && windowWidth < 768) ? 'z-[101]' : 'z-[60]'
             ]"
             :style="(isExpanded && windowWidth < 768) ? {
                 top: '120px',
                 left: '1.5rem', 
                 width: 'calc(100% - 3rem)', 
                 height: '82px',
                 bottom: 'auto'
             } : (windowWidth >= 768) ? {
                 width: '400px', 
                 height: '82px', 
                 left: '16px', 
                 bottom: (playerBottomOffset + 12) + 'px'
             } : {
                 width: '300px', 
                 height: '82px', 
                 left: '16px', 
                 bottom: (structureMode !== 'none' ? 128 : 96) + 'px'
             }">
            <spotify-engine 
                ref="spotifyEngine" 
                :track-id="spotifyTrackId" 
                :active-source="activeSource" 
                @playback-update="onSpotifyPlaybackUpdate">
            </spotify-engine>
        </div>

        <structure-editor :is-open="showStructureEditor" :track="currentTrack" :current-time="visualTime" :duration="duration" :is-playing="isPlaying" @close="showStructureEditor = false" @seek="handleSeek" @toggle-play="togglePlay"></structure-editor>

        <broken-link-toast
            class="hidden md:block"
            :broken-state="potentialBrokenState"
            :structure-mode="structureMode"
            @close="potentialBrokenState = null"
        ></broken-link-toast>

    </div>
    `
}