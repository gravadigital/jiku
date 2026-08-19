---
id: queue
display_name: Cola de trabajos (BullMQ)
language: node
description: Background job queues with BullMQ, Redis-backed, with worker process patterns
applies_to: [api, worker]
required_by: []
package: bullmq
---

# Queue / Background Jobs (Node, BullMQ)

Background job queues with [BullMQ](https://docs.bullmq.io), backed by Redis. Producers (usually the API) enqueue jobs; workers (separate processes) process them. Supports retries, delays, priorities, and concurrency out of the box.

## When to use

- Any service that needs to defer work outside the HTTP request cycle.
- Workers that process jobs produced by the API or by scheduled triggers.
- Not needed in services with no background processing.

## Package

```
bullmq              # queue + worker
ioredis             # Redis client (shared with cache convention)
```

## Structure

```
src/
├── queues/
│   ├── index.ts            # exports queue instances
│   ├── {queue-name}.ts     # queue definition + producer helper
│   └── workers/
│       ├── index.ts        # bootstraps all workers
│       └── {queue-name}.worker.ts   # processor logic
```

## Configuration

```ts
// src/queues/connection.ts
import { Redis } from 'ioredis';
import { env } from '@/config/env';

// BullMQ requires a dedicated connection (not shared with cache)
export const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,  // required by BullMQ
  enableReadyCheck: false,
});
```

```ts
// src/queues/email.ts
import { Queue } from 'bullmq';
import { queueConnection } from './connection';

export interface SendEmailJob {
  to: string;
  subject: string;
  templateId: string;
  variables: Record<string, string>;
}

export const emailQueue = new Queue<SendEmailJob>('email', {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
```

## How to use

### Enqueuing jobs (producer)

```ts
import { emailQueue } from '@/queues/email';

// fire-and-forget
await emailQueue.add('send-welcome', {
  to: user.email,
  subject: 'Welcome!',
  templateId: 'welcome',
  variables: { name: user.name },
});

// with delay
await emailQueue.add('send-reminder', payload, { delay: 24 * 60 * 60 * 1000 });
```

### Processing jobs (worker)

```ts
// src/queues/workers/email.worker.ts
import { Worker, type Job } from 'bullmq';
import { queueConnection } from '../connection';
import type { SendEmailJob } from '../email';
import { logger } from '@/shared/logger';
import { emailService } from '@/domain/notifications/email.service';

export function createEmailWorker() {
  return new Worker<SendEmailJob>(
    'email',
    async (job: Job<SendEmailJob>) => {
      const jobLogger = logger.child({ jobId: job.id, jobName: job.name });
      jobLogger.info('Processing email job');

      await emailService.send(job.data);

      jobLogger.info('Email job completed');
    },
    {
      connection: queueConnection,
      concurrency: 5,
    },
  );
}
```

### Graceful shutdown

```ts
// src/queues/workers/index.ts
import { createEmailWorker } from './email.worker';

const workers = [createEmailWorker()];

export async function startWorkers() {
  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Job failed');
    });
  }
  logger.info('Workers started');
}

export async function stopWorkers() {
  await Promise.all(workers.map((w) => w.close()));
  logger.info('Workers stopped');
}
```

Register shutdown handlers in the entry point:

```ts
process.on('SIGTERM', async () => {
  await stopWorkers();
  process.exit(0);
});
```

## Rules

- Workers and producers use separate Redis connections. BullMQ requires `maxRetriesPerRequest: null` on the connection.
- Do not share the BullMQ Redis connection with the cache convention. Isolation avoids cross-contamination of connection state.
- Every job type has a TypeScript interface for its payload. No `any` job data.
- All job processors must be idempotent — jobs can be retried after partial execution.
- Log the job start and completion with at minimum `{ jobId, jobName }` in the child logger.
- `removeOnComplete` and `removeOnFail` are always set to prevent unbounded Redis growth.
- Graceful shutdown: workers call `.close()` before the process exits to drain in-progress jobs.
- Do not block the event loop in a job processor. CPU-heavy work goes in a worker thread or separate process.

## Integration with other conventions

- **logging**: child logger per job with `{ jobId, jobName }` context.
- **env-config**: `REDIS_URL` (or `QUEUE_REDIS_URL`) validated at startup.
- **error-handling**: unhandled job errors are caught by BullMQ and trigger retries per `attempts` config.
