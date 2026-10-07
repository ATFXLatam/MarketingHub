# Reference Brief: estimador en vivo dentro de la solicitud, vencidas vs proximas, filtro por persona y vista publica vs interna

Slug: intake-estimator-ux | Nivel: standard | Fecha: 2026-10-07 | Estado: APROBADO
Versiones: next=16.4.0, react=19.3.0
Verificador: research-verifier 2026-10-07 ESCALATE

## 1. Pregunta y decisiones abiertas

Como resuelven las herramientas profesionales de intake y los estimadores en vivo cuatro puntos de UX, para decidir el diseno de atfx-marketing-hub. Reusa `similar-projects.md` (D1 vista publica por token y lista blanca, D4 estimacion por reglas) sin reinvestigarlo.

- P1. Calculadora de plazo dentro del flujo de solicitud: resumen vivo en todos los pasos (columna en desktop, barra fija en mobile), desglose en el paso final, y como se dice que completar el brief acorta la fecha (enlace al campo que falta).
- P2. Separar trabajo vencido de proximas entregas en las listas del dashboard.
- P3. Filtrar tablero y tabla por persona al elegirla en el directorio o en avatares.
- P4. Que expone la vista compartida por enlace frente a la interna, en especial carga y rendimiento por persona.

## 2. Estado actual

- La estimacion se recalcula en cada render del asistente a partir del borrador, en cuanto hay area elegida [repo:components/intake/request-form.tsx:117]
- El panel de estimacion solo se monta en el ultimo paso, "Revision" [repo:components/intake/request-form.tsx:384]
- El paso "Material" ya promete en texto que adjuntar acorta la entrega, sin mostrar cuanto [repo:components/intake/request-form.tsx:351]
- El panel muestra dias, fecha, barra de calidad y un Alert con lo que falta como texto corrido [repo:components/intake/estimate-panel.tsx:21]
- `briefQuality` devuelve `missing` como frases de ayuda (`hint`), sin id de campo ni de paso al que llevar [repo:lib/estimate.ts:74]
- Cada check lleva peso, predicado, `hint` y `label`; no sabe en que paso vive su campo [repo:lib/estimate.ts:37]
- `deliveryDays` ya separa base, prioridad y penalizacion por brief para que form y calculadora expliquen el mismo numero [repo:lib/estimate.ts:89]
- `tight` marca cuando la fecha requerida cae antes de la estimada [repo:lib/estimate.ts:118]
- El asistente vive en un `Sheet` de `SheetStack`: dialogo centrado en pantallas anchas, hoja inferior arrastrable en telefonos [repo:components/intake/request-flow.tsx:15]
- `Sheet` acepta un slot `footer` [repo:components/arc/sheet-stack/sheet-stack.tsx:41]
- `SheetStack` cambia de modo en `breakpoint = 640` por defecto [repo:components/arc/sheet-stack/sheet-stack.tsx:112]
- `MultiStepForm` es un Arc Pro adaptado en el repo; sus props no tienen slot lateral ni forma de saltar a un paso [repo:components/arc/multi-step-form/multi-step-form.tsx:15]
- El paso actual es estado interno del formulario; solo Atras y Continuar lo mueven [repo:components/arc/multi-step-form/multi-step-form.tsx:99]
- `DeliveryCalculator` (bloque usage-pricing adaptado) simula el plazo con sliders, no con el borrador real [repo:components/arc/blocks/usage-pricing/usage-pricing.tsx:92]
- Su desglose "De donde sale el plazo" ya pinta base, prioridad, brief y total con `deliveryDays` [repo:components/arc/blocks/usage-pricing/usage-pricing.tsx:198]
- Tiene una region `aria-live="polite"` que anuncia tier y dias [repo:components/arc/blocks/usage-pricing/usage-pricing.tsx:195]
- La calculadora se renderiza como pieza suelta al final de `TeamPage`, separada del flujo de solicitud [repo:components/team/team-page.tsx:64]
- Karen pidio que la calculadora vaya asociada al paso final de la solicitud dentro del flujo, no como pieza separada [KAREN:mensaje en esta sesion 2026-10-07]
- Karen pidio "full arc, nada de hardcodear ni crear nuevas clases" y "solo arc" [KAREN:pedido relayado por /research 2026-10-07]
- `upcomingDeliveries` mezcla vencidas y futuras en una sola lista ordenada por fecha; las vencidas quedan arriba [repo:lib/team.ts:43]
- `nextDelivery` ya excluye las vencidas para no mostrar una cuenta regresiva en 0 [repo:lib/team.ts:48]
- "Proximas entregas" usa `upcomingDeliveries` tal cual, asi que incluye vencidas bajo ese titulo [repo:components/team/team-activity.tsx:61]
- Cada fila dice "vencida hace N dias" via `dueText`, pero no hay grupo separado [repo:components/team/team-overview.tsx:23]
- `TeamOverview` solo muestra la tarjeta "Vencidas" cuando no hay ninguna entrega futura [repo:components/team/team-overview.tsx:48]
- El tablero filtra solo por area con `ChipGroup` [repo:components/team/team-board.tsx:79]
- `TeamDirectory` expone `onPersonSelect` [repo:components/arc/blocks/team-directory/team-directory.tsx:33]
- `TeamHeader` monta `TeamDirectory` sin pasar `onPersonSelect` [repo:components/team/team-header.tsx:60]
- `TeamDirectory` arranca con la primera persona seleccionada aunque nadie haya hecho clic [repo:components/arc/blocks/team-directory/team-directory.tsx:44]
- El `AvatarGroup` del `ProjectBoard` es decorativo: no recibe handler de clic [repo:components/arc/blocks/project-board/project-board.tsx:77]
- La solicitud abierta ya vive en la URL (`?solicitud=`), precedente para guardar un filtro en la URL [repo:components/team/team-board.tsx:50]
- `TeamPage` es la misma pagina para el equipo y para clientes [repo:components/team/team-page.tsx:37]
- El directorio muestra a clientes la "Carga" por persona (abiertas y entregadas en 30 dias) [repo:components/team/team-header.tsx:42]
- "Por persona" muestra anillos de Entregadas, Al dia y En curso por cada miembro [repo:components/team/team-activity.tsx:150]
- `memberShares` calcula el porcentaje "al dia" de cada persona a partir de sus vencidas [repo:lib/team.ts:54]
- El DTO publico incluye responsables con nombre, foto, cargo y zona horaria [repo:lib/public-dto.ts:31]
- El dashboard interno ofrece el boton "Enlace para clientes" que copia la URL publica [repo:components/shell/internal-dashboard.tsx:69]
Contextos: dashboard interno en Vercel con sesion Clerk (Server Component + Client Components), vista publica `/p/token` prerenderizada desde la cache del snapshot de monday, asistente en dialogo (ancho >= 640) o en hoja inferior (ancho < 640), tests vitest de `lib/*` (sin DOM ni runtime Next), `next dev` local

