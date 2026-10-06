# Reference Brief: proyectos similares para atfx-marketing-hub (intake + vista publica + monday.com)

Slug: similar-projects | Nivel: deep | Fecha: 2026-10-06 | Estado: BORRADOR
Versiones: node=22.23.2, next=16.4, monday-api=2026-07
Verificador: pendiente

## 1. Pregunta y decisiones abiertas

Proyecto nuevo Next.js (App Router) para Marketing LATAM de ATFX: vista publica de solo lectura (kanban, tabla, actividad), formulario de intake autenticado y automatizacion que crea items en monday.com. Decidido por Karen: el estado se edita en monday, la app solo lee (cache + webhooks) y crea items; la vista publica usa lista blanca de campos; UI con Arc.

Nota de citas: el proyecto destino esta vacio. En la seccion 2, cada `[repo:]` es relativo a la raiz del repo hermano que la linea nombra (pipeline-board en 096c175, atfx-web-requests en d5c0f99). Ambos repos de GitHub son privados, por eso no se citan como `[ref:]`. pipeline-board `app/p/[token]/page.tsx` (lineas 35-41 y 53) aplica `robots: noindex`, `referrer: no-referrer` y no pasa el token al cliente; no se cita con `[repo:]` porque los corchetes de la ruta rompen el formato de la marca.

Decisiones grises, una por bloque:

- D1. Vista publica: como se comparte (token, publica, login) y como se garantiza la lista blanca de campos.
- D2. Lectura de monday: como se cachea y se invalida (cache tags + webhook) sin agotar los limites del API.
- D3. Escritura en monday: cliente (SDK oficial o fetch), formato de `column_values`, adjuntos y anti-duplicados.
- D4. Estimacion de entrega y asignacion: reglas, LLM o mixto.
- D5. Intake: que se toma del prior art (Clerk, Blob, zod por area) y que cambia al cambiar el destino a monday.

## 2. Estado actual

- El proyecto destino no tiene codigo todavia; las decisiones de arquitectura vienen de la solicitud [KAREN:solicitud /research 2026-10-06]
- El estado se edita en monday; la app solo lee (cache revalidada por webhooks) y crea items; sin panel admin propio [KAREN:solicitud /research 2026-10-06]
- pipeline-board: el contenido es un store JSON en `content/`, solo servidor [repo:lib/content/index.ts:5]
- pipeline-board: `TaskSchema` zod define los campos de una tarea (titulo, area, fase, resumen, alcance, due, historial) [repo:lib/content/schema.ts:50]
- pipeline-board: la actividad sale del historial de cambios de fase de cada tarea [repo:lib/content/schema.ts:62]
- pipeline-board: `visibleTasks` filtra archivadas antes de renderizar; no proyecta campos, pasa la tarea completa [repo:lib/content/derive.ts:19]
- atfx-web-requests: todo el sitio exige sesion Clerk salvo `/sign-in` [repo:middleware.ts:10]
- atfx-web-requests: acceso por dominio de correo desde env; sin lista en produccion no entra nadie [repo:lib/access.ts:22]
- atfx-web-requests: la Server Action re-verifica usuario y dominio aunque el middleware ya lo haga [repo:app/actions.ts:103]
- atfx-web-requests: rate limit en memoria por isolate, documentado como freno de bursts y no control fuerte [repo:lib/shared/rate-limit.ts:1]
- atfx-web-requests: honeypot `website` responde OK sin delatar el campo [repo:app/actions.ts:123]
- atfx-web-requests: subida directa navegador a Vercel Blob; la ruta solo firma el token con tipo, peso y prefijo [repo:app/api/blob-upload/route.ts:35]
- atfx-web-requests: la ruta de firma aplica el mismo gate de dominio que la accion [repo:app/api/blob-upload/route.ts:24]
- atfx-web-requests: areas `web`, `video`, `eventos`, `diseno` como union de claves [repo:lib/areas/index.ts:5]
- atfx-web-requests: cada tipo web declara dias habiles de trabajo [repo:lib/areas/web/model.ts:18]
- atfx-web-requests: landing nueva = 7 dias habiles [repo:lib/areas/web/model.ts:22]
- atfx-web-requests: la fecha minima es `addBusinessDays(hoy, dias del tipo)`, sin depender de la urgencia [repo:lib/areas/web/model.ts:500]
Contextos: app en Vercel (Server Components, Server Actions, Route Handlers), Route Handler de webhook llamado por monday, `next dev` local (monday no alcanza localhost), tests vitest, automatizaciones nativas de monday (fuera de la app)

