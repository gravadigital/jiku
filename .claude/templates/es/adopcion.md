# Adopción de jiku flow

> Informe de la adopción del {{completar: fecha}} (requisito #{{completar: id}}). Es un registro de ese
> día: no se mantiene al día. Lo que decidas hacer con lo que lista entra como requisito de Jiku
> (`/jflow-spec` + `/jflow-build`) o como cambio directo (`/jflow-fix`).

## Resumen

| | |
|---|---|
| Definición | {{completar: n bloques, m entidades, k operaciones, invariantes, garantías, decisiones, flujos}} |
| Listo para especificar e implementar | Sí: el repositorio cumple el mínimo (M1–M9), verificado |
| Correcciones hechas en la adopción | {{completar: n}} |
| Cargado en Jiku | {{completar: las incidencias de seguridad #…, o «Nada.»}} |
| En este informe | {{completar: n bugs, n comportamientos a confirmar, n defaults sugeridos, n otras mejoras}} |
| Cobertura por ID | {{completar: x/y (los tests anteriores no llevan IDs)}} |

## Línea de base

Cómo estaba el repositorio antes de la adopción, corriendo sus propios comandos.

| Comando de antes | Resultado |
|---|---|
| {{completar: cada comando que el repo traía para instalar, compilar, lintear y testear, y si pasó o cuántos tests fallaron}} | |

## Correcciones hechas en la adopción

Lo que la adopción cambió para llegar al mínimo de jiku flow. La lógica del producto solo cambió
para que pase un test que ya existía y fallaba: cada caso nombra el test.

| Mínimo | Qué se hizo | Cómo se comprobó |
|---|---|---|
| {{completar: M1–M9, una fila por corrección: qué se movió, agregó o arregló, y el comando que lo demuestra}} | | |

## Cargado en Jiku

| # | Título | Por qué |
|---|---|---|
| {{completar: una fila por incidencia de seguridad}} | | |

## Bugs sospechados

No son de seguridad, así que no se cargaron en Jiku. La definición los documenta tal como funcionan hoy.

### B-01 {{completar: título}}

- **Qué pasa:** {{completar: el comportamiento actual}}
- **Por qué parece un error:** {{completar}}
- **Dónde:** {{completar: IDs de la definición y `archivo:línea`}}
- **Gravedad sugerida:** {{completar: alta, media o baja, y por qué}}

## Comportamientos a confirmar

Comportamientos que pueden ser intencionales o no, y que quedaron sin respuesta en la adopción. La
definición los documenta tal cual, sin decisión. Al especificar algo que los toque, conviene decidirlos.

| Comportamiento | Duda | IDs |
|---|---|---|
| {{completar: «Ninguno.» si todos se respondieron}} | | |

## Defaults de jiku flow que el producto no sigue

Los productos nuevos los siguen desde el inicio; este los sigue desde ahora en lo nuevo. Adecuar lo
existente es opcional: si se decide mantener uno a propósito, queda como decisión técnica al especificarlo.

| Default | Hoy | Cambio sugerido | Esfuerzo |
|---|---|---|---|
| {{completar: uno por desvío fuera del mínimo}} | | | |

## Otras mejoras sugeridas

| Mejora | Por qué | Esfuerzo |
|---|---|---|
| {{completar: deuda técnica, tests faltantes, refactors que valga la pena considerar; «Ninguna.» si no hay}} | | |

## Contradicciones

{{completar: comportamientos contradictorios documentados los dos en la definición; «Ninguna.» si no hay}}
