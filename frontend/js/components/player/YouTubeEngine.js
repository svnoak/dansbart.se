import { useConsent } from '../../consent.js';

export default {
    props: ['videoId', 'activeSource'],
    emits: ['ready', 'state-change', 'error', 'time-update', 'next'],

    setup() {
        const { consentStatus } = useConsent();
        return { consentStatus };
    },

    template: `
    <div class="w-full h-full">
        <div id="hidden-yt-player" class="w-full h-full"></div>
    </div>
    `,

    data() {
        return {
            ytPlayer: null,
            timer: null,
            apiInitialized: false
        }
    },

    mounted() {
        // Only initialize API if consent is granted
        if (this.consentStatus === 'granted') {
            this.initAPI();
        }

        // Listen for consent changes
        window.addEventListener('consent-changed', this.onConsentChanged);
    },

    beforeUnmount() {
        this.stopTimer();
        window.removeEventListener('consent-changed', this.onConsentChanged);
    },

    watch: {
        videoId(newId) {
            if (newId && this.activeSource === 'youtube') {
                this.$nextTick(() => this.loadVideo(newId));
            }
        },
        activeSource(newSource) {
            if (newSource === 'youtube') {
                if (this.videoId) this.loadVideo(this.videoId);
            } else {
                // Pause internally if parent switches source
                if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
                    this.ytPlayer.pauseVideo();
                }
                this.stopTimer();
            }
        }
    },

    methods: {
        onConsentChanged(event) {
            if (event.detail.status === 'granted' && !this.apiInitialized) {
                this.initAPI();
            }
        },
        initAPI() {
            // Only load if consent is granted
            if (this.consentStatus !== 'granted') return;

            this.apiInitialized = true;

            if (window.YT && window.YT.Player) {
                this.createPlayer();
            } else {
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
            // Safety: Wait for DOM
            const container = document.getElementById('hidden-yt-player');
            if (!container) {
                setTimeout(() => this.createPlayer(), 100);
                return;
            }
            
            if (this.ytPlayer) return;

            this.ytPlayer = new YT.Player('hidden-yt-player', {
                height: '100%',
                width: '100%',
                playerVars: { 'autoplay': 1, 'controls': 0, 'disablekb': 1 }, 
                events: {
                    'onReady': (e) => {
                        this.$emit('ready');
                        if (this.videoId && this.activeSource === 'youtube') {
                            e.target.loadVideoById(this.videoId);
                        }
                    },
                    'onStateChange': (e) => {
                        // FIX: Emit directly, don't call 'this.onYtStateChange'
                        this.$emit('state-change', e.data);
                        
                        if (e.data === YT.PlayerState.PLAYING) this.startTimer();
                        else this.stopTimer();
                        
                        if (e.data === YT.PlayerState.ENDED) this.$emit('next');
                    },
                    'onError': (e) => this.$emit('error', e.data)
                }
            });
        },

        loadVideo(id) {
            if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
                this.ytPlayer.loadVideoById(id);
            } else {
                this.createPlayer();
            }
        },

        // --- Public Methods (Parent calls these via $refs.ytEngine.play()) ---
        play() { this.ytPlayer?.playVideo(); },
        pause() { this.ytPlayer?.pauseVideo(); },
        seekTo(seconds) { this.ytPlayer?.seekTo(seconds, true); },

        // --- Internal Timer ---
        startTimer() {
            this.stopTimer();
            this.timer = setInterval(() => {
                if (this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
                    const curr = this.ytPlayer.getCurrentTime();
                    const dur = this.ytPlayer.getDuration();
                    this.$emit('time-update', { currentTime: curr, duration: dur });
                }
            }, 500);
        },
        stopTimer() {
            if (this.timer) clearInterval(this.timer);
        }
    }
};