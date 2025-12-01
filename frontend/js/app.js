import { createApp, onMounted, ref, toRaw } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { useTracks } from './tracks.js';
import { usePlayer } from './player.js';

// Components
import TrackCard from './components/TrackCard.js';
import FilterBar from './components/FilterBar.js';
import MusicPlayer from './components/MusicPlayer.js'; 
import BrokenLinkToast from './components/BrokenLinkToast.js';
import StatsDashboard from './components/StatsDashboard.js';

const app = createApp({
    components: {
        'track-card': TrackCard,
        'filter-bar': FilterBar,
        'music-player': MusicPlayer,
        'broken-link-toast': BrokenLinkToast,
        'stats-dashboard': StatsDashboard
    },
    setup() {
        const trackLogic = useTracks();
        const playerLogic = usePlayer();
        const potentialBrokenState = ref(null);

        // --- Handlers ---
        const handlePotentialBrokenLink = (payload) => {
            potentialBrokenState.value = payload;
            // Auto-hide logic
            setTimeout(() => {
                if (potentialBrokenState.value?.track.id === payload.track.id) {
                    potentialBrokenState.value = null;
                }
            }, 10000);
        };

        const handlePlay = (track, source) => {
            playerLogic.playTrack(track, source);
        };

        onMounted(() => {
            trackLogic.fetchTracks();
        });

        return { 
            ...trackLogic, ...playerLogic,
            handlePlay,
            handlePotentialBrokenLink,
            potentialBrokenState
        };
    }
});

app.mount('#app');