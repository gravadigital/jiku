# {{completar: nombre del producto}}

{{completar: qué es el producto, para quién y qué resuelve, en un párrafo corto}}

## Cómo levantarlo

Solo hace falta Docker (con Compose) y `make`.

```bash
make up      # levanta todo y espera a que cada servicio esté sano
make down    # lo baja
make logs    # sigue los logs
```

| Qué | Dónde |
|---|---|
| {{completar: cada superficie, la API y las herramientas locales, con su URL}} | |

{{completar: lo que hace falta para usarlo en local (por ejemplo, cómo crear el primer usuario) y
dónde está la configuración (`.env`, creado desde `.env.example`)}}

## Comandos

| Comando | Qué hace |
|---|---|
| `make check` | Lint, typecheck y todos los tests, igual que CI |
| `make test` | Todos los tests (`S={servicio}` para uno solo) |
| `make dev` | Levanta con recarga en caliente |
| `make migrate` | Aplica las migraciones |
| `make help` | Lista el resto |

## Documentación

- [`docs/operacion.md`](docs/operacion.md): cómo operarlo — salud, procesos, configuración, alertas.
- [`docs/integracion.md`](docs/integracion.md): cómo integrarse, si el producto tiene integradores
  externos.
- [`CHANGELOG.md`](CHANGELOG.md): los cambios por versión.
- La definición del producto (qué hace, reglas y decisiones) está en `_gflow/prd/index.md`, y los
  requisitos con su especificación, en Jiku.
- [`AGENTS.md`](AGENTS.md): la guía para los agentes que trabajan en el repositorio.
