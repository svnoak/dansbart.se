import { createApp, onMounted, onUnmounted, ref, watch } from 'vue';
import { useTracks } from './tracks.js';
import { usePlayer } from './player.js';

// Components
import TrackCard from './components/TrackCard.js';
import FilterBar from './components/FilterBar.js';
import GlobalPlayer from './components/player/GlobalPlayer.js';
import StatsDashboard from './components/StatsDashboard.js';
import Header from './components/Header.js';
import CookieConsent from './components/CookieConsent.js';

const app = createApp({
    components: {
        'track-card': TrackCard,
        'filter-bar': FilterBar,
        'global-player': GlobalPlayer,
        'stats-dashboard': StatsDashboard,
        'site-header': Header,
        'cookie-consent': CookieConsent
    },
    setup() {
        const trackLogic = useTracks();
        const playerLogic = usePlayer();
        const { isPlaying, togglePlay } = playerLogic;

        const scrollTrigger = ref(null);
        let observer = null;

        const handlePlay = (track, sourcePreference = null) => {
            const list = trackLogic.tracks.value;
            const index = list.findIndex(t => t.id === track.id);

            if (index !== -1) {
                playerLogic.playContext(list, index, sourcePreference);
            }
        };

        const setupScrollObserver = () => {
            // Disconnect existing observer if any
            if (observer) {
                observer.disconnect();
            }

            // Create new observer
            observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && !trackLogic.loading.value && !trackLogic.loadingMore.value) {
                    trackLogic.loadMore();
                }
            }, { rootMargin: '100px' });

            // Watch for the trigger element
            const checkTrigger = setInterval(() => {
                const el = document.querySelector('[data-scroll-trigger]');
                if (el) {
                    observer.observe(el);
                    clearInterval(checkTrigger);
                }
            }, 100);
        };

        onMounted(() => {
            trackLogic.fetchTracks();
            setupScrollObserver();

            // Re-setup observer whenever tracks are reset (filters change)
            watch(() => trackLogic.tracks.value.length, (newLen, oldLen) => {
                // If tracks were reset (length became 0 or jumped back), re-setup observer
                if (newLen === 0 || (oldLen > newLen && newLen <= 20)) {
                    setTimeout(setupScrollObserver, 100);
                }
            });
        });

        onUnmounted(() => {
            if (observer) observer.disconnect();
        });

        return { 
            ...trackLogic, 
            ...playerLogic,
            handlePlay,
            togglePlay,
            scrollTrigger
        };
    }
});

app.config.devtools = true;

app.mount('#app');