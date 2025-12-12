/**
 * Toast Notifications Composable
 * Manages toast notification queue with auto-dismiss
 */

const toasts = { value: [] };
let toastId = 0;

export function useToast() {
    const showToast = (message, type = 'success') => {
        const id = toastId++;
        toasts.value.push({ id, message, type });

        setTimeout(() => {
            toasts.value = toasts.value.filter(t => t.id !== id);
        }, 3000);

        // Emit custom event for debugging/logging
        window.dispatchEvent(new CustomEvent('admin:toast', {
            detail: { message, type }
        }));
    };

    return {
        toasts,
        showToast
    };
}
