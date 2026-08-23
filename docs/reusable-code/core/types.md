# Types — `core`

## ServiceSpec

**Location:** `core/src/bus/service.ts`

**Description:** Everything a micro service needs in order to be registered on the bus. Four
members and nothing else, which is what makes `registerService()` reusable across services rather
than tailored to the command one.

`handle` **never throws**: it always resolves to a `Reply`. That is a contract, not a precaution —
if an exception escaped to micro, micro would answer `Empty` with error headers and **the body
would be lost**, and the body is the envelope the api parses.

`patterns` are the command patterns as the registry writes them (`tasks.{id}.edit`), not endpoint
names or subjects: the derivation belongs to `registerService()`.

**Interface:**
```ts
interface ServiceSpec {
  /** Bus name, queue group, and the `{svc}` token of the subject. */
  name: string;
  description: string;
  /** Method patterns: `tasks.{id}.edit`, `clients.new`, … They come from the registry. */
  patterns: string[];
  /** Resolves the request. Never throws: always returns a `Reply`. */
  handle: (subject: string, payload: unknown) => Promise<Reply>;
}
```

**Usage:**
```ts
const commandsSpec: ServiceSpec = {
  name: COMMAND_SERVICE,
  description: 'Comandos de dominio de Jiku: la única vía de escritura a la base',
  patterns: registry.patterns(),
  handle: (subject, payload) => dispatcher.dispatch(subject, payload),
};
```

**The spec is built in `src/index.ts`**, not in a file of its own: that is already the place where
the process is wired, so adding a second service is adding a second object literal to the same
call.
