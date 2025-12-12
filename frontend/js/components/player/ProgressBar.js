export default {
    props: ['currentTime', 'duration', 'disabled', 'structureMode', 'track', 'breakpoints'],
    emits: ['seek', 'jump-to-breakpoint', 'update-breakpoint', 'remove-breakpoint'],

    data() {
        return {
            isDragging: false,
            
            // Breakpoint State
            draggingBreakpointOriginal: null, // The timestamp we started dragging
            dragCurrentTime: null,            // The timestamp where the ghost is NOW
            dragStartX: 0,
            hasMoved: false,
            
            mouseDownTime: 0,
            clickCount: 0,
            clickTimer: null
        }
    },

    computed: {
        progressPercent() {
            if (!this.duration) return 0;
            return (this.currentTime / this.duration) * 100;
        },
        
        currentBarIndex() {
            if (!this.track?.bars || this.track.bars.length === 0) return 0;
            const barIndex = this.track.bars.findIndex(b => b > this.currentTime);
            if (barIndex === -1) return this.track.bars.length; 
            return barIndex;
        },

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

        barTicks() {
            if (this.structureMode !== 'bars' || !this.track?.bars) return [];
            return this.track.bars.map(time => ({
                left: (time / this.duration) * 100
            })).filter(b => b.left <= 100);
        },

        // Return ALL markers; hide active one in template
        breakpointMarkers() {
            if (this.structureMode !== 'bars' || !this.breakpoints || !Array.isArray(this.breakpoints)) return [];
            
            return this.breakpoints.map(time => ({
                time,
                left: (time / this.duration) * 100
            })).filter(b => b.left <= 100);
        },

        draggingMarkerStyle() {
            if (this.dragCurrentTime === null) return null;
            return {
                left: (this.dragCurrentTime / this.duration) * 100 + '%'
            };
        }
    },

    methods: {
        onInput(e) {
            this.isDragging = true; 
            let val = parseFloat(e.target.value);

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
            this.isDragging = false; 
            this.onInput(e);
        },

        getClientX(evt) {
            if (evt.clientX != null) return evt.clientX;
            if (evt.touches && evt.touches.length > 0) return evt.touches[0].clientX;
            return null;
        },

        startDragBreakpoint(e, breakpoint) {
            e.stopPropagation();
            e.preventDefault();

            const clientX = this.getClientX(e);
            if (clientX === null) return;

            this.mouseDownTime = Date.now();
            this.draggingBreakpointOriginal = breakpoint.time;
            this.dragCurrentTime = breakpoint.time;
            this.dragStartX = clientX;
            this.hasMoved = false;

            window.addEventListener('pointermove', this.onDragBreakpoint);
            window.addEventListener('pointerup', this.stopDragBreakpoint);
        },

        onDragBreakpoint(e) {
            if (this.draggingBreakpointOriginal === null) return;

            const clientX = this.getClientX(e);
            if (clientX === null) return;

            const distanceMoved = Math.abs(clientX - this.dragStartX);
            if (distanceMoved > 5) {
                this.hasMoved = true;
            }

            if (!this.hasMoved) return;

            e.preventDefault();
            e.stopPropagation();

            const rect = this.$el.getBoundingClientRect();
            const x = clientX - rect.left;
            const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
            let newTime = (percent / 100) * this.duration;

            // Snap to Bars
            if (this.structureMode === 'bars' && this.track?.bars && this.track.bars.length > 0) {
                const closestBar = this.track.bars.reduce((prev, curr) => {
                    return (Math.abs(curr - newTime) < Math.abs(prev - newTime) ? curr : prev);
                });
                newTime = closestBar;
            }

            this.dragCurrentTime = newTime;
        },

        stopDragBreakpoint(e) {
            const wasDragging = this.hasMoved;
            const clickDuration = Date.now() - this.mouseDownTime;
            const originalTime = this.draggingBreakpointOriginal;
            const finalTime = this.dragCurrentTime;

            window.removeEventListener('pointermove', this.onDragBreakpoint);
            window.removeEventListener('pointerup', this.stopDragBreakpoint);

            // DRAG END
            if (wasDragging) {
                if (originalTime != null && finalTime != null && originalTime !== finalTime) {
                    this.$emit('update-breakpoint', originalTime, finalTime);
                }

                // Clear state AFTER DOM update
                this.$nextTick(() => {
                    this.draggingBreakpointOriginal = null;
                    this.dragCurrentTime = null;
                    this.hasMoved = false;
                });

                return;
            }

            // CLICK HANDLING
            if (clickDuration < 200 && originalTime !== null) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                this.clickCount++;
                if (this.clickCount === 1) {
                    this.clickTimer = setTimeout(() => {
                        this.$emit('jump-to-breakpoint', originalTime);
                        this.clickCount = 0;
                    }, 250);
                } else if (this.clickCount === 2) {
                    clearTimeout(this.clickTimer);
                    this.$emit('remove-breakpoint', originalTime);
                    this.clickCount = 0;
                }
            }

            // If it was a click, reset immediately
            this.draggingBreakpointOriginal = null;
            this.dragCurrentTime = null;
            this.hasMoved = false;
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

            <div v-for="bp in breakpointMarkers" :key="bp.time"
                 @pointerdown="startDragBreakpoint($event, bp)"
                 class="absolute top-0 h-full w-3 -ml-1.5 cursor-grab active:cursor-grabbing z-30 group/bp transition-opacity duration-75"
                 :class="bp.time === draggingBreakpointOriginal ? 'opacity-0 pointer-events-none' : 'opacity-100'"
                 :style="{ left: bp.left + '%' }">
                <div class="absolute top-0 left-1/2 -translate-x-1/2 h-full w-0.5 bg-red-500"></div>
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-md transition-transform group-hover/bp:scale-125"></div>
            </div>

            <div v-if="draggingMarkerStyle" 
                 class="absolute top-0 h-full w-3 -ml-1.5 cursor-grabbing z-40 pointer-events-none"
                 :style="draggingMarkerStyle">
                <div class="absolute top-0 left-1/2 -translate-x-1/2 h-full w-0.5 bg-red-600"></div>
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-lg"></div>
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
            
            <div v-if="structureMode === 'bars'"
                 class="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-indigo-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                {{ currentBarIndex }}
            </div>

        </div>
    </div>
    `
};
