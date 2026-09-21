/// <reference types="node" />

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
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

function findFixedWidthViolations(files: string[], srcPath: string): Map<string, number> {
  const violations = new Map<string, number>();
  const pattern = /\b(min|max)-w-\[[0-9.]+px\]/g;
  // SmartNudge is fixed in its own change.
  const exclusions = new Set(['player/SmartNudge.tsx']);

  for (const file of files) {
    const relativePath = relative(srcPath, file);

    if (exclusions.has(relativePath)) {
      continue;
    }

    const content = readFileSync(file, 'utf8');
    let count = 0;
    while (pattern.exec(content) !== null) {
      count++;
    }

    if (count > 0) {
      violations.set(relativePath, count);
    }
  }

  return violations;
}

describe('Fixed widths', () => {
  it('no component sets a fixed pixel min or max width', () => {
    const srcPath = resolve(__dirname, '../');
    const files = walkDirectory(srcPath);
    const violations = findFixedWidthViolations(files, srcPath);

    const offenders = Array.from(violations.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([path, count]) => `${path}: ${count}`);

    const message = offenders.length > 0
      ? `Found fixed pixel widths in ${offenders.length} file(s): ${offenders.join(', ')}`
      : '';

    expect(offenders, message).toEqual([]);
  });
});
