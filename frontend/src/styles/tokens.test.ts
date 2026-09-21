/// <reference types="node" />

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readIndexCss(): string {
  const path = resolve(__dirname, '../index.css');
  return readFileSync(path, 'utf8');
}

function collectDefinedTokens(css: string): Set<string> {
  const defined = new Set<string>();
  const tokenRegex = /--color-[a-z-]+\s*:/g;
  let match;
  while ((match = tokenRegex.exec(css)) !== null) {
    const token = match[0].replace(/\s*:$/, '');
    defined.add(token);
  }
  return defined;
}

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

function collectReferencedTokens(files: string[]): Map<string, string[]> {
  const referenced = new Map<string, string[]>();
  const tokenRegex = /var\(--color-[a-z0-9-]+\)/g;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    let match;
    while ((match = tokenRegex.exec(content)) !== null) {
      const token = match[0].replace(/var\(/, '').replace(/\)/, '');
      if (!referenced.has(token)) {
        referenced.set(token, []);
      }
      const files = referenced.get(token)!;
      if (!files.includes(file)) {
        files.push(file);
      }
    }
  }
  return referenced;
}

describe('CSS tokens', () => {
  it('every --color-* token used in src is defined in index.css', () => {
    const css = readIndexCss();
    const defined = collectDefinedTokens(css);

    const srcPath = resolve(__dirname, '../');
    const files = walkDirectory(srcPath);
    const referenced = collectReferencedTokens(files);

    const missing: string[] = [];
    const missingExamples = new Map<string, string>();

    for (const [token, files] of referenced.entries()) {
      if (!defined.has(token)) {
        missing.push(token);
        if (files.length > 0) {
          const relativePath = files[0].replace(srcPath, '');
          missingExamples.set(token, relativePath);
        }
      }
    }

    if (missing.length > 0) {
      const details = missing.map(token => {
        const example = missingExamples.get(token) || 'unknown';
        return `${token} (e.g., ${example})`;
      }).join(', ');
      expect(missing, `undefined tokens: ${details}`).toEqual([]);
    } else {
      expect(missing).toEqual([]);
    }
  });
});
