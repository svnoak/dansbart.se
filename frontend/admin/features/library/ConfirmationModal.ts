/**
 * Simple Confirmation Modal Component
 * Reusable modal for confirming actions with customizable content
 */

export default {
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    title: {
      type: String,
      default: 'Confirm Action',
    },
    message: {
      type: String,
      required: true,
    },
    confirmText: {
      type: String,
      default: 'Confirm',
    },
    cancelText: {
      type: String,
      default: 'Cancel',
    },
    confirmClass: {
      type: String,
      default: 'bg-blue-600 hover:bg-blue-500',
    },
  },
  emits: ['confirm', 'cancel'],
  template: /*html*/ `
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
         @click.self="$emit('cancel')">
      <div class="bg-gray-800 rounded-lg border border-gray-700 shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-700 bg-gray-900">
          <h3 class="text-lg font-bold text-white">{{ title }}</h3>
        </div>

        <!-- Content -->
        <div class="px-6 py-4">
          <p class="text-gray-300 whitespace-pre-line">{{ message }}</p>
        </div>

        <!-- Actions -->
        <div class="px-6 py-4 border-t border-gray-700 bg-gray-900/50 flex gap-3 justify-end">
          <button @click="$emit('cancel')"
                  class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors">
            {{ cancelText }}
          </button>
          <button @click="$emit('confirm')"
                  :class="confirmClass"
                  class="px-4 py-2 rounded text-white font-medium transition-colors">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
};
