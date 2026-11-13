# Operación de {{completar: nombre del producto}}

Cómo se opera el producto: cómo saber si está sano, qué procesos corren solos, cómo se configura y
qué conviene alertar. Para el detalle de qué hace el producto, ver la definición en `_gflow/prd/`.

## Servicios y salud

Cada servicio responde `GET /health` (está vivo) y `GET /health/ready` (puede atender), con su estado,
versión, commit y el estado de cada dependencia:

```json
{ "status": "up", "version": "1.4.0", "commit": "a1b2c3d", "checks": { "database": "up" } }
```

| Servicio | Health | Dependencias que chequea |
|---|---|---|
| {{completar: cada servicio, la URL de su health y lo que chequea su readiness}} | | |

## Procesos en segundo plano

| Proceso | Servicio | Cada cuánto | Qué hace | Métrica de último éxito |
|---|---|---|---|---|
| {{completar: cada proceso programado, worker o consumidor de cola; "Ninguno todavía." si no hay}} | | | | |

## Configuración

Todo se configura con variables de entorno (ver `.env.example`). Si falta una obligatoria o es
inválida, el servicio no arranca y lo dice.

| Variable | Servicio | Para qué | Default |
|---|---|---|---|
| {{completar: las variables de cada servicio, incluidos los parámetros del producto}} | | | |

## Observabilidad

Los servicios usan OpenTelemetry. Para enviar trazas, métricas y logs a un stack de observabilidad,
alcanza con configurar:

| Variable | Valor |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | El colector OTLP del entorno (sin ella, no se exporta nada) |
| `OTEL_SERVICE_NAME` | El nombre del servicio (ya viene configurado) |
| `OTEL_RESOURCE_ATTRIBUTES` | `deployment.environment=…,service.version=…` |

Los logs son JSON en la salida estándar, con `trace_id` y `span_id`. La respuesta de cada pedido trae
el `trace_id` en un header: con ese id se encuentra el recorrido completo del pedido.

En local: `docker compose --profile observability up` levanta un colector y un visor.

## Alertas recomendadas

Qué conviene alertar, con umbrales que salen de los requisitos no funcionales de disponibilidad y
tiempos. No se fija una herramienta: las implementa el stack que se use.

| Alerta | Condición | Umbral |
|---|---|---|
| Servicio caído | `/health/ready` responde `down` o no responde | {{completar: según el NFR de disponibilidad}} |
| Tasa de errores | Respuestas 5xx sobre el total | {{completar}} |
| Latencia | Percentil 95 de la duración de las operaciones | {{completar: según el NFR de tiempos}} |
| Proceso que no corrió | Tiempo desde el último éxito de un proceso en segundo plano | {{completar: o "no aplica" sin procesos}} |
| Cola acumulada | Mensajes pendientes o antigüedad del más viejo | {{completar: o "no aplica" sin colas}} |

## Secretos del CI

Lo que los pipelines necesitan y es secreto se configura como variable de la plataforma, nunca en el
repositorio. GitLab: *Settings → CI/CD → Variables* (enmascarada; protegida si solo la usan `main` y
los tags). GitHub: *Settings → Secrets and variables → Actions*.

| Variable | Qué es | Cómo se crea | Si falta |
|---|---|---|---|
| {{completar: cada secreto que usa el CI, con el comando exacto para crearlo; o "Ninguno: el CI usa solo el token de la plataforma."}} | | | |

## Builds para descargar

{{completar: qué deja el CI para descargar y dónde — el último build de `dev` (link fijo) y el de cada
versión (adjunto al release del tag); o "Ninguno: el producto se despliega como imágenes."}}

## Despliegue

{{completar: cómo se despliega (imágenes del registry, variables por entorno, migraciones), y cómo se
crea lo que haga falta para usarlo (por ejemplo, el primer usuario)}}
