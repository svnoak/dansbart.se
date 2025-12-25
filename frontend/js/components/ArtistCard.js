export default {
  name: 'ArtistCard',
  props: {
    artist: {
      type: Object,
      required: true
    }
  },
  emits: ['navigate-to-artist'],
  template: `
    <div
      @click="$emit('navigate-to-artist', artist.id)"
      class="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-all cursor-pointer group"
    >
      <div class="flex items-center gap-4">
        <!-- Artist Icon -->
        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
          </svg>
        </div>

        <!-- Artist Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-xl font-bold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
              {{ artist.name }}
            </h3>
            <svg
              v-if="artist.is_verified"
              class="w-5 h-5 text-blue-500 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              title="Verifierad artist"
            >
              <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
          </div>

          <p class="text-gray-600 text-sm">
            {{ artist.total_tracks }} {{ artist.total_tracks === 1 ? 'låt' : 'låtar' }}
          </p>
        </div>

        <!-- Chevron -->
        <svg class="w-6 h-6 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </div>
    </div>
  `
};
