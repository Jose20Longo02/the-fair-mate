# Preparacion para produccion — FairMate

Audit completo del codebase con todo lo que falta para que la app este lista para produccion.
Organizado por prioridad: bloqueadores criticos primero, luego alta, media y baja.

---

## BLOQUEADORES CRITICOS

Estos items deben resolverse **antes de ir a produccion**. Sin ellos, la app es vulnerable o no funciona correctamente en un entorno real.

---

### ~~1. Base de datos: Migrar de SQLite a PostgreSQL~~ ✅ DONE

~~SQLite no soporta concurrencia real, no es adecuado para datos financieros, y no escala horizontalmente.~~

**Completado:**
- Changed `provider = "sqlite"` to `provider = "postgresql"` in `schema.prisma`.
- Provisioned a PostgreSQL instance on **Neon** (AWS US East, free tier).
- Updated `DATABASE_URL` in `.env` with the Neon connection string.
- Ran `npx prisma db push` — all tables created successfully in PostgreSQL.
- Database started fresh (clean slate, no data migration from SQLite).

---

### 2. Secretos hardcodeados con defaults inseguros — DONE

La app tenia secrets con valores por defecto si no se definian en `.env`.

**Que hacer:** Eliminar defaults y validar al cargar; fallar si faltan o son cortos.

**Hecho:**
- **`web/lib/env.ts`**: `requireEnv(name, minLength)` que lanza si la variable falta o tiene menos de `minLength` caracteres. Exporta `SESSION_SECRET` (mín. 32), `ADMIN_SECRET` (mín. 16), `MATCHMAKING_SECRET` (mín. 16).
- **`auth.ts`** y **`admin-auth.ts`**: usan `SESSION_SECRET` y `ADMIN_SECRET` desde `env.ts`; sin defaults.
- **`config.ts`**: reexporta `MATCHMAKING_SECRET` desde `env.ts`.
- La app falla en el primer uso que cargue auth o config si falta alguna variable o es demasiado corta. `.env.example` actualizado con longitudes mínimas; en producción usar 64+ caracteres (ej. `openssl rand -base64 48`).

---

### 3. Cookies de sesion no aseguradas — DONE

**Archivo:** `web/lib/auth.ts` (funcion `createSession`, lineas 15-27)

Actualmente las cookies se setean sin flags de seguridad explicitos:
- **`Secure`**: No esta seteado. Sin esto, la cookie se envia por HTTP sin cifrar.
- **`HttpOnly`**: No esta seteado. Sin esto, JavaScript del cliente puede leer la cookie (XSS).
- **`SameSite`**: No esta seteado. Sin esto, la cookie se envia en requests cross-site (CSRF).

**Que hacer:**
1. Al setear la cookie de sesion, agregar los flags (httpOnly, secure en prod, sameSite: lax, path, maxAge).
2. Hacer lo mismo para la cookie de admin en `lib/admin-auth.ts`.
3. Verificar que el logout borra la cookie correctamente.

**Hecho:** En `lib/auth.ts` se exporta `SESSION_COOKIE_OPTIONS` (httpOnly, secure en production, sameSite: "lax", path: "/", maxAge 7 dias). Login y register usan estas opciones al setear la cookie. En `lib/admin-auth.ts` se exporta `ADMIN_COOKIE_OPTIONS` (iguales flags, maxAge 24h). Admin auth las usa. Logout de usuario y de admin borran la cookie con las mismas opciones (path, httpOnly, secure, sameSite) y maxAge: 0 para que el navegador la elimine correctamente.

---

### 4. Sin proteccion CSRF — DONE

**Archivo:** `web/middleware.ts`

El middleware solo verificaba sesion valida, sin proteccion contra Cross-Site Request Forgery.

**Que hacer:** Validar Origin para requests que mutan datos (POST/PUT/PATCH/DELETE).

**Hecho:** En el middleware, para metodos POST, PUT, PATCH y DELETE se comprueba: si el header `Origin` esta presente, su host debe coincidir con el header `Host`. Si no coincide (p. ej. request desde otro dominio), se responde 403 Forbidden. Si `Origin` no viene (p. ej. misma origen o llamadas server-to-server como cron/WS), se permite. Asi se evita que un sitio externo fuerce acciones con la sesion del usuario.

---

