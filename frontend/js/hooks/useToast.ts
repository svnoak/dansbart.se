/**
 * Toast Notifications Composable
 * Manages toast notification queue with auto-dismiss
 */

import { ref, type Ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

const toasts: Ref<ToastMessage[]> = ref<ToastMessage[]>([]);
let toastId = 0;

/**
 * Standalone helper to show toasts
 * Can be imported and used anywhere without needing the composable
 */
export function showToast(message: string, type: ToastType = 'success'): void {
  const id = toastId++;
  toasts.value.push({ id, message, type });

  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 3000);

  window.dispatchEvent(
    new CustomEvent('admin:toast', {
      detail: { message, type },
    }),
  );
}

/**
 * Standalone helper to show error toasts
 * Can be imported and used anywhere without needing the composable
 */
export function showError(message = 'Oj, något gick fel'): void {
  showToast(message, 'error');
}

export function useToast() {
  const localShowToast = (message: string, type: ToastType = 'success'): void => {
    const id = toastId++;
    toasts.value.push({ id, message, type });

    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3000);

    // Emit custom event for debugging/logging
    window.dispatchEvent(
      new CustomEvent('admin:toast', {
        detail: { message, type },
      }),
    );
  };

  const localShowError = (message = 'Oj, något gick fel'): void => {
    localShowToast(message, 'error');
  };

  return {
    toasts,
    showToast: localShowToast,
    showError: localShowError,
  };
}

