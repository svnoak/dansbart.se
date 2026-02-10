export default {
  name: 'EmptyState',
  props: {
    type: {
      type: String,
      required: true,
      validator: (value) => ['popular', 'recent', 'curated', 'styles'].includes(value)
    }
  },
  computed: {
    icon() {
      const icons = {
        popular: '📊',
        recent: '🎵',
        curated: '⭐',
        styles: '🎻'
      };
      return icons[this.type] || '🎶';
    },
    title() {
      const titles = {
        popular: 'Inga populära låtar ännu',
        recent: 'Inga nya låtar ännu',
        curated: 'Inga kurerade låtar ännu',
        styles: 'Inga dansstilar funna'
      };
      return titles[this.type];
    },
    message() {
      return 'Kom tillbaka snart!';
    }
  },
  template: `
    <div class="text-center py-12 px-4">
      <div class="text-gray-400 text-6xl mb-4">
        {{ icon }}
      </div>
      <h3 class="text-gray-600 font-medium mb-2">{{ title }}</h3>
      <p class="text-gray-500 text-sm">{{ message }}</p>
    </div>
  `
};
