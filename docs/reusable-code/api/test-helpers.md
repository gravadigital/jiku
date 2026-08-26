# Test Helpers — `api`

> Partial catalog. Run `/service-update-reusable-code api` for a full scan.

The `FakeBus` (`api/tests/mocks/bus.ts`) is installed for the whole run by
`api/tests/setup-env.ts` and reset before each test by a root hook, so a test **never** calls
`setBus`. It exposes `fakeBus` as a singleton.

## dayOffset / HOY / HOY_M10 / HOY_M11 / MANANA

**Location:** `api/tests/helpers/dates.ts`

**Description:** Dates relative to *today*, as `YYYY-MM-DD` strings, for every suite that touches
worked or unworked times. `dayOffset(n)` returns the day `n` days from today; the four constants
name the boundaries the submission window is defined by — `HOY` (today, inside), `HOY_M10` (the
exact lower edge, inside), `HOY_M11` (the first day outside, backwards) and `MANANA` (the first day
outside, forwards).

**Why it exists:** since S-031 the submission window (*the current day and the 10 previous ones*)
is enforced by `core`, and its exact edges have to be tested from the api too. The three
time-tracking suites each declared their own `getDateStr`, and two of their constants **lied** about
the offset they returned (`eightDaysAgoStr = getDateStr(-11)`, `tenDaysAgoStr = getDateStr(-11)`):
three definitions of the same temporal reference are three chances for a divergence to go unnoticed.
It is deliberately the **mirror** of `core/tests/helpers/dates.ts` — the parity test of CA-14 only
reads well if both halves spell the same boundary with the same name.

**Why not `mockdate`,** which the `testing` convention also offers: the `FakeBus` runs `core` **in
the same process**, so freezing the clock would also freeze `isWithinSubmissionWindow` inside core.
It works, but it couples the test to a detail of the double.

**Why it lives outside a `.test.ts`:** four files need it, and mocha does not load it as a suite —
importing a test file from another one would reorder the registration of the `describe`s.

**Signature:**

```ts
export function dayOffset(days: number): string
export const HOY: string      // hoy
export const HOY_M10: string  // hoy − 10, the exact lower edge, inside the window
export const HOY_M11: string  // hoy − 11, the first day outside
export const MANANA: string   // hoy + 1, the first day outside going forwards
```

**Usage example:**

```ts
import { HOY_M10, HOY_M11 } from '../helpers/dates';

it('acepta el borde inferior exacto de la ventana (hoy − 10)', () => {
  return request(application)
    .post('/api/worked-times')
    .send({ date: HOY_M10, minutes: 60, projectId: 1 })
    .set('Authorization', 'Bearer token_01_user')
    .expect(201);
});

it('rechaza hoy − 11 con `invalid_date_range`', () => {
  return request(application)
    .post('/api/worked-times')
    .send({ date: HOY_M11, minutes: 60, projectId: 1 })
    .set('Authorization', 'Bearer token_01_user')
    .expect(400);
});
```

**Note:** `unworked_times.created_at` is a `TIMESTAMP`, not a day, so the deadline fixtures need a
full `Date`. Derive it from the same offset (`new Date(`${dayOffset(-11)}T00:00:00.000Z`)`) rather
than writing millisecond arithmetic — that is exactly what this helper exists to avoid.

## fakeBus.failWithNoResponders()

**Location:** `api/tests/mocks/bus.ts`

**Description:** Makes the next `request()` fail with the NATS *no responders* signal — nobody is
subscribed to the subject. The api answers **`503 service_unavailable`**.

This is a **deployment** problem, and the real server reports it in milliseconds rather than at the
timeout, because it is the server that answers. The api translates it in the `catch` of
`sendCommand`, where it falls into the default branch together with any other exception.

**Why it exists rather than each test building the error:** the exact shape of the error is what the
`catch` discriminates on, so it must be defined in exactly one place. Before S-014 the eleven tests
that covered a broken bus simulated it with `failWith(new Error('timeout'))` — a bare `Error` with no
NATS signal at all. Those assertions stayed green for the wrong reason: they fell into the default
branch instead of simulating the cause they claimed. Naming the two signals is what makes each test
say which failure it means.

**Signature:**

```ts
failWithNoResponders(): this
```

**Usage example:**

```ts
it('responde 503 cuando no hay ningún suscriptor del subject', () => {
  fakeBus.failWithNoResponders();

  return request(application)
    .post('/api/clients')
    .set('Authorization', 'Bearer token_01_user')
    .send({ name: 'Adistal' })
    .expect(503)
    .then((res) => {
      res.body.code.should.equal('service_unavailable');
      // Safe to assert here, and only here: with no subscriber nothing was written.
      return Client.count().then((count) => count.should.equal(0));
    });
});
```

**Used by:** `attachments-preview`, `attachments-download`, `files-preview`,
`opus-attachments-preview`, `projects-post`, `projects-patch`, `clients-post`, `clients-patch` and
`requirements-post` (TS-1, TS-6).

## fakeBus.failWithTimeout()

**Location:** `api/tests/mocks/bus.ts`

**Description:** Makes the next `request()` fail with the NATS timeout signal — someone was
listening and the reply did not arrive in time. The api answers **`504 gateway_timeout`**.

This is a **performance** problem, and **the operation may have happened**: without JetStream there
is no ack and commands are not idempotent, so retrying blindly can duplicate. That is why a test
using this helper must **not** also assert that nothing was written — the two files that make that
assertion (`projects-post`, `clients-post`) are the ones that have to stay on `failWithNoResponders()`.

**A bare `new Error('timeout')` is not a timeout for the api.** The branch is chosen by the NATS
client's signal, never by the message text or by elapsed time, so this helper is the only way to
reach the 504.

**Signature:**

```ts
failWithTimeout(): this
```

**Usage example:**

```ts
it('devuelve 504 cuando la respuesta del bus no llega a tiempo', () => {
  fakeBus.failWithTimeout();

  return request(application)
    .post('/api/attachments')
    .set('Authorization', 'Bearer token_01_user')
    .send(validBody)
    .expect(504)
    .then((res) => {
      res.body.code.should.equal('gateway_timeout');
    });
});
```

**Used by:** `attachments-post`, `attachments-delete`, `opus-attachments-post` and
`requirements-post` (TS-2).

## token_05_user_profile

**Location:** `api/tests/mocks/jsonwebtoken-mock.ts`

**Description:** The only mock token that carries the three OIDC profile claims: `name`
(`'Ana Pérez'`), `preferred_username` and `email` (both `'ana@grava.digital'`), on
`sub: 'zitadel-sub-05'` with the `user` role.

It exists because the identity envelope (S-029) treats those three as optional — the access token
carries them only if the Zitadel instance emits them with the `profile` / `email` scopes the two
frontends request. The other four tokens carry none, which is the opposite case and the one worth
keeping: an envelope without `name` must not wipe the name the `users` row already had.

**Seed a `users` row for `zitadel-sub-05` before using it** — `validateToken` still answers `401
user_not_found` for a `sub` with no row (that 401 goes away in S-034).

**Usage example:**

```ts
await request(application)
  .post('/api/clients')
  .set('Authorization', 'Bearer token_05_user_profile')
  .send({ name: 'Acme' })
  .expect(201);

(fakeBus.last as any).payload.actor.should.deepEqual({
  id: 'zitadel-sub-05',
  roles: ['user'],
  name: 'Ana Pérez',
  username: 'ana@grava.digital',   // `preferred_username` travels as `username`
  email: 'ana@grava.digital',
});
```

**Used by:** `actor-envelope.test.ts` (TS-8).
