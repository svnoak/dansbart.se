import { createApp, onMounted, ref, toRaw } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { useTracks } from './tracks.js';
import { usePlayer } from './player.js';

// Components
import TrackCard from './components/TrackCard.js';
import FilterBar from './components/FilterBar.js';
import GlobalPlayer from './components/player/GlobalPlayer.js'; 
import BrokenLinkToast from './components/toasts/BrokenLinkToast.js';
import StatsDashboard from './components/StatsDashboard.js';

const app = createApp({
    components: {
        'track-card': TrackCard,
        'filter-bar': FilterBar,
        'global-player': GlobalPlayer,
        'broken-link-toast': BrokenLinkToast,
        'stats-dashboard': StatsDashboard
    },
    setup() {
        const trackLogic = useTracks();
        const playerLogic = usePlayer();
        const potentialBrokenState = ref(null);
        const { isPlaying, togglePlay } = playerLogic;
        const useSpotifyFallback = ref(false);

        // --- Handlers ---
        const handlePotentialBrokenLink = (payload) => {
            potentialBrokenState.value = payload;
            setTimeout(() => {
                if (potentialBrokenState.value?.track.id === payload.track.id) {
                    potentialBrokenState.value = null;
                }
            }, 8000); // Auto-dismiss after 8 seconds
        };

        const confirmBrokenLink = async (reason) => {
            if (!potentialBrokenState.value) return;
            const { track, badLink } = toRaw(potentialBrokenState.value);
            potentialBrokenState.value = null; 

            try {
                if (badLink && badLink.id) {
                    await fetch(`/api/links/${badLink.id}/report?reason=${reason}`, { method: 'PATCH' });
                }
            } catch (e) {
                console.error(e);
            }
        };

        const handlePlay = (track, sourcePreference = null) => {
            const list = trackLogic.tracks.value;
            const index = list.findIndex(t => t.id === track.id);
            
            if (index !== -1) {
                playerLogic.playContext(list, index, sourcePreference);
            }
        };

        onMounted(() => {
            trackLogic.fetchTracks();
        });

        return { 
            ...trackLogic, 
            ...playerLogic,
            handlePlay,
            togglePlay,
            handlePotentialBrokenLink,
            confirmBrokenLink,
            potentialBrokenState,
            useSpotifyFallback
        };
    }
});

app.mount('#app');