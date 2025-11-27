export default {
    // Add 'tempoEnabled' to props
    props: ['modelValue', 'filters', 'min', 'max', 'leftPct', 'widthPct', 'tempoEnabled'], 
    emits: ['update:modelValue', 'update:filters', 'update:tempoEnabled'], // Add emit
    template: `
    <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">Dance Style</label>
                <select :value="filters.style" 
                        @input="$emit('update:filters', { ...filters, style: $event.target.value })"
                        class="w-full p-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500">
                    <option value="">All Styles</option>
                    <option value="Hambo">Hambo</option>
                    <option value="Schottis">Schottis</option>
                    <option value="Polska">Polska</option>
                    <option value="Snoa">Snoa</option>
                    <option value="Vals">Vals</option>
                </select>
            </div>

            <div class="md:col-span-2 flex flex-col justify-end">
                
                <div class="flex justify-between items-end mb-3">
                    <div class="flex items-center gap-3">
                        <label class="block text-sm font-semibold text-gray-700">Specific Tempo?</label>
                        
                        <button 
                            @click="$emit('update:tempoEnabled', !tempoEnabled)"
                            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            :class="tempoEnabled ? 'bg-blue-600' : 'bg-gray-200'"
                        >
                            <span class="sr-only">Enable tempo filter</span>
                            <span 
                                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                                :class="tempoEnabled ? 'translate-x-6' : 'translate-x-1'"
                            />
                        </button>
                    </div>

                    <div class="text-right transition-opacity duration-200" :class="tempoEnabled ? 'opacity-100' : 'opacity-40'">
                        <span class="text-2xl font-bold block leading-none" :class="tempoEnabled ? 'text-blue-600' : 'text-gray-400'">
                            {{ tempoEnabled ? modelValue : 'Any' }}
                        </span>
                        <span class="text-xs text-gray-400 font-mono">
                            {{ tempoEnabled ? \`Searching \${min} - \${max} BPM\` : 'Ignoring BPM' }}
                        </span>
                    </div>
                </div>

                <div class="relative w-full h-6 flex items-center transition-opacity duration-200"
                     :class="tempoEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'">
                    
                    <div class="absolute w-full h-2 bg-gray-200 rounded-lg"></div>
                    <div class="absolute h-2 bg-blue-200 rounded-lg transition-all duration-75"
                         :style="{ left: leftPct + '%', width: widthPct + '%' }"></div>

                    <input type="range" 
                           :value="modelValue"
                           @input="$emit('update:modelValue', Number($event.target.value))"
                           :disabled="!tempoEnabled"
                           min="60" max="200" step="1"
                           class="absolute w-full h-2 appearance-none bg-transparent cursor-pointer z-10 focus:outline-none opacity-0 hover:opacity-100"> 
                </div>
            </div>
        </div>
    </div>
    `
};