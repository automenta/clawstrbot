import { RateLimiter, RateLimitConfig } from '../src/rate-limiter';
import { ActionType } from '../src/approval-types';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  const config: Partial<RateLimitConfig> = {
    post: { maxPerHour: 2, maxPerDay: 5 },
    reply: { maxPerHour: 2, maxPerDay: 5 }
  };

  beforeEach(() => {
    rateLimiter = new RateLimiter(config);
  });

  test('should allow actions within limit', async () => {
    const result = await rateLimiter.checkRateLimit('user1', ActionType.POST);
    expect(result.allowed).toBe(true);
  });

  test('should block actions exceeding hourly limit', async () => {
    await rateLimiter.checkRateLimit('user1', ActionType.POST);
    await rateLimiter.checkRateLimit('user1', ActionType.POST);

    // Third one should be blocked
    const result = await rateLimiter.checkRateLimit('user1', ActionType.POST);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Hourly limit exceeded');
  });

  test('should track usage separately for different users', async () => {
    await rateLimiter.checkRateLimit('user1', ActionType.POST);
    await rateLimiter.checkRateLimit('user1', ActionType.POST);

    // user1 is now limited
    const result1 = await rateLimiter.checkRateLimit('user1', ActionType.POST);
    expect(result1.allowed).toBe(false);

    // user2 should still be allowed
    const result2 = await rateLimiter.checkRateLimit('user2', ActionType.POST);
    expect(result2.allowed).toBe(true);
  });
});
