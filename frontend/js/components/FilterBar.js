export default {
  name: 'FilterBar',
  template: /*html*/`
    <div class="mb-6 max-w-4xl mx-auto">
      <!-- Mobile View -->
      <div class="md:hidden">
        <!-- Search + Filter Toggle Row -->
        <div class="flex gap-2 mb-2">
          <div class="relative flex-1">
            <input
              v-model="localSearch"
              @input="debouncedSearch"
              type="text"
              placeholder="Sök låtnamn..."
              class="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
          <button 
            @click="isExpanded = !isExpanded"
            class="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            :class="{ 'bg-blue-50 border-blue-300': activeFilterCount > 0 }"
          >
            <svg class="w-5 h-5" :class="activeFilterCount > 0 ? 'text-blue-600' : 'text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
            </svg>
            <span v-if="activeFilterCount > 0" class="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{{ activeFilterCount }}</span>
          </button>
        </div>

        <!-- Expandable Filters -->
        <transition name="slide">
          <div v-if="isExpanded" class="bg-gray-50 rounded-xl p-4 space-y-4">
            <!-- Source Filter -->
            <div>
              <label class="text-xs font-medium text-gray-600 mb-2 block">Källa</label>
              <div class="flex gap-2">
                <button 
                  @click="toggleSource('spotify')"
                  class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  :class="localSource === 'spotify' ? 'bg-green-100 text-green-700 border-2 border-green-400' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Spotify
                </button>
                <button 
                  @click="toggleSource('youtube')"
                  class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  :class="localSource === 'youtube' ? 'bg-red-100 text-red-700 border-2 border-red-400' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube
                </button>
              </div>
            </div>

            <!-- Vocals Filter -->
            <div>
              <label class="text-xs font-medium text-gray-600 mb-2 block">Sång</label>
              <div class="flex rounded-lg overflow-hidden border border-gray-200 bg-white">
                <button 
                  @click="setVocals('')"
                  class="flex-1 px-3 py-2 text-sm font-medium transition-colors"
                  :class="localVocals === '' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
                >
                  Alla
                </button>
                <button 
                  @click="setVocals('instrumental')"
                  class="flex-1 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200"
                  :class="localVocals === 'instrumental' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
                >
                  🎻 Instrumental
                </button>
                <button 
                  @click="setVocals('vocals')"
                  class="flex-1 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200"
                  :class="localVocals === 'vocals' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
                >
                  🎤 Sång
                </button>
              </div>

            </div>

            <!-- User Confirmed Filter -->
            <div>
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-gray-600">Bekräftad dansstil</label>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="localStyleConfirmed" @change="$emit('update:styleConfirmed', localStyleConfirmed)" class="sr-only peer">
                  <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <!-- Discovery Filters (hidden when searching) -->
            <template v-if="!localSearch">
              <!-- Style Dropdown -->
              <div>
                <label class="text-xs font-medium text-gray-600 mb-2 block">Dansstil</label>
                <select 
                  v-model="localStyle" 
                  @change="$emit('update:style', localStyle)"
                  class="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Alla stilar</option>
                  <option v-for="style in styles" :key="style" :value="style">{{ style }}</option>
                </select>
              </div>

              <!-- Duration Dropdown -->
              <div>
                <label class="text-xs font-medium text-gray-600 mb-2 block">Längd</label>
                <select 
                  v-model="localDuration" 
                  @change="emitDuration"
                  class="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Alla längder</option>
                  <option value="short">Kort (&lt; 3 min)</option>
                  <option value="medium">Medium (3-5 min)</option>
                  <option value="long">Lång (&gt; 5 min)</option>
                </select>
              </div>

              <!-- Tempo Slider -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-xs font-medium text-gray-600">Tempo</label>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="localTempoEnabled" @change="$emit('update:tempoEnabled', localTempoEnabled)" class="sr-only peer">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div class="space-y-2" :class="{ 'opacity-40 pointer-events-none': !localTempoEnabled }">
                  <div class="relative h-2">
                    <!-- Grey track background -->
                    <div class="absolute top-0 w-full h-full bg-gray-200 rounded-lg"></div>
                    <!-- Range highlight background -->
                    <div class="absolute top-0 h-full bg-blue-300 rounded-lg" :style="{ left: rangeLeftPct + '%', width: rangeWidthPct + '%' }"></div>
                    <!-- Slider track -->
                    <input 
                      type="range" 
                      v-model.number="localTargetTempo"
                      @input="$emit('update:targetTempo', localTargetTempo)"
                      min="60" 
                      max="200" 
                      class="absolute top-0 w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  <div class="text-center text-sm" :class="localTempoEnabled ? 'text-gray-600' : 'text-gray-400'">
                    {{ computedMin }} - {{ computedMax }} BPM
                  </div>
                </div>
              </div>
            </template>

            <!-- Clear Filters Button -->
            <button 
              v-if="activeFilterCount > 0"
              @click="clearAllFilters"
              class="w-full py-2 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Rensa alla filter
            </button>
          </div>
        </transition>
      </div>

      <!-- Desktop View -->
      <div class="hidden md:block space-y-4">
        <!-- Search Bar -->
        <div class="relative">
          <input
            v-model="localSearch"
            @input="debouncedSearch"
            type="text"
            placeholder="Sök låtnamn..."
            class="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>

        <!-- Quick Filters Row -->
        <div class="flex flex-wrap gap-4 items-center">
          <!-- Source Filters -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Källa:</span>
            <button 
              @click="toggleSource('spotify')"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              :class="localSource === 'spotify' ? 'bg-green-100 text-green-700 ring-2 ring-green-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Spotify
            </button>
            <button 
              @click="toggleSource('youtube')"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              :class="localSource === 'youtube' ? 'bg-red-100 text-red-700 ring-2 ring-red-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              YouTube
            </button>
          </div>

          <!-- Vocals Filter -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Sång:</span>
            <div class="flex rounded-full overflow-hidden border border-gray-200 bg-white">
              <button 
                @click="setVocals('')"
                class="px-3 py-1.5 text-sm font-medium transition-colors"
                :class="localVocals === '' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
              >
                Alla
              </button>
              <button 
                @click="setVocals('instrumental')"
                class="px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200"
                :class="localVocals === 'instrumental' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
              >
                🎻 Instrumental
              </button>
              <button 
                @click="setVocals('vocals')"
                class="px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200"
                :class="localVocals === 'vocals' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
              >
                🎤 Sång
              </button>
            </div>
          </div>

          <!-- User Confirmed Filter -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Bekräftad dansstil:</span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="localStyleConfirmed" @change="$emit('update:styleConfirmed', localStyleConfirmed)" class="sr-only peer">
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <!-- Discovery Filters (hidden when searching) -->
        <div v-if="!localSearch" class="flex flex-wrap gap-4 items-end">
          <!-- Style Dropdown -->
          <div class="min-w-[160px]">
            <label class="text-xs font-medium text-gray-600 mb-1 block">Dansstil</label>
            <select 
              v-model="localStyle" 
              @change="$emit('update:style', localStyle)"
              class="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Alla stilar</option>
              <option v-for="style in styles" :key="style" :value="style">{{ style }}</option>
            </select>
          </div>

          <!-- Duration Dropdown -->
          <div class="min-w-[140px]">
            <label class="text-xs font-medium text-gray-600 mb-1 block">Längd</label>
            <select 
              v-model="localDuration" 
              @change="emitDuration"
              class="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Alla längder</option>
              <option value="short">Kort (&lt; 3 min)</option>
              <option value="medium">Medium (3-5 min)</option>
              <option value="long">Lång (&gt; 5 min)</option>
            </select>
          </div>

          <!-- Tempo Slider with Toggle -->
          <div class="flex-1 min-w-[200px]">
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium text-gray-600">Tempo</label>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="localTempoEnabled" @change="$emit('update:tempoEnabled', localTempoEnabled)" class="sr-only peer">
                <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div class="flex gap-3 items-center" :class="{ 'opacity-40 pointer-events-none': !localTempoEnabled }">
              <span class="text-xs text-gray-400">60</span>
              <div class="relative flex-1 h-2">
                <!-- Grey track background -->
                <div class="absolute top-0 w-full h-full bg-gray-200 rounded-lg"></div>
                <!-- Range highlight background -->
                <div class="absolute top-0 h-full bg-blue-300 rounded-lg" :style="{ left: rangeLeftPct + '%', width: rangeWidthPct + '%' }"></div>
                <!-- Slider track -->
                <input 
                  type="range" 
                  v-model.number="localTargetTempo"
                  @input="$emit('update:targetTempo', localTargetTempo)"
                  min="60" 
                  max="200" 
                  class="absolute top-0 w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <span class="text-xs text-gray-400">200</span>
              <span class="text-sm whitespace-nowrap" :class="localTempoEnabled ? 'text-gray-600' : 'text-gray-400'">
                {{ computedMin }}-{{ computedMax }} BPM
              </span>
            </div>
          </div>
        </div>

        <!-- Active Filters Tags -->
        <div v-if="activeFilterCount > 0" class="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
          <span class="text-xs text-gray-500">Aktiva filter:</span>
          
          <span v-if="localSearch" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            Sök: "{{ localSearch }}"
            <button @click="clearSearch" class="hover:text-blue-900">×</button>
          </span>
          
          <span v-if="localSource" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {{ localSource === 'spotify' ? 'Spotify' : 'YouTube' }}
            <button @click="clearSource" class="hover:text-blue-900">×</button>
          </span>
          
          <span v-if="localVocals" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {{ localVocals === 'instrumental' ? 'Instrumental' : 'Med sång' }}
            <button @click="clearVocals" class="hover:text-blue-900">×</button>
          </span>

          <span v-if="localStyleConfirmed" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            Bekräftad dansstil
            <button @click="clearstyleConfirmed" class="hover:text-blue-900">×</button>
          </span>

          <span v-if="localStyle" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {{ localStyle }}
            <button @click="clearStyle" class="hover:text-blue-900">×</button>
          </span>
          
          <span v-if="localDuration" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {{ durationLabel }}
            <button @click="clearDuration" class="hover:text-blue-900">×</button>
          </span>
          
          <span v-if="localTempoEnabled" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {{ computedMin }}-{{ computedMax }} BPM
            <button @click="clearTempo" class="hover:text-blue-900">×</button>
          </span>
          
          <button 
            @click="clearAllFilters"
            class="ml-2 text-xs text-red-600 hover:text-red-700 font-medium"
          >
            Rensa alla
          </button>
        </div>
      </div>
    </div>
  `,
  props: {
    style: { type: String, default: '' },
    styles: { type: Array, default: () => [] },
    search: { type: String, default: '' },
    source: { type: String, default: '' },
    vocals: { type: String, default: '' },
    styleConfirmed: { type: Boolean, default: false },
    minDuration: { type: Number, default: null },
    maxDuration: { type: Number, default: null },
    targetTempo: { type: Number, default: 130 },
    tempoEnabled: { type: Boolean, default: false },
    computedMin: { type: Number, default: 120 },
    computedMax: { type: Number, default: 140 }
  },
  emits: ['update:style', 'update:search', 'update:source', 'update:vocals', 'update:styleConfirmed', 'update:minDuration', 'update:maxDuration', 'update:targetTempo', 'update:tempoEnabled'],
  data() {
    return {
      isExpanded: false,
      localStyle: this.style,
      localSearch: this.search,
      localSource: this.source,
      localVocals: this.vocals,
      localStyleConfirmed: this.styleConfirmed,
      localDuration: this.getDurationPreset(),
      localTargetTempo: this.targetTempo,
      localTempoEnabled: this.tempoEnabled,
      searchTimeout: null
    };
  },
  computed: {
    activeFilterCount() {
      let count = 0;
      if (this.localSearch) count++;
      if (this.localSource) count++;
      if (this.localVocals) count++;
      if (this.localStyleConfirmed) count++;
      if (this.localStyle) count++;
      if (this.localDuration) count++;
      if (this.localTempoEnabled) count++;
      return count;
    },
    durationLabel() {
      const labels = {
        'short': 'Kort (< 3 min)',
        'medium': 'Medium (3-5 min)',
        'long': 'Lång (> 5 min)'
      };
      return labels[this.localDuration] || '';
    },
    rangeLeftPct() {
      const min = 60, max = 200;
      const rangeStart = Math.max(min, this.computedMin);
      return ((rangeStart - min) / (max - min)) * 100;
    },
    rangeWidthPct() {
      const min = 60, max = 200;
      const rangeStart = Math.max(min, this.computedMin);
      const rangeEnd = Math.min(max, this.computedMax);
      return ((rangeEnd - rangeStart) / (max - min)) * 100;
    }
  },
  watch: {
    style(val) { this.localStyle = val; },
    search(val) { this.localSearch = val; },
    source(val) { this.localSource = val; },
    vocals(val) { this.localVocals = val; },
    styleConfirmed(val) { this.localStyleConfirmed = val; },
    targetTempo(val) { this.localTargetTempo = val; },
    tempoEnabled(val) { this.localTempoEnabled = val; },
    minDuration() { this.localDuration = this.getDurationPreset(); },
    maxDuration() { this.localDuration = this.getDurationPreset(); }
  },
  methods: {
    getDurationPreset() {
      if (this.minDuration === null && this.maxDuration === null) return '';
      if (this.maxDuration === 180 && this.minDuration === null) return 'short';
      if (this.minDuration === 180 && this.maxDuration === 300) return 'medium';
      if (this.minDuration === 300 && this.maxDuration === null) return 'long';
      return '';
    },
    debouncedSearch() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.$emit('update:search', this.localSearch);
      }, 300);
    },
    toggleSource(source) {
      this.localSource = this.localSource === source ? '' : source;
      this.$emit('update:source', this.localSource);
    },
    setVocals(value) {
      this.localVocals = value;
      this.$emit('update:vocals', this.localVocals);
    },
    toggleTempoEnabled() {
      this.localTempoEnabled = !this.localTempoEnabled;
      this.$emit('update:tempoEnabled', this.localTempoEnabled);
    },
    emitDuration() {
      switch (this.localDuration) {
        case 'short':
          this.$emit('update:minDuration', null);
          this.$emit('update:maxDuration', 180);
          break;
        case 'medium':
          this.$emit('update:minDuration', 180);
          this.$emit('update:maxDuration', 300);
          break;
        case 'long':
          this.$emit('update:minDuration', 300);
          this.$emit('update:maxDuration', null);
          break;
        default:
          this.$emit('update:minDuration', null);
          this.$emit('update:maxDuration', null);
      }
    },
    clearSearch() {
      this.localSearch = '';
      this.$emit('update:search', '');
    },
    clearSource() {
      this.localSource = '';
      this.$emit('update:source', '');
    },
    clearVocals() {
      this.localVocals = '';
      this.$emit('update:vocals', '');
    },
    clearstyleConfirmed() {
      this.localStyleConfirmed = false;
      this.$emit('update:styleConfirmed', false);
    },
    clearStyle() {
      this.localStyle = '';
      this.$emit('update:style', '');
    },
    clearDuration() {
      this.localDuration = '';
      this.$emit('update:minDuration', null);
      this.$emit('update:maxDuration', null);
    },
    clearTempo() {
      this.localTempoEnabled = false;
      this.$emit('update:tempoEnabled', false);
    },
    clearAllFilters() {
      this.clearSearch();
      this.clearSource();
      this.clearVocals();
      this.clearstyleConfirmed();
      this.clearStyle();
      this.clearDuration();
      this.clearTempo();
    }
  }
};
