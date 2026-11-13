---
document: UX Research Context
audience: cliente
version: 1.0
date: 2026-08-18
status: hipótesis-preliminar
---

# Research Context — Audiencia `cliente`

> Caracterización de la audiencia. **Todo lo que sigue es hipótesis** hasta que se valide con
> usuarios reales. Cada item está trazado a su fuente (PRD, benchmark, código-existente). Items sin
> fuente trazable no se incluyen.

> **Este es el documento menos sostenido de los dos, y la diferencia importa.** El equipo interno
> es su propia audiencia y está a una reunión de distancia; **el cliente no está en la oficina, no
> participó del diseño y nunca fue entrevistado**. Todo lo que sigue se infirió del PRD, del
> benchmark y del comportamiento del código. No hay analítica de ningún tipo en el producto
> `[fuente: PRD § Métricas de Éxito]`, así que **no sabemos siquiera si alguien entra a Opus**.
>
> El PRD lo dice con todas las letras sobre la caracterización de audiencias: el código distingue a
> los consumidores con precisión, pero **no dice quién es cada uno ni con qué frecuencia y en qué
> contexto usa cada pantalla** `[fuente: PRD § Nota sobre la caracterización de audiencias]`.

## Persona Genérica

- **Rol:** Contraparte del proyecto en la organización cliente de la consultora (`external-user`).
  Es quien pide y quien tiene que poder responder internamente en su empresa "cómo viene esto". No
  ejecuta el trabajo ni conoce su descomposición en tareas
  `[fuente: PRD §U-03 y § Problema que Resuelve]`.
- **Contexto de uso:** Entra desde su propia jornada de trabajo, que es otra cosa: Jiku no es una
  herramienta de su oficio sino un lugar al que va cuando necesita algo puntual —ver cómo va un
  pedido, o dejar uno nuevo. Antes de Opus ese pedido llegaba por Mattermost, mail o reunión y se
  perdía `[fuente: PRD § Problema que Resuelve]`, lo que sugiere que **el portal compite con
  escribirle a alguien**, no con otra herramienta.
- **Expertise técnico:** **Desconocido y no asumible.** El PRD no lo caracteriza. Puede ir de un
  perfil técnico (un CTO o líder de producto del lado del cliente) a uno completamente ajeno al
  software. El único límite duro conocido es que **no conoce el vocabulario interno del equipo**:
  los 7 estados del requisito están nombrados para el flujo de la consultora, no para él
  `[fuente: PRD § Vocabulario del Producto; benchmark § Freshdesk]`. **Diseñar asumiendo pericia
  técnica es la apuesta más riesgosa que se puede hacer con esta audiencia.**
- **Frecuencia de uso esperada:** **Esporádica y de baja frecuencia** — entra cada tanto, no todos
  los días, y no acumula pericia entre visitas: cada visita empieza casi de cero
  `[fuente: product-overview.md § Inventario de Audiencias]`. **"Cada tanto" no está cuantificado y
  no debe inventarse un número.** La consecuencia de diseño no depende del número exacto: si el
  intervalo es largo, todo lo aprendido se olvida.
- **Dispositivo principal:** **Sin evidencia.** El código dice qué soporta el producto, no qué usa
  el cliente: `opus-web` declara `desktop` como primario y `mobile` como secundario, y bajo 768 px
  `useIsMobile()` decide qué árbol de componentes montar. Pero **bajo 768 px el Sidebar desaparece
  y no se monta ningún reemplazo**: no se puede cambiar de proyecto ni cerrar sesión, y el PRD lo
  registra como fuera de alcance `[fuente: código-existente; PRD § Fuera del Alcance]`. Es decir:
  hay tres vistas del tablero incluyendo una específicamente de mobile, y a la vez el mobile no
  tiene navegación. Es la contradicción más grande del portal.

## Jobs To Be Done

1. **Cuando** pasó un tiempo desde la última vez que miré, **quiero** entender rápido si lo que
   pedí avanza y qué cambió, **para** poder responder internamente en mi empresa sin escribirle a
   nadie de la consultora.
   `[fuente: PRD §G-02 "el cliente tiene que poder pedir, seguir y conversar sobre sus requisitos";
   product-overview.md § Inventario de Audiencias "entra a ver cómo va lo que pidió"; benchmark §
   Zendesk, donde la fecha de actualización es columna de primera clase]`
   **Fuerza: media.** El "seguir" es objetivo declarado del PRD y el portal existe para eso. Lo que
   es inferencia —fuerte, pero inferencia— es que la pregunta real sea **"qué cambió desde la
   última vez"** y no "qué estado tiene cada cosa". Esa diferencia decide qué se muestra primero y
   **necesita validarse con un cliente real**.

