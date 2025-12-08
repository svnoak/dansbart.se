import SmartNudge from '../toasts/SmartNudge.js';
import SectionVoting from '../toasts/SectionVoting.js';
import PlayerControls from './PlayerControls.js';
import ProgressBar from './ProgressBar.js';

export default {
    props: [
        'currentTrack', 'availableVersions', 'currentVersionIndex', 
        'isPlaying', 'isShuffled', 'repeatMode', 
        'structureMode', 'activeSource', 
        'visualTime', 'duration', 
        'isExpanded', 'hasYt', 'hasSpot', // passed from parent
        'fmtCurrent', 'fmtDuration'
    ],
    emits: [
        'expand', 'set-source', 'cycle-version', 
        'toggle-structure-mode', 'seek', 
        'toggle-play', 'next', 'prev', 'shuffle', 'toggle-repeat', 'jump'
    ],
    components: { SmartNudge, SectionVoting, PlayerControls, ProgressBar },

    computed: {
        structureButtonLabel() {
            if (this.structureMode === 'sections') return 'Visa takter';
            if (this.structureMode === 'bars') return 'Dölj';
            return 'Visa repriser';
        },
        // Calculate the bottom offset for elements above the player
        nudgeBottomOffset() {
            const playerHeight = 80;
            const progressBarHeight = this.structureMode !== 'none' ? 32 : 6;
            return playerHeight + progressBarHeight + 12; // 12px margin
        },
        // Show Spotify hint only when it's a preview (duration <= 30s)
        showSpotifyHint() {
            return this.activeSource === 'spotify' && this.duration <= 30;
        }
    },

    template: /*html*/`
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-up z-50 flex flex-col transition-all duration-300"
         :class="isExpanded ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : 'opacity-100'">
         
        <div class="hidden md:flex fixed right-4 w-80 z-40 flex-col gap-2 transition-all duration-300"
             :style="{ bottom: nudgeBottomOffset + 'px' }">
            <smart-nudge :track="currentTrack" :is-playing="isPlaying"></smart-nudge>
            <section-voting v-if="structureMode !== 'none'" :track="currentTrack" :active-version="availableVersions[currentVersionIndex]"></section-voting>
        </div>

        <div class="hidden md:block relative w-full">
            <!-- Spotify hint - sits above the progress bar, hides when full track plays -->
            <div v-if="showSpotifyHint" class="absolute -top-8 left-1/2 -translate-x-1/2 z-10">
                <span class="text-[10px] text-gray-500 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    Klicka i Spotify-spelaren för hela låten
                </span>
            </div>
            <progress-bar :current-time="visualTime" :duration="duration" :disabled="false" :structure-mode="structureMode" :track="currentTrack" @seek="$emit('seek', $event)"></progress-bar>
        </div>
        
        <div class="md:hidden w-full h-1 bg-gray-200 relative">
            <div class="h-full bg-indigo-600" :style="{ width: (duration ? (visualTime/duration)*100 : 0) + '%' }"></div>
            <!-- Spotify hint for mobile docked view -->
            <div v-if="showSpotifyHint" class="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                <span class="text-[9px] text-gray-500 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 whitespace-nowrap">
                    Klicka i Spotify-spelaren
                </span>
            </div>
        </div>

        <div class="flex items-center justify-between px-4 py-3 h-20 bg-white cursor-pointer md:cursor-default" 
             @click.self="!$event.target.closest('button') && $emit('expand')">
             
             <div class="flex items-center w-2/3 md:w-1/3 gap-3" @click="$emit('expand')">
                <div class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-xl shrink-0">🎵</div>
                <div class="min-w-0">
                    <div class="font-bold truncate text-sm md:text-base">{{ currentTrack.title }}</div>
                    <div class="text-[10px] text-gray-400 md:hidden">Tap to expand</div>
                    <div class="text-[10px] text-gray-400 font-mono hidden md:block" v-if="activeSource === 'youtube'">{{ fmtCurrent }} / {{ fmtDuration }}</div>
                    
                    <div class="hidden md:flex items-center gap-2 mt-1">
                        <button v-if="currentTrack.sections?.length" @click.stop="$emit('toggle-structure-mode')" class="text-[9px] font-bold uppercase border px-1.5 rounded" :class="structureMode!=='none'?'bg-indigo-100 text-indigo-700':'bg-white text-gray-400'">{{ structureButtonLabel }}</button>
                         <div v-if="availableVersions.length > 1 && structureMode !== 'none'" class="flex items-center bg-gray-50 rounded-full border px-1">
                            <button @click.stop="$emit('cycle-version', -1)" class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold text-[10px]">‹</button>
                            <span class="text-[9px] font-mono font-bold text-gray-700 px-1">v{{ currentVersionIndex + 1 }}</span>
                            <button @click.stop="$emit('cycle-version', 1)" class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold text-[10px]">›</button>
                        </div>
                    </div>
                </div>
             </div>

             <div class="flex justify-end md:justify-center w-1/3 md:w-1/3">
                <player-controls :is-playing="isPlaying" :is-shuffled="isShuffled" :repeat-mode="repeatMode" :has-spotify="activeSource === 'spotify'" :structure-mode="structureMode" :full-mode="false" :active-source="activeSource" @toggle-play="$emit('toggle-play')" @next="$emit('next')" @prev="$emit('prev')" @shuffle="$emit('shuffle')" @toggle-repeat="$emit('toggle-repeat')" @jump="$emit('jump', $event)"></player-controls>
             </div>
             
             <div class="hidden md:flex w-1/3 justify-end items-center gap-2">
                <span v-if="hasYt || hasSpot" class="text-[10px] text-gray-400 font-bold uppercase mr-2">Källa</span>
                <button v-if="hasYt" @click="$emit('set-source', 'youtube')" class="p-1.5 rounded border transition-all" :class="activeSource === 'youtube' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white text-gray-400 hover:text-gray-600'">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                </button>
                <button v-if="hasSpot" @click="$emit('set-source', 'spotify')" class="p-1.5 rounded border transition-all" :class="activeSource === 'spotify' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white text-gray-400 hover:text-gray-600'">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.779-.6 13.5 1.621.42.181.6.719.241 1.2zm.12-3.36C15.54 8.46 9.059 8.22 5.28 9.361c-.6.181-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.24z"/></svg>
                </button>
             </div>
        </div>
    </div>
    `
}