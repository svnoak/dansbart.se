import { describe, expect, it } from 'vitest';
import { importSummary } from './importSummary';

describe('importSummary', () => {
  it('counts added, existing and failed', () => {
    expect(importSummary({ created: 3, existing: 2, failedAlbums: 1 }))
      .toBe('3 låtar tillagda, 2 fanns redan. 1 album gick inte att hämta.');
    expect(importSummary({ created: 0, existing: 1 })).toBe('0 låtar tillagda, 1 fanns redan.');
    expect(importSummary(undefined)).toBe('0 låtar tillagda.');
  });
});
