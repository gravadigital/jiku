/**
 * Capacidades opcionales del módulo docs que la api informa en `GET /modules`.
 *
 * `sharing` (links públicos) depende de `JIKU_PUBLIC_URL`, que declara S-080 junto con
 * `API_TRUST_PROXY` y `DOCS_PUBLIC_DOMAIN`. Acá solo se LEE, en cada llamada (convención
 * `env-config`: leer `process.env` en el punto de uso); ausente o vacía → `false`.
 */
export function docsFeatures(): { sharing: boolean } {
  return { sharing: (process.env.JIKU_PUBLIC_URL || '').trim() !== '' };
}
