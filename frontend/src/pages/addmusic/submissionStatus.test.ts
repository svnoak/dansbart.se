import { describe, it, expect } from 'vitest';
import { isStillAnalysing, submissionStatusWord, suggestedStyleLabel } from './submissionStatus';

describe('submissionStatusWord', () => {
  it('names each state with a word', () => {
    expect(submissionStatusWord({ status: 'pending' })).toBe('Väntar på granskning');
    expect(submissionStatusWord({ status: 'rejected' })).toBe('Avvisad');
    expect(submissionStatusWord({ status: 'exists' })).toBe('Finns redan');
    expect(submissionStatusWord({ status: 'approved' })).toBe('Hämtas');
    expect(submissionStatusWord({ status: 'approved', trackId: 't', trackStatus: 'PENDING' })).toBe('Analyseras');
    expect(submissionStatusWord({ status: 'approved', trackId: 't', trackStatus: 'PROCESSING' })).toBe('Analyseras');
    expect(submissionStatusWord({ status: 'approved', trackId: 't', trackStatus: 'DONE' })).toBe('Klar');
    expect(submissionStatusWord({ status: 'approved', trackId: 't', trackStatus: 'FAILED' })).toBe('Analysen misslyckades');
  });

  it('only keeps polling while the audio worker has the track', () => {
    expect(isStillAnalysing({ status: 'approved' })).toBe(true);
    expect(isStillAnalysing({ status: 'approved', trackId: 't', trackStatus: 'PROCESSING' })).toBe(true);
    expect(isStillAnalysing({ status: 'approved', trackId: 't', trackStatus: 'DONE' })).toBe(false);
    expect(isStillAnalysing({ status: 'pending' })).toBe(false);
  });

  it('labels the suggested style', () => {
    expect(suggestedStyleLabel({ suggestedMainStyle: 'Polska', suggestedSubStyle: 'Slängpolska' })).toBe('Polska · Slängpolska');
    expect(suggestedStyleLabel({ suggestedMainStyle: 'Polska' })).toBe('Polska');
    expect(suggestedStyleLabel({})).toBeNull();
  });
});
