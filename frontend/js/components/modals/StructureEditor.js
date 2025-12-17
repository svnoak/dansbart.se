import { toRaw } from 'vue';
import ProgressBar from '../player/ProgressBar.js';
import { showError } from '../../hooks/useToast.js';

export default {
  components: { ProgressBar },
  props: ['track', 'isOpen', 'currentTime', 'duration', 'isPlaying'],
  emits: ['close', 'save', 'seek', 'toggle-play'],

  data() {
    return {
      sections: [],
      selectedIndices: [],
      historyStack: [],
      isSubmitting: false,
      editorStructureMode: 'sections',
      isDirty: false,
      zoomLevel: 1,
      isResizing: false,
      resizeIndex: null,
    };
  },

  watch: {
    isOpen(val) {
      if (val) this.initData();
    },
  },

  computed: {
    selectedSection() {
      return this.selectedIndex !== null ? this.sections[this.selectedIndex] : null;
    },
    hasSelection() {
      return this.selectedIndices.length > 0;
    },
    canMerge() {
      if (this.selectedIndices.length < 2) return false;
      const sorted = [...this.selectedIndices].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] !== sorted[i] + 1) return false;
      }
      return true;
    },
    viewToggleIcon() {
      if (this.editorStructureMode === 'sections') return `<path d="M4 4h16v16H4z M12 4v16"/>`;
      return `<path d="M4 6h1v12H4zm5 0h1v12H9zm5 0h1v12h-1zm5 0h1v12h-1z"/>`;
    },
    viewToggleLabel() {
      return this.editorStructureMode === 'sections' ? 'Visar Repriser' : 'Visar Takter';
    },
  },

  mounted() {
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
  },
  beforeUnmount() {
    window.removeEventListener('mousemove', this.onDragMove);
    window.removeEventListener('mouseup', this.onDragEnd);
  },

  methods: {
    initData() {
      this.historyStack = [];
      this.isDirty = false;
      this.zoomLevel = 1;
      this.selectedIndices = [];

      if (!this.track.sections) return;

      const rawSec = toRaw(this.track.sections);
      const rawLbl = toRaw(this.track.section_labels) || [];
      const duration = this.track.duration / 1000;

      this.sections = [];
      for (let i = 0; i < rawSec.length; i++) {
        const start = rawSec[i];
        const end = i + 1 < rawSec.length ? rawSec[i + 1] : duration;
        this.sections.push({
          start: start,
          end: end,
          label: rawLbl[i] || '?',
        });
      }
    },

    startResize(index, event) {
      event.stopPropagation();
      this.pushHistory();
      this.isResizing = true;
      this.resizeIndex = index;
    },

    onDragMove(e) {
      if (!this.isResizing || this.resizeIndex === null) return;

      const container = this.$refs.timelineContainer;
      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left + container.scrollLeft;
      const totalWidth = container.scrollWidth;
      const percentage = Math.max(0, Math.min(1, offsetX / totalWidth));
      const rawTime = percentage * (this.track.duration / 1000);

      let snappedTime = rawTime;

      if (this.track.bars) {
        const closestBar = this.track.bars.reduce((prev, curr) =>
          Math.abs(curr - rawTime) < Math.abs(prev - rawTime) ? curr : prev
        );
        if (Math.abs(rawTime - closestBar) < 0.5) {
          snappedTime = closestBar;
        }
      }

      const currentSection = this.sections[this.resizeIndex];
      const nextSection = this.sections[this.resizeIndex + 1];
      const minLen = 1.0;

      if (snappedTime > currentSection.start + minLen) {
        if (nextSection) {
          if (snappedTime < nextSection.end - minLen) {
            currentSection.end = snappedTime;
            nextSection.start = snappedTime;
          }
        }
      }
    },

    onDragEnd() {
      if (this.isResizing) {
        this.isResizing = false;
        this.resizeIndex = null;
      }
    },

    pushHistory() {
      this.historyStack.push(JSON.parse(JSON.stringify(this.sections)));
      if (this.historyStack.length > 20) this.historyStack.shift();
      this.isDirty = true;
    },
    undo() {
      if (this.historyStack.length === 0) return;
      this.sections = this.historyStack.pop();
      this.selectedIndices = [];
    },
    reset() {
      if (!confirm('Vill du återställa?')) return;
      this.initData();
    },
    handleBlockClick(index, event) {
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        if (this.selectedIndices.includes(index)) {
          this.selectedIndices = this.selectedIndices.filter(i => i !== index);
        } else {
          this.selectedIndices.push(index);
        }
      } else {
        this.selectedIndices = [index];
        this.$emit('seek', this.sections[index].start);
      }
    },
    jumpToSection(index) {
      // Separate method for simple clicking vs multi-select logic
      this.selectedIndices = [index];
      this.$emit('seek', this.sections[index].start);
    },

    cycleLabel() {
      if (!this.hasSelection) return;
      this.pushHistory();
      const map = { A: 'B', B: 'C', C: 'D', D: 'A' };
      this.selectedIndices.forEach(idx => {
        this.sections[idx].label = map[this.sections[idx].label] || 'A';
      });
    },
    splitSection() {
      if (this.selectedIndices.length !== 1) return;
      this.pushHistory();
      const index = this.selectedIndices[0];
      const current = this.sections[index];
      const midPoint = current.start + (current.end - current.start) / 2;
      const newSection = {
        start: midPoint,
        end: current.end,
        label: current.label,
      };
      current.end = midPoint;
      this.sections.splice(index + 1, 0, newSection);
      this.selectedIndices = [index, index + 1];
    },
    mergeSelection() {
      if (!this.canMerge) return;
      this.pushHistory();
      const indices = [...this.selectedIndices].sort((a, b) => a - b);
      const firstIdx = indices[0];
      const target = this.sections[firstIdx];
      const lastIdx = indices[indices.length - 1];
      const lastBlock = this.sections[lastIdx];
      target.end = lastBlock.end;
      for (let i = indices.length - 1; i > 0; i--) {
        this.sections.splice(indices[i], 1);
      }
      this.selectedIndices = [firstIdx];
    },

    toggleBars() {
      this.editorStructureMode = this.editorStructureMode === 'sections' ? 'bars' : 'sections';
    },
    skip(seconds) {
      const newTime = Math.max(0, Math.min(this.duration, this.currentTime + seconds));
      this.$emit('seek', newTime);
    },
    async save() {
      if (!confirm('Spara ändringar?')) return;
      this.isSubmitting = true;
      const timestamps = this.sections.map(s => s.start);
      const labels = this.sections.map(s => s.label);
      const payload = { sections: timestamps, section_labels: labels };
      try {
        await fetch(`/api/tracks/${this.track.id}/structure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        this.track.sections = timestamps;
        this.track.section_labels = labels;
        this.isDirty = false;
        this.$emit('close');
      } catch {
        showError('Något gick fel, försök igen senare');
      } finally {
        this.isSubmitting = false;
      }
    },
    attemptClose() {
      if (this.isDirty && !confirm('Osparade ändringar. Stäng ändå?')) return;
      this.$emit('close');
    },
  },

  template: /*html*/ `
    <div v-if="isOpen" class="fixed inset-0 z-[110] flex items-center justify-center p-2 md:p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="attemptClose"></div>
        
        <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
            
            <!-- Header - Mobile optimized -->
            <div class="bg-indigo-600 p-3 md:p-4 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-2 shrink-0">
                <h3 class="font-bold flex items-center gap-2 text-sm md:text-base">
                    <span>✏️</span> Redigera Struktur
                </h3>
                <div class="flex items-center justify-between md:justify-end gap-2 md:gap-4">
                    <div class="flex items-center gap-2 text-[10px] md:text-xs font-bold bg-indigo-800/50 px-2 md:px-3 py-1 rounded-full">
                        <span class="hidden md:inline">Zoom:</span>
                        <span class="md:hidden">🔍</span>
                        <input type="range" min="1" max="8" step="0.1" v-model.number="zoomLevel" class="w-16 md:w-24 accent-white cursor-pointer">
                        <span>{{ Math.round(zoomLevel * 100) }}%</span>
                    </div>
                    <button @click="attemptClose" class="hover:bg-indigo-500 p-1.5 rounded text-white/80 hover:text-white text-lg">✕</button>
                </div>
            </div>

            <div class="p-3 md:p-6 overflow-y-auto flex-1">
                
                <!-- Instructions & actions - stacked on mobile -->
                <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-3 md:mb-4 sticky top-0 bg-white z-30 py-2 border-b border-gray-100 gap-2">
                    <p class="text-xs md:text-sm text-gray-500">
                        <span class="hidden md:inline">Markera block för att ändra. Dra i kanten för att justera (snappar mot takter).</span>
                        <span class="md:hidden">Tryck på block för att välja. Dra i kanten för att justera.</span>
                    </p>
                    <div class="flex gap-2">
                        <button @click="undo" :disabled="historyStack.length === 0" class="text-[10px] md:text-xs font-bold px-2 md:px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-40">↩ Ångra</button>
                        <button @click="reset" :disabled="!isDirty" class="text-[10px] md:text-xs font-bold px-2 md:px-3 py-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-40">Återställ</button>
                    </div>
                </div>

                <div class="w-full overflow-x-auto border border-gray-300 rounded-lg bg-gray-50 mb-4 md:mb-6 relative scrollbar-thin" ref="timelineContainer">
                    
                    <div class="h-16 md:h-24 relative" :style="{ width: (zoomLevel * 100) + '%' }">
                        
                        <div v-if="track.bars" class="absolute inset-0 w-full h-full pointer-events-none z-0">
                             <div v-for="(bar, i) in track.bars" :key="'grid-'+i"
                                  class="absolute top-0 bottom-0"
                                  :class="sections.some(s => Math.abs(s.start - bar) < 0.1) ? 'border-r-2 border-gray-500/60' : 'border-r border-gray-400/20'"
                                  :style="{ left: (bar / (track.duration/1000) * 100) + '%' }">
                             </div>
                        </div>

                        <div v-for="(sec, i) in sections" 
                             :key="i"
                             @click="handleBlockClick(i, $event)"
                             class="absolute top-1 bottom-1 flex items-center justify-center text-sm font-bold select-none cursor-pointer transition-all group z-10 border-r-2 border-white shadow-sm"
                             :class="[
                                selectedIndices.includes(i) ? 'ring-4 ring-inset ring-indigo-600 z-30' : 'opacity-50 hover:brightness-95',
                                sec.label === 'A' ? 'bg-blue-400 text-white' : 
                                sec.label === 'B' ? 'bg-emerald-400 text-white' : 
                                sec.label === 'C' ? 'bg-purple-400 text-white' : 'bg-amber-400 text-white'
                             ]"
                             :style="{ 
                                 left: (sec.start / (track.duration/1000) * 100) + '%', 
                                 width: ((sec.end - sec.start) / (track.duration/1000) * 100) + '%' 
                             }"
                        >
                            {{ sec.label }}

                            <div v-if="i < sections.length - 1"
                                 @mousedown="startResize(i, $event)"
                                 class="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize hover:bg-black/20 z-40 flex items-center justify-center"
                                 title="Dra"
                            >
                                <div class="w-1 h-4 bg-white/40 rounded-full"></div>
                            </div>
                        </div>

                        <div class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-lg"
                             :style="{ left: (currentTime / (track.duration/1000) * 100) + '%' }">
                            <div class="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-1.5 border-2 border-white shadow-sm"></div>
                        </div>

                    </div>
                </div>

                <div class="bg-gray-50 rounded-xl p-3 md:p-4 border border-gray-200 mb-4 md:mb-6">
                     <progress-bar 
                        :current-time="currentTime" :duration="duration" 
                        :disabled="false" :structure-mode="editorStructureMode" 
                        :track="track" @seek="$emit('seek', $event)"
                    ></progress-bar>
                    <div class="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
                        <span>{{ (currentTime/60).toFixed(0) }}:{{ ((currentTime%60).toFixed(0)).padStart(2,'0') }}</span>
                        <span>{{ (duration/60).toFixed(0) }}:{{ ((duration%60).toFixed(0)).padStart(2,'0') }}</span>
                    </div>
                    <div class="flex items-center justify-center gap-2 md:gap-4 mt-2">
                        <button @click="skip(-5)" class="p-1.5 md:p-2 rounded-full hover:bg-gray-200 text-gray-600"><svg class="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg></button>
                        <button @click="$emit('toggle-play')" class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:scale-105 shadow-md">
                            <svg v-if="!isPlaying" class="w-5 h-5 md:w-6 md:h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            <svg v-else class="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>
                        <button @click="skip(5)" class="p-1.5 md:p-2 rounded-full hover:bg-gray-200 text-gray-600"><svg class="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 6v12l8.5-6L13 6zM4 18l8.5-6L4 6v12z"/></svg></button>
                         <button @click="toggleBars" class="ml-2 md:ml-4 text-[10px] md:text-xs border border-gray-300 px-2 md:px-3 py-1 md:py-1.5 rounded hover:bg-white bg-gray-100 transition-colors whitespace-nowrap">{{ viewToggleLabel }}</button>
                    </div>
                </div>

                <!-- Action buttons - responsive grid -->
                <div class="grid grid-cols-3 gap-2 md:gap-3">
                    <button @click="cycleLabel" :disabled="!hasSelection" class="p-2 md:p-3 rounded bg-white border border-gray-200 hover:bg-gray-50 font-bold text-gray-700 disabled:opacity-50 shadow-sm flex flex-col items-center gap-1 text-xs md:text-sm">
                        <span>🔤</span>
                        <span class="hidden md:inline">Byt Namn</span>
                        <span class="md:hidden">Namn</span>
                    </button>
                    <button @click="splitSection" :disabled="selectedIndices.length !== 1" class="p-2 md:p-3 rounded bg-white border border-gray-200 hover:bg-gray-50 font-bold text-gray-700 disabled:opacity-50 shadow-sm flex flex-col items-center gap-1 text-xs md:text-sm">
                        <span>✂️</span>
                        <span class="hidden md:inline">Dela (1/2)</span>
                        <span class="md:hidden">Dela</span>
                    </button>
                    <button @click="mergeSelection" :disabled="!canMerge" class="p-2 md:p-3 rounded bg-white border border-gray-200 hover:bg-gray-50 font-bold text-gray-700 disabled:opacity-50 shadow-sm flex flex-col items-center gap-1 text-xs md:text-sm">
                        <span>🔗</span>
                        <span class="hidden md:inline">Slå ihop</span>
                        <span class="md:hidden">Slå ihop</span>
                    </button>
                </div>
            </div>
            
            <!-- Footer - mobile optimized -->
            <div class="p-3 md:p-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
                <button @click="attemptClose" class="px-3 md:px-4 py-2 text-xs md:text-sm text-gray-600 hover:text-gray-800 font-medium">Avbryt</button>
                <button @click="save" :disabled="isSubmitting || !isDirty" class="px-4 md:px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm">Spara</button>
            </div>
        </div>
    </div>
    `,
};
