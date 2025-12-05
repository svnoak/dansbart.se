import { ref, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js';

export default {
    props: ['trackId', 'isOpen'],
    emits: ['close', 'preview'],
    
    setup(props, { emit }) {
        const versions = ref([]);
        const loading = ref(false);
        const activeVersionId = ref(null);

        // Fetch data when modal opens
        onMounted(async () => {
            loading.value = true;
            try {
                // Assuming your API is at /api or localhost:8000
                const res = await fetch(`http://localhost:8000/tracks/${props.trackId}/structure-versions`);
                if(res.ok) {
                    versions.value = await res.json();
                    const active = versions.value.find(v => v.is_active);
                    if (active) activeVersionId.value = active.id;
                }
            } catch (e) { console.error(e); } 
            finally { loading.value = false; }
        });

        const select = (v) => {
            activeVersionId.value = v.id;
            // Send the new JSON data up to the parent
            emit('preview', v.structure_data);
        };
        
        const vote = async (v, type) => {
             // Optimistic update
             v.vote_count += (type === 'up' ? 1 : -1);
             await fetch(`http://localhost:8000/structure-versions/${v.id}/vote`, {
                 method: 'POST', 
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({vote_type: type})
             });
        };

        return { versions, loading, activeVersionId, select, vote };
    },

    template: /*html*/`
    <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>
        
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col relative z-10 overflow-hidden">
            <div class="p-4 border-b flex justify-between bg-gray-50">
                <h3 class="font-bold">Versionshistorik</h3>
                <button @click="$emit('close')">✕</button>
            </div>

            <div class="overflow-y-auto p-2 space-y-2 bg-gray-100 flex-1">
                <div v-if="loading" class="text-center py-4 text-gray-500">Laddar...</div>
                
                <div v-else v-for="v in versions" :key="v.id" 
                     @click="select(v)"
                     class="bg-white p-3 rounded border cursor-pointer hover:shadow-md flex justify-between"
                     :class="activeVersionId === v.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'">
                    
                    <div>
                        <div class="font-bold text-sm">
                            {{ v.description || 'Strukturändring' }}
                            <span v-if="v.is_active" class="bg-green-100 text-green-800 text-[10px] px-1 rounded ml-1">AKTIV</span>
                        </div>
                        <div class="text-xs text-gray-500">
                            {{ v.author_alias || 'Anonym' }} • {{ new Date(v.created_at).toLocaleDateString() }}
                        </div>
                    </div>

                    <div class="flex items-center gap-1 bg-gray-50 rounded px-1" @click.stop>
                        <button @click="vote(v, 'up')" class="hover:text-green-600 px-1">👍</button>
                        <span class="text-xs font-mono font-bold">{{ v.vote_count }}</span>
                        <button @click="vote(v, 'down')" class="hover:text-red-600 px-1">👎</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `
};