## 3. Fuentes primarias

- Baymard: mostrar la fecha de entrega concreta en vez de la velocidad ("2-3 dias habiles"); los usuarios se frenan a calcular la fecha [doc:https://baymard.com/blog/shipping-speed-vs-delivery-date@2023-06-27]
- Baymard: los usuarios leen la fecha estimada como promesa; la precision es esencial para no perder confianza [doc:https://baymard.com/blog/shipping-speed-vs-delivery-date@2023-06-27]
- Baymard: los pasos completados de un checkout deben colapsar a resumenes con los datos, no a encabezados vacios [doc:https://baymard.com/blog/accordion-checkout-usability@2023-09-27]
- GOV.UK: pagina "check answers" justo antes de confirmar, con un enlace "Change" junto a cada respuesta [doc:https://design-system.service.gov.uk/patterns/check-answers/@2026-10]
- GOV.UK: una respuesta opcional omitida se muestra como "Not provided" en la revision [doc:https://design-system.service.gov.uk/patterns/check-answers/@2026-10]
- GOV.UK: tras cambiar una respuesta, Continuar devuelve a la revision sin repetir el resto del flujo [doc:https://design-system.service.gov.uk/patterns/check-answers/@2026-10]
- GOV.UK: cada error del resumen debe enlazar al campo al que se refiere [doc:https://design-system.service.gov.uk/components/error-summary/@2026-10]
- WCAG 2.2 SC 4.1.3: un cambio de resultado sin cambio de contexto es un mensaje de estado y debe anunciarse sin mover el foco (`role="status"`) [doc:https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html@2.2]
- Linear: el filtro por asignado acepta una o varias personas ("is", "is either of") [doc:https://linear.app/docs/filters@2026-10]
- Linear: los filtros aplicados se reflejan en la URL; copiarla comparte la vista filtrada [doc:https://linear.app/docs/filters@2026-10]
- Linear: agrupar por asignado y ordenar dentro del grupo por fecha de vencimiento son opciones de visualizacion [doc:https://linear.app/docs/display-options@2026-10]
- Asana: organizar My Tasks por fecha con secciones "hoy", "proxima semana" y "despues", y ordenar dentro de cada seccion [doc:https://asana.com/inside-asana/customize-my-tasks@2021-09-10]
- Asana forms: el branching muestra solo las preguntas que aplican; la ayuda no menciona ningun valor calculado visible para quien llena [doc:https://help.asana.com/s/article/how-to-use-forms-branching@2026-10]
- Jira: el filtro rapido de asignados del tablero son avatares; solo 6 visibles y hay que pasar el cursor para ver el nombre [doc:https://jira.atlassian.com/browse/JRACLOUD-85997@2025-05-13]
- Jira Cloud: compartir un dashboard como Public lo hace visible y buscable en internet [doc:https://confluence.atlassian.com/servicedeskcloud/managing-shared-dashboards-1097176699.html@cloud]
- Jira: "Public" y "Anyone" incluyen al usuario anonimo; Atlassian recomienda compartir con usuarios logueados en su lugar [doc:https://support.atlassian.com/jira/kb/anonymous-users-able-to-see-shared-filters-dashboards-or-project-issues-in-jira/@cloud]
- ICO: monitorear trabajadores exige proposito claro, el medio menos intrusivo y no recolectar mas de lo necesario [doc:https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/employment/monitoring-workers/data-protection-and-monitoring-workers/@2023-10]

## 4. Implementaciones de referencia

- Saleor storefront (saleor/storefront, mantenido por Saleor Commerce, 1.6k estrellas, push 2026-10-05): sus reglas de checkout piden resumen del pedido en cada paso [ref:https://github.com/saleor/storefront/blob/b73bdce3269cceb08feff856af5067d117c79cb6/skills/saleor-paper-storefront/rules/checkout-design-principles.md#L28@b73bdce3269cceb08feff856af5067d117c79cb6]
- Saleor: en mobile, barra colapsada con el total visible arriba, nunca oculta del todo [ref:https://github.com/saleor/storefront/blob/b73bdce3269cceb08feff856af5067d117c79cb6/skills/saleor-paper-storefront/rules/checkout-design-principles.md#L49@b73bdce3269cceb08feff856af5067d117c79cb6]
- Saleor: en desktop, resumen fijo a la derecha con totales que se actualizan y explican por que cambia el total [ref:https://github.com/saleor/storefront/blob/b73bdce3269cceb08feff856af5067d117c79cb6/skills/saleor-paper-storefront/rules/checkout-design-principles.md#L71-L73@b73bdce3269cceb08feff856af5067d117c79cb6]
- Saleor: el resumen mobile es un boton con `aria-expanded` que arranca colapsado y se abre solo cuando hay un problema que ver [ref:https://github.com/saleor/storefront/blob/b73bdce3269cceb08feff856af5067d117c79cb6/src/checkout/views/saleor-checkout/order-summary.tsx#L188-L229@b73bdce3269cceb08feff856af5067d117c79cb6]
- Plane (makeplane/plane, ya usado en similar-projects): el widget de trabajo asignado separa pestanas Upcoming, Overdue y Marked completed [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/packages/constants/src/dashboard.ts#L63-L79@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Plane: Upcoming y Overdue se definen solo por la fecha objetivo contra hoy (`after` y `before`) [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/web/helpers/dashboard.helper.ts#L53-L66@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Plane: clic en un asignado de las estadisticas alterna un filtro `assignee_id in [...]` sobre la lista; otro clic lo quita [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/web/components/core/sidebar/progress-stats/shared.ts#L33-L51@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Plane: la vista publica devuelve por item solo `assignee_ids` en una lista explicita de campos; no hay agregados de carga por persona en esa respuesta [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/space/views/issue.py#L830-L854@7466675e471efe1c96b122615f7a0d30c9b2eb05]

## 5. Opciones

P1. Calculadora dentro del flujo

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. Resumen vivo en todos los pasos (columna en desktop, `footer` del Sheet en mobile) + desglose completo y lista de faltantes con enlace al campo en "Revision"; se quita `DeliveryCalculator` suelto de `TeamPage` | Fecha visible mientras decide (Baymard), check answers con enlaces (GOV.UK), cumple lo pedido por Karen | Tocar `MultiStepForm` (slot lateral y salto a paso) y `briefQuality` (ids de check y paso) | media | Si |
| B. Solo en "Revision" (hoy), con faltantes como enlaces | Cambio minimo | Quien llena no ve el efecto de cada campo hasta el final | baja | Respaldo si no se toca MultiStepForm |
| C. Calculadora separada en la pagina (hoy) | Ya existe | Simula con sliders, no con el brief real; Karen la quiere en el flujo | baja | No |

P2. Vencidas vs proximas

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. Dos grupos en la misma lista: "Vencidas" arriba, siempre abierto, con conteo; luego "Proximas" | Patron de Plane y Asana; nada escondido | Lista mas alta | baja | Si |
| B. Pestanas Vencidas / Proximas | Igual a Plane | Esconde una de las dos | baja | No para listas cortas |
| C. Una lista ordenada (hoy) | Ya existe | "Proximas" incluye vencidas; mezcla dos acciones distintas | baja | No |

P3. Filtro por persona

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. Clic en una persona del directorio alterna `?persona=id`; tablero, tabla y proximas leen el filtro; chip visible "Filtrando por X" para quitarlo | Igual a Linear (URL) y Plane (alternar); usa `onPersonSelect` que ya existe | Estado nuevo compartido entre header y board | media | Si |
| B. Avatares clicables en el tablero (estilo Jira) | Familiar | Jira: nombres ocultos tras hover y solo 6 visibles; `AvatarGroup` no tiene handler | media | No |
| C. Select "Responsable" en la barra del tablero | Simple | Duplica el directorio | baja | Complemento opcional |

P4. Vista publica vs interna

| Opcion | Pros | Contras | Complejidad | Recomendacion |
|---|---|---|---|---|
| A. Prop `audience` decidida en servidor: publica muestra estado por solicitud y agregados del equipo; oculta carga y rendimiento por persona; DTO publico sin lo que no se muestra | Minimizacion (ICO); no expone desempeno individual a clientes | Menos "quien esta en que" para clientes | media | Si |
| B. Misma pagina para ambos (hoy) | Cero trabajo | Clientes ven carga y % al dia por persona | baja | No |
| C. Ocultar widgets solo en UI y dejar el DTO igual | Rapido | Los datos siguen en el payload del cliente | baja | No |

## 6. Evidencia en contra

- Una fecha visible y precisa se lee como promesa; si el responsable la mueve, el solicitante se siente defraudado. Se resuelve rotulando "estimada" y diciendo que la fecha final la fija el responsable en monday [doc:https://baymard.com/blog/shipping-speed-vs-delivery-date@2023-06-27]
- Recalcular en cada tecla del brief cambia el tier al cruzar 150 caracteres; anunciar cada cambio satura el lector de pantalla. Se resuelve anunciando solo cuando cambian los dias, con `role="status"` [doc:https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html@2.2]
- Mostrar el umbral invita a rellenar texto para bajar dias. Se acepta: el responsable revisa el brief y la vista de reglas ya era la decision de D4 [repo:lib/estimate.ts:42]
- Tocar `MultiStepForm` choca con "solo arc". Se acepta porque ya es un Arc Pro adaptado en el repo y el cambio son dos props, sin clases nuevas [repo:components/arc/multi-step-form/multi-step-form.tsx:11]
- Quitar `DeliveryCalculator` de la pagina deja a los clientes de la vista publica sin la explicacion del plazo (alli no hay flujo de solicitud) [repo:components/team/team-page.tsx:25]
- Ocultar carga por persona contradice la promesa actual de la pagina, "Quien esta en que" [repo:components/team/team-page.tsx:51]
- Los mayores productos no ocultan al asignado por item en vistas publicas: Plane devuelve `assignee_ids`. El riesgo esta en los agregados de rendimiento, no en el nombre en la tarjeta [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/api/plane/space/views/issue.py#L830-L854@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Agrupar vencidas aparte las destaca ante clientes en la vista publica; puede leerse como mal desempeno del equipo. Queda como pregunta para Karen [repo:components/team/team-overview.tsx:48]

## 7. Ejemplares y anti-ejemplos

- Bien: resumen fijo a la derecha en desktop y barra colapsada con el total en mobile [ref:https://github.com/saleor/storefront/blob/b73bdce3269cceb08feff856af5067d117c79cb6/skills/saleor-paper-storefront/rules/checkout-design-principles.md#L71-L73@b73bdce3269cceb08feff856af5067d117c79cb6]
- Bien: el resumen mobile se abre solo cuando hay algo que corregir (aqui: `tight`) [ref:https://github.com/saleor/storefront/blob/b73bdce3269cceb08feff856af5067d117c79cb6/src/checkout/views/saleor-checkout/order-summary.tsx#L188-L229@b73bdce3269cceb08feff856af5067d117c79cb6]
- Bien: cada faltante es un enlace que lleva al campo y vuelve a la revision al continuar [doc:https://design-system.service.gov.uk/patterns/check-answers/@2026-10]
- Mal: faltantes como una frase con puntos ("Para mejorarlo: A. B. C.") sin forma de ir al campo [repo:components/intake/estimate-panel.tsx:21]
- Bien: desglose base, prioridad, brief y total, ya escrito con `deliveryDays`; reusar esas filas con el borrador real en vez de sliders [repo:components/arc/blocks/usage-pricing/usage-pricing.tsx:198]
- Bien: Upcoming y Overdue definidos solo por fecha contra hoy [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/web/helpers/dashboard.helper.ts#L53-L66@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Mal: la seccion de vencidas colapsada por defecto; usuarios de Asana lo reportan como lo que mas necesitan ver (foro oficial) [doc:https://forum.asana.com/t/my-tasks-list-when-sorted-by-due-date-has-past-due-collapsed-as-default-would-prefer-it-expanded/453160@2023-06-13]
- Bien: filtro por persona que alterna con un segundo clic y acepta varias personas [ref:https://github.com/makeplane/plane/blob/7466675e471efe1c96b122615f7a0d30c9b2eb05/apps/web/components/core/sidebar/progress-stats/shared.ts#L33-L51@7466675e471efe1c96b122615f7a0d30c9b2eb05]
- Mal: filtro por avatar sin nombre visible y con tope de avatares [doc:https://jira.atlassian.com/browse/JRACLOUD-85997@2025-05-13]
- Mal: compartir con "Public" pensando que es "toda la organizacion"; en 2019 dashboards publicos de Jira expusieron nombres, cargos y correos de empleados (prensa, no Atlassian) [doc:https://www.bleepingcomputer.com/news/security/misconfigured-jira-servers-leak-info-on-users-and-projects@2019-08-03]

## 8. Trampas

- `TeamDirectory` siempre tiene a alguien seleccionado al montar; filtrar por "seleccion" filtraria el tablero sin clic. El filtro debe salir solo de `onPersonSelect` [repo:components/arc/blocks/team-directory/team-directory.tsx:44]
- `onPersonSelect` solo avisa al elegir, no al deseleccionar; alternar o limpiar el filtro necesita un control propio (chip "Quitar filtro") [repo:components/arc/blocks/team-directory/team-directory.tsx:58]
- `missing` son frases; para enlazar al campo hace falta que cada check devuelva un id de campo y de paso, sin romper `BRIEF_CHECKS` que usa la calculadora [repo:lib/estimate.ts:64]
- El area no es un check: sin area no hay `preview`, asi que el resumen vivo empieza vacio en el paso 1 [repo:components/intake/request-form.tsx:117]
- El servidor recalcula la estimacion al enviar; el resumen debe seguir llamando a la misma `estimate` para no mostrar otra cifra [repo:lib/estimate.ts:107]
- Contexto hoja inferior (< 640 px): el `footer` del Sheet es el lugar para la barra fija; un elemento `position: fixed` propio dentro de una hoja arrastrable se mueve con ella o queda tapado por el teclado [repo:components/arc/sheet-stack/sheet-stack.tsx:41]
- Contexto dialogo (>= 640 px): la columna lateral reduce el ancho util del formulario; `RadioCards` usa `minColumnWidth={220}` y puede caer a una columna [repo:components/intake/request-form.tsx:223]
- Contexto vista publica prerenderizada: ocultar widgets en el cliente no saca los datos del HTML ni del payload RSC; lo que no se muestra no debe llegar en las props [repo:lib/public-dto.ts:31]
- Contexto vista publica: aunque se oculten los anillos, con `owners` por tarea cualquiera recalcula la carga por persona; decidir si la publica lleva responsables [repo:lib/team.ts:20]
- Contexto vitest: los tests corren sobre `lib/*` sin DOM; la separacion vencidas/proximas y el filtro por persona deben ser funciones puras en `lib/team.ts` para poder probarse [repo:lib/team.test.ts:29]
- Contexto `next dev`: `today` viene del servidor; comparar vencidas con la fecha del navegador desalinea servidor y cliente cerca de medianoche [repo:components/intake/request-form.tsx:76]
- Avatares de Jira solo muestran personas con trabajo en el tablero en ese momento; el directorio aqui sale de `teamMembers(tasks)` y tiene el mismo efecto [repo:components/team/team-page.tsx:52]

## 9. Incertidumbre

- ASSUMPTION: los shareable views de monday dejan elegir columnas e items y aun asi los datos filtrados son accesibles para usuarios tecnicos (lo dice el resumen de busqueda de support.monday.com, que devolvio 403). prueba: abrir el articulo 360009695080 con sesion y probar un shareable view con una columna oculta inspeccionando la red
- ASSUMPTION: Asana no tiene vista publica por enlace sin cuenta para proyectos o portafolios (solo invitados y comment-only). prueba: revisar el centro de ayuda de Asana sobre "publish to web" con sesion
- ASSUMPTION: Linear no ofrece vistas publicas de issues con carga por persona. prueba: buscar en linear.app/docs "public" y "share view"
- ASSUMPTION: Jira Service Management no muestra el SLA al cliente en el portal sin apps del Marketplace (los resultados apuntan a apps de terceros). prueba: leer la doc oficial de JSM sobre lo que ve el cliente en una solicitud
- ASSUMPTION: monday WorkForms, Wrike request forms, Workfront request queues, Smartsheet forms y Airtable interfaces no muestran una fecha estimada viva antes de enviar; la fecha se pone al crear el item. prueba: crear un formulario de prueba en cada una y ver si hay campos calculados visibles al llenar
- ASSUMPTION: el filtro por persona de monday filtra por la columna People y tambien por Last Updated y Creation Log (resumen de busqueda; support.monday.com dio 403). prueba: abrir el articulo de board filters con sesion
- ASSUMPTION: anunciar solo el cambio de dias basta para lectores de pantalla. prueba: VoiceOver en el asistente escribiendo un brief que cruce 150 caracteres
- [NEEDS CLARIFICATION: en la vista publica, se muestran responsables por solicitud (nombre y foto), o solo el estado y la fecha?]
- [NEEDS CLARIFICATION: se quitan de la vista publica la carga por persona del directorio y los anillos "Por persona"?]
- [NEEDS CLARIFICATION: los clientes deben ver el grupo "Vencidas" en la vista publica, o solo el equipo?]
- [NEEDS CLARIFICATION: al sacar la calculadora de la pagina, la vista publica conserva alguna explicacion del plazo, o desaparece del todo?]
- [NEEDS CLARIFICATION: se acepta agregar a `MultiStepForm` un slot lateral y un salto a paso, o se queda con la opcion B de P1?]

## 10. Checklist de estandar

- [ ] La estimacion visible en el asistente sale de la misma `estimate` que usa el servidor al enviar
- [ ] Desde que hay area, cada paso muestra dias habiles y fecha concreta "estimada"; en ancho >= 640 en una columna lateral y en < 640 en el `footer` del Sheet
- [ ] La barra mobile arranca colapsada y se abre sola cuando `tight` es verdadero
- [ ] El paso "Revision" muestra el desglose base, prioridad, brief y total con `deliveryDays`
- [ ] Cada faltante de `briefQuality` lleva id de campo y de paso; en "Revision" es un enlace que lleva al paso, enfoca el campo, y Continuar vuelve a "Revision"
- [ ] Cambio de dias anunciado una vez por `role="status"`, no en cada tecla
- [ ] `DeliveryCalculator` ya no se renderiza como pieza suelta en `TeamPage`
- [ ] Funcion pura que separa vencidas (fecha < hoy, no hecha) de proximas (fecha >= hoy), con un test
- [ ] "Proximas entregas" no contiene vencidas; "Vencidas" va arriba, abierta, con conteo
- [ ] Clic en una persona del directorio alterna `?persona=id`; tablero, tabla y proximas aplican el filtro; hay un chip visible para quitarlo
- [ ] Montar la pagina sin `?persona` no filtra nada
- [ ] La vista publica recibe solo lo que muestra: si no muestra carga por persona, esos datos no llegan en las props
- [ ] Ningun widget de rendimiento individual (porcentaje al dia, carga) se renderiza en `/p/token`
- [ ] Componentes Arc existentes, sin clases nuevas salvo layout minimo

## 11. Fuentes

| n | Titulo | Editor | Version o fecha | Consultado | Confianza |
|---|---|---|---|---|---|
| 1 | Shipping speed vs delivery date | Baymard Institute | 2023-06-27 | 2026-10-07 | high |
| 2 | Accordion checkout usability | Baymard Institute | 2023-09-27 | 2026-10-07 | high |
| 3 | Check answers pattern | GOV.UK Design System | 2026-10 | 2026-10-07 | high |
| 4 | Error summary component | GOV.UK Design System | 2026-10 | 2026-10-07 | high |
| 5 | Understanding SC 4.1.3 Status Messages | W3C WAI | WCAG 2.2 | 2026-10-07 | high |
| 6 | Filters | Linear | 2026-10 | 2026-10-07 | high |
| 7 | Display options | Linear | 2026-10 | 2026-10-07 | high |
| 8 | Customize My Tasks | Asana | 2021-09-10 | 2026-10-07 | medium |
| 9 | Forms branching | Asana | 2026-10 | 2026-10-07 | high |
| 10 | Past due collapsed by default (foro) | Asana community | 2023-06-13 | 2026-10-07 | low |
| 11 | JRACLOUD-85997 assignee quick filter | Atlassian | 2025-05-13 | 2026-10-07 | medium |
| 12 | Managing shared dashboards | Atlassian | Cloud | 2026-10-07 | high |
| 13 | Anonymous users see shared filters and dashboards | Atlassian | Cloud | 2026-10-07 | high |
| 14 | Misconfigured Jira servers leak info | BleepingComputer | 2019-08-03 | 2026-10-07 | medium |
| 15 | Data protection and monitoring workers | ICO (UK) | 2023-10 | 2026-10-07 | medium |
| 16 | saleor/storefront | Saleor Commerce | b73bdce | 2026-10-07 | high |
| 17 | makeplane/plane | Plane | 7466675 | 2026-10-07 | high |
| 18 | similar-projects.md (D1, D4) | este repo | BORRADOR 2026-10-06 | 2026-10-07 | medium |

## Decision de Karen (2026-10-07)

- La vista es publica por diseno: el proposito del proyecto es dar visibilidad a la carga del area y hacer la solicitud mas sencilla y predecible [KAREN: mensaje en esta sesion 2026-10-07]. P4 se descarta: no se separa vista publica de interna ni se recorta carga por persona, responsables o vencidas.
- P1 opcion A (resumen vivo en cada paso, desglose en Revision, enlaces a lo que falta) sigue el pedido previo de llevar la calculadora al paso final del flujo.
