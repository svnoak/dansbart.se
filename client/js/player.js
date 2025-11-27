import { ref, nextTick } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

export function usePlayer() {
    const currentTrack = ref(null);
    const currentVideoId = ref(null);
    const isPlayerVisible = ref(false);
    const playerState = ref(-1); 
    const restrictedError = ref(false);
    const useSpotifyFallback = ref(false);
    let ytPlayer = null; 

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

    // --- Logic ---
    const initYouTubeAPI = () => {
        if (window.YT && window.YT.Player) {
            createPlayerInstance();
            return;
        }
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        window.onYouTubeIframeAPIReady = () => createPlayerInstance();
    };

    const createPlayerInstance = () => {
        ytPlayer = new YT.Player('youtube-player', {
            events: {
                'onStateChange': (e) => playerState.value = e.data,
                'onError': (e) => {
                    console.warn("YouTube Player Error:", e.data);
                    if ([101, 150, 100].includes(e.data)) {
                        if (getSpotifyId(currentTrack.value)) {
                            if (ytPlayer?.stopVideo) ytPlayer.stopVideo();
                            useSpotifyFallback.value = true;
                        } else {
                            restrictedError.value = true;
                            window.open(`https://www.youtube.com/watch?v=${currentVideoId.value}`, '_blank');
                        }
                    }
                }
            }
        });
    };

    const playTrack = (track, source = 'youtube') => {
        currentTrack.value = track;
        isPlayerVisible.value = true;
        restrictedError.value = false;
        
        if (source === 'spotify') {
            useSpotifyFallback.value = true;
            currentVideoId.value = null;
            if (ytPlayer?.stopVideo) ytPlayer.stopVideo();
        } else {
            const videoId = getYouTubeId(track);
            if (!videoId) return; 
            currentVideoId.value = videoId;
            useSpotifyFallback.value = false;
            
            nextTick(() => {
                if (ytPlayer?.loadVideoById) ytPlayer.loadVideoById(videoId);
                else setTimeout(() => ytPlayer?.loadVideoById(videoId), 500);
            });
        }
    };

    const closePlayer = () => {
        isPlayerVisible.value = false;
        if (ytPlayer?.stopVideo) ytPlayer.stopVideo();
        currentTrack.value = null;
        currentVideoId.value = null;
        playerState.value = -1;
        restrictedError.value = false;
        useSpotifyFallback.value = false;
    };

    return {
        currentTrack, currentVideoId, isPlayerVisible, playerState, 
        restrictedError, useSpotifyFallback,
        initYouTubeAPI, playTrack, closePlayer,
        getYouTubeId, getSpotifyUrl, hasLinks, getSpotifyId
    };
}