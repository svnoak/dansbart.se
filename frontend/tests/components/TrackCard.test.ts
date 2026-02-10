import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Component } from 'vue';
import TrackCard from '../../js/components/TrackCard';
import type { TrackListDto } from '../../js/api/models';

describe('TrackCard', () => {
  it('renders danceStyle from TrackListDto payload', () => {
    const baseTrack: TrackListDto = {
      id: '123',
      title: 'Test Tune',
      durationMs: 180000,
      danceStyle: 'Polska',
      subStyle: 'Bingsjö',
      effectiveBpm: 120,
      confidence: 0.95,
      hasVocals: false,
      artistName: 'Test Artist',
      playbackPlatform: 'youtube',
      playbackLink: 'https://youtube.com/watch?v=test',
    };

    const wrapper = mount(TrackCard as Component, {
      props: {
        track: baseTrack,
        currentTrack: null,
        isSpotifyMode: false,
        isPlaying: false,
      },
    });

    expect(wrapper.text()).toContain('Polska');
  });
});