## 3. Fuentes primarias

- `create_item` recibe `board_id`, `item_name`, `group_id`, `column_values` (string JSON) y `create_labels_if_missing` [doc:https://developer.monday.com/api-reference/reference/items@2026-07]
- Status se escribe como `{"label": "..."}` o `{"index": id}`; el `id` de etiqueta es estable al reordenar, el indice visual no [doc:https://developer.monday.com/api-reference/reference/status@2026-07]
- Dropdown acepta `{"labels": [...]}` o `{"ids": [...]}`; crear etiquetas faltantes exige permisos de estructura del tablero [doc:https://developer.monday.com/api-reference/reference/dropdown@2026-07]
- People se escribe como `{"personsAndTeams": [{"id": n, "kind": "person"}]}` [doc:https://developer.monday.com/api-reference/reference/people@2026-07]
- Date se escribe como `{"date": "AAAA-MM-DD", "time": "HH:MM:SS"}` y los valores se interpretan en UTC [doc:https://developer.monday.com/api-reference/reference/date@2026-07]
- Link se escribe como `{"url": "https://...", "text": "..."}`; la URL exige protocolo [doc:https://developer.monday.com/api-reference/reference/link@2026-07]
- File no se puede escribir con `column_values`: solo `add_file_to_column` multipart a `/v2/file`, que agrega sin reemplazar [doc:https://developer.monday.com/api-reference/reference/files-1@2026-07]
- Limites: 10M puntos/min por token personal, 5M por consulta, llamadas diarias 1,000 (Standard), 10,000 (Pro), 25,000 (Enterprise); errores traen `retry_in_seconds` [doc:https://developer.monday.com/api-reference/docs/rate-limits@2026-07]
- Versionado por header `API-Version`; 2026-07 es Current, 2026-10 es RC; sin header se usa la Current y puede cambiar sola [doc:https://developer.monday.com/api-reference/docs/api-versioning@2026-07]
- Header `Idempotency-Key` en mutaciones; respuestas cacheadas 30 min; replay marcado con `Idempotency-Replayed: true` [doc:https://developer.monday.com/api-reference/docs/idempotency@2026-07]
- Webhooks: challenge `{"challenge": ...}` que hay que devolver igual; eventos `create_item`, `change_column_value`, `item_deleted`, etc.; reintento cada minuto durante 30 min [doc:https://developer.monday.com/api-reference/reference/webhooks@2026-07]
- Webhooks: solo los creados con token de app de integracion llevan JWT verificable con el Signing Secret [doc:https://developer.monday.com/api-reference/reference/webhooks@2026-07]
- `items_page` devuelve hasta 500 items por pagina con cursor; `next_items_page` para seguir [doc:https://developer.monday.com/api-reference/reference/items-page@2026-07]
- `activity_logs` cuelga de `boards`, filtra por fechas, items y columnas, y devuelve en orden cronologico inverso [doc:https://developer.monday.com/api-reference/reference/activity-logs@2026-07]
- `revalidateTag(tag, profile)`: la forma de un argumento esta deprecada; `"max"` sirve stale mientras revalida; `{ expire: 0 }` desde webhooks si hace falta frescura inmediata [doc:https://nextjs.org/docs/app/api-reference/functions/revalidateTag@16.4.0]
- `cacheTag` exige el flag `cacheComponents` en `next.config` y se usa dentro de `'use cache'` [doc:https://nextjs.org/docs/app/api-reference/functions/cacheTag@16.3.8]
- `updateTag` solo funciona en Server Actions (read-your-own-writes); en Route Handlers lanza error [doc:https://nextjs.org/docs/app/api-reference/functions/updateTag@16.4.0]
- Next recomienda una Data Access Layer server-only que devuelva DTO minimos y re-autorizar dentro de cada Server Action [doc:https://nextjs.org/docs/app/guides/data-security@16.4.0]
- Vercel Functions: cuerpo de request/respuesta maximo 4.5 MB; duracion por defecto 300 s [doc:https://vercel.com/docs/functions/limitations@2026-08-24]
- `z.discriminatedUnion` valida uniones etiquetadas por una clave discriminante (zod 4) [doc:https://zod.dev/api?id=discriminated-unions@4]
- Anthropic: la calificacion por codigo es la mas rapida y fiable; la de LLM requiere rubrica clara, salida acotada y probar fiabilidad antes de escalar [doc:https://platform.claude.com/docs/en/test-and-evaluate/develop-tests@2026-10]
- Jira Service Management: basar metas SLA en criterios estables como prioridad, no en el estado; calendarios de horario laboral pausan el reloj [doc:https://confluence.atlassian.com/display/SERVICEMANAGEMENTSERVER0419/Setting+up+SLAs@4.19]

## 4. Implementaciones de referencia

- Plane (makeplane/plane, 60k estrellas, AGPL, push diario): `DeployBoard` publica un proyecto bajo un `anchor` uuid4 hex unico, con flags por funcion (comentarios, votos, actividad, deshabilitado) [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/db/models/deploy_board.py#L15-L39@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Plane: el endpoint publico es `AllowAny`, resuelve el tablero solo por `anchor` y devuelve 404 si no esta publicado [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/space/views/issue.py#L100-L110@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Plane: la respuesta publica es una lista explicita de campos via `.values(...)`, no el modelo serializado entero [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/space/views/issue.py#L830-L854@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Plane Intake: lo que entra por el formulario publico cae en un estado `Triage`, valida prioridad contra lista cerrada y sanea HTML [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/space/views/intake.py#L124-L165@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Fider (getfider/fider, 4.5k estrellas, AGPL, activo): sitio privado opcional, `PreventIndexing`, y campos internos excluidos del JSON con `json:"-"` [ref:https://github.com/getfider/fider/blob/cfcc18c895eb4888e95658d5951bc71d5b9e5167/app/models/entity/tenant.go#L21-L37@cfcc18c895eb4888e95658d5951bc71d5b9e5167]
- LogChimp (logchimp/logchimp, 1.1k estrellas, activo): sin permiso `roadmap:read` el servidor reduce el filtro de visibilidad a publico, sin confiar en el query del cliente [ref:https://github.com/logchimp/logchimp/blob/c8f59fae391cb0bde4ab76ab5a43f169e4a9c394/packages/server/src/ee/controllers/v1/roadmaps/filter.ts#L80-L84@c8f59fae391cb0bde4ab76ab5a43f169e4a9c394]
- LogChimp: la consulta del roadmap selecciona columnas explicitas [ref:https://github.com/logchimp/logchimp/blob/c8f59fae391cb0bde4ab76ab5a43f169e4a9c394/packages/server/src/ee/controllers/v1/roadmaps/filter.ts#L141-L142@c8f59fae391cb0bde4ab76ab5a43f169e4a9c394]
- SDK oficial de monday (mondaycom/monday-graphql-api, mantenido por monday): `ApiClient`, subida de archivos con `File`/`Blob` y `idempotencyKey`; sus tipos corresponden a la version del API vigente al publicar [ref:https://github.com/mondaycom/monday-graphql-api/blob/f94463e199b0e49c7226b164dbba26df1f121d0a/packages/api/README.md@f94463e199b0e49c7226b164dbba26df1f121d0a]
- Formbricks (formbricks/formbricks, 13k estrellas): la logica condicional es dato (condiciones + acciones) evaluado en runtime; util como contraste, no para copiar [ref:https://github.com/formbricks/formbricks/blob/bd5c8d88b0e4d6c81853335d85651be8c58b874f/docs/api-v3-reference/src/components/schemas/SurveyBlockLogic.yml@bd5c8d88b0e4d6c81853335d85651be8c58b874f]
- Ejemplo oficial Next.js (vercel/next.js, cms-contentful): Route Handler que verifica un secreto en header y llama `revalidateTag` [ref:https://github.com/vercel/next.js/blob/0e912cb9010def935bfbd07611c84c733738b733/examples/cms-contentful/app/api/revalidate/route.ts#L4-L15@0e912cb9010def935bfbd07611c84c733738b733]
- Busqueda en GitHub de portales de solicitudes creativas o de marketing: el mejor resultado es una demo de 1 estrella; ninguno sirve de referencia profesional [ref:https://github.com/Hakuroo/ai-ticket-triage-demo/tree/cc01e9173e345d850cc28800465bb2b671b5ca79@cc01e9173e345d850cc28800465bb2b671b5ca79]

## 5. Opciones

D1. Vista publica

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. Token no adivinable en la URL + noindex + no-referrer + DTO de lista blanca | Igual a Plane y a pipeline-board; compartible sin cuenta | Quien tenga el link lo ve; rotar = cambiar env | baja | Si |
| B. Pagina totalmente publica e indexable | Cero friccion | Expone trabajo interno a buscadores | baja | No |
| C. Login Clerk para ver | Control total | No es "compartible como status page" | media | No |

D2. Lectura y cache

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. `'use cache'` + `cacheTag` + webhook que llama `revalidateTag(tag, 'max')` + `cacheLife` de respaldo | Pocas llamadas a monday; sirve lo ultimo bueno si monday falla | Exige `cacheComponents` (config raiz) | media | Si |
| B. `fetch` con `next.tags` sin cacheComponents | No toca el flag | La llamada GraphQL es POST; hay que confirmar que se cachea | media | Alternativa |
| C. Solo revalidacion por tiempo | Simple | Retraso visible; mas llamadas | baja | Solo respaldo |
| D. Espejo en base de datos propia | Desacopla de limites | Dependencia y migraciones nuevas; contradice "monday es la fuente" | alta | No |

D3. Escritura en monday

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. `fetch` a `/v2` con `API-Version` fijo, `Idempotency-Key` y builders tipados de `column_values` | Sin dependencia nueva; control total del header | Tipos a mano | baja | Si |
| B. `@mondaydotcomorg/api` | Tipos y subida de archivos resueltos | Dependencia nueva; tipos atados a la version de publicacion | baja | Si Karen prefiere tipos generados |
| Adjuntos 1. Blob + URL en columna link o en un update | Sin pasar archivos por la funcion | El archivo no vive en monday | baja | Si para v1 |
| Adjuntos 2. Copiar a monday con `add_file_to_column` | Todo en monday | Descarga y re-subida server-side, una llamada por archivo | media | Despues |

D4. Estimacion

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. Reglas: dias habiles base por area x subtipo + ajuste por prioridad + penalizacion por brief incompleto (checklist de campos) | Determinista, testeable, igual que el prior art | Ciega a matices del texto | baja | Si |
| B. LLM califica el brief y estima | Lee el texto libre | Costo, latencia, no determinista; exige rubrica y evals | media | No en v1 |
| C. Mixto: reglas deciden la fecha; LLM solo sugiere que falta al solicitante | Mejora briefs sin tocar la fecha | Dependencia y costo nuevos | media | Fase 2 opcional |

Recomendacion: que tomar de donde

| Fuente | Que tomar | Que evitar | Donde cae |
|---|---|---|---|
| pipeline-board | Vistas kanban/tabla/actividad con Arc, ruta token, noindex, no-referrer, token fuera del cliente | Store JSON + MCP (la fuente pasa a ser monday); pasar la tarea entera a componentes | `app/p/token`, `components/board/*` |
| atfx-web-requests | Clerk + gate por dominio en pagina, accion y firma; Blob directo; zod por area; honeypot; dias habiles | Correo/Sheets como destino; rate limit en memoria como control fuerte | `app/(intake)`, `lib/intake/*` |
| Plane DeployBoard + Intake | Anchor aleatorio, lista explicita de campos, intake cae en estado Triage | Comentarios y votos publicos | DTO publico; grupo "Nuevas" en monday |
| Fider, LogChimp | Exclusion de campos en serializacion; visibilidad decidida en servidor | Portal de votos | `lib/public-dto.ts` |
| Docs monday | Formatos de `column_values`, `API-Version`, `Idempotency-Key`, `items_page`, `activity_logs`, challenge | `create_labels_if_missing: true`; omitir el header de version | `lib/monday/*` |
| Docs Next 16 | `cacheTag` + `revalidateTag(tag,'max')` en webhook, `updateTag` tras crear, DAL server-only | `revalidateTag(tag)` de un argumento | `lib/monday/read.ts`, `app/api/monday/webhook` |
| Docs Anthropic + Jira SLA | Reglas primero; metas por prioridad; calendario laboral | LLM decidiendo fechas sin evals | `lib/estimate.ts` |

## 6. Evidencia en contra

- Sin base de datos propia, un webhook perdido deja la vista vieja: monday reintenta solo 30 min. Se resuelve con `cacheLife` acotado como respaldo ademas del webhook [doc:https://developer.monday.com/api-reference/reference/webhooks@2026-07]
- Webhooks creados con token personal no se pueden autenticar por JWT. Se acepta: el webhook se trata como senal (secreto en la URL + re-lectura desde el API), nunca como dato [doc:https://developer.monday.com/api-reference/reference/webhooks@2026-07]
- El limite diario (1,000 en Standard) se agota si cada visita publica consulta monday. Se resuelve con cache por tag: las lecturas dependen de cambios, no de visitas [doc:https://developer.monday.com/api-reference/docs/rate-limits@2026-07]
- La cache por tag exige `cacheComponents`, un cambio de config raiz que escala a Karen. Se acepta; la opcion B de D2 evita el flag si se rechaza [doc:https://nextjs.org/docs/app/api-reference/functions/cacheTag@16.3.8]
- Las reglas de estimacion se equivocan en pedidos atipicos. Se acepta: el responsable corrige la fecha en monday y esa es la verdad que lee la vista [KAREN:solicitud /research 2026-10-06]
- Un token en la URL se puede reenviar. Se acepta porque es el modelo de status page pedido; mitigacion: lista blanca estricta y token rotable [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/db/models/deploy_board.py#L15-L39@7466675e471efe1c96b122615f7a0d30c9b2eb05]

## 7. Ejemplares y anti-ejemplos

- Bien: lista explicita de campos publicos en la consulta, no el registro entero [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/space/views/issue.py#L830-L854@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Bien: DTO que devuelve solo lo relevante y modulo `server-only` [doc:https://nextjs.org/docs/app/guides/data-security@16.4.0]
- Mal: pasar el registro completo a un Client Component (ejemplo "EXPOSED" de la misma guia) [doc:https://nextjs.org/docs/app/guides/data-security@16.4.0]
- Bien: `revalidateTag('monday:board', 'max')` en el Route Handler del webhook [doc:https://nextjs.org/docs/app/api-reference/functions/revalidateTag@16.4.0]
- Mal: `revalidateTag("posts")` de un argumento y comparacion de secreto con `!==` en el ejemplo de Contentful [ref:https://github.com/vercel/next.js/blob/0e912cb9010def935bfbd07611c84c733738b733/examples/cms-contentful/app/api/revalidate/route.ts#L4-L15@0e912cb9010def935bfbd07611c84c733738b733]
- Bien: `create_item` con `column_values: JSON.stringify({...})` e `Idempotency-Key` estable entre reintentos [doc:https://developer.monday.com/api-reference/docs/idempotency@2026-07]
- Bien: intake que valida prioridad contra lista cerrada y cae en un estado de triage [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/space/views/intake.py#L124-L165@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Mal (para nosotros): motor generico de logica condicional como dato; los show-if por area caben en `z.discriminatedUnion` [ref:https://github.com/formbricks/formbricks/blob/bd5c8d88b0e4d6c81853335d85651be8c58b874f/docs/api-v3-reference/src/components/schemas/SurveyBlockLogic.yml@bd5c8d88b0e4d6c81853335d85651be8c58b874f]

## 8. Trampas

- Sin `API-Version` el cliente salta solo a la Current nueva cada trimestre (2026-10 es RC hoy) [doc:https://developer.monday.com/api-reference/docs/api-versioning@2026-07]
- Status por `index` debe usar el id estable de la etiqueta; el orden visual cambia [doc:https://developer.monday.com/api-reference/reference/status@2026-07]
- `create_labels_if_missing` crea etiquetas con cualquier texto del formulario; dejarlo en false y mapear a ids [doc:https://developer.monday.com/api-reference/reference/dropdown@2026-07]
- Fechas con hora se interpretan en UTC; usar solo `date` para la fecha de entrega [doc:https://developer.monday.com/api-reference/reference/date@2026-07]
- La columna File no acepta `column_values`; `add_file_to_column` va por multipart a `/v2/file` y agrega sin reemplazar [doc:https://developer.monday.com/api-reference/reference/files-1@2026-07]
- El endpoint del webhook debe devolver el `challenge` identico o monday no lo registra [doc:https://developer.monday.com/api-reference/reference/webhooks@2026-07]
- `updateTag` lanza en Route Handlers: en el webhook va `revalidateTag`; `updateTag` solo tras crear en la Server Action [doc:https://nextjs.org/docs/app/api-reference/functions/updateTag@16.4.0]
- Tags de mas de 256 caracteres se ignoran en silencio [doc:https://nextjs.org/docs/app/api-reference/functions/cacheTag@16.3.8]
- Pasar archivos por una Function topa en 4.5 MB: mantener la subida directa a Blob [doc:https://vercel.com/docs/functions/limitations@2026-08-24]
- `items_page` corta en 500 por pagina; seguir el cursor hasta null [doc:https://developer.monday.com/api-reference/reference/items-page@2026-07]
- Una Server Action es un endpoint POST propio: re-verificar sesion y dominio dentro [doc:https://nextjs.org/docs/app/guides/data-security@16.4.0]
- Contexto `next dev`: monday no alcanza localhost; los webhooks se prueban con un tunel o llamando al handler en tests [doc:https://developer.monday.com/api-reference/reference/webhooks@2026-07]
- Contexto tests vitest: `'use cache'` y `revalidateTag` necesitan el runtime de Next; extraer la logica (mapeo DTO, builders de `column_values`, estimacion) a funciones puras testeables [doc:https://nextjs.org/docs/app/api-reference/functions/cacheTag@16.3.8]
- Contexto automatizaciones de monday: las notificaciones las dispara monday al crear o asignar; la app no debe duplicarlas por correo [KAREN:solicitud /research 2026-10-06]

## 9. Incertidumbre

- ASSUMPTION: los webhooks creados con token personal llegan sin header Authorization (la doc solo habla del caso con token de integracion). prueba: crear un webhook de prueba con token personal y registrar los headers recibidos
- ASSUMPTION: una lectura GraphQL por POST dentro de `'use cache'` queda cacheada y se invalida por tag. prueba: pagina de prueba con contador de llamadas, dos visitas, luego `revalidateTag` y una tercera
- ASSUMPTION: el payload de `change_column_value` basta para saber que tag invalidar (board id). prueba: capturar un evento real y leer `boardId` y `pulseId`
- ASSUMPTION: WorkForms limita la logica condicional y los campos por plan; support.monday.com devolvio 403 y no se pudo leer. prueba: abrir el articulo de conditional logic en un navegador con sesion y anotar plan y limites
- ASSUMPTION: las automatizaciones nativas de monday cubren las notificaciones al responsable y al solicitante. prueba: configurar en el tablero real "cuando se crea un item, notificar a la persona de la columna"
- ASSUMPTION: Arc tiene piezas suficientes para kanban; en pipeline-board el kanban es componente propio sobre Arc. prueba: buscar kanban y data-table en el registro de Arc via MCP
- ASSUMPTION: Linear, Huly y Featurebase no se investigaron por falta de tiempo; Plane, Fider y LogChimp cubren el patron. prueba: revisar si alguno ofrece vista publica con lista de campos configurable
- [NEEDS CLARIFICATION: plan de monday de ATFX (Standard, Pro, Enterprise)? define el limite diario y la concurrencia]
- [NEEDS CLARIFICATION: se acepta `cacheComponents` en `next.config` (config raiz) o se usa la opcion B de D2?]
- [NEEDS CLARIFICATION: se acepta `@mondaydotcomorg/api` como dependencia o `fetch` propio?]
- [NEEDS CLARIFICATION: adjuntos v1 como link a Blob o Drive, o copia a la columna File de monday? Blob publico expone archivos a quien tenga la URL]
- [NEEDS CLARIFICATION: que campos ve la vista publica (titulo, area, estado, fecha, responsable?) y si el nombre del solicitante es publico]
- [NEEDS CLARIFICATION: una vista publica unica o una por area o mercado, cada una con su token?]
- [NEEDS CLARIFICATION: tabla de dias habiles base por area y subtipo, y ajuste por prioridad; quien la aprueba]
- [NEEDS CLARIFICATION: responsable por area (ids de monday) y si eventos o video tienen mas de uno]

## 10. Checklist de estandar

- [ ] Toda llamada a monday envia `API-Version` fijo desde una constante
- [ ] `create_item` envia `Idempotency-Key` derivado de la solicitud y reutilizado en reintentos
- [ ] `column_values` se arma con builders tipados por tipo de columna (status por id, dropdown por ids, people, date sin hora, link)
- [ ] `create_labels_if_missing` es false
- [ ] La vista publica recibe un DTO de lista blanca desde un modulo `server-only`; test que falla si aparece un campo fuera de la lista
- [ ] Ruta publica con token de al menos 128 bits, `noindex`, `no-referrer`, 404 si el token no coincide, token fuera del cliente
- [ ] Lecturas de monday con `'use cache'` + `cacheTag` y `cacheLife` de respaldo
- [ ] Webhook: responde el `challenge`, exige secreto en la URL con comparacion de tiempo constante, llama `revalidateTag(tag, 'max')` y no usa el payload como dato
- [ ] Tras crear, la Server Action llama `updateTag` para que el solicitante vea su item
- [ ] Server Action y ruta de firma de Blob re-verifican sesion Clerk y dominio
- [ ] Esquema zod por area con `z.discriminatedUnion('area', ...)` que replica los show-if del form de monday
- [ ] Estimacion como funcion pura (area, subtipo, prioridad, completitud del brief, hoy) a fecha en dias habiles, con un test por regla
- [ ] Paginacion de `items_page` hasta cursor null
- [ ] Errores de limite de monday respetan `retry_in_seconds` y no reintentan sin `Idempotency-Key`

## 11. Fuentes

| n | Titulo | Editor | Version o fecha | Consultado | Confianza |
|---|---|---|---|---|---|
| 1 | Items (create_item) | monday.com | API 2026-07 | 2026-10-06 | high |
| 2 | Status, Dropdown, People, Date, Link, Files columns | monday.com | API 2026-07 | 2026-10-06 | high |
| 3 | Rate limits | monday.com | API 2026-07 | 2026-10-06 | high |
| 4 | API versioning | monday.com | 2026-07 Current | 2026-10-06 | high |
| 5 | Idempotency | monday.com | API 2026-07 | 2026-10-06 | high |
| 6 | Webhooks | monday.com | API 2026-07 | 2026-10-06 | high |
| 7 | items_page, activity_logs | monday.com | API 2026-07 | 2026-10-06 | high |
| 8 | revalidateTag, cacheTag, updateTag | Vercel / Next.js | 16.4.0 / 16.3.8 | 2026-10-06 | high |
| 9 | Data security guide | Vercel / Next.js | 16.4.0 | 2026-10-06 | high |
| 10 | Vercel Functions limits | Vercel | 2026-08-24 | 2026-10-06 | high |
| 11 | Discriminated unions | zod | 4 | 2026-10-06 | high |
| 12 | Develop tests (grading) | Anthropic | 2026-10 | 2026-10-06 | high |
| 13 | Setting up SLAs | Atlassian | JSM Server 4.19 | 2026-10-06 | medium |
| 14 | makeplane/plane | Plane | 7466675 | 2026-10-06 | high |
| 15 | getfider/fider | Fider | cfcc18c | 2026-10-06 | medium |
| 16 | logchimp/logchimp | LogChimp | c8f59fa | 2026-10-06 | medium |
| 17 | mondaycom/monday-graphql-api | monday.com | f94463e, api 14.1.0 | 2026-10-06 | high |
| 18 | formbricks/formbricks | Formbricks | bd5c8d8 | 2026-10-06 | medium |
| 19 | vercel/next.js examples | Vercel | 0e912cb | 2026-10-06 | medium |
| 20 | pipeline-board, atfx-web-requests | Karen (repos privados) | 096c175, d5c0f99 | 2026-10-06 | high |
