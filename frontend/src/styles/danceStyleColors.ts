export type MeterFamily = 'triple' | 'duple';

export interface DanceStyleColor {
  bg: string;
  text: string;
  bgDark: string;
  textDark: string;
  family: MeterFamily;
}

export const DANCE_STYLE_COLORS: Record<string, DanceStyleColor> = {
  polska: {
    bg: '#DBEAFE',
    text: '#1E4FAA',
    bgDark: '#1E3A5F',
    textDark: '#93B8F0',
    family: 'triple',
  },
  slangpolska: {
    bg: '#DBEAFE',
    text: '#1E4FAA',
    bgDark: '#1E3A5F',
    textDark: '#93B8F0',
    family: 'triple',
  },
  vals: {
    bg: '#FCE4EC',
    text: '#88305A',
    bgDark: '#3D1A2E',
    textDark: '#E8A0B8',
    family: 'triple',
  },
  menuett: {
    bg: '#DBEAFE',
    text: '#1E4FAA',
    bgDark: '#1E3A5F',
    textDark: '#93B8F0',
    family: 'triple',
  },
  hambo: {
    bg: '#FCE4EC',
    text: '#88305A',
    bgDark: '#3D1A2E',
    textDark: '#E8A0B8',
    family: 'triple',
  },
  ganglat: {
    bg: '#DBEAFE',
    text: '#1E4FAA',
    bgDark: '#1E3A5F',
    textDark: '#93B8F0',
    family: 'triple',
  },
  mazurka: {
    bg: '#FCE4EC',
    text: '#88305A',
    bgDark: '#3D1A2E',
    textDark: '#E8A0B8',
    family: 'triple',
  },
  polka: {
    bg: '#DCFCE7',
    text: '#166534',
    bgDark: '#14332A',
    textDark: '#86EFAC',
    family: 'duple',
  },
  schottis: {
    bg: '#E0F7FA',
    text: '#155E63',
    bgDark: '#133B3E',
    textDark: '#80DEEA',
    family: 'duple',
  },
  snoa: {
    bg: '#E0F7FA',
    text: '#155E63',
    bgDark: '#133B3E',
    textDark: '#80DEEA',
    family: 'duple',
  },
  engelska: {
    bg: '#DCFCE7',
    text: '#166534',
    bgDark: '#14332A',
    textDark: '#86EFAC',
    family: 'duple',
  },
};

export const FAMILY_FALLBACK_COLORS: Record<MeterFamily, DanceStyleColor> = {
  triple: {
    bg: '#E8EDF5',
    text: '#3B5280',
    bgDark: '#1E2D45',
    textDark: '#95ACC8',
    family: 'triple',
  },
  duple: {
    bg: '#E5F2E8',
    text: '#2D5B3A',
    bgDark: '#1A3520',
    textDark: '#88C49A',
    family: 'duple',
  },
};

export const UNKNOWN_STYLE_COLOR: DanceStyleColor = {
  bg: '#F3F4F6',
  text: '#6B7280',
  bgDark: '#374151',
  textDark: '#9CA3AF',
  family: 'triple',
};

const STYLE_FAMILY_MAP: Record<string, MeterFamily> = {
  polska: 'triple',
  slangpolska: 'triple',
  vals: 'triple',
  menuett: 'triple',
  hambo: 'triple',
  ganglat: 'triple',
  mazurka: 'triple',
  polka: 'duple',
  schottis: 'duple',
  snoa: 'duple',
  engelska: 'duple',
  marsch: 'duple',
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
