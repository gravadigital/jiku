type Protocol = typeof import('../../src/index');

/** Las cuatro variables que el módulo lee al importarse. Se resetean SIEMPRE. */
const PROTOCOL_ENV_KEYS = [
  'NATS_INSTANCE',
  'NATS_PROTOCOL_VERSION',
  'NATS_COMMAND_SERVICE',
  'NATS_QUERY_SERVICE',
] as const;

type ProtocolEnvKey = (typeof PROTOCOL_ENV_KEYS)[number];

/**
 * Re-importa el paquete con un entorno controlado.
 *
 * El módulo lee `process.env` AL IMPORTARSE, así que no hay forma de cambiar una constante
 * después del import: hay que volver a importarlo. Y las cuatro variables se resetean siempre,
 * no solo las que el test pisa, para que la suite no dependa del shell de quien la corre.
 */
export function reload(env: Partial<Record<ProtocolEnvKey, string>> = {}): Protocol {
  const saved = new Map<string, string | undefined>();
  for (const key of PROTOCOL_ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  const modulePath = require.resolve('../../src/index');
  delete require.cache[modulePath];
  const loaded = require('../../src/index') as Protocol;

  for (const [key, value] of saved) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  // Que el módulo cargado con entorno de test no quede cacheado para el próximo `reload`.
  delete require.cache[modulePath];

  return loaded;
}
