export default {
    props: ['currentTime', 'duration', 'disabled', 'structureMode', 'track'], 
    emits: ['seek'],
    
    data() {
        return {
            isDragging: false
        }
    },

    computed: {
        progressPercent() {
            if (!this.duration) return 0;
            return (this.currentTime / this.duration) * 100;
        },
        
        // 1. CALCULATE CURRENT BAR NUMBER
        currentBarIndex() {
            if (!this.track?.bars || this.track.bars.length === 0) return 0;
            
            // Find the last bar timestamp that is less than current time
            // e.g. if bars are [0, 2, 4] and time is 3, we are in bar 2 (index 1 + 1)
            const barIndex = this.track.bars.findIndex(b => b > this.currentTime);
            
            // If -1, we are past the last bar. If 0, we are before first bar (intro).
            if (barIndex === -1) return this.track.bars.length; 
            return barIndex; // Returns 1-based count if we consider index 0 as Bar 1 start
        },

        // Pre-calculate visual blocks for Sections (A-part, B-part)
        sectionBlocks() {
            if (this.structureMode !== 'sections' || !this.track?.sections) return [];
            
            const blocks = [];
            const sections = this.track.sections; 
            const labels = this.track.section_labels || [];
            
            for (let i = 0; i < sections.length; i++) {
                const start = sections[i];
                const end = (i + 1 < sections.length) ? sections[i+1] : this.duration;
                if (start >= this.duration) break;
                
                blocks.push({
                    left: (start / this.duration) * 100,
                    width: ((end - start) / this.duration) * 100,
                    color: i % 2 === 0 ? 'bg-indigo-500/20' : 'bg-transparent',
                    label: labels[i] || (i + 1)
                });
            }
            return blocks;
        },

        // Pre-calculate tick marks for Bars
        barTicks() {
            if (this.structureMode !== 'bars' || !this.track?.bars) return [];
            return this.track.bars.map(time => ({
                left: (time / this.duration) * 100
            })).filter(b => b.left <= 100);
        }
    },

    methods: {
        onInput(e) {
            this.isDragging = true; // Show tooltip
            
            let val = parseFloat(e.target.value);

            // Magnetic Snap Logic (Sections Only)
            if (this.structureMode === 'sections' && this.track?.sections) {
                const closestSection = this.track.sections.reduce((prev, curr) => {
                    return (Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev);
                });
                if (Math.abs(val - closestSection) < 1.5) {
                    val = closestSection;
                }
            }
            this.$emit('seek', val);
        },
        
        onChange(e) {
            this.isDragging = false; // Hide tooltip
            this.onInput(e); 
        }
    },

    template: /*html*/`
    <div class="w-full bg-gray-200 relative group cursor-pointer select-none transition-all duration-200"
         :class="structureMode !== 'none' ? 'h-8 mt-[-16px]' : 'h-1.5'">
        
        <template v-if="structureMode === 'sections'">
            <div v-for="(block, i) in sectionBlocks" :key="'sec-'+i"
                 class="absolute top-0 h-full border-l border-indigo-400/50 pointer-events-none flex items-center justify-center text-[9px] font-bold text-indigo-700 overflow-hidden"
                 :class="block.color"
                 :style="{ left: block.left + '%', width: block.width + '%' }">
                 <span v-if="block.width > 5">{{ block.label }}</span>
            </div>
        </template>

        <template v-if="structureMode === 'bars'">
            <div v-for="(tick, i) in barTicks" :key="'bar-'+i"
                 class="absolute top-0 h-full border-l border-gray-400/60 pointer-events-none"
                 :style="{ left: tick.left + '%' }">
            </div>
        </template>

        <div class="absolute top-0 left-0 h-full bg-indigo-600/40 border-r-2 border-indigo-700 pointer-events-none" 
             :style="{ width: progressPercent + '%' }">
        </div>
        
        <input 
            type="range" 
            min="0" 
            :max="duration || 100" 
            :value="currentTime" 
            @mousedown="isDragging = true"
            @mouseup="isDragging = false"
            @touchstart="isDragging = true"
            @touchend="isDragging = false"
            @input="onInput"
            @change="onChange"
            :disabled="disabled"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed"
        >
        
        <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 pointer-events-none"
             :style="{ left: progressPercent + '%' }">
            
            <div v-if="structureMode === 'none'" 
                 class="h-3 w-3 bg-indigo-600 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity">
            </div>
            
            <div v-if="isDragging && structureMode === 'bars'"
                 class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-indigo-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                Takt {{ currentBarIndex }}
                <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-indigo-800"></div>
            </div>

        </div>
    </div>
    `
};