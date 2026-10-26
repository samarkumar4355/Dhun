import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { catalogService } from '../src/services/catalog.service.js';
import { formatTrackResponse } from '../src/routes/track.routes.js';

describe('Dhun Music Catalog & Normalization Tests', () => {

  describe('1. Artist String Parsing & Normalization', () => {
    it('should normalize whitespace and Unicode characters', () => {
      assert.strictEqual(catalogService.normalizeName('  Josh   Woodward  '), 'josh woodward');
      assert.strictEqual(catalogService.normalizeName('Artist\tName\n'), 'artist name');
      assert.strictEqual(catalogService.normalizeName(''), '');
    });

    it('should parse single artist without featured artists', () => {
      const parsed = catalogService.parseArtistString('Josh Woodward');
      assert.strictEqual(parsed.primaryArtist, 'Josh Woodward');
      assert.deepStrictEqual(parsed.featuredArtists, []);
    });

    it('should parse "feat." collaborator notation', () => {
      const parsed = catalogService.parseArtistString('Daft Punk feat. Pharrell Williams');
      assert.strictEqual(parsed.primaryArtist, 'Daft Punk');
      assert.deepStrictEqual(parsed.featuredArtists, ['Pharrell Williams']);
    });

    it('should parse "ft." collaborator notation', () => {
      const parsed = catalogService.parseArtistString('Eminem ft. Rihanna');
      assert.strictEqual(parsed.primaryArtist, 'Eminem');
      assert.deepStrictEqual(parsed.featuredArtists, ['Rihanna']);
    });

    it('should parse parenthesized "(feat. ...)" notation', () => {
      const parsed = catalogService.parseArtistString('Major Lazer (feat. MO & DJ Snake)');
      assert.strictEqual(parsed.primaryArtist, 'Major Lazer');
      assert.ok(parsed.featuredArtists.length >= 1);
    });

    it('should parse comma-separated featured artists safely', () => {
      const parsed = catalogService.parseArtistString('Kanye West feat. Rihanna, Kid Cudi');
      assert.strictEqual(parsed.primaryArtist, 'Kanye West');
      assert.deepStrictEqual(parsed.featuredArtists, ['Rihanna', 'Kid Cudi']);
    });

    it('should handle empty or whitespace artist cleanly', () => {
      const parsed = catalogService.parseArtistString('');
      assert.strictEqual(parsed.primaryArtist, 'Unknown Artist');
      assert.deepStrictEqual(parsed.featuredArtists, []);
    });
  });

  describe('2. Unknown Metadata Honesty', () => {
    it('should not fabricate metadata when fields are missing', () => {
      const rawTrack = {
        _id: '67bdc1234567890abcdef123',
        filename: 'TheBox.flac',
        title: 'The Box',
        artist: 'Unknown Artist',
        album: undefined,
        genre: undefined,
        year: undefined,
        lyrics: null,
        hasLyrics: false,
        isLossless: true,
        format: 'FLAC',
        size: 25000000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const formatted = formatTrackResponse(rawTrack);
      assert.strictEqual(formatted.title, 'The Box');
      assert.strictEqual(formatted.album, null);
      assert.strictEqual(formatted.genre, null);
      assert.strictEqual(formatted.lyrics, null);
      assert.strictEqual(formatted.hasLyrics, false);
      assert.strictEqual(formatted.isLossless, true);
    });
  });

  describe('3. Track Response Formatting & Quality Classification', () => {
    it('should format duration in ms and seconds accurately', () => {
      const trackWithDuration = {
        _id: '67bdc1234567890abcdef124',
        title: 'Let It In',
        artist: 'Josh Woodward',
        duration: 185.4,
        durationMs: 185400,
        isLossless: false,
        format: 'MPEG 1 Layer 3',
        bitrate: 320000,
        sampleRate: 44100,
        lyrics: 'Line 1\nLine 2\nLine 3',
        hasLyrics: true,
      };

      const formatted = formatTrackResponse(trackWithDuration);
      assert.strictEqual(formatted.duration, 185.4);
      assert.strictEqual(formatted.durationMs, 185400);
      assert.strictEqual(formatted.hasLyrics, true);
      assert.strictEqual(formatted.isLossless, false);
      assert.strictEqual(formatted.quality.isLossless, false);
      assert.strictEqual(formatted.quality.format, 'MPEG 1 Layer 3');
      assert.strictEqual(formatted.quality.bitrate, 320000);
      assert.strictEqual(formatted.quality.sampleRate, 44100);
    });

    it('should accurately expose lossless metadata for FLAC tracks', () => {
      const flacTrack = {
        _id: '67bdc1234567890abcdef125',
        title: 'Cherubs',
        artist: 'Josh Woodward',
        duration: 210,
        isLossless: true,
        format: 'FLAC',
        bitDepth: 16,
        sampleRate: 44100,
        channels: 2,
        hasLyrics: false,
      };

      const formatted = formatTrackResponse(flacTrack);
      assert.strictEqual(formatted.isLossless, true);
      assert.strictEqual(formatted.quality.bitDepth, 16);
      assert.strictEqual(formatted.quality.channels, 2);
    });
  });
});
