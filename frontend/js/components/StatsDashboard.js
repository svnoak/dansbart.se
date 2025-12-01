export default {
    data() {
        return {
            stats: null,
            loading: true
        }
    },
    async mounted() {
        try {
            const res = await fetch('/api/stats');
            this.stats = await res.json();
        } catch (e) {
            console.error("Failed to load stats", e);
        } finally {
            this.loading = false;
        }
    },
    computed: {
        lastAddedLabel() {
            if (!this.stats || !this.stats.last_added) return '-';
            const date = new Date(this.stats.last_added);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

            if (checkDate.getTime() === today.getTime()) return 'Idag';
            if (checkDate.getTime() === yesterday.getTime()) return 'Igår';
            return date.toISOString().split('T')[0];
        }
    },
    template: /*html*/`
    <div v-if="stats" class="flex flex-wrap justify-center gap-3 mb-6 animate-fade-in">
        
        <div class="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-xs font-medium text-gray-600">
            <svg class="w-3.5 h-3.5 mr-1.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
            <span class="font-bold text-gray-900 mr-1">{{ stats.total_tracks }}</span> låtar
        </div>

        <div class="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-xs font-medium text-gray-600">
            <svg class="w-3.5 h-3.5 mr-1.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span class="font-bold text-gray-900 mr-1">{{ stats.coverage_percent }}%</span> kategoriserade
        </div>
        
        <div class="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-xs font-medium text-gray-600">
            <svg class="w-3.5 h-3.5 mr-1.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Senast tillagda: <span class="font-bold text-gray-900 ml-1">{{ lastAddedLabel }}</span>
        </div>

    </div>
    `
}