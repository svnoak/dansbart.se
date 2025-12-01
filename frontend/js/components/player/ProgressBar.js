export default {
    props: ['currentTime', 'duration', 'disabled'],
    emits: ['seek'],
    computed: {
        progressPercent() {
            if (!this.duration) return 0;
            return (this.currentTime / this.duration) * 100;
        }
    },
    methods: {
        onInput(e) {
            // Optional: Visual update while dragging (optimization)
        },
        onChange(e) {
            this.$emit('seek', parseFloat(e.target.value));
        }
    },
    template: /*html*/`
    <div class="w-full h-1.5 bg-gray-100 relative group cursor-pointer">
        <input 
            type="range" 
            min="0" 
            :max="duration" 
            :value="currentTime" 
            @input="onInput"
            @change="onChange"
            :disabled="disabled"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed"
        >
        <div class="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-200" 
             :style="{ width: progressPercent + '%' }"></div>
        
        <div class="absolute top-1/2 -mt-1.5 h-3 w-3 bg-indigo-600 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
             :style="{ left: progressPercent + '%' }"></div>
    </div>
    `
};