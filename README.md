# atfx-marketing-hub

Solicitudes y flujo del equipo de marketing de ATFX LATAM, con monday como fuente de verdad.

- `/solicitar`: formulario con login (Clerk, por dominio). Calcula la entrega estimada según el área, el tipo de pieza, la prioridad y qué tan completo está el brief, y crea el item en el board [Solicitudes Marketing LATAM](https://atfx.monday.com/boards/18424308173).
- `/p/<token>`: tablero público de solo lectura (tablero, tabla y actividad). Solo muestra título, área, estado, prioridad, fecha, mercado y SLA; nunca solicitante, brief ni adjuntos.

Next.js 16 (Cache Components) · Arc UI · Clerk · Vercel Blob · monday GraphQL API `2026-07` · zod.

## Por qué así

- **El estado se edita en monday, no aquí.** Sin panel propio: el equipo ya vive en monday, cambiar un status es un clic, y la app no duplica permisos ni UI. La app solo crea items y lee.
- **Una lectura por cambio, no por visita.** `getBoardSnapshot` corre bajo `"use cache"` con el tag del board; el webhook de monday lo expira. `cacheLife("hours")` cubre un webhook perdido (monday reintenta solo 30 min). Así la vista pública no gasta el límite diario del API.
- **Avisos y asignación en monday.** Las notificaciones al responsable las dispara una automatización de monday sobre la columna Área u Owner. Opcionalmente `MONDAY_AREA_OWNERS` asigna el Owner al crear.
- **Estimación por reglas.** `lib/estimate.ts` es una función pura, con tests, y el form la muestra en vivo: la persona ve qué le falta al brief y cuánto mueve la fecha. Los días base por pieza están en `lib/board-config.ts`.
- **Adjuntos en Blob, link en monday.** La columna File de monday no se puede llenar al crear el item; los links quedan en un update del item.
- Investigación de origen: `docs/research/similar-projects.md`.

## Arranque

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev
```

Variables en `.env.example`. Mínimo para ver el tablero: `MONDAY_API_TOKEN`, `PUBLIC_BOARD_TOKEN` y las de Clerk.

### Conectar el webhook de monday

Board → Integrate → Webhooks → "When any column changes" (y "When an item is created") → URL `https://<host>/api/monday/webhook/<MONDAY_WEBHOOK_SECRET>`. La ruta responde el challenge sola.

## Comandos

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint`
