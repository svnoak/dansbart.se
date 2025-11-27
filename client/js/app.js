import { createApp, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';
import { useTracks } from './tracks.js';
import { usePlayer } from './player.js';

// Import Components
import TrackCard from './components/TrackCard.js';
import FilterBar from './components/FilterBar.js';
import MusicPlayer from './components/MusicPlayer.js'; 

const app = createApp({
    components: {
        'track-card': TrackCard,
        'filter-bar': FilterBar,
        'music-player': MusicPlayer
    },
    setup() {
        const trackLogic = useTracks();
        const playerLogic = usePlayer();

        onMounted(() => {
            trackLogic.fetchTracks();
            playerLogic.initYouTubeAPI();
        });

        const handlePlay = (track, source) => {
            playerLogic.playTrack(track, source);
        };

        return { ...trackLogic, ...playerLogic, handlePlay };
    }
});

app.mount('#app');