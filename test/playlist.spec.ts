import { afterEach, describe, expect, it } from 'vitest';
import { playlistService } from '../src/core/playlist';

describe('local playlist persistence', () => {
  afterEach(() => playlistService.clear());

  it('persists the library and deduplicates items by path', () => {
    const first = { path: '/music/track.mp3', name: 'track.mp3' };
    playlistService.set([first]);
    playlistService.add([
      { ...first, name: 'renamed.mp3' },
      { path: '/music/other.flac', name: 'other.flac' },
    ]);

    expect(playlistService.all).toEqual([
      { path: '/music/track.mp3', name: 'renamed.mp3' },
      { path: '/music/other.flac', name: 'other.flac' },
    ]);
    expect(JSON.parse(localStorage.getItem('freq.local-library.v1') ?? '[]')).toEqual(playlistService.all);
  });
});
