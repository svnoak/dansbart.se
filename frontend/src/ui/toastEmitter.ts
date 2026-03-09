export interface ToastMessage {
  id: number;
  text: string;
  variant: 'success' | 'error';
}

let nextId = 0;
export const toastListeners = new Set<(msg: ToastMessage) => void>();

export function toast(text: string, variant: 'success' | 'error' = 'success') {
  const msg: ToastMessage = { id: nextId++, text, variant };
  toastListeners.forEach((fn) => fn(msg));
}