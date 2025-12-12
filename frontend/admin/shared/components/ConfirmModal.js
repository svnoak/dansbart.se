/**
 * Confirmation Modal Component
 * Reusable modal for confirming actions
 */

export default {
    props: {
        show: {
            type: Boolean,
            required: true
        },
        title: {
            type: String,
            default: 'Confirm Action'
        },
        message: {
            type: String,
            required: true
        },
        confirmText: {
            type: String,
            default: 'Confirm'
        },
        cancelText: {
            type: String,
            default: 'Cancel'
        },
        confirmClass: {
            type: String,
            default: 'bg-indigo-600 hover:bg-indigo-500'
        },
        loading: {
            type: Boolean,
            default: false
        }
    },
    emits: ['confirm', 'cancel'],
    setup(props, { emit }) {
        const handleConfirm = () => {
            emit('confirm');
        };

        const handleCancel = () => {
            if (!props.loading) {
                emit('cancel');
            }
        };

        return { handleConfirm, handleCancel };
    },
    template: /*html*/`
        <div v-if="show" class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" @click.self="handleCancel">
            <div class="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full mx-4">
                <div class="p-4 sm:p-6">
                    <h3 class="text-lg sm:text-xl font-bold mb-3 sm:mb-4">{{ title }}</h3>

                    <p class="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6 whitespace-pre-line">{{ message }}</p>

                    <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button @click="handleConfirm" :disabled="loading"
                                :class="confirmClass"
                                class="flex-1 disabled:opacity-50 px-4 py-2 sm:py-2.5 rounded font-medium text-sm sm:text-base order-2 sm:order-1">
                            {{ loading ? 'Processing...' : confirmText }}
                        </button>
                        <button @click="handleCancel" :disabled="loading"
                                class="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-2 sm:py-2.5 rounded font-medium text-sm sm:text-base order-1 sm:order-2">
                            {{ cancelText }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `
};
