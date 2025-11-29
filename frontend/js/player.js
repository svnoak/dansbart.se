import { ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

// Global Singleton State
const currentTrack = ref(null);
const currentVideoId = ref(null);
const isPlayerVisible = ref(false);
const playerState = ref(-1); 
const restrictedError = ref(false);
const useSpotifyFallback = ref(false);

export function usePlayer() {

    // --- Helpers ---
    const isUrl = (str) => typeof str === 'string' && /^https?:\/\//.test(str);

    const getYouTubeId = (track) => {
        if (!track?.playback_links) return null;
        for (const linkObj of track.playback_links) {
            const val = linkObj.deep_link || linkObj;
            if (typeof val === 'string' && !isUrl(val) && val.length > 5) return val;
        }
        return null;
    };

    const getSpotifyUrl = (track) => {
        if (!track?.playback_links) return null;
        for (const linkObj of track.playback_links) {
            const val = linkObj.deep_link || linkObj;
            if (typeof val === 'string' && val.includes('spotify')) return val;
        }
        return null;
    };

    const getSpotifyId = (track) => {
        const url = getSpotifyUrl(track);
        if (!url) return null;
        const match = url.match(/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    };

    const hasLinks = (track) => getYouTubeId(track) || getSpotifyUrl(track);

    // --- Actions ---

    const playTrack = (track, source = 'youtube') => {
        currentTrack.value = track;
        isPlayerVisible.value = true;
        restrictedError.value = false; // Reset error state
        
        if (source === 'spotify') {
            useSpotifyFallback.value = true;
            currentVideoId.value = null;
        } else {
            const videoId = getYouTubeId(track);
            if (!videoId) return; 
            
            // We only set the ID here. The MusicPlayer component watches this value
            // and handles the actual API calls.
            currentVideoId.value = videoId;
            useSpotifyFallback.value = false;
        }
    };

    const closePlayer = () => {
        isPlayerVisible.value = false;
        currentTrack.value = null;
        currentVideoId.value = null;
        playerState.value = -1;
        restrictedError.value = false;
        useSpotifyFallback.value = false;
    };

    const handlePlayerError = (errorCode) => {
        console.warn("YouTube Player Error reported:", errorCode);
        // Error 101, 150 = Embedding Restricted
        if ([101, 150, 100].includes(errorCode)) {
            // Try Auto-Fallback to Spotify
            if (getSpotifyId(currentTrack.value)) {
                console.log("⚠️ YouTube restricted. Auto-switching to Spotify.");
                useSpotifyFallback.value = true; 
            } else {
                restrictedError.value = true;
            }
        }
    };

    return {
        currentTrack, currentVideoId, isPlayerVisible, playerState, 
        restrictedError, useSpotifyFallback,
        playTrack, closePlayer, handlePlayerError,
        getYouTubeId, getSpotifyUrl, getSpotifyId, hasLinks
    };
}