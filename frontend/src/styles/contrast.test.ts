/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf-8');

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = relativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = relativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColorTokens(css: string): Record<string, [number, number, number] | null> {
  const tokens: Record<string, [number, number, number] | null> = {};
  const regex = /--color-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    const name = `--color-${match[1]}`;
    const r = parseInt(match[2], 10);
    const g = parseInt(match[3], 10);
    const b = parseInt(match[4], 10);
    tokens[name] = [r, g, b];
  }
  return tokens;
}

function extractCssBlock(css: string, selector: string): string {
  const pattern = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]+)\\}`
  );
  const match = css.match(pattern);
  return match ? match[1] : '';
}

describe('color contrast', () => {
  const lightTokens = parseColorTokens(extractCssBlock(css, ':root'));

  it('light tokens meet WCAG AA', () => {
    const pairs: Array<[string, string, string]> = [
      ['text', 'text', 'bg'],
      ['text on bg-elevated', 'text', 'bg-elevated'],
      ['text-muted on bg', 'text-muted', 'bg'],
      ['text-muted on bg-elevated', 'text-muted', 'bg-elevated'],
      ['accent on bg', 'accent', 'bg'],
      ['accent on bg-elevated', 'accent', 'bg-elevated'],
      ['accent-foreground on accent', 'accent-foreground', 'accent'],
      ['accent-foreground on accent-hover', 'accent-foreground', 'accent-hover'],
      ['accent on accent-muted', 'accent', 'accent-muted'],
      ['text on pill-bg', 'text', 'pill-bg'],
    ];

    for (const [pairName, fgKey, bgKey] of pairs) {
      const fgToken = `--color-${fgKey}`;
      const bgToken = `--color-${bgKey}`;
      const fgColor = lightTokens[fgToken];
      const bgColor = lightTokens[bgToken];

      expect(fgColor, `${fgToken} not found`).toBeTruthy();
      expect(bgColor, `${bgToken} not found`).toBeTruthy();

      if (fgColor && bgColor) {
        const ratio = contrastRatio(fgColor, bgColor);
        expect(ratio, `${pairName}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('dark tokens meet WCAG AA', () => {
    const darkBlockContent = extractCssBlock(css, 'html\\.dark,\\s*\\[data-theme="dark"\\]');
    const darkTokens = parseColorTokens(darkBlockContent);
    const mergedTokens = { ...lightTokens, ...darkTokens };

    const pairs: Array<[string, string, string]> = [
      ['text', 'text', 'bg'],
      ['text on bg-elevated', 'text', 'bg-elevated'],
      ['text-muted on bg', 'text-muted', 'bg'],
      ['text-muted on bg-elevated', 'text-muted', 'bg-elevated'],
      ['accent on bg', 'accent', 'bg'],
      ['accent on bg-elevated', 'accent', 'bg-elevated'],
      ['accent-foreground on accent', 'accent-foreground', 'accent'],
      ['accent-foreground on accent-hover', 'accent-foreground', 'accent-hover'],
      ['accent on accent-muted', 'accent', 'accent-muted'],
      ['text on pill-bg', 'text', 'pill-bg'],
    ];

    for (const [pairName, fgKey, bgKey] of pairs) {
      const fgToken = `--color-${fgKey}`;
      const bgToken = `--color-${bgKey}`;
      const fgColor = mergedTokens[fgToken];
      const bgColor = mergedTokens[bgToken];

      expect(fgColor, `${fgToken} not found`).toBeTruthy();
      expect(bgColor, `${bgToken} not found`).toBeTruthy();

      if (fgColor && bgColor) {
        const ratio = contrastRatio(fgColor, bgColor);
        expect(ratio, `${pairName}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
