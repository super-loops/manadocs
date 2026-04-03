import {
  computeBackoffMs,
  QUEUE_RUNTIME_CONFIG,
  resolveEnqueueOptions,
} from './queue.config';

describe('resolveEnqueueOptions', () => {
  it('applies defaults when opts is empty', () => {
    expect(resolveEnqueueOptions({})).toEqual({
      delay: 0,
      priority: 0,
      maxAttempts: QUEUE_RUNTIME_CONFIG.defaultMaxAttempts,
      uniqueKey: null,
    });
  });

  it('clamps negative delay to zero', () => {
    expect(resolveEnqueueOptions({ delay: -5000 }).delay).toBe(0);
  });

  it('preserves positive delay', () => {
    expect(resolveEnqueueOptions({ delay: 1500 }).delay).toBe(1500);
  });

  it('maps BullMQ attempts option to maxAttempts', () => {
    expect(resolveEnqueueOptions({ attempts: 3 }).maxAttempts).toBe(3);
  });

  it('prefers explicit maxAttempts over attempts alias', () => {
    expect(
      resolveEnqueueOptions({ maxAttempts: 10, attempts: 2 }).maxAttempts,
    ).toBe(10);
  });

  it('uses jobId as the unique_key', () => {
    expect(resolveEnqueueOptions({ jobId: 'abc' }).uniqueKey).toBe('abc');
  });

  it('falls back to deduplication.id when jobId absent', () => {
    expect(
      resolveEnqueueOptions({ deduplication: { id: 'dedup-1' } }).uniqueKey,
    ).toBe('dedup-1');
  });

  it('jobId wins over deduplication.id', () => {
    expect(
      resolveEnqueueOptions({
        jobId: 'primary',
        deduplication: { id: 'secondary' },
      }).uniqueKey,
    ).toBe('primary');
  });

  it('passes priority through unchanged', () => {
    expect(resolveEnqueueOptions({ priority: -3 }).priority).toBe(-3);
    expect(resolveEnqueueOptions({ priority: 7 }).priority).toBe(7);
  });

  it('ignores BullMQ-only options (removeOnComplete, backoff)', () => {
    // These are accepted at the type boundary but have no effect — retention
    // is governed by QueueRuntime config. Assertion: calling with them
    // produces the same result as calling without.
    const withNoise = resolveEnqueueOptions({
      removeOnComplete: true,
      removeOnFail: { age: 3600 },
      backoff: { type: 'exponential', delay: 5000 },
    });
    expect(withNoise).toEqual(resolveEnqueueOptions({}));
  });
});

describe('computeBackoffMs', () => {
  it('first retry waits one base interval', () => {
    expect(computeBackoffMs(1)).toBe(QUEUE_RUNTIME_CONFIG.backoffBaseMs);
  });

  it('doubles each retry (exponential)', () => {
    expect(computeBackoffMs(2)).toBe(QUEUE_RUNTIME_CONFIG.backoffBaseMs * 2);
    expect(computeBackoffMs(3)).toBe(QUEUE_RUNTIME_CONFIG.backoffBaseMs * 4);
    expect(computeBackoffMs(4)).toBe(QUEUE_RUNTIME_CONFIG.backoffBaseMs * 8);
  });
});