### 5. Rate limiting en memoria (no distribuido) — DONE

**Archivo:** `web/lib/rate-limit.ts`

El rate limiter usaba un `Map` en memoria. En multiples instancias cada una tenia su propio Map.

**Que hacer:** Redis (Upstash) o documentar limitacion de una instancia.

**Hecho:**
- **Upstash Redis** cuando estan definidas `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`: se usa `@upstash/ratelimit` con **sliding window** en Redis. Limiter por (limit, windowMs) cacheado en memoria; `checkRateLimit(key, limit, windowMs)` es **async** y devuelve `Promise<{ ok: true } | { ok: false; retryAfter: number }>`.
- **Fallback in-memory** cuando no hay env de Upstash (local o una sola instancia): mismo comportamiento que antes (ventana fija). Documentado en el propio modulo que solo vale para una instancia.
- Todas las rutas que usan rate limit ahora hacen `await checkRateLimit(...)` (login, register, forgot-password, reset-password, resend-code, games move).
- Crear una base Redis en [Upstash](https://console.upstash.com), copiar URL y token a `.env`, y el rate limit sera compartido entre instancias.

---

### 6. Sin monitoreo de errores ni alertas

**Archivo:** `web/lib/logger.ts`

```typescript
// Los logs van solo a console.log/console.error
if (level === "error") {
  console.error(payload);
}
```

Los logs se pierden cuando se reinicia el servidor o se llena el buffer. No hay forma de saber cuando algo falla en produccion salvo que alguien mire los logs manualmente.

**Que hacer:**
1. Integrar **Sentry** para capturar errores automaticamente (gratis hasta 5K eventos/mes).
   - `npm install @sentry/nextjs`
   - Configurar en `next.config.ts` y `sentry.client.config.ts` / `sentry.server.config.ts`
2. Configurar alertas por email/Slack cuando hay errores nuevos.
3. Para logs persistentes: usar un servicio como Axiom, Datadog, o al menos un archivo de log rotado.
4. Agregar un health check endpoint (`/api/health`) que devuelva el estado de la DB y servicios.

---

### ~~7. Paginas legales obligatorias~~ ✅ DONE

~~No existen paginas de Terms of Service ni Privacy Policy.~~

**Completado:**
- `/terms` — Terms of Service (11 secciones: About the service, Eligibility, Accounts, Deposits, Stakes & gameplay, Withdrawals, Fair play, Disputes, Limitation of liability, Changes, Contact).
- `/privacy` — Privacy Policy (9 secciones: Information collected, How we use it, Sharing, Storage & security, Cookies, User rights, Data retention, Changes, Contact).
- Links added to the footer on all pages.

**Pendiente:**
- Requerir aceptacion de los terminos durante el registro.
- **Consultar con un abogado** especializado en fintech/gaming para validar el contenido.

---

## PRIORIDAD ALTA

Estos items son muy recomendables antes de produccion. No bloquean el lanzamiento, pero no tenerlos expone a riesgos significativos.

---

### ~~8. Verificacion de email~~ ✅ DONE

~~Actualmente cualquiera puede registrarse con cualquier email sin verificar que le pertenece.~~

**Completado:**
- Integrated **Resend** as email service (`lib/email.ts`).
- Added `emailVerified`, `verificationCode`, `verificationCodeExpiresAt` fields to `User` model.
- On registration, a 6-digit code is generated and emailed to the user.
- Created `/verify-email` page with a 6-digit code input (auto-submit, paste support).
- Created `POST /api/auth/verify-email` and `POST /api/auth/resend-code` endpoints (rate-limited).
- Server-side verification check in `/cuenta/depositar`, `/jugar`, and `/partida/[id]` — redirects unverified users to `/verify-email`.
- Email verification badge on the account page: green "Verified" or yellow "Not verified" (links to `/verify-email`).

**Pending setup:**
- Add `RESEND_API_KEY` to `.env` (get from https://resend.com/api-keys).
- Optionally set `EMAIL_FROM` (defaults to `FairMate <noreply@fairmate.com>`, requires a verified domain in Resend).

---

### ~~9. Recuperacion de password~~ ✅ DONE

~~No existe un flujo de "Olvide mi contraseña". Si un usuario pierde su password, no tiene forma de recuperar su cuenta ni sus fondos.~~

**Completado:**
- Added `resetToken` and `resetTokenExpiresAt` fields to the `User` model.
- `POST /api/auth/forgot-password` — generates a secure 48-char hex token (1 hour expiry), sends a reset email via Resend. Rate-limited (3 req / 5 min). Returns a generic message to prevent email enumeration.
- `POST /api/auth/reset-password` — validates token, enforces password policy (8+ chars, letter + number), hashes with bcrypt, clears token after use (single-use). Rate-limited.
- `/forgot-password` page — email input form with success confirmation.
- `/reset-password?token=...` page — new password + confirm form, handles invalid/expired tokens gracefully.
- "Forgot password?" link added to the login page (next to the password label).

---

### ~~11. Race conditions en operaciones financieras~~ ✅ DONE

~~Entre el check de balance y la deduccion, otro request concurrente podria modificar el balance, resultando en un balance negativo.~~

**Completado:**
- `deductStakesForGame` — uses `SELECT ... FOR UPDATE` inside an interactive `$transaction` to lock both player rows before checking balance and deducting stakes. Prevents double-spend when two games start simultaneously.
- `settleGame` — locks the winner's row (or both rows on draw) before crediting winnings/refunds.
- `executeWithdraw` — locks the user row, checks balance, and deducts atomically inside a transaction. If the on-chain transfer fails afterwards, the balance is rolled back with a refund ledger entry.

---

### 11b. Balance en app = balance on-chain (reconciliación) ✅ DONE

Enfoque escalable: **DB como fuente de verdad** en tiempo real; **on-chain como referencia** vía reconciliación periódica. Así se evita saturar RPC con miles de syncs por operación.

**Completado:**
- **Fuente de verdad en runtime:** el balance que usa la app (stakes, retiros, UI) es el de la DB. Depósitos, settlements y retiros actualizan la DB de forma consistente; no se hace sync RPC tras cada operación.
- **Reconciliación periódica:** `GET /api/cron/sync-balances` (auth: X-Matchmaking-Secret o Bearer CRON_SECRET) lee el USDC on-chain de cada wallet de depósito y actualiza la DB; crea entradas "adjustment" solo cuando hay diferencia. Ejecutar cada 5–15 min (Vercel Cron o cron externo).
- `lib/sync-balances-to-on-chain.ts`: `syncBalancesToOnChain(network)` para el cron; `syncUserBalanceFromOnChain(userId, network)` disponible para admin o uso puntual.
- El admin puede lanzar la sync manual con `POST /api/admin/sync-balances-to-on-chain`.

**Setup en producción:** Cron que llame a `GET /api/cron/sync-balances` cada 5–15 minutos. Con miles de usuarios/partidas, este diseño evita picos de RPC y mantiene el balance alineado con on-chain.

---

### ~~12. On-chain settlement puede fallar silenciosamente~~ ✅ DONE

**Completado:**
- Added `settlementStatus` to `Game` model: "pending" | "completed" | "failed" (null for draws).
- `executeOnChainSettlementAndUpdateGame(gameId, ...)` in `lib/settle-on-chain.ts`: sets "pending" before running settlement, then "completed" or "failed"; logs `settlement_failed_admin_alert` on failure. All call sites (move, resign, timeout, disconnect-forfeit, admin settle-past) use it.
- **Cron:** `GET /api/cron/retry-settlements` (auth: X-Matchmaking-Secret or Bearer CRON_SECRET) finds games with `settlementStatus = "failed"` and retries on-chain settlement; updates to "completed" on success. Run every 5–15 min (e.g. after check-timeouts).
- **Admin alert:** Dashboard shows a warning card when `failedSettlementsCount > 0`. Stats API includes `failedSettlementsCount`.

---

### 13. WebSocket server sin autenticacion — DONE

**Archivo:** `web/ws-server/server.cjs`

Las conexiones WebSocket no verifican la identidad del usuario. Cualquiera puede conectarse y enviar mensajes.

**Que hacer:**
1. Requerir un token JWT en la conexion WebSocket (ej. como query param o en el primer mensaje).
2. Verificar el token antes de aceptar la conexion.
3. Asociar la conexion al userId verificado.

**Hecho:**
- **GET /api/auth/ws-token:** devuelve un JWT de corta duracion (5 min) con `userId`; requiere sesion (cookie). El cliente lo pide antes de abrir el WS.
- **POST /api/internal/verify-ws-token:** body `{ token }`; verifica el JWT; protegido por X-Matchmaking-Secret; devuelve `{ userId }`. El servidor WS llama a esta API para verificar el token.
- **Servidor WS:** en cada conexion exige `?token=...` en la URL. Si falta o es invalido, cierra con codigo 4001. Tras verificar, asigna `ws.userId` y **no usa** `msg.userId` del cliente (joinGame, joinQueue, presence usan solo el userId verificado).
- **Clientes:** ChessBoard, MatchmakingPanel, Home1v1Card, NotificationBell obtienen el token con `getWsToken()` de `@/lib/ws-auth` y abren la URL con `?token=...`.

---

### 14. Tests — DONE

No existe ningun test en el proyecto. Cero archivos `*.test.*`, `*.spec.*`, ni directorio `__tests__/`.

**Que hacer:**
1. Configurar un framework de testing (ej. Vitest para unit tests, Playwright para E2E).
2. Priorizar tests para:
   - Operaciones financieras (ledger, deposits, withdrawals, settlement).
   - Autenticacion (login, registro, sesiones).
   - Logica de juego (movimientos, checkmate, timeouts, ELO).
   - API endpoints criticos.
3. Apuntar a un minimo de cobertura en los flujos financieros antes de produccion.

**Hecho:**
- **Vitest** en `web/`: `vitest.config.ts`, scripts `test`, `test:run`, `test:coverage`. Entorno `node`, path alias `@/`, cobertura v8.
- **Unit tests** `web/__tests__/lib/`:
  - `elo.test.ts`: ELO (calculateExpected, calculateNewElo, getEloChanges) — 10 tests.
  - `auth-ws.test.ts`: JWT WS (createWsToken, verifyWsToken) — 6 tests.
  - `ledger.test.ts`: comision 5% del bote (winner receives) — 4 tests.
  - `rate-limit.test.ts`: checkRateLimit, getClientKey — 6 tests.
  - `withdraw.test.ts`: validacion (amount &lt;= 0, network no configurado, wallet no configurado) — 3 tests.
  - `game-move.test.ts`: chess.js (movimiento valido/invalido, turno, promocion, checkmate, stalemate) — 8 tests.
- **Tests de API** `web/__tests__/api/` (mocks de prisma/auth):
  - `auth.login.test.ts`: POST /api/auth/login (400 sin email/password, 401 user/wrong pass, 200 + cookie) — 5 tests.
  - `auth.register.test.ts`: POST /api/auth/register (validaciones email, password, avatar; 200 ok) — 6 tests.
  - `auth.reset-password.test.ts`: POST /api/auth/reset-password (token/password validacion, 200 ok) — 5 tests.
  - `account.balance.test.ts`: GET /api/account/balance (401 sin sesion, 404 user no existe, 200 con balance) — 3 tests.
- **Playwright E2E** en `web/`: `playwright.config.ts`, `e2e/smoke.spec.ts` (home carga, link register, login carga). Scripts `e2e`, `e2e:ui`. Ejecutar `npx playwright install` la primera vez para instalar Chromium.
- **Total:** 56 tests unitarios/API + 3 E2E. Pendiente opcional: tests de integracion con DB de test (ledger/withdraw completos), mas E2E (flujo deposito/jugar).

---

### 15. CI/CD Pipeline

No hay pipeline de integracion continua ni despliegue automatizado.

**Que hacer:**
1. Configurar GitHub Actions (o similar) con:
   - Lint + type-check en cada PR.
   - Tests automaticos.
   - Build de produccion.
   - Deploy automatico a staging/produccion.
2. Bloquear merges a `main` si los checks fallan.

---

## PRIORIDAD MEDIA

Items que mejoran la robustez y mantenibilidad pero pueden implementarse despues del lanzamiento inicial.

---

### 16. Docker / Containerizacion — DONE

No hay `Dockerfile` ni `docker-compose.yml`.

**Que hacer:**
1. Crear un `Dockerfile` multi-stage para el build de Next.js.
2. Crear un `docker-compose.yml` con: app Next.js, WS server, PostgreSQL, Redis.
3. Esto facilita el deploy en cualquier cloud (AWS ECS, GCP Cloud Run, DigitalOcean App Platform, etc.).

**Hecho:**
- **`web/Dockerfile`** multi-stage: etapa `builder` (npm ci, prisma generate, next build), etapa `runner` (solo deps de produccion, copia .next, prisma, public, ws-server). Imagen unica para app y ws (se cambia el comando en compose).
- **`web/.dockerignore`** para excluir node_modules, .env, tests, etc.
- **`docker-compose.yml`** en la raíz del repo: servicios `app` (Next en 3001), `ws` (WebSocket en 3002), `postgres` (PostgreSQL 16), `redis`. Variables de entorno por defecto para desarrollo local; secrets (SESSION_SECRET, etc.) se pueden pasar con `${VAR}` desde el host.
- **Primera vez:** tras `docker compose up -d`, ejecutar `docker compose run --rm app npx prisma db push` para crear las tablas en PostgreSQL.

---

### 17. Configuracion de CORS

No hay configuracion de CORS. En produccion, se deberia restringir que dominios pueden hacer requests a la API.

**Que hacer:**
1. Configurar CORS en `next.config.ts` o en un middleware para limitar origenes permitidos.
2. El WebSocket server tambien deberia validar el origen.

---

### 18. PM2 configurado para desarrollo — DONE

**Archivo:** `web/ecosystem.config.cjs`

```javascript
args: "dev -p 3001 -H 0.0.0.0",
env: { NODE_ENV: "development" },
```

**Que hacer:**
1. Crear un `ecosystem.production.config.cjs` con:
   - `args: "start -p 3001"` (en vez de `dev`)
   - `NODE_ENV: "production"`
   - `instances: "max"` o un numero fijo para cluster mode
   - `max_memory_restart: "500M"`

**Hecho:**
- Creado `web/ecosystem.production.config.cjs`: Next con `args: "start -p 3001 -H 0.0.0.0"`, `NODE_ENV: "production"`, `max_memory_restart: "500M"`, `instances: 1`. WS-server con los mismos env y límite de memoria, `instances: 1`. Para escalar Next en cluster haría falta un reverse proxy que reparta a varios puertos (un solo proceso por puerto).

---

### 19. Validacion de variables de entorno al iniciar — DONE

**Archivo:** `web/lib/config.ts`

Las variables de entorno no se validan al arrancar. Si falta una variable critica (ej. `DATABASE_URL`, `SESSION_SECRET`, `TREASURY_PRIVATE_KEY`), la app arranca y falla en runtime cuando se necesita.

**Que hacer:**
1. Crear un script de validacion que corra al inicio.
2. Usar una libreria como `zod` para validar el schema de env vars.
3. Ejemplo:
```typescript
import { z } from "zod";
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ADMIN_SECRET: z.string().min(16),
  MATCHMAKING_SECRET: z.string().min(16),
  TREASURY_PRIVATE_KEY: z.string().min(64),
  // ... etc
});
envSchema.parse(process.env);
```

**Hecho:**
- Creado `web/lib/env-schema.ts` con schema zod: `DATABASE_URL` (obligatorio salvo en test), `SESSION_SECRET` (min 32), `ADMIN_SECRET` (min 16), `MATCHMAKING_SECRET` (min 16), `TREASURY_PRIVATE_KEY` (opcional; si esta definida, min 64). En `NODE_ENV=test` se permite omitir `DATABASE_URL` (default placeholder).
- `web/lib/env.ts` importa `validateEnv()` de env-schema y usa el resultado para exportar los secretos; la validacion se ejecuta en el primer import (arranque de Next o de cualquier modulo que use auth/config), por lo que falla al inicio y no en runtime.
- Dependencia `zod` ya presente en el proyecto.

---

### 20. GDPR / Derechos del usuario sobre sus datos — DONE

No hay mecanismo para que un usuario:
- Exporte sus datos.
- Solicite eliminacion de su cuenta y datos.
- Vea que datos se almacenan sobre el.

**Que hacer:**
1. Agregar una seccion en "My account" para exportar datos (JSON con partidas, transacciones, perfil).
2. Agregar un boton de "Delete my account" que anonimice o elimine los datos.
3. Documentar en la Privacy Policy los derechos del usuario.

**Hecho:**
- En **My account** se añadio la seccion **Data and privacy** con: (1) **Export my data**: descarga un JSON con perfil, partidas (como blanco/negro), transacciones (ledger), reportes, desafios y notificaciones (endpoint `GET /api/account/export`). (2) **Delete my account**: boton que abre confirmacion; al confirmar se llama a `POST /api/account/delete`, que anonimiza al usuario (email a deleted-{id}@deleted.local, name/avatar null, password reemplazado) y borra la cookie de sesion. No se permite borrar si hay balance &gt; 0 (debe retirar antes).
- En la **Privacy Policy** (seccion 6) se documentan los derechos de acceso (export desde My account), correccion y supresion (delete account desde My account), y enlace a soporte.

---

## PRIORIDAD BAJA

Items que son nice-to-have y pueden implementarse gradualmente.

---

### 22. Metricas y dashboard de monitoreo — DONE

**Que hacer:**
1. Agregar metricas de negocio: partidas activas, volumen de apuestas, depositos/retiros por dia.
2. Usar un dashboard (Grafana, Vercel Analytics, o similar).
3. Monitorear latencia de la API y tiempos de respuesta.

**Hecho:**
- **Metricas de negocio:** En `/api/admin/stats` y en el dashboard de admin se añadieron **depositsTodayCents** y **withdrawalsTodayCents** (agregados del ledger por dia). El dashboard ya tenia partidas activas, volumen total, comision y juegos hoy/semana; ahora incluye Deposits today y Withdrawals today.
- **Endpoint para dashboards externos:** `GET /api/admin/metrics` devuelve JSON con las mismas metricas (ts, totalUsers, totalGames, gamesToday, gamesThisWeek, activeGames, totalVolumeCents, totalCommissionCents, depositsTodayCents, withdrawalsTodayCents, failedSettlementsCount). Requiere sesion admin. Sirve para Grafana (JSON datasource), scripts de cron que almacenen metricas, o Vercel Analytics si se exponen por otro canal.
- **Latencia:** El middleware añade el header **X-Response-Time** (en ms) a todas las respuestas, para poder medir tiempos desde logs o desde un reverse proxy. Para latencia de API completa (incl. handler) se puede usar Vercel Analytics o un APM.

---

### 23. Backup automatico de la base de datos

**Que hacer:**
1. Configurar backups automaticos diarios de PostgreSQL.
2. Testear la restauracion de backups periodicamente.
3. Almacenar backups en un servicio externo (S3, GCS).

---

### 24. CDN y optimizacion de assets

**Que hacer:**
1. Configurar un CDN (Cloudflare, Vercel Edge) para servir assets estaticos.
2. Optimizar imagenes con `next/image` (ya se usa parcialmente).
3. Configurar caching headers apropiados.

---

### 25. Documentacion tecnica

**Que hacer:**
1. Documentar la arquitectura del sistema (Next.js + WS server + Blockchain).
2. Documentar los flujos financieros (deposito → partida → settlement → retiro).
3. Documentar los endpoints de la API.
4. Crear un runbook para operaciones comunes (deploy, rollback, manejo de incidentes).

---

## LO QUE YA ESTA BIEN HECHO

Para dar contexto, estas cosas ya estan implementadas correctamente:

- **Ledger con transacciones atomicas**: `lib/ledger.ts` usa `prisma.$transaction` para operaciones financieras.
- **Idempotencia en depositos**: El modelo `ProcessedDepositEvent` previene doble-acreditacion con el indice unico `(chainId, txHash, logIndex)`.
- **Logging estructurado**: `lib/logger.ts` produce JSON con timestamp, level, y event.
- **Middleware de auth**: `middleware.ts` protege rutas `/cuenta`, `/partida`, `/jugar`, y `/admin/*`.
- **Validacion de inputs**: La mayoria de APIs validan tipos, campos requeridos, y formatos (email regex, password length, etc.).
- **Heartbeat en WebSocket**: El WS server hace ping-pong para detectar conexiones muertas.
- **Health endpoint**: El WS server expone `/health` para monitoreo basico.
- **Retry en operaciones on-chain**: `lib/index-deposits.ts` implementa retry con backoff para errores 503.
- **Comision de plataforma**: El 5% se retiene on-chain (treasury); la contabilidad se ve en el admin dashboard (Revenue).

---

*Documento generado el 31 de enero de 2026.*
*Ultima revision del codebase: FairMate v0 (pre-produccion).*
