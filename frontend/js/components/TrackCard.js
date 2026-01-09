import AddLinkModal from './modals/AddLinkModal.js';
import FlagTrackModal from './modals/FlagTrackModal.js';
import SparklesIcon from '../icons/SparklesIcon.js';
import FlagIcon from '../icons/FlagIcon.js';
import { showToast } from '../hooks/useToast.js';
import { usePlaylists } from '../hooks/usePlaylists.js';
import { useAuth } from '../hooks/useAuth.js';
import { FEATURES } from '../config/features.js';

export default {
  props: ['track', 'currentTrack', 'isSpotifyMode', 'isPlaying'],
  emits: ['play', 'stop', 'refresh', 'filter-style', 'show-similar', 'add-to-queue', 'navigate-to-artist', 'navigate-to-album'],
  components: { AddLinkModal, FlagTrackModal, SparklesIcon, FlagIcon },

  setup() {
    const { isAuthenticated } = useAuth();
    const { playlists, loading: playlistsLoading, fetchUserPlaylists, addTrackToPlaylist } = usePlaylists();

    return {
      isAuthenticated,
      playlists,
      playlistsLoading,
      fetchUserPlaylists,
      addTrackToPlaylist,
      authFeaturesEnabled: FEATURES.ENABLE_AUTH_FEATURES,
    };
  },

  data() {
    return {
      showLinkModal: false,
      showFlagModal: false,
      showPlaylistModal: false,
      showMenu: false,
      showPlaylistSubmenu: false,
      addingToPlaylist: false,
    };
  },

  template: /*html*/ `
    <div class="card bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-100 flex flex-row items-center gap-3 sm:gap-4 transition-all hover:shadow-md group w-full max-w-full overflow-visible">

        <!-- Play Button (Left) -->
        <div class="shrink-0">
            <button
                @click.stop="playPrimary"
                :disabled="!primarySource"
                class="w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100"
                :class="[
                    !primarySource ? 'bg-gray-100 text-gray-300 cursor-not-allowed' :
                    (isCurrent && isPlaying) ? 'bg-indigo-100 text-indigo-600 ring-2 ring-indigo-500' :
                    'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 shadow-md hover:shadow-lg'
                ]"
                :aria-label="!primarySource ? 'Ingen spelare tillgänglig för ' + track.title : (isCurrent && isPlaying) ? 'Pausa ' + track.title : 'Spela ' + track.title"
                :title="playButtonTitle"
            >
                <svg v-if="isCurrent && isPlaying" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /> </svg>
                <svg v-else class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </button>
        </div>

        <div class="flex-1 min-w-0">
            
            <div class="flex flex-wrap items-center gap-2 mb-2">
                
                <template v-if="hasValidStyle">
                    
                    <div v-if="track.style_confidence >= 1.0" class="flex items-center gap-1">
                        <button 
                            @click.stop="$emit('filter-style', track.dance_style)"
                            class="px-2 py-1 text-xs font-bold rounded-full uppercase bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
                            title="Filtrera på huvudstil"
                        >
                            {{ track.dance_style }}
                        </button>

                        <template v-if="hasSubStyle">
                            <span class="text-gray-300 text-[10px] font-bold">›</span>
                            <button 
                                @click.stop="$emit('filter-style', track.sub_style)"
                                class="px-2 py-1 text-xs font-bold rounded-full uppercase bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
                                title="Filtrera på understil"
                            >
                                {{ track.sub_style }}
                            </button>
                        </template>
                    </div>

                    <div v-else-if="track.style_confidence > 0.75" class="flex items-center gap-1">
                        <button 
                            @click.stop="$emit('filter-style', track.dance_style)"
                            class="px-2 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
                            title="Filtrera på huvudstil (AI-gissning)"
                        >
                            {{ track.dance_style }} <sparkles-icon class="w-3 h-3 text-blue-400" />
                        </button>

                        <template v-if="hasSubStyle">
                            <span class="text-gray-300 text-[10px] font-bold">›</span>
                            <button 
                                @click.stop="$emit('filter-style', track.sub_style)"
                                class="px-2 py-1 text-xs font-bold rounded-full uppercase bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
                                title="Filtrera på understil (AI-gissning)"
                            >
                                {{ track.sub_style }}
                            </button>
                        </template>
                    </div>

                    <div v-else class="flex items-center gap-1">
                        <button 
                            @click.stop="$emit('filter-style', track.dance_style)"
                            class="px-2 py-1 text-xs font-bold rounded-full uppercase flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer"
                            title="Filtrera på huvudstil (Osäker)"
                        >
                            {{ track.dance_style }} <sparkles-icon class="w-3 h-3 text-amber-400" />
                        </button>

                        <template v-if="hasSubStyle">
                            <span class="text-gray-300 text-[10px] font-bold">›</span>
                            <button 
                                @click.stop="$emit('filter-style', track.sub_style)"
                                class="px-2 py-1 text-xs font-bold rounded-full uppercase bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer"
                                title="Filtrera på understil (Osäker)"
                            >
                                {{ track.sub_style }}
                            </button>
                        </template>
                    </div>

                </template>

                <template v-else>
                    <span class="px-2 py-1 bg-gray-100 text-gray-600 border border-gray-300 text-xs font-bold rounded-full flex items-center gap-1 cursor-help" title="Kunde inte avgöra stil">
                        ❓ Okänd stil
                    </span>
                </template>

                <span class="text-gray-500 text-xs flex items-center font-medium border border-gray-100 bg-gray-50 px-2 py-1 rounded-full whitespace-nowrap">
                    {{ tempoLabel }}
                </span>

                <span v-if="track.has_vocals" class="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-100 text-xs font-bold rounded-full flex items-center gap-1">🎤 Vocals</span>
                <span v-else class="px-2 py-1 bg-green-50 text-green-700 border border-green-100 text-xs font-bold rounded-full flex items-center gap-1">🎻 Instr.</span>
                
                <span v-if="formattedDuration" class="px-2 py-1 text-gray-400 text-xs font-mono flex items-center border border-gray-100 bg-gray-50 rounded-full">{{ formattedDuration }}</span>
            </div>
            
            <h3 class="font-bold text-lg text-gray-900 leading-tight mb-1 truncate">{{ track.title }}</h3>

            <p class="text-gray-600 text-sm mb-1 truncate">
                <template v-if="track.artists && track.artists.length > 0">
                    <template v-for="(artist, index) in track.artists" :key="artist.id || index">
                        <a
                            v-if="artist.id"
                            @click.stop.prevent="$emit('navigate-to-artist', artist.id)"
                            href="#"
                            class="font-medium text-gray-700 hover:text-primary-600 hover:underline cursor-pointer"
                        >{{ artist.name }}</a>
                        <span v-else class="font-medium text-gray-700">{{ artist.name }}</span>
                        <span v-if="index < track.artists.length - 1" class="text-gray-500">, </span>
                    </template>
                </template>
                <span v-else class="font-medium text-gray-700">{{ artistDisplayString }}</span>
            </p>
            <p v-if="track.albums && track.albums.length > 0" class="text-gray-600 text-sm mb-3">
                <template v-if="track.albums.length === 1">
                    <a
                        v-if="track.albums[0].id"
                        @click.stop.prevent="$emit('navigate-to-album', track.albums[0].id)"
                        href="#"
                        class="italic text-gray-500 hover:text-primary-600 hover:underline cursor-pointer truncate inline-block max-w-full"
                    >{{ track.albums[0].title }}</a>
                    <span v-else class="italic text-gray-500 truncate">{{ track.albums[0].title }}</span>
                </template>
                <template v-else>
                    <span class="italic text-gray-500 truncate">
                        <template v-for="(album, index) in track.albums" :key="album.id || index">
                            <a
                                v-if="album.id"
                                @click.stop.prevent="$emit('navigate-to-album', album.id)"
                                href="#"
                                class="hover:text-primary-600 hover:underline cursor-pointer"
                            >{{ album.title }}</a>
                            <span v-else>{{ album.title }}</span>
                            <span v-if="index < track.albums.length - 1"> • </span>
                        </template>
                    </span>
                </template>
            </p>
            <p v-else-if="track.album" class="text-gray-600 text-sm mb-3 truncate">
                <a
                    v-if="track.album.id"
                    @click.stop.prevent="$emit('navigate-to-album', track.album.id)"
                    href="#"
                    class="italic text-gray-500 hover:text-primary-600 hover:underline cursor-pointer"
                >{{ track.album.title }}</a>
                <span v-else class="italic text-gray-500">{{ track.album.title }}</span>
            </p>

            <div class="flex flex-wrap items-center gap-3 text-xs font-medium text-gray-500 overflow-visible">
                <button v-if="hasSpotify" @click="$emit('play', track, 'spotify')"
                        class="flex items-center gap-1 hover:text-[#1DB954] transition-colors"
                        :class="{ 'text-[#1DB954] font-bold': isCurrent && isSpotifyMode }"
                        :aria-label="'Spela på Spotify: ' + track.title">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.181.6.719.241 1.2zm.12-3.36C15.54 8.46 9.059 8.22 5.28 9.361c-.6.181-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.24z"/></svg>
                    <span>Spotify</span>
                </button>

                <button v-if="hasYouTube" @click="$emit('play', track, 'youtube')"
                        class="flex items-center gap-1 hover:text-red-600 transition-colors"
                        :class="{ 'text-red-600 font-bold': isCurrent && !isSpotifyMode }"
                        :aria-label="'Spela på YouTube: ' + track.title">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                    <span>YouTube</span>
                </button>

                <button v-if="!hasYouTube" @click="showLinkModal = true"
                        class="text-xs text-gray-400 hover:text-red-500 border border-transparent hover:border-red-200 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                        :aria-label="'Lägg till YouTube-länk för ' + track.title">
                    <span>+ Lägg till länk</span>
                </button>

                <button @click="openFlagModal"
                        class="text-xs text-gray-400 hover:text-orange-600 border border-transparent hover:border-orange-200 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                        :aria-label="'Rapportera problem med ' + track.title">
                    <flag-icon class="w-3 h-3" />
                    <span>Rapportera</span>
                </button>
            </div>
        </div>

        <!-- More Menu (Right) -->
        <div class="shrink-0 relative">
            <button @click.stop="showMenu = !showMenu"
                    class="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                    :aria-label="'Fler alternativ för ' + track.title">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
            </button>

            <!-- Dropdown Menu -->
            <div v-if="showMenu" @click.stop
                 class="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <!-- Add to Playlist with Submenu -->
                <div v-if="authFeaturesEnabled" class="relative"
                     @mouseenter="openPlaylistSubmenu"
                     @mouseleave="closePlaylistSubmenu">
                    <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                            </svg>
                            Lägg till i spellista
                        </div>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </button>

                    <!-- Playlist Submenu -->
                    <div v-if="showPlaylistSubmenu"
                         class="absolute left-full top-0 ml-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-64 overflow-y-auto">

                        <!-- Not authenticated -->
                        <div v-if="!isAuthenticated" class="px-4 py-3 text-sm text-gray-500 text-center">
                            <p class="mb-2">Logga in för att använda spellistor</p>
                            <button @click="handleLogin"
                                    class="text-indigo-600 hover:underline font-medium">
                                Logga in
                            </button>
                        </div>

                        <!-- Loading -->
                        <div v-else-if="playlistsLoading" class="px-4 py-3 text-sm text-gray-500 text-center">
                            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600 mx-auto mb-1"></div>
                            Laddar...
                        </div>

                        <!-- Playlists -->
                        <template v-else>
                            <!-- Create new playlist -->
                            <button @click="openCreatePlaylistModal"
                                    class="w-full text-left px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-medium border-b border-gray-200">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                </svg>
                                Skapa ny spellista
                            </button>

                            <!-- Empty state -->
                            <div v-if="playlists.length === 0" class="px-4 py-3 text-sm text-gray-500 text-center">
                                Du har inga spellistor
                            </div>

                            <!-- Playlist items -->
                            <button v-for="playlist in playlists"
                                    :key="playlist.id"
                                    @click="handleAddToPlaylist(playlist.id)"
                                    :disabled="addingToPlaylist"
                                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                                <div class="flex items-center justify-between">
                                    <div class="flex-1 min-w-0">
                                        <p class="font-medium truncate">{{ playlist.name }}</p>
                                        <p class="text-xs text-gray-500">{{ playlist.track_count }} låtar</p>
                                    </div>
                                </div>
                            </button>
                        </template>
                    </div>
                </div>

                <button @click="showSimilar"
                        class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                    </svg>
                    Liknande låtar
                </button>
                <button @click="addToQueue"
                        class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Lägg till i kö
                </button>
                <button @click="handleShare"
                        class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                    </svg>
                    Dela
                </button>
            </div>
        </div>

        <add-link-modal
            :is-open="showLinkModal"
            :track="track"
            @close="showLinkModal = false"
            @refresh="$emit('refresh')"
        ></add-link-modal>

        <flag-track-modal
            :is-open="showFlagModal"
            :track="track"
            @close="showFlagModal = false"
            @refresh="$emit('refresh')"
        ></flag-track-modal>

        <add-to-playlist-modal
            :is-open="showPlaylistModal"
            :track="track"
            @close="showPlaylistModal = false"
        ></add-to-playlist-modal>
    </div>
    `,
  computed: {
    hasValidStyle() {
      return (
        this.track.dance_style &&
        this.track.dance_style !== 'Unknown' &&
        this.track.dance_style !== 'Unclassified'
      );
    },
    hasSubStyle() {
      return this.track.sub_style && this.track.sub_style !== this.track.dance_style;
    },
    artistDisplayString() {
      if (!this.track.artists || this.track.artists.length === 0) return 'Okänd artist';
      const primary = this.track.artists.filter(a => a.role === 'primary').map(a => a.name);
      const feat = this.track.artists.filter(a => a.role === 'featured').map(a => a.name);
      let text = primary.join(', ');
      if (feat.length > 0) text += ' feat. ' + feat.join(', ');
      if (!text) text = this.track.artists.map(a => a.name).join(', ');
      return text;
    },
    hasYouTube() {
      return this.getLink('youtube');
    },
    hasSpotify() {
      return this.getLink('spotify');
    },
    isCurrent() {
      return this.currentTrack?.id === this.track.id;
    },
    primarySource() {
      if (this.hasYouTube) return 'youtube';
      if (this.hasSpotify) return 'spotify';
      return null;
    },
    playButtonTitle() {
      if (this.isCurrent && this.isPlaying) return 'Pausa';
      if (this.isCurrent && !this.isPlaying) return 'Spela';
      return 'Spela upp';
    },
    formattedDuration() {
      const ms = this.track.duration;
      if (!ms) return null;
      const min = Math.floor(ms / 60000);
      const sec = ((ms % 60000) / 1000).toFixed(0);
      return min + ':' + (sec < 10 ? '0' : '') + sec;
    },
    tempoLabel() {
      if (!this.track) return '';
      if (!this.hasValidStyle) return 'Tempo?';
      if (this.track.tempo && this.track.tempo.label) return this.track.tempo.label;
      const labels = {
        Slow: 'Långsamt',
        SlowMed: 'Lugnt',
        Medium: 'Lagom',
        Fast: 'Snabbt',
        Turbo: 'Väldigt snabbt',
      };
      return labels[this.track.tempo_category] || 'Lagom';
    },
  },
  mounted() {
    // Close menu when clicking outside
    document.addEventListener('click', this.handleClickOutside);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside);
  },
  methods: {
    getLink(type) {
      if (!this.track.playback_links) return null;
      return this.track.playback_links.find(l => {
        if (l.platform) return l.platform === type;
        const url = l.deep_link || (typeof l === 'string' ? l : null);
        if (!url) return false;
        return type === 'spotify' ? url.includes('spotify') : !url.includes('spotify');
      });
    },
    playPrimary() {
      if (this.isCurrent && this.isPlaying) {
        this.$emit('stop');
      } else if (this.isCurrent && !this.isPlaying) {
        this.$emit('play', this.track, this.primarySource);
      } else if (this.primarySource) {
        this.$emit('play', this.track, this.primarySource);
      }
    },
    shareTrack() {
      const shareUrl = `${window.location.origin}/?track=${this.track.id}`;

      if (navigator.share) {
        // Use native share on mobile
        navigator
          .share({
            title: this.track.title,
            text: `${this.track.title} - ${this.artistDisplayString}`,
            url: shareUrl,
          })
          .catch(() => {
            // User cancelled share, ignore
          });
      } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
          // Show toast notification
          showToast('Länk kopierad!', 'success');
        });
      }
    },
    toggleMenu() {
      this.showMenu = !this.showMenu;
      if (this.showMenu && this.isAuthenticated) {
        this.fetchUserPlaylists();
      }
    },
    handleClickOutside() {
      this.showMenu = false;
      this.showPlaylistSubmenu = false;
    },
    openPlaylistSubmenu() {
      this.showPlaylistSubmenu = true;
    },
    closePlaylistSubmenu() {
      this.showPlaylistSubmenu = false;
    },
    async handleAddToPlaylist(playlistId) {
      if (!this.track || this.addingToPlaylist) return;

      this.addingToPlaylist = true;
      try {
        const success = await this.addTrackToPlaylist(playlistId, this.track.id);
        if (success) {
          this.showMenu = false;
          this.showPlaylistSubmenu = false;
        }
      } finally {
        this.addingToPlaylist = false;
      }
    },
    openCreatePlaylistModal() {
      this.showPlaylistModal = true;
      this.showMenu = false;
      this.showPlaylistSubmenu = false;
    },
    handleLogin() {
      this.showMenu = false;
      this.showPlaylistSubmenu = false;
      const { login } = useAuth();
      login();
    },
    showSimilar() {
      this.$emit('show-similar', this.track.id);
      this.showMenu = false;
    },
    addToQueue() {
      this.$emit('add-to-queue', this.track);
      this.showMenu = false;
    },
    handleShare() {
      this.shareTrack();
      this.showMenu = false;
    },
    openFlagModal() {
      this.showFlagModal = true;
    },
  },
};
