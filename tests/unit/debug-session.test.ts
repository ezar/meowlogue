import { describe, expect, it } from 'vitest';
import { median, summarizeSession, toExportPayload } from '@/lib/debug-session';
import { makeEvent, makeFeatures } from './fixtures/events';

describe('median', () => {
  it('returns 0 for an empty sample', () => {
    expect(median([])).toBe(0);
  });

  it('averages the middle pair for an even sample', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('takes the middle value for an odd sample', () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it('does not mutate its input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('summarizeSession', () => {
  it('reports an empty session without dividing by zero', () => {
    const summary = summarizeSession([]);
    expect(summary.total).toBe(0);
    expect(summary.eventsPerMinute).toBe(0);
    expect(summary.spanMs).toBe(0);
    expect(summary.byType.meow).toBe(0);
  });

  it('counts by type and flags possible-human events separately', () => {
    const base = Date.UTC(2026, 8, 11, 7, 0, 0);
    const summary = summarizeSession([
      makeEvent({ id: 'a', type: 'meow', startedAt: base, durationMs: 500 }),
      makeEvent({ id: 'b', type: 'meow', startedAt: base + 1_000, durationMs: 700 }),
      makeEvent({ id: 'c', type: 'purr', startedAt: base + 2_000, durationMs: 9_000 }),
      makeEvent({
        id: 'd',
        type: 'meow',
        startedAt: base + 3_000,
        durationMs: 300,
        possibleHuman: true,
      }),
    ]);

    expect(summary.total).toBe(4);
    expect(summary.byType.meow).toBe(3);
    expect(summary.byType.purr).toBe(1);
    expect(summary.byType.hiss).toBe(0);
    expect(summary.possibleHuman).toBe(1);
    expect(summary.totalDurationMs).toBe(10_500);
    expect(summary.medianDurationMs).toBe(600);
  });

  it('measures the span from the first start to the last end', () => {
    const base = Date.UTC(2026, 8, 11, 7, 0, 0);
    const summary = summarizeSession([
      makeEvent({ id: 'a', startedAt: base, durationMs: 500 }),
      makeEvent({ id: 'b', startedAt: base + 59_000, durationMs: 1_000 }),
    ]);

    expect(summary.spanMs).toBe(60_000);
    expect(summary.eventsPerMinute).toBeCloseTo(2, 5);
  });
});

describe('toExportPayload', () => {
  const events = [makeEvent()];

  it('omits embeddings and thumbnails by default', () => {
    const payload = toExportPayload(events, 'test-agent');
    const [event] = payload.events;

    expect(payload.schema).toBe('meowlogue.debug-session/1');
    expect(payload.userAgent).toBe('test-agent');
    expect(event?.features.embeddingMean).toBeUndefined();
    expect(event?.features.melThumbnail).toBeUndefined();
    expect(event?.features.pitch.f0MedianHz).toBe(520);
  });

  it('includes embeddings as plain arrays when asked', () => {
    const payload = toExportPayload(events, 'test-agent', { includeEmbeddings: true });
    const [event] = payload.events;

    expect(event?.features.embeddingMean).toHaveLength(1024);
    expect(Array.isArray(event?.features.embeddingMean)).toBe(true);
  });

  it('includes thumbnails as plain arrays when asked', () => {
    const payload = toExportPayload([makeEvent({ features: makeFeatures() })], 'test-agent', {
      includeThumbnails: true,
    });
    const thumbnail = payload.events[0]?.features.melThumbnail;

    expect(thumbnail?.bands).toBe(64);
    expect(thumbnail?.data).toHaveLength(64 * 24);
  });

  it('survives a JSON round trip', () => {
    const payload = toExportPayload(events, 'test-agent', {
      includeEmbeddings: true,
      includeThumbnails: true,
    });
    expect(() => JSON.parse(JSON.stringify(payload)) as unknown).not.toThrow();
  });

  it('writes timestamps as ISO 8601', () => {
    const payload = toExportPayload(events, 'test-agent');
    expect(payload.events[0]?.startedAt).toBe('2026-09-11T07:10:00.000Z');
  });
});
