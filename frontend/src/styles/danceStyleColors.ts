export type MeterFamily = 'triple' | 'duple';

export interface DanceStyleColor {
  bg: string;
  text: string;
  bgDark: string;
  textDark: string;
  family: MeterFamily;
}

/**
 * One colour pair per dance style, used wherever a track lists its style.
 *
 * The hue family carries meaning: warm hues are tretakt (triple meter), cool
 * hues are tvåtakt (duple meter). Light backgrounds sit at one lightness and
 * text colours at another, so every pair clears WCAG AA (4.5:1) in both
 * themes and the set reads as one family.
 *
 * Confidence is never a colour. A confirmed style is a filled pill, a guess is
 * a dashed outline in the same colour, an unknown style is grey.
 */
export const DANCE_STYLE_COLORS: Record<string, DanceStyleColor> = {
  // Tretakt: warm hues
  polska: {
    bg: '#F8E1DE',
    text: '#932A23',
    bgDark: '#3B2320',
    textDark: '#F0B3AB',
    family: 'triple',
  },
  hambo: {
    bg: '#FAE6D3',
    text: '#8A4A0E',
    bgDark: '#3A2A18',
    textDark: '#F0C48E',
    family: 'triple',
  },
  vals: {
    bg: '#F6EBC6',
    text: '#6E5410',
    bgDark: '#363018',
    textDark: '#E9D48A',
    family: 'triple',
  },
  mazurka: {
    bg: '#FBE1EA',
    text: '#932D5A',
    bgDark: '#3B2330',
    textDark: '#F0B3CB',
    family: 'triple',
  },
  slangpolska: {
    bg: '#F2E1F2',
    text: '#7A2A78',
    bgDark: '#35233A',
    textDark: '#E3B3E3',
    family: 'triple',
  },
  menuett: {
    bg: '#E9E3F7',
    text: '#4F3496',
    bgDark: '#2B2640',
    textDark: '#C9BCF0',
    family: 'triple',
  },
  // Tvåtakt: cool hues
  polka: {
    bg: '#DDEFE0',
    text: '#1F6B3A',
    bgDark: '#1F3327',
    textDark: '#A6DDB5',
    family: 'duple',
  },
  schottis: {
    bg: '#D8EFEC',
    text: '#11685E',
    bgDark: '#1C3331',
    textDark: '#9EDDD3',
    family: 'duple',
  },
  snoa: {
    bg: '#DAEDF7',
    text: '#155E85',
    bgDark: '#1C2F3A',
    textDark: '#9FD0EE',
    family: 'duple',
  },
  engelska: {
    bg: '#DFE7F8',
    text: '#2B4C9C',
    bgDark: '#20283C',
    textDark: '#B3C6F0',
    family: 'duple',
  },
  ganglat: {
    bg: '#E6EECF',
    text: '#4E6410',
    bgDark: '#2A3120',
    textDark: '#CBDC94',
    family: 'duple',
  },
};

export const FAMILY_FALLBACK_COLORS: Record<MeterFamily, DanceStyleColor> = {
  triple: {
    bg: '#F3E4DA',
    text: '#7A4530',
    bgDark: '#352620',
    textDark: '#E6BFAE',
    family: 'triple',
  },
  duple: {
    bg: '#DDE9E6',
    text: '#2D5B52',
    bgDark: '#1E302D',
    textDark: '#A9D2CA',
    family: 'duple',
  },
};

export const UNKNOWN_STYLE_COLOR: DanceStyleColor = {
  bg: '#ECECE8',
  text: '#596069',
  bgDark: '#2C3035',
  textDark: '#A4AAB2',
  family: 'triple',
};

const STYLE_FAMILY_MAP: Record<string, MeterFamily> = {
  polska: 'triple',
  slangpolska: 'triple',
  vals: 'triple',
  menuett: 'triple',
  hambo: 'triple',
  mazurka: 'triple',
  polka: 'duple',
  schottis: 'duple',
  snoa: 'duple',
  engelska: 'duple',
  marsch: 'duple',
  ganglat: 'duple',
  gånglåt: 'duple',
};

export function getStyleFamily(styleName: string | null | undefined): MeterFamily | null {
  if (!styleName) return null;
  const lower = styleName.toLowerCase();
  if (STYLE_FAMILY_MAP[lower]) return STYLE_FAMILY_MAP[lower];
  for (const [key, family] of Object.entries(STYLE_FAMILY_MAP)) {
    if (lower.startsWith(key)) return family;
  }
  return null;
}

export function getStyleColor(styleName: string | null | undefined): DanceStyleColor {
  if (!styleName) return UNKNOWN_STYLE_COLOR;
  const lower = styleName.toLowerCase();

  if (DANCE_STYLE_COLORS[lower]) return DANCE_STYLE_COLORS[lower];

  for (const [key, color] of Object.entries(DANCE_STYLE_COLORS)) {
    if (lower.startsWith(key)) return color;
  }

  const family = getStyleFamily(styleName);
  if (family) return FAMILY_FALLBACK_COLORS[family];

  return UNKNOWN_STYLE_COLOR;
}
