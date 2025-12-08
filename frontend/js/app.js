import { createApp, onMounted, onUnmounted, ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { useTracks } from './tracks.js';
import { usePlayer } from './player.js';

// Components
import TrackCard from './components/TrackCard.js';
import FilterBar from './components/FilterBar.js';
import GlobalPlayer from './components/player/GlobalPlayer.js'; 
import StatsDashboard from './components/StatsDashboard.js';

const app = createApp({
    components: {
        'track-card': TrackCard,
        'filter-bar': FilterBar,
        'global-player': GlobalPlayer,
        'stats-dashboard': StatsDashboard
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

        onMounted(() => {
            trackLogic.fetchTracks();

            // Set up Intersection Observer for infinite scroll
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

app.mount('#app');