2. **Cuando** necesito algo nuevo del equipo, **quiero** dejarlo pedido por escrito y en un lugar
   donde quede registrado, **para** que no se pierda como se perdía cuando lo mandaba por chat o lo
   decía en una reunión.
   `[fuente: PRD § Problema que Resuelve — "el pedido de un cliente que llega por Mattermost, mail
   o reunión se pierde o queda sin trazabilidad"; PRD § Alcance — alta de requisitos en el portal;
   benchmark § Zendesk/Productive, donde crear un pedido es acción de primer nivel]`
   **Fuerza: fuerte.** Es el problema nombrado por el PRD y hay una métrica propuesta atada a él
   (requisitos originados por el cliente sobre el total de requisitos nuevos). El requisito es
   además **lo único que un cliente puede crear**.

3. **Cuando** el equipo pregunta algo sobre un pedido mío o necesito aclarar el alcance, **quiero**
   dejar la respuesta pegada al requisito, **para** que la conversación no quede en un hilo aparte
   que después nadie encuentra.
   `[fuente: PRD §G-02 "pedir, seguir y **conversar**"; PRD § Alcance — comentarios con adjuntos en
   el portal; código-existente — feed de actividad con visibilidad public/internal]`
   **Fuerza: media.** La capacidad está implementada y el objetivo la nombra. Que el cliente
   prefiera responder ahí en vez de por el canal que ya usa con el equipo es exactamente lo que
   **no está validado** — y el benchmark advierte que el portal compite con escribirle a alguien.

## Pains

- No tiene forma de enterarse de que algo cambió sin entrar a mirar: **puede suscribirse a un
  requisito y esa suscripción no dispara nada**, porque no hay canal de notificación en el producto
  —ni mail, ni push, ni webhooks.
  `[fuente: PRD § Fuera del Alcance — "la suscripción registra interés y nada más";
  product-overview.md § Glosario; benchmark § Anti-patrones, donde todos los referentes notifican]`
  **Fuerza: fuerte** en cuanto al hecho, verificado en el código y declarado en el PRD. Lo que no
  está establecido es la consecuencia: si el cliente interpreta la suscripción como promesa de
  aviso, deja de entrar y se entera tarde. **Eso hay que preguntárselo a un cliente.**

- Lee estados que están nombrados para el flujo interno del equipo, sin traducción: los 7 estados
  del requisito son los mismos de un lado y del otro, y ninguno le dice lo único accionable para él
  —si la pelota está de su lado o del de la consultora.
  `[fuente: PRD § Alcance — workflow de 7 estados; código-existente — el portal muestra el estado
  tal cual; benchmark § Freshdesk, que mantiene dos vocabularios en paralelo justamente por esto]`
  **Fuerza: media.** La ausencia de traducción es verificable; que le resulte opaco es inferencia
  respaldada por el benchmark, no por observación.

- Si abre el portal desde el teléfono, se queda sin navegación: bajo 768 px el Sidebar desaparece y
  no se monta reemplazo, así que no puede cambiar de proyecto ni cerrar sesión.
  `[fuente: código-existente — useIsMobile() y ausencia de reemplazo del Sidebar; PRD § Fuera del
  Alcance]`
  **Fuerza: fuerte** en cuanto al defecto; **débil** en cuanto a que sea un pain real, porque
  **no sabemos si algún cliente entra desde el teléfono**. Un usuario esporádico que recibe un
  link es un candidato razonable a abrirlo en el móvil, pero eso es analogía, no dato.

## Gains

- Ve el avance de sus proyectos sin que nadie del equipo tenga que preparar nada ni acordarse de
  publicar: la visibilidad la decide el sistema —estado, título y descripción son públicos; el
  resto interno— y no depende de que alguien marque cada ítem.
  `[fuente: código-existente — modelo public/internal aplicado en la api; product-overview.md §
  Glosario; benchmark § Basecamp/Teamwork, donde el default privado con toggle manual traslada esa
  carga al equipo]`
  **Fuerza: fuerte** como capacidad diferencial; **media** como gain percibido, porque el cliente
  no sabe que del otro lado hay un modelo de visibilidad — solo ve que hay información.

