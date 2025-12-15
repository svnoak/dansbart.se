import { createApp, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'; // Added nextTick
import { useTracks } from './hooks/tracks.js';
import { useFilters } from './hooks/filter.js';
import { usePlayer } from './hooks/player.js';
import { trackSession } from './analytics.js';

import './main.css';

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
        const filterLogic = useFilters();
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

        const createObserver = () => {
            if (observer) observer.disconnect();

            console.log("Creating Observer..."); // Debug

            observer = new IntersectionObserver((entries) => {
                const entry = entries[0];
                
                // Debugging logs to see why it might fail
                if (entry.isIntersecting) {
                    console.log("Trigger visible. Loading:", trackLogic.loading.value, "LoadingMore:", trackLogic.loadingMore.value);
                    
                    if (!trackLogic.loading.value && !trackLogic.loadingMore.value) {
                        console.log("Firing loadMore()");
                        trackLogic.loadMore();
                    }
                }
            }, { 
                root: null, // viewport
                rootMargin: '200px', 
                threshold: 0 
            });

            if (scrollTrigger.value) {
                console.log("Attached observer to element"); // Debug
                observer.observe(scrollTrigger.value);
            } else {
                console.warn("Could not find scrollTrigger element to attach to");
            }
        };

        onMounted(() => {
            trackLogic.fetchTracks();
            trackSession();
        });

        onUnmounted(() => {
            if (observer) observer.disconnect();
        });

        watch(() => trackLogic.loading.value, async (isLoading) => {
            if (!isLoading) {
                await nextTick(); // Wait for v-else to render the div
                createObserver();
            }
        });
        watch(scrollTrigger, (el) => {
            if (el) createObserver();
        });

        return { 
            ...trackLogic, 
            ...playerLogic,
            filters: filterLogic.filters,
            styleTree: filterLogic.styleTree,
            targetTempo: filterLogic.targetTempo,
            tempoEnabled: filterLogic.tempoEnabled,
            computedMin: filterLogic.computedMin,
            computedMax: filterLogic.computedMax,
            handleFilterStyle: filterLogic.handleFilterStyle,
            handlePlay,
            togglePlay,
            scrollTrigger
        };
    }
});

app.config.devtools = true;
app.mount('#app');