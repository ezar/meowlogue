import { describe, expect, it } from 'vitest';
import { median, summarizeSession, toExportPayload } from '@/lib/debug-session';
import { makeMeowEvent } from './fixtures/events';

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
      makeMeowEvent({ id: 'a', type: 'meow', startedAt: base, durationMs: 500 }),
      makeMeowEvent({ id: 'b', type: 'meow', startedAt: base + 1_000, durationMs: 700 }),
      makeMeowEvent({ id: 'c', type: 'purr', startedAt: base + 2_000, durationMs: 9_000 }),
      makeMeowEvent({
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
      makeMeowEvent({ id: 'a', startedAt: base, durationMs: 500 }),
      makeMeowEvent({ id: 'b', startedAt: base + 59_000, durationMs: 1_000 }),
    ]);

    expect(summary.spanMs).toBe(60_000);
    expect(summary.eventsPerMinute).toBeCloseTo(2, 5);
  });
});

describe('toExportPayload', () => {
  const events = [makeMeowEvent()];

  it('omits embeddings and thumbnails by default', () => {
    const payload = toExportPayload(events, 'test-agent');
    const [event] = payload.events;

    expect(payload.schema).toBe('meowlogue.debug-session/3');
    expect(payload.userAgent).toBe('test-agent');
    expect(event?.embedding).toBeUndefined();
    expect(event?.melThumbnail).toBeUndefined();
    expect(event?.pitch.medianF0Hz).toBe(520);
  });

  it('includes both poolings as plain arrays when asked', () => {
    const payload = toExportPayload(events, 'test-agent', { includeEmbeddings: true });
    const [event] = payload.events;

    expect(event?.embedding?.mean).toHaveLength(1024);
    expect(event?.embedding?.max).toHaveLength(1024);
    expect(Array.isArray(event?.embedding?.mean)).toBe(true);
    expect(event?.embedding?.windows).toBe(3);
  });

  it('omits the embedding of a classifier-only event even when asked', () => {
    const payload = toExportPayload([makeMeowEvent({ embedding: null })], 'test-agent', {
      includeEmbeddings: true,
    });

    expect(payload.events[0]?.embedding).toBeUndefined();
  });

  it('includes thumbnails as plain arrays when asked', () => {
    const payload = toExportPayload([makeMeowEvent()], 'test-agent', {
      includeThumbnails: true,
    });
    const thumbnail = payload.events[0]?.melThumbnail;

    expect(thumbnail?.bands).toBe(64);
    expect(thumbnail?.data).toHaveLength(64 * 24);
  });

  it('omits the thumbnail key entirely when an event has none', () => {
    const payload = toExportPayload([makeMeowEvent({ melThumbnail: null })], 'test-agent', {
      includeThumbnails: true,
    });
    expect(payload.events[0]?.melThumbnail).toBeUndefined();
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
