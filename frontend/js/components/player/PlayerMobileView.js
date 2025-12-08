import SmartNudge from '../toasts/SmartNudge.js';
import SectionVoting from '../toasts/SectionVoting.js';
import BrokenLinkToast from '../toasts/BrokenLinkToast.js';
import PlayerControls from './PlayerControls.js';
import ProgressBar from './ProgressBar.js';

export default {
    props: [
        'currentTrack', 'availableVersions', 'currentVersionIndex', 
        'isPlaying', 'isShuffled', 'repeatMode', 
        'structureMode', 'activeSource', 
        'visualTime', 'duration', 
        'isExpanded', 'trackArtist', 'trackAlbum',
        'brokenState'
    ],
    emits: [
        'close', 'set-source', 'cycle-version', 
        'toggle-structure-mode', 'seek', 
        'toggle-play', 'next', 'prev', 'shuffle', 'toggle-repeat', 'jump',
        'dismiss-broken'
    ],
    components: { SmartNudge, SectionVoting, BrokenLinkToast, PlayerControls, ProgressBar },
    
    computed: {
        structureButtonLabel() {
            if (this.structureMode === 'sections') return 'Visa takter';
            if (this.structureMode === 'bars') return 'Dölj';
            return 'Visa repriser';
        },
        structureButtonIcon() {
            if (this.structureMode === 'none') return `<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`; 
            if (this.structureMode === 'sections') return `<path d="M4 4h16v16H4z M12 4v16"/>`;
            return `<path d="M4 6h1v12H4zm5 0h1v12H9zm5 0h1v12h-1zm5 0h1v12h-1z"/>`;
        }
    },

    template: /*html*/`
    <div class="fixed inset-0 bg-white z-[100] flex flex-col transition-transform duration-300 ease-in-out md:hidden"
         :class="isExpanded ? 'translate-y-0' : 'translate-y-full'">
        
        <div class="flex items-center justify-between px-6 pt-12 pb-4 shrink-0 bg-white z-10">
            <button @click="$emit('close')" class="text-gray-500 p-2 -ml-2">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div class="flex bg-gray-100 rounded-lg p-1 gap-1">
                <button @click="$emit('set-source', 'youtube')" class="px-3 py-1 text-[10px] font-bold uppercase rounded transition-all" :class="activeSource === 'youtube' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'">YouTube</button>
                <button @click="$emit('set-source', 'spotify')" class="px-3 py-1 text-[10px] font-bold uppercase rounded transition-all" :class="activeSource === 'spotify' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'">Spotify</button>
            </div>
        </div>

        <div class="flex-1 flex flex-col px-6 overflow-y-auto min-h-0 pb-10">
            <!-- Placeholder for video/spotify embed that's positioned fixed above -->
            <div class="w-full shrink-0 mb-6"
                 :class="activeSource === 'spotify' ? 'h-[152px]' : 'aspect-video'">
            </div>

            <div class="mb-2 shrink-0">
                <h2 class="text-2xl font-extrabold text-gray-900 leading-tight mb-0.5">{{ currentTrack.title }}</h2>
                <p class="text-lg text-indigo-600 font-bold">{{ trackArtist }}</p>
                <p v-if="trackAlbum" class="text-sm text-gray-500 font-medium truncate mb-2">{{ trackAlbum }}</p>
                <span v-if="currentTrack.dance_style" class="inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs uppercase tracking-wide font-bold">{{ currentTrack.dance_style }}</span>
            </div>

            <div class="flex-1 min-h-[20px]"></div>

            <div class="mb-4 shrink-0">
                <smart-nudge :track="currentTrack" @visibility-change="$emit('nudge-visibility', $event)"></smart-nudge>
                <section-voting v-if="structureMode !== 'none'" :track="currentTrack" :active-version="availableVersions[currentVersionIndex]"></section-voting>
                <broken-link-toast 
                    :broken-state="brokenState" 
                    :structure-mode="structureMode"
                    :inline-mode="true"
                    @close="$emit('dismiss-broken')"
                ></broken-link-toast>
            </div>

            <div class="flex justify-between items-end mb-2 shrink-0">
                <div v-if="availableVersions.length > 1" class="flex items-center bg-gray-100 rounded-full border border-gray-200 px-2 py-1 h-8">
                    <button @click="$emit('cycle-version', -1)" class="w-6 h-full flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold">‹</button>
                    <span class="text-xs font-mono font-bold text-gray-700 px-2 pt-0.5">v.{{ currentVersionIndex + 1 }}</span>
                    <button @click="$emit('cycle-version', 1)" class="w-6 h-full flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold">›</button>
                </div>
                <div v-else></div> 
                <button @click="$emit('toggle-structure-mode')" class="flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wide transition-all h-8" :class="structureMode !== 'none' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-500 border-gray-200'">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="structureButtonIcon" stroke-width="2"></svg>
                    {{ structureButtonLabel }}
                </button>
            </div>

            <div class="h-12 mb-4 relative w-full shrink-0 flex items-end">
                 <progress-bar :current-time="visualTime" :duration="duration" :disabled="false" :structure-mode="structureMode" :track="currentTrack" @seek="$emit('seek', $event)"></progress-bar>
            </div>
            <div class="shrink-0">
                <player-controls :is-playing="isPlaying" :is-shuffled="isShuffled" :repeat-mode="repeatMode" :has-spotify="activeSource === 'spotify'" :structure-mode="structureMode" :full-mode="true" :active-source="activeSource" @toggle-play="$emit('toggle-play')" @next="$emit('next')" @prev="$emit('prev')" @shuffle="$emit('shuffle')" @toggle-repeat="$emit('toggle-repeat')" @jump="$emit('jump', $event)"></player-controls>
            </div>
        </div>
    </div>
    `
}