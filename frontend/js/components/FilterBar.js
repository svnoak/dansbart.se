export default {
  name: 'FilterBar',
  template: /*html*/ `
    <div class="mb-6 max-w-4xl mx-auto">
      <div class="md:hidden">
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
            :aria-expanded="isExpanded"
            :aria-label="isExpanded ? 'Stäng filter' : 'Visa filter' + (activeFilterCount > 0 ? ' (' + activeFilterCount + ' aktiva)' : '')">
            <svg class="w-5 h-5" :class="activeFilterCount > 0 ? 'text-blue-600' : 'text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
            </svg>
            <span v-if="activeFilterCount > 0" class="bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full" aria-hidden="true">{{ activeFilterCount }}</span>
          </button>
        </div>

        <transition name="slide">
          <div v-if="isExpanded" class="bg-gray-50 rounded-xl p-4 space-y-4">
            
            <div>
              <label class="text-xs font-medium text-gray-600 mb-2 block">Källa</label>
              <div class="flex gap-2" role="group" aria-label="Välj musikkälla">
                <button
                  @click="toggleSource('spotify')"
                  class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  :class="localSource === 'spotify' ? 'bg-green-100 text-green-700 border-2 border-green-400' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'"
                  :aria-pressed="localSource === 'spotify'"
                  aria-label="Visa endast Spotify-låtar">
                  <span>Spotify</span>
                </button>
                <button
                  @click="toggleSource('youtube')"
                  class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  :class="localSource === 'youtube' ? 'bg-red-100 text-red-700 border-2 border-red-400' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'"
                  :aria-pressed="localSource === 'youtube'"
                  aria-label="Visa endast YouTube-låtar">
                  <span>YouTube</span>
                </button>
              </div>
            </div>

            <template v-if="!localSearch">
              
              <div>
                <label for="mobile-category-select" class="text-xs font-medium text-gray-600 mb-2 block">Kategori</label>
                <select id="mobile-category-select" v-model="localMainStyle" @change="onMainStyleChange" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500" aria-label="Filtrera på dansstilskategori">
                  <option value="">Alla Kategorier</option>
                  <option v-for="(subStyles, main) in styleTree" :key="main" :value="main">{{ main }}</option>
                </select>
              </div>

              <div>
                <label for="mobile-substyle-select" class="text-xs font-medium text-gray-600 mb-2 block">Specifik Dans</label>
                <select id="mobile-substyle-select" v-model="localSubStyle" @change="onSubStyleChange" :disabled="!localMainStyle" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400" aria-label="Filtrera på specifik dansstil">
                  <option value="">{{ localMainStyle ? 'Alla ' + localMainStyle + ' varianter' : 'Välj kategori först' }}</option>
                  <option v-for="style in availableSubStyles" :key="style" :value="style">{{ style }}</option>
                </select>
              </div>

              <div>
                <label for="mobile-duration-select" class="text-xs font-medium text-gray-600 mb-2 block">Längd</label>
                <select id="mobile-duration-select" v-model="localDuration" @change="emitDuration" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500" aria-label="Filtrera på låtlängd">
                  <option value="">Alla längder</option>
                  <option value="short">Kort (&lt; 3 min)</option>
                  <option value="medium">Medium (3-5 min)</option>
                  <option value="long">Lång (&gt; 5 min)</option>
                </select>
              </div>

              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-xs font-medium text-gray-600">Tempo</label>
                  <label class="relative inline-flex items-center cursor-pointer" @keydown.enter.prevent="localTempoEnabled = !localTempoEnabled; $emit('update:tempoEnabled', localTempoEnabled)" @keydown.space.prevent="localTempoEnabled = !localTempoEnabled; $emit('update:tempoEnabled', localTempoEnabled)">
                    <input type="checkbox" v-model="localTempoEnabled" @change="$emit('update:tempoEnabled', localTempoEnabled)" class="sr-only peer" aria-label="Aktivera tempofilter" tabindex="0">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div class="space-y-2" :class="{ 'opacity-40 pointer-events-none': !localTempoEnabled }">
                  <div class="relative h-2">
                    <div class="absolute top-0 w-full h-full bg-gray-200 rounded-lg"></div>
                    <div class="absolute top-0 h-full bg-blue-300 rounded-lg" :style="{ left: rangeLeftPct + '%', width: rangeWidthPct + '%' }"></div>
                    <input type="range" v-model.number="localTargetTempo" @input="$emit('update:targetTempo', localTargetTempo)" min="60" max="200" class="absolute top-0 w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <div class="text-center text-sm" :class="localTempoEnabled ? 'text-gray-600' : 'text-gray-400'">{{ computedMin }} - {{ computedMax }} BPM</div>
                </div>
              </div>
            </template>

            <div>
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-gray-600">Bekräftad dansstil</label>
                <label class="relative inline-flex items-center cursor-pointer" @keydown.enter.prevent="localStyleConfirmed = !localStyleConfirmed; $emit('update:styleConfirmed', localStyleConfirmed)" @keydown.space.prevent="localStyleConfirmed = !localStyleConfirmed; $emit('update:styleConfirmed', localStyleConfirmed)">
                  <input type="checkbox" v-model="localStyleConfirmed" @change="$emit('update:styleConfirmed', localStyleConfirmed)" class="sr-only peer" aria-label="Bekräftad dansstil" tabindex="0">
                  <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div class="border-t border-gray-200 pt-3">
              <button
                @click="advancedExpanded = !advancedExpanded"
                class="w-full flex items-center justify-between text-xs font-medium text-gray-600 hover:text-gray-800"
                :aria-expanded="advancedExpanded"
                aria-label="Växla avancerad sökning">
                <span>Avancerad sökning</span>
                <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': advancedExpanded }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              <transition name="slide">
                <div v-if="advancedExpanded" class="mt-3 space-y-4">
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <label class="text-xs font-medium text-gray-600">Studsighet</label>
                      <label class="relative inline-flex items-center cursor-pointer" @keydown.enter.prevent="localBouncinessEnabled = !localBouncinessEnabled; $emit('update:bouncinessEnabled', localBouncinessEnabled)" @keydown.space.prevent="localBouncinessEnabled = !localBouncinessEnabled; $emit('update:bouncinessEnabled', localBouncinessEnabled)">
                        <input type="checkbox" v-model="localBouncinessEnabled" @change="$emit('update:bouncinessEnabled', localBouncinessEnabled)" class="sr-only peer" aria-label="Aktivera studsighetsfilter" tabindex="0">
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div :class="{ 'opacity-40 pointer-events-none': !localBouncinessEnabled }">
                      <div class="flex gap-2 items-center mb-2">
                        <span class="text-xs text-gray-500">Mjuk</span>
                        <input type="range" v-model.number="localMinBounciness" @input="emitBounciness" min="0" max="1" step="0.1" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                        <span class="text-xs text-gray-500">Studsig</span>
                      </div>
                      <div class="text-center text-xs text-gray-500">{{ localMinBounciness.toFixed(1) }} - {{ localMaxBounciness.toFixed(1) }}</div>
                    </div>
                  </div>

                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <label class="text-xs font-medium text-gray-600">Artikulation</label>
                      <label class="relative inline-flex items-center cursor-pointer" @keydown.enter.prevent="localArticulationEnabled = !localArticulationEnabled; $emit('update:articulationEnabled', localArticulationEnabled)" @keydown.space.prevent="localArticulationEnabled = !localArticulationEnabled; $emit('update:articulationEnabled', localArticulationEnabled)">
                        <input type="checkbox" v-model="localArticulationEnabled" @change="$emit('update:articulationEnabled', localArticulationEnabled)" class="sr-only peer" aria-label="Aktivera artikulationsfilter" tabindex="0">
                        <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <div :class="{ 'opacity-40 pointer-events-none': !localArticulationEnabled }">
                      <div class="flex gap-2 items-center mb-2">
                        <span class="text-xs text-gray-500">Flytande</span>
                        <input type="range" v-model.number="localMinArticulation" @input="emitArticulation" min="0" max="1" step="0.1" class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                        <span class="text-xs text-gray-500">Tydlig</span>
                      </div>
                      <div class="text-center text-xs text-gray-500">{{ localMinArticulation.toFixed(1) }} - {{ localMaxArticulation.toFixed(1) }}</div>
                    </div>
                  </div>
                </div>
              </transition>
            </div>

            <button v-if="activeFilterCount > 0" @click="clearAllFilters" class="w-full py-2 text-sm text-red-600 hover:text-red-700 font-medium">Rensa alla filter</button>
          </div>
        </transition>
      </div>

      <div class="hidden md:block space-y-4">
        <div class="relative">
          <input v-model="localSearch" @input="debouncedSearch" type="text" placeholder="Sök låtnamn..." class="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>

        <div class="flex flex-wrap gap-4 items-center">
          <div class="flex items-center gap-2" role="group" aria-label="Välj musikkälla">
            <span class="text-sm text-gray-500">Källa:</span>
            <button
              @click="toggleSource('spotify')"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              :class="localSource === 'spotify' ? 'bg-green-100 text-green-700 ring-2 ring-green-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
              :aria-pressed="localSource === 'spotify'"
              aria-label="Visa endast Spotify-låtar">Spotify</button>
            <button
              @click="toggleSource('youtube')"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              :class="localSource === 'youtube' ? 'bg-red-100 text-red-700 ring-2 ring-red-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
              :aria-pressed="localSource === 'youtube'"
              aria-label="Visa endast YouTube-låtar">YouTube</button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-500">Bekräftad dansstil:</span>
            <label class="relative inline-flex items-center cursor-pointer" @keydown.enter.prevent="localStyleConfirmed = !localStyleConfirmed; $emit('update:styleConfirmed', localStyleConfirmed)" @keydown.space.prevent="localStyleConfirmed = !localStyleConfirmed; $emit('update:styleConfirmed', localStyleConfirmed)">
              <input type="checkbox" v-model="localStyleConfirmed" @change="$emit('update:styleConfirmed', localStyleConfirmed)" class="sr-only peer" aria-label="Bekräftad dansstil" tabindex="0">
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">Sång:</span>
              <div class="flex rounded-lg overflow-hidden border border-gray-200 bg-white" role="group" aria-label="Filtrera på sång eller instrumental">
                <button
                  @click="setVocals('')"
                  class="px-3 py-1.5 text-sm font-medium transition-colors"
                  :class="localVocals === '' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
                  :aria-pressed="localVocals === ''"
                  aria-label="Visa alla låtar">
                  Alla
                </button>
                <button
                  @click="setVocals('instrumental')"
                  class="px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200"
                  :class="localVocals === 'instrumental' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
                  :aria-pressed="localVocals === 'instrumental'"
                  aria-label="Visa endast instrumentala låtar">
                  <span aria-hidden="true">🎻</span> Instrumental
                </button>
                <button
                  @click="setVocals('vocals')"
                  class="px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200"
                  :class="localVocals === 'vocals' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'"
                  :aria-pressed="localVocals === 'vocals'"
                  aria-label="Visa endast låtar med sång">
                  <span aria-hidden="true">🎤</span> Sång
                </button>
              </div>
            </div>
        </div>           

        <div v-if="!localSearch" class="flex flex-wrap gap-4 items-end">
          
          <div class="min-w-[160px]">
            <label for="desktop-category-select" class="text-xs font-medium text-gray-600 mb-1 block">Kategori</label>
            <select id="desktop-category-select" v-model="localMainStyle" @change="onMainStyleChange" class="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500" aria-label="Filtrera på dansstilskategori">
              <option value="">Alla Kategorier</option>
              <option v-for="(subStyles, main) in styleTree" :key="main" :value="main">{{ main }}</option>
            </select>
          </div>

          <div class="min-w-[160px]">
            <label for="desktop-substyle-select" class="text-xs font-medium text-gray-600 mb-1 block">Specifik Dans</label>
            <select id="desktop-substyle-select" v-model="localSubStyle" @change="onSubStyleChange" :disabled="!localMainStyle" class="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400" aria-label="Filtrera på specifik dansstil">
              <option value="">{{ localMainStyle ? 'Alla ' + localMainStyle + ' varianter' : 'Välj kategori först' }}</option>
              <option v-for="style in availableSubStyles" :key="style" :value="style">{{ style }}</option>
            </select>
          </div>

          <div class="min-w-[140px]">
            <label for="desktop-duration-select" class="text-xs font-medium text-gray-600 mb-1 block">Längd</label>
            <select id="desktop-duration-select" v-model="localDuration" @change="emitDuration" class="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" aria-label="Filtrera på låtlängd">
              <option value="">Alla längder</option>
              <option value="short">Kort (&lt; 3 min)</option>
              <option value="medium">Medium (3-5 min)</option>
              <option value="long">Lång (&gt; 5 min)</option>
            </select>
          </div>

          <div class="flex-1 min-w-[200px]">
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium text-gray-600">Tempo</label>
              <label class="relative inline-flex items-center cursor-pointer" @keydown.enter.prevent="localTempoEnabled = !localTempoEnabled; $emit('update:tempoEnabled', localTempoEnabled)" @keydown.space.prevent="localTempoEnabled = !localTempoEnabled; $emit('update:tempoEnabled', localTempoEnabled)">
                <input type="checkbox" v-model="localTempoEnabled" @change="$emit('update:tempoEnabled', localTempoEnabled)" class="sr-only peer" aria-label="Aktivera tempofilter" tabindex="0">
                <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div class="flex gap-3 items-center" :class="{ 'opacity-40 pointer-events-none': !localTempoEnabled }">
              <span class="text-xs text-gray-400">60</span>
              <div class="relative flex-1 h-2">
                <div class="absolute top-0 w-full h-full bg-gray-200 rounded-lg"></div>
                <div class="absolute top-0 h-full bg-blue-300 rounded-lg" :style="{ left: rangeLeftPct + '%', width: rangeWidthPct + '%' }"></div>
                <input type="range" v-model.number="localTargetTempo" @input="$emit('update:targetTempo', localTargetTempo)" min="60" max="200" class="absolute top-0 w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>
              <span class="text-xs text-gray-400">200</span>
              <span class="text-sm whitespace-nowrap" :class="localTempoEnabled ? 'text-gray-600' : 'text-gray-400'">{{ computedMin }}-{{ computedMax }} BPM</span>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-100 pt-4">
          <button
            @click="advancedExpanded = !advancedExpanded"
            class="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 mb-3"
            :aria-expanded="advancedExpanded"
            aria-label="Växla avancerad sökning">
            <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': advancedExpanded }" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
            <span>Avancerad sökning</span>
          </button>

          <transition name="slide">
            <div v-if="advancedExpanded" class="flex flex-wrap gap-4 items-end">
              <div class="min-w-[200px]">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-medium text-gray-600">Studsighet</label>
                  <label class="relative inline-flex items-center cursor-pointer" @keydown.enter.prevent="localBouncinessEnabled = !localBouncinessEnabled; $emit('update:bouncinessEnabled', localBouncinessEnabled)" @keydown.space.prevent="localBouncinessEnabled = !localBouncinessEnabled; $emit('update:bouncinessEnabled', localBouncinessEnabled)">
                    <input type="checkbox" v-model="localBouncinessEnabled" @change="$emit('update:bouncinessEnabled', localBouncinessEnabled)" class="sr-only peer" aria-label="Aktivera studsighetsfilter" tabindex="0">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div class="flex gap-3 items-center" :class="{ 'opacity-40 pointer-events-none': !localBouncinessEnabled }">
                  <span class="text-xs text-gray-400">Mjuk</span>
                  <div class="relative flex-1">
                    <input type="range" v-model.number="localMinBounciness" @input="emitBounciness" min="0" max="1" step="0.1" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <span class="text-xs text-gray-400">Studsig</span>
                  <span class="text-sm whitespace-nowrap" :class="localBouncinessEnabled ? 'text-gray-600' : 'text-gray-400'">{{ localMinBounciness.toFixed(1) }}-{{ localMaxBounciness.toFixed(1) }}</span>
                </div>
              </div>

              <div class="min-w-[200px]">
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-medium text-gray-600">Artikulation</label>
                  <label class="relative inline-flex items-center cursor-pointer" @keydown.enter.prevent="localArticulationEnabled = !localArticulationEnabled; $emit('update:articulationEnabled', localArticulationEnabled)" @keydown.space.prevent="localArticulationEnabled = !localArticulationEnabled; $emit('update:articulationEnabled', localArticulationEnabled)">
                    <input type="checkbox" v-model="localArticulationEnabled" @change="$emit('update:articulationEnabled', localArticulationEnabled)" class="sr-only peer" aria-label="Aktivera artikulationsfilter" tabindex="0">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div class="flex gap-3 items-center" :class="{ 'opacity-40 pointer-events-none': !localArticulationEnabled }">
                  <span class="text-xs text-gray-400">Flytande</span>
                  <div class="relative flex-1">
                    <input type="range" v-model.number="localMinArticulation" @input="emitArticulation" min="0" max="1" step="0.1" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <span class="text-xs text-gray-400">Tydlig</span>
                  <span class="text-sm whitespace-nowrap" :class="localArticulationEnabled ? 'text-gray-600' : 'text-gray-400'">{{ localMinArticulation.toFixed(1) }}-{{ localMaxArticulation.toFixed(1) }}</span>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <div v-if="activeFilterCount > 0" class="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100">
          <span class="text-xs text-gray-500">Aktiva filter:</span>
          
          <span v-if="localSearch" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            Sök: "{{ localSearch }}"
            <button @click="clearSearch" class="hover:text-blue-900">×</button>
          </span>
          
          <span v-if="localMainStyle" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            Kategori: {{ localMainStyle }}
            <button @click="clearMainStyle" class="hover:text-blue-900">×</button>
          </span>

          <span v-if="localSubStyle" class="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
            Dans: {{ localSubStyle }}
            <button @click="clearSubStyle" class="hover:text-purple-900">×</button>
          </span>
          
          <span v-if="localSource" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {{ localSource === 'spotify' ? 'Spotify' : 'YouTube' }}
            <button @click="clearSource" class="hover:text-blue-900">×</button>
          </span>
          
          <span v-if="localStyleConfirmed" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            Bekräftad dansstil
            <button @click="clearstyleConfirmed" class="hover:text-blue-900">×</button>
          </span>
          
          <span v-if="localDuration" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {{ durationLabel }}
            <button @click="clearDuration" class="hover:text-blue-900">×</button>
          </span>
          
          <span v-if="localTempoEnabled" class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {{ computedMin }}-{{ computedMax }} BPM
            <button @click="clearTempo" class="hover:text-blue-900">×</button>
          </span>

          <span v-if="localBouncinessEnabled" class="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
            Studsighet: {{ localMinBounciness.toFixed(1) }}-{{ localMaxBounciness.toFixed(1) }}
            <button @click="clearBounciness" class="hover:text-purple-900">×</button>
          </span>

          <span v-if="localArticulationEnabled" class="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
            Artikulation: {{ localMinArticulation.toFixed(1) }}-{{ localMaxArticulation.toFixed(1) }}
            <button @click="clearArticulation" class="hover:text-purple-900">×</button>
          </span>

          <button @click="clearAllFilters" class="ml-2 text-xs text-red-600 hover:text-red-700 font-medium">Rensa alla</button>
        </div>
      </div>
    </div>
  `,
  props: {
    // NEW PROPS
    styleTree: { type: Object, default: () => ({}) },
    mainStyle: { type: String, default: '' },
    subStyle: { type: String, default: '' },
    // Removed 'style' and 'styles' props
    search: { type: String, default: '' },
    source: { type: String, default: '' },
    vocals: { type: String, default: '' },
    styleConfirmed: { type: Boolean, default: false },
    minDuration: { type: Number, default: null },
    maxDuration: { type: Number, default: null },
    targetTempo: { type: Number, default: 130 },
    tempoEnabled: { type: Boolean, default: false },
    computedMin: { type: Number, default: 120 },
    computedMax: { type: Number, default: 140 },
    // Audio feature filters
    minBounciness: { type: Number, default: null },
    maxBounciness: { type: Number, default: null },
    bouncinessEnabled: { type: Boolean, default: false },
    minArticulation: { type: Number, default: null },
    maxArticulation: { type: Number, default: null },
    articulationEnabled: { type: Boolean, default: false },
  },
  emits: [
    'update:mainStyle',
    'update:subStyle',
    'update:search',
    'update:source',
    'update:vocals',
    'update:styleConfirmed',
    'update:minDuration',
    'update:maxDuration',
    'update:targetTempo',
    'update:tempoEnabled',
    'update:minBounciness',
    'update:maxBounciness',
    'update:bouncinessEnabled',
    'update:minArticulation',
    'update:maxArticulation',
    'update:articulationEnabled',
  ],
  data() {
    return {
      isExpanded: false,
      advancedExpanded: false,
      localMainStyle: this.mainStyle,
      localSubStyle: this.subStyle,
      localSearch: this.search,
      localSource: this.source,
      localVocals: this.vocals,
      localStyleConfirmed: this.styleConfirmed,
      localDuration: this.getDurationPreset(),
      localTargetTempo: this.targetTempo,
      localTempoEnabled: this.tempoEnabled,
      localMinBounciness: this.minBounciness || 0,
      localMaxBounciness: this.maxBounciness || 1,
      localBouncinessEnabled: this.bouncinessEnabled,
      localMinArticulation: this.minArticulation || 0,
      localMaxArticulation: this.maxArticulation || 1,
      localArticulationEnabled: this.articulationEnabled,
      searchTimeout: null,
    };
  },
  computed: {
    availableSubStyles() {
      if (!this.localMainStyle || !this.styleTree[this.localMainStyle]) return [];
      return this.styleTree[this.localMainStyle];
    },
    activeFilterCount() {
      let count = 0;
      if (this.localSearch) count++;
      if (this.localSource) count++;
      if (this.localVocals) count++;
      if (this.localStyleConfirmed) count++;
      if (this.localMainStyle) count++; // Count main
      if (this.localSubStyle) count++; // Count sub
      if (this.localDuration) count++;
      if (this.localTempoEnabled) count++;
      if (this.localBouncinessEnabled) count++;
      if (this.localArticulationEnabled) count++;
      return count;
    },
    durationLabel() {
      const labels = {
        short: 'Kort (< 3 min)',
        medium: 'Medium (3-5 min)',
        long: 'Lång (> 5 min)',
      };
      return labels[this.localDuration] || '';
    },
    rangeLeftPct() {
      const min = 60,
        max = 200;
      const rangeStart = Math.max(min, this.computedMin);
      return ((rangeStart - min) / (max - min)) * 100;
    },
    rangeWidthPct() {
      const min = 60,
        max = 200;
      const rangeStart = Math.max(min, this.computedMin);
      const rangeEnd = Math.min(max, this.computedMax);
      return ((rangeEnd - rangeStart) / (max - min)) * 100;
    },
  },
  watch: {
    mainStyle(val) {
      this.localMainStyle = val;
    },
    subStyle(val) {
      this.localSubStyle = val;
    },
    search(val) {
      this.localSearch = val;
    },
    source(val) {
      this.localSource = val;
    },
    vocals(val) {
      this.localVocals = val;
    },
    styleConfirmed(val) {
      this.localStyleConfirmed = val;
    },
    targetTempo(val) {
      this.localTargetTempo = val;
    },
    tempoEnabled(val) {
      this.localTempoEnabled = val;
    },
    minDuration() {
      this.localDuration = this.getDurationPreset();
    },
    maxDuration() {
      this.localDuration = this.getDurationPreset();
    },
  },
  methods: {
    onMainStyleChange() {
      this.localSubStyle = ''; // Reset substyle when main changes
      this.$emit('update:mainStyle', this.localMainStyle);
      this.$emit('update:subStyle', '');
    },
    onSubStyleChange() {
      this.$emit('update:subStyle', this.localSubStyle);
    },
    clearMainStyle() {
      this.localMainStyle = '';
      this.onMainStyleChange();
    },
    clearSubStyle() {
      this.localSubStyle = '';
      this.onSubStyleChange();
    },
    // ... rest of the existing methods ...
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
      // If clicking the same non-empty value, toggle it off (back to "Alla")
      // If clicking "Alla" (empty string), always set to "Alla"
      if (value === '') {
        this.localVocals = '';
      } else {
        this.localVocals = this.localVocals === value ? '' : value;
      }
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
    clearDuration() {
      this.localDuration = '';
      this.$emit('update:minDuration', null);
      this.$emit('update:maxDuration', null);
    },
    clearTempo() {
      this.localTempoEnabled = false;
      this.$emit('update:tempoEnabled', false);
    },
    clearBounciness() {
      this.localBouncinessEnabled = false;
      this.$emit('update:bouncinessEnabled', false);
    },
    clearArticulation() {
      this.localArticulationEnabled = false;
      this.$emit('update:articulationEnabled', false);
    },
    emitBounciness() {
      this.$emit('update:minBounciness', this.localMinBounciness);
      this.$emit('update:maxBounciness', this.localMaxBounciness);
    },
    emitArticulation() {
      this.$emit('update:minArticulation', this.localMinArticulation);
      this.$emit('update:maxArticulation', this.localMaxArticulation);
    },
    clearAllFilters() {
      this.clearSearch();
      this.clearSource();
      this.clearVocals();
      this.clearstyleConfirmed();
      this.clearMainStyle();
      this.clearSubStyle();
      this.clearDuration();
      this.clearTempo();
      this.clearBounciness();
      this.clearArticulation();
    },
  },
};
