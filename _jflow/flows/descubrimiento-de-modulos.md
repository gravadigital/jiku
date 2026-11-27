---
flow: descubrimiento-de-modulos
requirements: [DOC-01, DOC-02, ACC-14, CON-16]
modules: [api.docs, api.portal]
---

# Descubrimiento del módulo de documentación

El módulo opcional de documentación se registra en el bus; la api lo descubre, lo verifica con un ping periódico y les informa su estado a los frontends, que muestran u ocultan la documentación.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | jiku-docs → NATS | Al arrancar, cuando ya puede atender, el módulo escribe su registro (módulo, nombre del servicio, protocolo) en el espacio de módulos del bus; apagarse no lo borra | `registerModule` (`$KV.JIKU_MODULES.docs`) | DOC-01 |
| 2 | api.docs → NATS | Al arrancar, la api abre el espacio de módulos, lee la clave del módulo y la observa; si el bus o el espacio no están, queda «no instalado» y reintenta a los 30 segundos | `watchModules` (`$KV.JIKU_MODULES.docs`) | DOC-01 |
| 3 | api.docs | Sin clave el módulo está «no instalado»; un registro inválido o con un protocolo distinto de `v1` se registra en el log y cuenta como «no instalado» | — | DOC-01 |
| 4 | api.docs → jiku-docs | Con un registro válido hace ping al servicio de consultas del módulo (2 segundos de espera): responde «disponible», no responde «no disponible»; repite cada 30 segundos | `$SRV.PING.jiku-docs-queries` | DOC-01 |
| 5 | NATS → api.docs | Si la clave se borra o cambia, la observación lo entrega y el estado cambia sin reiniciar la api; una llamada al módulo sin respuesta lo marca «no disponible» | `watchModules` | DOC-01 |
| 6 | web → api.docs, opus-web → api.portal | Los frontends piden el estado de los módulos y si los links públicos están habilitados, cada 60 segundos y cada vez que una llamada responde que el módulo no está disponible | `GET /modules`, `GET /opus/modules` | DOC-02, DOC-E1, DOC-E2 |
| 7 | web / opus-web | Con el módulo «no instalado» el gestor oculta «Documentación» del menú y el portal oculta la sección de documentos | — | ACC-14, DOC-02 |
| 8 | conector → NATS | Un conector también puede leer y observar el registro de módulos y consultar si un servicio responde | `watchModules`, `$SRV.PING.{serviceName}-queries` | CON-16 |
