export function getInputByLabel(label: string): HTMLInputElement | HTMLTextAreaElement | null {
  const labelElement = Array.from(document.body.querySelectorAll('label')).find((l) =>
    l.textContent?.includes(label),
  );
  if (labelElement && labelElement.htmlFor) {
    return document.getElementById(labelElement.htmlFor) as HTMLInputElement | HTMLTextAreaElement;
  }
  return null;
}