- Entra sabiendo que lo que ve es suyo: solo aparecen los proyectos que le fueron concedidos, nunca
  horas, ni costos, ni comentarios internos, ni proyectos de otros clientes. La separación es
  estructural —dos aplicaciones sobre la misma API— no una convención de uso.
  `[fuente: PRD §G-02 y § Decisiones Clave; código-existente — user_project_permissions y
  validateProjectPermissions en /api/opus/*; benchmark § Patrones Recurrentes, donde es invariante
  de toda la categoría]`
  **Fuerza: fuerte.**

- Deja un pedido por escrito en el mismo lugar donde después va a poder seguirlo, en vez de
  mandarlo por un canal donde se pierde.
  `[fuente: PRD § Problema que Resuelve y § Alcance — alta de requisitos en el portal]`
  **Fuerza: media.** La capacidad existe; que el cliente la prefiera al chat es la apuesta central
  del portal y está sin validar.

## Hipótesis de Comportamiento

- El cliente entra con **una sola pregunta** —"¿cómo viene?"— y necesita la respuesta en la primera
  pantalla, sin navegar ni filtrar. No explora el producto: lo consulta.
  `[estado: hipótesis | fuerza: inferida-benchmark]` — el benchmark documenta que los portales de
  ticketing resuelven el listado pero no el resumen, y que Productive agrega dashboard justamente
  para cubrirlo.

- **La suscripción se interpreta como "me van a avisar".** Es el nombre que usa el producto y es lo
  que ese control significa en todos los referentes (Zendesk, Freshdesk, Basecamp, Teamwork
  notifican). Si la hipótesis es cierta, el control actual promete algo que el sistema no puede
  cumplir.
  `[estado: hipótesis | fuerza: inferida-benchmark]` — **es la hipótesis de mayor impacto del
  documento**: si se confirma, hay una decisión de producto pendiente (renombrar el control,
  explicitar que no notifica, o construir el canal).

- **Ofrecerle elegir entre tres vistas del mismo tablero le agrega una decisión que no pidió
  tomar.** El portal monta lista, kanban y acordeones mobile; un usuario esporádico que entra a
  responder una pregunta no tiene criterio acumulado para elegir representación, y la elección se
  interpone antes de la respuesta.
  `[estado: hipótesis | fuerza: por-analogía]` — **validación cara y obligatoria antes de actuar.**
  Ningún referente del benchmark ofrece esa elección al cliente, así que no hay patrón de mercado
  que respalde ni refute; y no hay observación de uso. **No tocar las tres vistas basándose solo en
  esto.**

- El cliente **no distingue entre "requisito" e "incidencia"** con el mismo criterio que el equipo,
  y por lo tanto el tipo elegido en el alta puede no coincidir con el que el equipo asignaría. El
  producto tiene 4 tipos y las incidencias siguen un camino de estados distinto —saltean `en_cola`—
  así que la elección del cliente tiene consecuencias en el flujo interno.
  `[estado: hipótesis | fuerza: inferida-PRD]` — el PRD define los tipos y el salto de estado; que
  el cliente los use distinto es inferencia sobre la asimetría de contexto entre las dos partes.

- El cliente **abre el portal desde un link que alguien del equipo le pasó**, no desde un marcador
  ni escribiendo la URL, porque no lo usa lo suficiente para tenerlo incorporado a su rutina. Eso
  hace que la pantalla de entrada sea a veces un requisito puntual y no el tablero.
  `[estado: hipótesis | fuerza: por-analogía]` — **validación cara y obligatoria antes de actuar.**
  No hay dato de tráfico ni de referrer: el producto no instrumenta nada. Se apoya solo en la
  analogía con el uso esporádico.

## Restricciones de Contexto

- **Sin ningún canal de notificación** — es la restricción que más condiciona a esta audiencia. El
  producto **no puede iniciar contacto**: toda la relación depende de que el cliente entre por su
  cuenta. Cualquier diseño que asuma que se le puede avisar algo está diseñando una función que no
  existe `[fuente: PRD § Fuera del Alcance]`.
- **Mobile sin navegación bajo 768 px** — el Sidebar desaparece y nada lo reemplaza: no se puede
  cambiar de proyecto ni cerrar sesión. Es un callejón sin salida, no una versión reducida
  `[fuente: código-existente; PRD § Fuera del Alcance]`.
