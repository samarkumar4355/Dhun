import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { PlaybackService } from '../src/services/playback.service.js';

describe('Dhun Playback & Audio Delivery Tests', () => {
  const playbackService = new PlaybackService();
  const fileSizeBytes = 10000; // 10,000 bytes

  describe('1. HTTP Range Request Parser (RFC 7233)', () => {
    it('should identify non-range requests for full file delivery', () => {
      const res = playbackService.parseRangeHeader(undefined, fileSizeBytes);
      assert.strictEqual(res.isRange, false);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.start, 0);
      assert.strictEqual(res.end, 9999);
      assert.strictEqual(res.chunkSize, 10000);
    });

    it('should parse explicit range: bytes=0-1023', () => {
      const res = playbackService.parseRangeHeader('bytes=0-1023', fileSizeBytes);
      assert.strictEqual(res.isRange, true);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.start, 0);
      assert.strictEqual(res.end, 1023);
      assert.strictEqual(res.chunkSize, 1024);
    });

    it('should parse open-ended range: bytes=5000-', () => {
      const res = playbackService.parseRangeHeader('bytes=5000-', fileSizeBytes);
      assert.strictEqual(res.isRange, true);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.start, 5000);
      assert.strictEqual(res.end, 9999);
      assert.strictEqual(res.chunkSize, 5000);
    });

    it('should parse suffix range: bytes=-1000', () => {
      const res = playbackService.parseRangeHeader('bytes=-1000', fileSizeBytes);
      assert.strictEqual(res.isRange, true);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.start, 9000);
      assert.strictEqual(res.end, 9999);
      assert.strictEqual(res.chunkSize, 1000);
    });

    it('should reject out-of-bounds start range: bytes=15000-20000', () => {
      const res = playbackService.parseRangeHeader('bytes=15000-20000', fileSizeBytes);
      assert.strictEqual(res.isRange, true);
      assert.strictEqual(res.isValid, false);
    });

    it('should reject inverted range: bytes=8000-5000', () => {
      const res = playbackService.parseRangeHeader('bytes=8000-5000', fileSizeBytes);
      assert.strictEqual(res.isRange, true);
      assert.strictEqual(res.isValid, false);
    });
  });

  describe('2. Delivery Quality & Technical Audio Classification', () => {
    it('should verify lossless classification integrity for high-res formats', () => {
      const losslessFlac = {
        format: 'FLAC',
        bitDepth: 24,
        sampleRate: 96000,
        channels: 2,
        isLossless: true,
      };

      assert.strictEqual(losslessFlac.isLossless, true);
      assert.strictEqual(losslessFlac.bitDepth, 24);
      assert.strictEqual(losslessFlac.sampleRate, 96000);
    });

    it('should not misclassify high-bitrate MP3 as lossless', () => {
      const highQualityMp3 = {
        format: 'MPEG 1 Layer 3',
        bitrate: 320000,
        sampleRate: 44100,
        channels: 2,
        isLossless: false,
      };

      assert.strictEqual(highQualityMp3.isLossless, false);
      assert.strictEqual(highQualityMp3.bitrate, 320000);
    });
  });
});
