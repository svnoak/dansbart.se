/**
 * Toast Notifications Composable
 * Manages toast notification queue with auto-dismiss
 */

const toasts = { value: [] };
let toastId = 0;

/**
 * Standalone helper to show error toasts
 * Can be imported and used anywhere without needing the composable
 */
export function showError(message = 'Oj, något gick fel') {
  const id = toastId++;
  toasts.value.push({ id, message, type: 'error' });

  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 3000);

  window.dispatchEvent(
    new CustomEvent('admin:toast', {
      detail: { message, type: 'error' },
    })
  );
}

export function useToast() {
  const showToast = (message, type = 'success') => {
    const id = toastId++;
    toasts.value.push({ id, message, type });

    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, 3000);

    // Emit custom event for debugging/logging
    window.dispatchEvent(
      new CustomEvent('admin:toast', {
        detail: { message, type },
      })
    );
  };

  const showError = (message = 'Oj, något gick fel') => {
    showToast(message, 'error');
  };

  return {
    toasts,
    showToast,
    showError,
  };
}
