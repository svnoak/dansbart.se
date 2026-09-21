/// <reference types="node" />

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function walkDirectory(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.git'].includes(file)) {
        if (file === 'api' && dir.endsWith('src')) {
          const apiPath = join(fullPath, 'generated');
          const modelsPath = join(fullPath, 'models');
          const subfiles = readdirSync(fullPath);
          for (const subfile of subfiles) {
            const subPath = join(fullPath, subfile);
            if (subPath !== apiPath && subPath !== modelsPath) {
              if (statSync(subPath).isDirectory()) {
                walkDirectory(subPath, fileList);
              } else if ((subfile.endsWith('.ts') || subfile.endsWith('.tsx')) &&
                         !subfile.endsWith('.test.ts') && !subfile.endsWith('.test.tsx')) {
                fileList.push(subPath);
              }
            }
          }
        } else {
          walkDirectory(fullPath, fileList);
        }
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) &&
               !file.endsWith('.test.ts') && !file.endsWith('.test.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function extractStringLiterals(content: string): string[] {
  const strings: string[] = [];

  const singleQuoteRegex = /'(?:\\.|[^'\n])*'/g;
  let match;
  while ((match = singleQuoteRegex.exec(content)) !== null) {
    strings.push(match[0].slice(1, -1));
  }

  const doubleQuoteRegex = /"(?:\\.|[^"\n])*"/g;
  while ((match = doubleQuoteRegex.exec(content)) !== null) {
    strings.push(match[0].slice(1, -1));
  }

  const backtickRegex = /`(?:\\.|[^`])*`/gs;
  while ((match = backtickRegex.exec(content)) !== null) {
    strings.push(match[0].slice(1, -1));
  }

  return strings;
}

function findOffenders(files: string[], srcPath: string): string[] {
  // SmartNudge is fixed in its own change.
  const excludedFile = join(srcPath, 'player/SmartNudge.tsx');
  const offenders: Map<string, number> = new Map();

  for (const file of files) {
    if (file === excludedFile) {
      continue;
    }

    const content = readFileSync(file, 'utf8');
    const strings = extractStringLiterals(content);

    let count = 0;
    for (const str of strings) {
      const hasAccentBg = /bg-\[rgb\(var\(--color-accent\)\)\](?!\/)/.test(str);
      const hasTextWhite = /text-white/.test(str);

      if (hasAccentBg && hasTextWhite) {
        count++;
      }
    }

    if (count > 0) {
      const relativePath = file.replace(srcPath, '').replace(/^\//, '');
      offenders.set(relativePath, count);
    }
  }

  return Array.from(offenders.entries())
    .map(([file, count]) => `${file}: ${count}`)
    .sort();
}

describe('accent text', () => {
  it('text on the accent background does not use text-white', () => {
    const srcPath = resolve(__dirname, '../');
    const files = walkDirectory(srcPath);
    const offenders = findOffenders(files, srcPath);
    expect(offenders, 'no files should have text-white on accent background').toEqual([]);
  });
});
