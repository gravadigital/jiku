# Requisitos no funcionales

| ID | Categoría | Requisito | Target | Alcance | Verificación | Prueba en | Origen |
|---|---|---|---|---|---|---|---|
| NFR-01 | Tiempos | Toda consulta de lectura de core se corta por tiempo en la base y responde `query_timeout` | **tiempo máximo de consulta** | core | prueba | base | inicial |
| NFR-02 | Tiempos | La api espera la respuesta de un comando a core y, si no llega, responde 504 | **tiempo de espera de comandos** | api | prueba | base | inicial |
| NFR-03 | Tiempos | La api espera la respuesta de una consulta al bus | 10000 ms (`NATS_QUERY_TIMEOUT_MS=10000`) | api | revisión | — | inicial |
| NFR-04 | Volumen | Una página de consulta del bus trae como mucho el límite pedido y no supera la mitad del tamaño máximo de mensaje del servidor NATS | **límite de página máximo**; 50 % de `max_payload` | core | prueba | base | inicial |
| NFR-05 | Volumen | Tamaño máximo del cuerpo JSON de un pedido HTTP; por encima, 413 `payload_too_large` | 100 kB en general; 768 KiB al guardar o crear documentos | api | prueba | base | inicial |
| NFR-06 | Volumen | Tamaño máximo de un archivo subido | **tamaño máximo de archivo** | core | prueba | base | inicial |
| NFR-07 | Disponibilidad | Los links públicos de documentación se limitan por dirección IP; por encima responden 429 | **límite de pedidos de links públicos** | api | prueba | base | inicial |
| NFR-08 | Disponibilidad | Las notificaciones se envían al menos una vez, con reintentos, y se descartan al agotar los intentos | **intentos de envío de notificaciones** | core | prueba | base | inicial |
| NFR-09 | Disponibilidad | Los eventos de dominio se publican a lo sumo una vez: si la publicación falla, el evento se pierde y el cambio queda | Sin reintento | core | prueba | base | inicial |
| NFR-10 | Privacidad y cumplimiento | Un Cliente solo accede a datos de proyectos donde tiene permiso de proyecto y a contenido público, en las consultas del bus y en el Portal de clientes | Recorte en todas las consultas de un Cliente | producto | prueba | base | inicial |
| NFR-11 | Privacidad y cumplimiento | Las lecturas de core usan un rol de base de datos de solo lectura | Ninguna escritura posible desde una consulta | core | prueba | base | inicial |
| NFR-12 | Privacidad y cumplimiento | Los archivos solo se leen y se suben por URLs firmadas que vencen | **vida de la URL de descarga**, **vida de la URL de subida** | core | prueba | base | inicial |
| NFR-13 | Privacidad y cumplimiento | Las páginas de links públicos se sirven sin indexación, sin referrer, sin caché y con CSP de solo lectura, y el token se enmascara en los logs | Cabeceras en toda respuesta de `/p/docs` | api | prueba | base | inicial |
| NFR-14 | Accesibilidad | Gestión interna respeta `prefers-reduced-motion` en el loader, los acordeones y el shell | Sin animación con la preferencia activa | Gestión interna | revisión | — | inicial |
| NFR-15 | Idioma, zona horaria y formatos | Las dos superficies están solo en español rioplatense, con textos fijos y sin internacionalización; el documento HTML se declara `lang="en"` | Español | producto | revisión | — | inicial |
| NFR-16 | Idioma, zona horaria y formatos | Los servicios corren en UTC; los instantes salen en ISO 8601 UTC con milisegundos y las reglas de calendario (ventana de horas, semana pasada) se evalúan en UTC | `TZ=UTC` | api, core | prueba | base | inicial |
| NFR-17 | Idioma, zona horaria y formatos | Las pantallas muestran fechas en la zona horaria del navegador, salvo algunas vistas que usan UTC; el formato varía por pantalla | Zona del navegador | producto | revisión | — | inicial |
| NFR-18 | Compatibilidad | Gestión interna es solo de escritorio: el shell tiene un ancho mínimo y por debajo se desplaza en horizontal | 1400 px | Gestión interna | prueba | base | inicial |
| NFR-19 | Compatibilidad | El Portal de clientes se adapta a móvil por debajo de 768 px: tablero en acordeones, detalle en pestañas y sin barra lateral | 768 px | Portal de clientes | prueba | base | inicial |
