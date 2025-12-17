/**
 * Toast Notifications Component
 * Displays toast notifications in bottom-right corner
 */

import { useToast } from '../../hooks/useToast.js';

export default {
  setup() {
    const { toasts } = useToast();

    return { toasts };
  },
  template: /*html*/ `
        <div class="fixed bottom-4 right-4 space-y-2 z-50">
            <transition-group name="fade">
                <div v-for="toast in toasts" :key="toast.id"
                     :class="toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'"
                     class="px-4 py-2 rounded shadow-lg text-sm max-w-sm text-white">
                    {{ toast.message || "Oj, något gick fel" }}
                </div>
            </transition-group>
        </div>
    `,
};
