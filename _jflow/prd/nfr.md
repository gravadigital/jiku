# Non-functional requirements

Scope: `product`, a surface or a service. Verification: `test` (a test, in the requirement named in «Tested in»), `alert` (in the operations guide) or `review` (the verifier checks it).

| ID | Category | Requirement | Target | Scope | Verification | Tested in | Origin |
|---|---|---|---|---|---|---|---|
| NFR-01 | Volumen | Las consultas de lista del bus paginan por cursor | 50 filas por página por defecto, 200 como máximo; un límite mayor se recorta sin error | core | review | — | initial |
| NFR-02 | Volumen | Conexiones de lectura de core (plano de consultas, rol de solo lectura) | Pool de hasta 10 conexiones (`POSTGRESQL_READ_POOL_MAX=10`) | core | review | — | initial |
| NFR-03 | Tiempos | La api espera la respuesta de core a un comando por un tiempo acotado | 5000 ms (`NATS_REQUEST_TIMEOUT_MS`); vencido, responde 504 `gateway_timeout`; sin nadie que atienda, 503 `service_unavailable` | api | review | — | initial |
| NFR-04 | Tiempos | Una consulta del bus tiene un tiempo máximo, y la base la cancela antes que el bus | Statement timeout de 8000 ms (`POSTGRESQL_STATEMENT_TIMEOUT_MS`) por debajo del timeout de consulta de 10000 ms (`NATS_QUERY_TIMEOUT_MS`); la cancelación responde `query_timeout` | core | review | — | initial |
| NFR-05 | Disponibilidad | Los links compartidos limitan los pedidos por dirección IP | 60 pedidos por minuto por IP a `/p/docs`, contados en memoria de cada réplica de la api; el exceso responde 429 | Documento compartido | review | — | initial |
| NFR-06 | Disponibilidad | El estado del módulo de documentación se verifica periódicamente | Ping cada 30 s con 2 s de espera, en cada réplica de la api | api | review | — | initial |
| NFR-07 | Disponibilidad | Los eventos de dominio quedan disponibles para los conectores por un tiempo acotado | 7 días de retención en el stream `JIKU_EVENTS` | core | review | — | initial |
| NFR-08 | Disponibilidad | Las notificaciones por email se entregan al menos una vez, con reintentos | Reintento a los 60 s × 2^(intentos previos), con tope de 24 h, hasta **intentos máximos de notificación** | core | review | — | initial |
| NFR-09 | Privacidad y cumplimiento | La página de un documento compartido no se indexa, no se cachea y no envía el link a terceros | `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer` y una política de contenido que solo admite imágenes externas | Documento compartido | review | — | initial |
| NFR-10 | Privacidad y cumplimiento | Los links firmados del almacenamiento vencen | Subida: **vigencia del link de subida**; lectura: **vigencia del link de descarga** | core | review | — | initial |
| NFR-11 | Idioma, zona horaria y formatos | La interfaz del Gestor interno y del Portal de clientes y los emails de notificación están en español; los mensajes de error que devuelven api y core mezclan español e inglés | Textos de pantalla y emails en español; fechas en formato día/mes/año | product | review | — | initial |
| NFR-12 | Idioma, zona horaria y formatos | Los servicios del servidor calculan las fechas en UTC | `TZ=UTC` en api y core; la ventana de carga de horas y la semana en curso de la asignación se calculan en UTC, y el selector de días del gestor usa la fecha local del navegador | product | review | — | initial |
| NFR-13 | Compatibilidad | Navegadores en los que se prueban los frontends de punta a punta | Chromium de escritorio | product | review | — | initial |
