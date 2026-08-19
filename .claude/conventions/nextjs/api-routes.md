---
id: api-routes
display_name: API Routes (Route Handlers)
language: nextjs
description: Route Handlers for external clients — when to use vs Server Actions, Next.js 15 patterns
applies_to: [frontend]
required_by: []
package: next
---

# API Routes (Next.js, Route Handlers)

Route Handlers (`route.ts`) expose HTTP endpoints for **external clients** — webhooks, mobile apps, third-party integrations. They are not for internal Next.js mutations or data fetching; those use Server Actions and Server Components respectively.

## When to use

**Use Route Handlers when the caller is external to the Next.js app:**
- Webhooks (Stripe, GitHub, etc.) — need raw body access to verify signatures
- Mobile apps or third-party clients that consume a JSON API
- Public APIs documented with OpenAPI/Swagger
- Responses with custom headers or non-JSON content types (CSV, XML, streams)

**Use Server Actions instead when:**
- The caller is a form or Client Component in the same app
- The operation is a user-triggered mutation (create, update, delete)

**Never use Route Handlers for:**
- Internal data fetching from Server Components (call the DB or API directly)
- Mutations triggered from the same Next.js app's UI

## Package

```
next        # Route Handlers are built-in (route.ts file convention)
zod         # input validation
```

## Structure

```
src/
└── app/
    └── api/
        ├── auth/
        │   └── [...nextauth]/
        │       └── route.ts    # Auth.js handler (special case)
        └── webhooks/
            └── stripe/
                └── route.ts
```

Keep `src/app/api/` only for external-facing endpoints. Internal mutations belong in `src/actions/`.

## Configuration

### Basic Route Handler (Next.js 15)

```ts
// src/app/api/users/[id]/route.ts
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifySession } from '@/lib/dal';

// In Next.js 15, params is a Promise — always await it
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await verifySession();

  const user = await getUserById(id);
  if (!user) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });

  return Response.json({ data: user });
}
```

### POST with validation

```ts
// src/app/api/users/route.ts
import { z } from 'zod';
import { verifySession } from '@/lib/dal';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  await verifySession();

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const user = await createUser(parsed.data);
  return Response.json({ data: user }, { status: 201 });
}
```

## How to use

### Webhook — raw body for signature verification

```ts
// src/app/api/webhooks/stripe/route.ts
import { type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  const body = await request.text();   // raw text, not .json()
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
  }

  return new Response(null, { status: 204 });
}
```

### CORS for external clients

```ts
// src/app/api/public/route.ts
import { env } from '@/lib/env';

const corsHeaders = {
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  return Response.json({ data: [...] }, { headers: corsHeaders });
}
```

### Caching (Next.js 15)

GET Route Handlers are **not cached by default** in Next.js 15. Opt in explicitly:

```ts
// Force static caching
export const dynamic = 'force-static';

export async function GET() {
  return Response.json({ data: [...] });
}
```

```ts
// Time-based revalidation
export const revalidate = 60; // seconds

export async function GET() {
  return Response.json({ data: [...] });
}
```

For dynamic per-user data, the default (no caching) is correct — do nothing.

## Response shape

Use a consistent shape across all Route Handlers:

```ts
// Success
return Response.json({ data: result }, { status: 200 });
return Response.json({ data: created }, { status: 201 });

// Expected error
return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
return Response.json(
  { error: 'VALIDATION_ERROR', details: fieldErrors },
  { status: 400 },
);

// No content
return new Response(null, { status: 204 });
```

This shape aligns with the Node backend `error-handling` convention so the frontend `error-handling` convention can parse it consistently.

## Rules

- Route Handlers are for external clients only. Internal mutations use Server Actions; internal data fetching goes directly to DB/API from Server Components.
- Always `await params` — in Next.js 15 it is a `Promise<{ ... }>`, not a plain object.
- Authenticate at the top of every non-public handler via `verifySession()` from the DAL.
- Validate all input with Zod before processing. Never trust request bodies.
- GET handlers are not cached by default in Next.js 15. Opt in explicitly with `dynamic` or `revalidate` exports when caching is desired.
- For webhooks, always verify the signature from the raw request body before processing.
- Apply CORS headers only on endpoints that serve external origins. Do not apply CORS globally.
- The response shape follows the `{ data }` / `{ error }` convention consistently.

## Integration with other conventions

- **auth**: non-public Route Handlers call `verifySession()` from the DAL.
- **error-handling**: error responses follow the `{ error: 'CODE', details?: ... }` shape that the Next.js `error-handling` convention parses via `ApiCallError`.
- **mutations**: Server Actions are the counterpart for internal mutations. Route Handlers and Server Actions are not interchangeable — choose based on who the caller is.
- **env-config**: secrets used in handlers (webhook signing secrets, etc.) are validated at startup.
