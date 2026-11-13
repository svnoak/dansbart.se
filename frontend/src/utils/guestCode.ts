/** The length of a guest code, as the API creates it. */
export const GUEST_CODE_LENGTH = 6;

/** What a person typed, as the API stores codes: capitals and digits only. */
export function normalizeGuestCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** "ABC 234": two groups of three are easier to read from a screen and to say aloud. */
export function formatGuestCode(code: string): string {
  return code.length === GUEST_CODE_LENGTH ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** The address the QR code points to. */
export function guestCodeUrl(code: string): string {
  return `${window.location.origin}/kod/${code}`;
}
