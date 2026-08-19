---
id: cache
display_name: Caché (ioredis)
language: node
description: Redis-based caching with ioredis using the cache-aside pattern
applies_to: [api, worker]
required_by: []
package: ioredis
---

# Cache (Node, ioredis)

Redis caching with [ioredis](https://github.com/redis/ioredis). Cache-aside pattern: the application checks the cache first, falls back to the source of truth on miss, and populates the cache for subsequent reads. All keys follow a structured naming convention with explicit TTL.

## When to use

- APIs with expensive reads (DB queries, external API calls) that can tolerate slightly stale data.
- Workers that need to deduplicate or throttle expensive operations.
- Not needed when data must always be fresh or the service has no Redis dependency.

## Package

```
ioredis             # Redis client
```

## Configuration

```ts
// src/shared/cache.ts
import { Redis } from 'ioredis';
import { env } from '@/config/env';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
```

## How to use

### Cache-aside helper

A generic helper prevents repetition across repositories and services:

```ts
// src/shared/cache.ts (continued)
export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  fetch: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached !== null) return JSON.parse(cached) as T;

  const value = await fetch();
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
  return value;
}
```

Usage in a service:

```ts
import { cacheAside } from '@/shared/cache';

async function getUser(id: string) {
  return cacheAside(
    `user:${id}`,
    300,   // 5 min TTL
    () => usersRepo.findById(id),
  );
}
```

### Key naming convention

Keys follow the pattern `{resource}:{id}` or `{resource}:{scope}:{qualifier}`:

```
user:abc123
product:list:category:electronics
session:xyz789
rate-limit:ip:192.168.1.1
```

- All lowercase, colon-separated.
- Always include the resource type as the first segment.
- Avoid generic keys like `data` or `cache`.

### Invalidation

Invalidate on write:

```ts
async function updateUser(id: string, data: Partial<User>) {
  const user = await usersRepo.update(id, data);
  await redis.del(`user:${id}`);
  return user;
}
```

Use pattern-based deletion sparingly (expensive scan):

```ts
// Only for batch invalidation when necessary
const keys = await redis.keys('product:list:*');
if (keys.length > 0) await redis.del(...keys);
```

### Direct Redis operations

```ts
// atomic increment (counters, rate limiting)
await redis.incr(`view-count:${postId}`);

// set with expiry
await redis.setex(`otp:${userId}`, 300, otpCode);

// check existence without fetching
const exists = await redis.exists(`session:${token}`);
```

## Rules

- Never cache data that must always be fresh (e.g., financial balances, auth tokens after revocation).
- Every cached key must have a TTL. Never use `redis.set` without expiry — use `setex` or `set` with `EX`.
- Follow the `{resource}:{id}` key naming convention. Document non-obvious key patterns near usage.
- Invalidate cache on write. Stale reads after mutations are acceptable for the TTL duration, but mutations must always go through and invalidate.
- The cache is a performance optimization, not a source of truth. The service must work (slower) without Redis.
- Parse and serialize with `JSON.parse` / `JSON.stringify`. Never store JS objects directly.
- Do not cache sensitive data (PII, tokens) unless encryption at rest is configured for Redis.
- Handle Redis errors gracefully: a cache miss or Redis unavailability falls back to the source of truth.

## Integration with other conventions

- **env-config**: `REDIS_URL` validated at startup.
- **logging**: log cache hits/misses at `debug` level, errors at `error`.
- **auth-jwt**: refresh token rotation state stored in Redis under `refresh-token:{userId}`.
- **queue**: BullMQ uses a separate Redis connection; do not share the cache connection with the queue.
