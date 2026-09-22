export function typeInto(input: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    'value',
  )!.set!;
  setter.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function pressKey(
  element: HTMLElement,
  key: string,
): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}
