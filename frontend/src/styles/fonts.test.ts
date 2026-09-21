/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
const mainTsx = readFileSync(resolve(__dirname, '../main.tsx'), 'utf-8');
const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf-8');
const indexHtml = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');

function extractCssBlock(css: string, selector: string): string {
  const pattern = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]+)\\}`
  );
  const match = css.match(pattern);
  return match ? match[1] : '';
}

describe('serves Open Sans from the site\'s own origin', () => {
  it('has the dependency in package.json', () => {
    expect(
      packageJson.dependencies?.['@fontsource-variable/open-sans'],
      'package.json must list @fontsource-variable/open-sans in dependencies'
    ).toBeDefined();
  });

  it('imports the font in main.tsx', () => {
    const hasImport = /import\s+['"]@fontsource-variable\/open-sans['"]/.test(mainTsx);
    expect(
      hasImport,
      'src/main.tsx must import @fontsource-variable/open-sans'
    ).toBe(true);
  });

  it('sets body font-family to start with Open Sans Variable', () => {
    const bodyBlock = extractCssBlock(indexCss, 'body');
    const fontFamilyMatch = bodyBlock.match(/font-family:\s*([^;]+)/);
    expect(
      fontFamilyMatch,
      'body rule must contain font-family property'
    ).toBeTruthy();

    if (fontFamilyMatch) {
      const fontStack = fontFamilyMatch[1];
      const startsWithOpenSans = fontStack.trim().startsWith("'Open Sans Variable'");
      expect(
        startsWithOpenSans,
        `body font-family must start with 'Open Sans Variable', got: ${fontStack}`
      ).toBe(true);
    }
  });

  it('does not link Google Fonts in index.html', () => {
    const hasGoogleFonts = /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(indexHtml);
    expect(
      hasGoogleFonts,
      'index.html must not contain links to fonts.googleapis.com or fonts.gstatic.com'
    ).toBe(false);
  });

  it('does not reference Merriweather or Inter in index.css', () => {
    const hasMerriweather = /Merriweather/.test(indexCss);
    const hasInter = /\bInter\b/.test(indexCss);
    expect(
      hasMerriweather,
      'index.css must not contain Merriweather'
    ).toBe(false);
    expect(
      hasInter,
      'index.css must not contain Inter'
    ).toBe(false);
  });
});