- **No hay alta de usuarios desde el producto** — un cliente nuevo requiere un INSERT manual en la
  base, y quien autentica bien contra Zitadel sin fila en `users` recibe 401 `user_not_found`. Todo
  onboarding de cliente pasa por alguien del equipo con acceso a la base, y **no hay ningún flujo
  de invitación diseñable hoy** `[fuente: PRD § Sistemas Existentes]`.
- **Identidad federada en Zitadel, misma app OIDC para los dos frontends** — el cliente necesita
  identidad en el IdP de la consultora para entrar. La primera vez que entra ya pasó por un flujo
  que el producto no controla `[fuente: PRD § Decisiones Clave]`.
- **El portal no corta navegación por rol** — un `user` o `admin` que abra Opus puede operar ahí,
  incluso cambiar estado y prioridad inline. No hay evidencia de si es intencional; es pregunta
  abierta del PRD. Para el cliente significa que puede haber controles de edición en el portal cuya
  existencia no fue pensada para él `[fuente: código-existente; product-overview.md § Matriz]`.
- **Los mensajes de error de api y core llegan al usuario tal cual, mezclados entre inglés y
  español** — en la audiencia interna es molesto; acá lo lee alguien de otra empresa, sin contexto
  para interpretarlo y sin nadie a mano a quien preguntarle `[fuente: PRD § Restricciones]`.
- **La escritura no degrada** — si `core` está caído, el alta del requisito **no ocurrió** y el
  cliente ve un 503, sin cola ni reintento. Un usuario esporádico que pierde su pedido a mitad de
  camino probablemente no vuelva a intentarlo por el portal `[fuente: PRD § Decisiones Clave]`.

## Lo que NO Sabemos

- **¿Entra alguien a Opus?** Es la pregunta cero y hoy no tiene respuesta: no hay analytics. Se
  puede aproximar contando en la base cuántos requisitos y comentarios tienen autoría de un
  `external-user`, y con qué distribución temporal. **Antes de diseñar nada para esta audiencia,
  convendría saber si existe en la práctica.**
- **¿Con qué frecuencia entra un cliente, y qué lo hace entrar?** "Esporádico" es una caracterización
  cualitativa heredada, sin número detrás. De la respuesta depende cuánto contexto hay que
  reconstruirle en cada visita.
- **¿Qué hace hoy cuando quiere saber cómo viene un proyecto: entra a Opus o le escribe a alguien
  del equipo?** Si sigue escribiendo, el portal no está resolviendo el problema que motivó su
  construcción, y ningún ajuste de pantalla lo va a cambiar.
- **¿Cómo interpreta la suscripción?** Pregunta directa a un cliente que se haya suscrito alguna
  vez. Es barata y resuelve la hipótesis de mayor impacto del documento.
- **¿Qué entiende de cada uno de los 7 estados?** Basta con mostrárselos y pedirle que diga qué
  significa cada uno y qué esperaría que pase después. Define si hace falta traducción de
  vocabulario, agrupación de estados, o ninguna de las dos.
- **¿Desde qué dispositivo abre el portal?** Determina si el hueco de navegación en mobile es un
  defecto crítico o uno teórico. Se puede aproximar con logs del proxy si existen; si no, hay que
  preguntar.
- **¿Quién es realmente el cliente: una persona o varias de la misma empresa?** Los permisos son por
  proyecto y por usuario (`user_project_permissions`), pero el benchmark muestra que en Zendesk el
  alcance de "mis pedidos" suele ser la organización, no el autor. Si en la práctica hay varias
  personas del lado del cliente, **puede haber más de una audiencia acá** —quien pide no es
  necesariamente quien hace seguimiento.
- **¿Qué le falta que hoy no está?** Ninguna conversación con un cliente informó este producto. Es
  posible que el pain principal no esté en esta lista, porque esta lista se armó desde adentro.
- **¿Alguien del equipo usa Opus para hablar con el cliente, y con qué expectativa?** El portal no
  corta por rol y el equipo puede operar ahí. Si lo hace, el flujo real es distinto del documentado.

---

**Estado:** Documento en estado `hipótesis-preliminar`. Para promoverlo a `validado`, ejecutar
entrevistas reales con clientes de Grava Digital y actualizar in-place el estado de cada hipótesis.
**Es la audiencia con menor sustento de las dos y la única sin acceso directo**: ninguna de estas
hipótesis debería sostener una decisión de diseño irreversible antes de hablar con al menos dos o
tres clientes reales.

**Consumido por:** Los `product-map.md` y `user-flows.md` de la superficie `opus-web` (ver matriz
en `product-overview.md`).
