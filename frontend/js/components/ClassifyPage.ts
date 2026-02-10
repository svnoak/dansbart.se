import { ref, onMounted, computed, onUnmounted } from 'vue';
import { getVoterId } from '../utils/voter'; 
import { showToast, showError } from '../hooks/useToast';
import FlagTrackModal from './modals/FlagTrackModal.js';
import FlagIcon from '../icons/FlagIcon';

export default {
  props: {
    currentTrack: Object,
    isPlaying: Boolean,
  },
  components: { FlagTrackModal, FlagIcon },
  emits: ['play', 'stop'],
  template: /*html*/ `
    <div class="max-w-2xl mx-auto pb-24 relative">
      
      <div class="flex items-center justify-between mb-2 px-4 pt-4">
        <div>
          <h2 class="text-xl font-bold text-gray-900 leading-none">Musikdomaren</h2>
          <div class="flex items-center gap-2 mt-1">
             <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wide">
                {{ currentRank.title }}
             </span>
             <span v-if="streak > 2" class="text-xs font-bold text-orange-500 animate-pulse">
                🔥 {{ streak }} i rad!
             </span>
          </div>
        </div>
        
        <button 
            @click="triggerSummary"
            :disabled="sessionCount === 0"
            class="group bg-white border-2 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all rounded-xl px-4 py-2 flex flex-col items-center min-w-[80px]"
            title="Avsluta session"
        >
          <span class="text-indigo-600 font-black text-2xl leading-none">{{ sessionCount }}</span>
          <span class="text-[9px] uppercase font-bold text-gray-400 group-hover:text-indigo-500">Antal Låtar</span>
        </button>
      </div>

      <div class="mx-4 mb-6 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full bg-indigo-500 transition-all duration-500 ease-out" :style="{ width: progressToNextRank + '%' }"></div>
      </div>

      <div v-if="view === 'summary'" class="mx-4 mt-8 animate-fade-in-up">
        <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-indigo-50">
            <div class="bg-indigo-600 p-8 text-center text-white relative overflow-hidden">
                <div class="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')]"></div>
                <div class="relative z-10">
                    <span class="text-5xl mb-2 block">{{ currentRank.icon }}</span>
                    <h3 class="text-2xl font-black uppercase tracking-wide">Snyggt Jobbat!</h3>
                    <p class="text-indigo-200 font-medium mt-1">Dagens insats</p>
                </div>
            </div>
            
            <div class="p-6">
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="text-center p-4 bg-gray-50 rounded-xl">
                        <div class="text-3xl font-black text-gray-800">{{ sessionCount }}</div>
                        <div class="text-xs text-gray-500 uppercase font-bold">Kategoriserade låtar</div>
                    </div>
                    <div class="text-center p-4 bg-gray-50 rounded-xl">
                        <div class="text-3xl font-black text-orange-500">{{ maxStreak }}</div>
                        <div class="text-xs text-gray-500 uppercase font-bold">Bästa Streak</div>
                    </div>
                </div>

                <div class="text-center space-y-3">
                    <p class="text-gray-600 text-sm">Du nådde rangen <strong class="text-indigo-600">{{ currentRank.title }}</strong>.</p>
                    
                    <button @click="resetGame" class="w-full py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-gray-800 transform transition active:scale-95">
                        Kör en omgång till 🚀
                    </button>
                    
                    <button @click="$emit('stop'); $parent.navigateToSearch()" class="text-xs text-gray-400 font-bold uppercase hover:text-gray-600">
                        Gå tillbaka till sök
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div v-else-if="loading && tracks.length === 0" class="h-48 flex items-center justify-center">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>

      <div v-else-if="tracks.length > 0" class="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 transform mx-2 sm:mx-0 border border-gray-100">
        
        <div class="bg-gray-900 p-3 flex items-center gap-4 shadow-md relative overflow-hidden">
            <div class="absolute inset-0 opacity-30 bg-cover bg-center" 
                 :style="{ backgroundImage: activeTrack?.album ? 'url(' + activeTrack.album.cover_image_url + ')' : '' }">
            </div>
            
            <div class="relative z-10 flex-shrink-0 group cursor-pointer" @click="togglePlayback">
                <div class="w-16 h-16 rounded-md shadow-lg bg-gray-800 bg-cover bg-center flex items-center justify-center relative overflow-hidden"
                     :style="{ backgroundImage: activeTrack?.album ? 'url(' + activeTrack.album.cover_image_url + ')' : '' }">
                     <div class="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/50">
                        <svg v-if="isPlaying && isCurrentTrack" class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                        <svg v-else class="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                     </div>
                </div>
            </div>

            <div class="relative z-10 flex-1 min-w-0 flex flex-col justify-center h-16">
                <h3 class="text-white text-base font-bold truncate leading-tight mb-1">{{ activeTrack.title }}</h3>
                <p class="text-gray-300 text-xs font-medium truncate">{{ activeTrack.artists?.[0]?.name || 'Okänd artist' }}</p>
            </div>
        </div>

        <div class="p-4 bg-gray-50 min-h-[300px] flex flex-col relative">
            
            <transition name="slide-left" mode="out-in">
                
                <div v-if="step === 'style'" key="step-style" class="flex-1 flex flex-col">
                    <h4 class="text-center text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Välj Dansstil</h4>
                    <div class="grid grid-cols-3 gap-2">
                        <button 
                            v-for="style in allStyles" :key="style" @click="selectStyle(style)"
                            class="py-3 px-1 rounded-lg font-bold text-xs shadow-sm transition-all border border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-md active:scale-95 break-words leading-tight"
                            :class="{'ring-2 ring-indigo-500 bg-indigo-50 text-indigo-900': selectedStyle === style}"
                        >
                            {{ style }}
                        </button>
                    </div>
                </div>

                <div v-else key="step-tempo" class="flex-1 flex flex-col">
                     
                     <div class="flex items-center justify-between mb-4">
                        <button @click="step = 'style'" class="text-gray-400 hover:text-gray-600 flex items-center text-xs font-medium">
                            <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg> Tillbaka
                        </button>
                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Tempo för <span class="text-indigo-600">{{ selectedStyle }}</span></h4>
                        <div class="w-12"></div>
                     </div>

                     <div v-if="hasBpm" class="flex flex-col gap-4">
                        <div class="text-center mb-2 px-4">
                            <h3 class="text-xl font-bold text-gray-800 leading-tight">
                                Är {{ selectedStyle }} <span class="text-indigo-600">{{ aiTempoLabel.toLowerCase() }}</span>?
                            </h3>
                        </div>

                        <div class="grid grid-cols-3 gap-2">
                            <button @click="finishVote(null, null, 'half')" class="py-4 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-700 active:scale-95 transition-all">
                                Den är<br>långsammare
                            </button>
                            <button @click="finishVote(null, null, 'ok')" class="py-4 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 active:scale-95 transition-all">
                                Ja, det är<br>rätt
                            </button>
                            <button @click="finishVote(null, null, 'double')" class="py-4 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-700 active:scale-95 transition-all">
                                Den är<br>snabbare
                            </button>
                        </div>
                     </div>

                    <div v-else class="flex-1 flex flex-col">
                         
                         <div class="mb-6 bg-gray-100 rounded-xl p-1 flex gap-1 ring-2 ring-indigo-100 transition-all duration-300"
                              :class="{'ring-indigo-300 bg-indigo-50': tappedBpm > 0}">
                            <button 
                                @click="handleTap"
                                class="flex-1 py-4 rounded-lg bg-white shadow-sm border-2 border-transparent font-bold text-gray-600 active:scale-95 active:bg-indigo-50 transition-all select-none"
                                :class="{'border-indigo-400 text-indigo-600': tappedBpm > 0}"
                            >
                                <span v-if="tappedBpm > 0" class="flex flex-col items-center leading-none">
                                    <span class="text-2xl font-black">{{ Math.round(tappedBpm) }}</span>
                                    <span class="text-[10px] uppercase font-bold text-gray-400">BPM (Tryck här)</span>
                                </span>
                                <span v-else class="flex flex-col items-center">
                                    <span class="text-xl">👆</span>
                                    <span class="text-xs uppercase font-bold mt-1">Tryck i takten</span>
                                </span>
                            </button>
                            
                            <button 
                                v-if="tappedBpm > 0"
                                @click="finishVote(null, tappedBpm, 'ok')"
                                class="px-6 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 transition-all animate-fade-in-right"
                            >
                                Spara
                            </button>
                         </div>

                         <div v-if="tappedBpm === 0" class="grid grid-cols-1 gap-3 flex-1 content-start max-w-sm mx-auto w-full animate-fade-in">
                            <button v-for="tempo in tempos" :key="tempo.value" @click="finishVote(tempo.label, null, 'ok')"
                                class="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-transparent shadow-sm hover:border-indigo-400 hover:shadow-md transition-all group active:scale-98">
                                <span class="font-bold text-gray-800 group-hover:text-indigo-700">{{ tempo.label }}</span>
                                <span class="text-xl">{{ tempo.icon }}</span>
                            </button>
                            <button @click="finishVote(null, null, 'ok')" class="mt-2 text-xs text-gray-400 hover:text-gray-600 underline text-center w-full py-2">Vet ej tempo</button>
                         </div>
                         
                         <div v-else class="text-center">
                             <button @click="tappedBpm = 0" class="text-xs text-gray-400 hover:text-red-500 underline">Rensa / Välj kategori istället</button>
                         </div>
                     </div>

                </div>
            </transition>

            <div class="mt-6 pt-4 border-t border-gray-200 flex gap-3">
                 <button 
                    @click="showFlagModal = true" 
                    class="p-3 rounded-lg border-2 border-gray-100 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all active:scale-95"
                    title="Rapportera fel"
                 >
                    <flag-icon class="w-3 h-3" aria-hidden="true" />
                 </button>

                 <button @click="skip" class="flex-1 flex items-center justify-center py-3 rounded-lg border-2 border-gray-200 text-gray-400 font-bold text-xs uppercase tracking-wider hover:bg-gray-100 hover:text-gray-700 transition-all active:scale-95">
                    Hoppa över
                </button>
            </div>
        </div>
      </div>
      
      <div v-else class="text-center py-12 px-4">
        <div class="bg-white rounded-2xl shadow-sm p-8">
            <h3 class="text-lg font-bold text-gray-900 mb-2">Kön är tom! 🎉</h3>
            <p class="text-sm text-gray-500 mb-6">Du har gått igenom alla tillgängliga låtar.</p>
            <button @click="triggerSummary" class="px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg">
                Se Resultat
            </button>
        </div>
      </div>

      <flag-track-modal
        :is-open="showFlagModal" 
        :track="activeTrack" 
        :exclude-correction="true"
        @close="showFlagModal = false"
        @refresh="handleReportSuccess"
      ></flag-track-modal>

    </div>
  `,
  setup(props, { emit }) {
    const view = ref('game');
    const tracks = ref([]);
    const loading = ref(false);
    const isFetching = ref(false);
    const sessionCount = ref(0);
    const streak = ref(0);
    const maxStreak = ref(0);
    const step = ref('style');
    const selectedStyle = ref(null);
    const offset = ref(0);
    const tappedBpm = ref(0);
    const showFlagModal = ref(false);
    
    let tapTimes = [];
    let lastTapTime = 0;

    const ranks = [{limit:0, title:'Novis', icon:'🌱'}, {limit:5, title:'Entusiast', icon:'🔥'}, {limit:15, title:'Expert', icon:'⚡'}, {limit:30, title:'Orakel', icon:'🔮'}, {limit:100, title:'Gudomlig', icon:'👑'}];
    const allStyles = ref([]);
    const tempos = [{label:'Långsamt', value:1, icon:'🐢'}, {label:'Lagom', value:3, icon:'🚶'}, {label:'Snabbt', value:4, icon:'🏃'}, {label:'Väldigt snabbt', value:5, icon:'🔥'}];
    
    const tempoLabels = {
        Slow: 'Långsamt',
        SlowMed: 'Lugnt',
        Medium: 'Lagom',
        Fast: 'Snabbt',
        Turbo: 'Väldigt snabbt',
    };

    const activeTrack = computed(() => tracks.value[0] || {});
    const isCurrentTrack = computed(() => props.currentTrack?.id === activeTrack.value.id);
    const currentRank = computed(() => [...ranks].reverse().find(r => sessionCount.value >= r.limit) || ranks[0]);
    const nextRank = computed(() => ranks.find(r => r.limit > sessionCount.value));
    const progressToNextRank = computed(() => nextRank.value ? Math.min(100, ((sessionCount.value - currentRank.value.limit) / (nextRank.value.limit - currentRank.value.limit)) * 100) : 100);

    const hasBpm = computed(() => activeTrack.value?.effective_bpm > 0);
    const aiTempoLabel = computed(() => {
        const cat = activeTrack.value?.tempo_category;
        return tempoLabels[cat] || cat || 'okänt';
    });

    const fetchStyles = async () => {
        try {
            const res = await fetch('/api/styles/tree');
            const tree = await res.json();
            const keys = Object.keys(tree);
            const pinned = ['Polska', 'Schottis', 'Vals', 'Hambo', 'Polkett', 'Snoa'];
            keys.sort((a, b) => {
                const idxA = pinned.indexOf(a);
                const idxB = pinned.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });
            allStyles.value = keys;
        } catch { allStyles.value = ['Polska', 'Schottis', 'Vals']; }
    };

    const fetchTracks = async () => {
        if (isFetching.value) return;
        isFetching.value = true;
        if (tracks.value.length === 0) loading.value = true;
        try {
            const params = new URLSearchParams({ sort: 'confidence', order: 'asc', limit: String(20), offset: String(offset.value) });
            const res = await fetch(`/api/tracks?${params.toString()}`);
            const data = await res.json();
            const currentIds = new Set(tracks.value.map(t => t.id));
            const newTracks = data.items.filter(t => !currentIds.has(t.id));
            if (newTracks.length > 0) { tracks.value.push(...newTracks); offset.value += 20; }
        } catch { showToast('Kunde inte hämta låtar', 'error'); } 
        finally { loading.value = false; isFetching.value = false; }
    };

    const togglePlayback = () => {
        if (!activeTrack.value?.id) return;
        if (isCurrentTrack.value && props.isPlaying) emit('stop');
        else emit('play', activeTrack.value);
    };

    const handleTap = () => {
        const now = Date.now();
        if (now - lastTapTime > 2000) tapTimes = [];
        lastTapTime = now;
        tapTimes.push(now);
        if (tapTimes.length > 1) {
            const intervals = [];
            for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i - 1]);
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            tappedBpm.value = 60000 / avgInterval;
        }
    };

    const selectStyle = (style) => {
        selectedStyle.value = style;
        step.value = 'tempo';
        tappedBpm.value = 0;
        tapTimes = [];
    };

    const finishVote = (tempoCategory = null, manualBpm = null, correction = "ok") => {
      if (!activeTrack.value?.id) return;
      
      sessionCount.value++;
      streak.value++;
      if (streak.value > maxStreak.value) maxStreak.value = streak.value;

      let msg = manualBpm ? `Sparat: ${Math.round(manualBpm)} BPM` : `Röstade: ${selectedStyle.value}`;
      if (streak.value > 1 && streak.value % 5 === 0) msg += ` 🔥 ${streak.value} i rad!`;
      showToast(msg, 'success');

      try {
          const id = getVoterId(); 
          fetch(`/api/tracks/${activeTrack.value.id}/feedback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Voter-ID': id },
              body: JSON.stringify({
                style: selectedStyle.value,
                mainStyle: selectedStyle.value,
                tempo_category: tempoCategory,
                manual_bpm: manualBpm ? Math.round(manualBpm) : null,
                tempo_correction: correction
              })
          })
          advance();
      } catch {
          showError('Något gick fel, försök igen');
      }
    };

    const advance = () => {
        tracks.value.shift();
        step.value = 'style';
        selectedStyle.value = null;
        tappedBpm.value = 0;
        if (tracks.value.length <= 5) fetchTracks();
        if (props.isPlaying && tracks.value.length > 0) setTimeout(() => emit('play', tracks.value[0]), 300);
    };

    const skip = () => {
        showToast('Hoppade över', 'info');
        streak.value = 0;
        advance();
    };
    
    const triggerSummary = () => { emit('stop'); view.value = 'summary'; };
    const resetGame = () => { sessionCount.value = 0; streak.value = 0; maxStreak.value = 0; view.value = 'game'; tracks.value = []; fetchTracks(); };
    
    const handleKey = (e) => { 
        if (e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') { e.preventDefault(); togglePlayback(); }
        if (e.code === 'ArrowRight') skip(); 
    };

    const handleReportSuccess = () => {
        advance();
    };

    onMounted(() => { fetchStyles(); fetchTracks(); window.addEventListener('keydown', handleKey); });
    onUnmounted(() => window.removeEventListener('keydown', handleKey));

    return {
      view, tracks, loading, step, selectedStyle, allStyles, tempos, activeTrack, isCurrentTrack,
      sessionCount, streak, maxStreak, currentRank, progressToNextRank, tappedBpm, hasBpm, aiTempoLabel,
      showFlagModal, handleReportSuccess,
      fetchTracks, togglePlayback, selectStyle, finishVote, skip, triggerSummary, resetGame, handleTap
    };
  }
};