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

function findSmallTextSizes(files: string[], srcPath: string): string[] {
  const smallTextRegex = /text-\[(9|10|11)px\]/g;
  // SmartNudge is fixed in its own change.
  const excludedFile = join(srcPath, 'player', 'SmartNudge.tsx');
  const offenders: Map<string, number> = new Map();

  for (const file of files) {
    if (file === excludedFile) {
      continue;
    }

    const content = readFileSync(file, 'utf8');
    const matches = content.match(smallTextRegex);
    const count = matches ? matches.length : 0;

    if (count > 0) {
      const relativePath = file.replace(srcPath, '').replace(/^\//, '');
      offenders.set(relativePath, count);
    }
  }

  const result: string[] = [];
  for (const [path, count] of offenders.entries()) {
    result.push(`${path}: ${count}`);
  }

  return result;
}

describe('text size', () => {
  it('no component uses text below 14px', () => {
    const srcPath = resolve(__dirname, '../');
    const files = walkDirectory(srcPath);
    const offenders = findSmallTextSizes(files, srcPath);

    const message = offenders.length > 0
      ? `Found ${offenders.length} file(s) with text below 14px:\n${offenders.join('\n')}`
      : '';

    expect(offenders, message).toEqual([]);
  });
});
