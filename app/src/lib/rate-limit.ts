// DB-backed rate limiter using Postgres (works across serverless instances)
// Keyed by `${bucket}:${ip}` to separate limits per endpoint

import { db } from './prisma';

/**
 * Check if a request is within the rate limit.
 * Returns true if allowed, false if rate limit exceeded.
 *
 * Uses atomic INSERT ON CONFLICT for race-safety.
 * Expired windows reset automatically.
 */
export async function rateLimit(
  ip: string,
  bucket: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const key = `${bucket}:${ip}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  try {
    const result = await db().$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits (key, count, expires_at)
      VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.expires_at < ${now} THEN 1
          ELSE rate_limits.count + 1
        END,
        expires_at = CASE
          WHEN rate_limits.expires_at < ${now} THEN ${expiresAt}
          ELSE rate_limits.expires_at
        END
      RETURNING count
    `;

    return (result[0]?.count ?? 1) <= limit;
  } catch (error) {
    // If rate limit check fails, allow the request (fail open)
    console.error('[rateLimit] DB error, allowing request:', error);
    return true;
  }
}
