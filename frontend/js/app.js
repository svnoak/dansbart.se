import { createApp, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
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
            togglePlay
        };
    }
});

app.mount('#app');