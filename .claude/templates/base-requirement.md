<!-- Template of the "Producto base" requirement that /product-define creates in Jiku (grava.py plan-build).
     The column Aplica filters the criteria by the services of the product:
     always | multi (more than one service) | http | nats | db | frontend | frontend-backend | process,
     and, for a frontend, the platform of its surfaces: web | mobile (mobile-app) | desktop (desktop-app).
     {producto} and {servicios} are filled by the script. Content in Spanish: the client reads it. -->

# Alcance

## Incluye

- La estructura base de {producto}: el repositorio, cada servicio con su stack elegido, Docker Compose,
  Make, tests en cada nivel, CI, observabilidad y monitoreo.
- La definición del producto de lo que queda construido, el README, la guía de operación
  (`docs/operacion.md`) y las guías para agentes (`AGENTS.md`).

## No incluye

- Ningún bloque funcional: cada uno se construye con su requisito del plan.

## Depende de

- Nada.

# Propuesta

El producto se levanta completo con un solo comando, informa su salud y su versión, registra lo que
hace de una forma que cualquier herramienta de observabilidad puede tomar, y queda listo para recibir su
primer bloque funcional.

## Servicios

{servicios}

## Detalle técnico

- El stack de cada servicio (framework, librerías, imagen base) se elige con la documentación oficial
  vigente; el lenguaje es el que fijó el discovery.
- Todo corre con Docker Compose y se maneja con `make`.
- Observabilidad con OpenTelemetry: trazas propagadas entre servicios (W3C `traceparent`), logs JSON
  con `trace_id`, métricas de cada operación. Se configura solo con las variables estándar `OTEL_*`.
- Monitoreo: endpoints de salud con versión, commit y estado de cada dependencia; apagado ordenado.

# Criterios de aceptación

| Cambio | ID | Criterio | Aplica |
|---|---|---|---|
| agrega | 0-AC-01 | `make up` levanta todos los servicios y sus dependencias, y cada uno informa que está sano | always |
| agrega | 0-AC-02 | Cada servicio no arranca, con un mensaje claro, si falta o es inválida una variable de configuración | always |
| agrega | 0-AC-03 | Cada servicio HTTP responde `GET /health` (vivo) y `GET /health/ready` (puede atender) con su estado, versión, commit y el estado de cada dependencia | http |
| agrega | 0-AC-04 | Cada servicio escribe logs JSON en la salida estándar con nivel, hora, servicio, `trace_id` y `span_id` | always |
| agrega | 0-AC-05 | Un pedido que pasa por varios servicios comparte el mismo `trace_id` en los logs de todos, y la respuesta lo devuelve en un header | multi |
| agrega | 0-AC-06 | Con `OTEL_EXPORTER_OTLP_ENDPOINT` configurado, cada servicio exporta trazas y métricas por OTLP; sin esa variable funciona igual, sin exportar | always |
| agrega | 0-AC-07 | Una ruta desconocida o un pedido inválido responde un error RFC 9457 (`application/problem+json`) con un `code` estable | http |
| agrega | 0-AC-08 | Ante una señal de apagado (SIGTERM), el servicio deja de aceptar pedidos, termina los que están en curso y se cierra | process |
| agrega | 0-AC-09 | Los tests de integración corren contra una base de datos real en un contenedor, con las migraciones aplicadas | db |
| agrega | 0-AC-10 | Cada respuesta de los tests de integración se valida contra el contrato del servicio en `_gflow/apis/` | http |
| agrega | 0-AC-11 | Cada mensaje publicado en los tests se valida contra el contrato AsyncAPI del servicio en `_gflow/apis/` | nats |
| agrega | 0-AC-12 | Cada superficie web carga en un navegador real (test end-to-end con Playwright, en cada navegador que pide el requisito no funcional de compatibilidad) y muestra el nombre del producto | web |
| agrega | 0-AC-12 | El test de integración de cada app móvil la abre en un emulador Android local, con la versión mínima que pide el requisito no funcional de compatibilidad, y muestra el nombre del producto (`make test-e2e`) | mobile |
| agrega | 0-AC-12 | Al mergear en `dev`, el CI compila el APK y lo deja descargable en un link fijo; en cada tag de versión, lo compila en modo release, firmado con la clave de las variables secretas del CI (o con la de debug y un aviso si faltan), y lo adjunta al release de esa versión | mobile |
| agrega | 0-AC-12 | Cada app móvil compila para iOS en un runner macOS, o una decisión técnica declara que no se compila y por qué | mobile |
| agrega | 0-AC-12 | Cada app de escritorio compila en el CI y su test end-to-end la abre y muestra el nombre del producto | desktop |
| agrega | 0-AC-12 | El test end-to-end de cada superficie falla ante un error de render del cliente (en Flutter, un overflow) y deja una captura de cada pantalla que recorre en `reports/screenshots/` | frontend |
| agrega | 0-AC-13 | El frontend llega a su backend por la URL configurada y muestra un estado de error cuando el backend no responde | frontend-backend |
| agrega | 0-AC-14 | `make test` deja un reporte JUnit por servicio y nivel en `reports/junit/` | always |
| agrega | 0-AC-15 | El CI de cada MR corre lint, typecheck, los tests unitarios y de integración, el escáner de secretos y la auditoría de dependencias; el de `dev` y el de cada tag, además, construyen las imágenes y compilan cada cliente para cada plataforma de sus superficies | always |
| agrega | 0-AC-15 | `make test-perf` corre las pruebas de rendimiento de los requisitos no funcionales que se verifican con una prueba, en local; no corre en el CI | always |
| agrega | 0-AC-15 | `docs/operacion.md` documenta cada secreto que usa el CI (nombre, qué es, cómo se crea y dónde se configura en la plataforma), o dice que no usa ninguno | always |
| agrega | 0-AC-16 | `README.md`, `docs/operacion.md` y los `AGENTS.md` dicen cómo levantar, operar y trabajar en el producto, sin marcadores pendientes | always |
