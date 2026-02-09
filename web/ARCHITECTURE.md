# Architecture & Conventions

This document describes how the codebase is organized and the conventions used, so that debugging and changes (especially around stakes and money) stay predictable and auditable.

---

## 1. Project structure

```
web/
├── app/
│   ├── api/              # API routes (Next.js App Router)
│   │   ├── account/       # User account (deposit, reports)
│   │   ├── admin/         # Admin panel (auth, users, games, reports)
│   │   ├── auth/          # Login, register, logout, session
│   │   ├── challenges/    # Direct challenges (list, create, respond, reject)
│   │   ├── cron/          # Internal cron (e.g. check-timeouts)
│   │   ├── games/         # Games CRUD, move, resign, draw, chat, disconnect-forfeit
│   │   └── notifications/ # Notifications list and mark read
│   ├── admin/             # Admin UI pages
│   ├── cuenta/            # User account pages
│   ├── jugar/             # Play (matchmaking + challenges)
│   ├── partida/           # Game page
│   └── ...
├── components/            # React components (Header, ChessBoard, etc.)
├── lib/                   # Shared logic (auth, ledger, config, API helpers)
├── prisma/                # Schema and migrations
└── ws-server/             # WebSocket server (real-time game + matchmaking)
```

---

## 2. Configuration and constants

- **`lib/config.ts`**  
  Single place for environment and business constants:
  - `WS_SERVER_URL`, `MATCHMAKING_SECRET` (server-to-server and WS)
  - `STAKE_CENTS_MIN`, `STAKE_CENTS_MAX` (stake limits for games/challenges)
  - `DEPOSIT_CENTS` (simulated deposit amount)
  - `RATE_*` and `RATE_WINDOW_MS` (rate limit constants)

Use these instead of `process.env.*` or magic numbers in routes. Changing limits or URLs happens in one file.

---

## 3. API responses

- **`lib/api-response.ts`**  
  Helpers for consistent responses:
  - **Errors:** `apiError(message, status)`, `unauthorized()`, `forbidden()`, `notFound()`, `tooManyRequests(message, retryAfter?)`
  - **Success:** `apiSuccess(data, status?)`

All error responses use body `{ error: string }`. Use these helpers in new routes so clients and logs see a uniform shape.

---

## 4. Authentication

- **`lib/auth.ts`**  
  Session via JWT in cookie: `getSession()`, `createSession()`, `getCookieName()`.
- **`lib/auth-middleware.ts`**  
  `hasValidSession(cookieHeader)` for middleware or non-Next contexts.

Protected API routes should call `await getSession()` first and return `unauthorized()` when missing.

---

## 5. Money and stakes (ledger)

- **`lib/ledger.ts`**  
  All balance and ledger operations:
  - `getUserBalance(userId)`, `updateUserBalance(userId, delta)`, `addLedgerEntry(...)`
  - `deductStakesForGame(player1Id, player2Id, stake, gameId)` — used when a game starts
  - `settleGame(gameId, winnerId, loserId, stake)` — used when a game ends (win/loss or draw/refund)

Stake and payout logic lives only here and in routes that call it. Do not update `User.balance` or create `LedgerEntry` outside this module.

---

## 6. WebSocket and real-time

- **`lib/ws-notify.ts`**  
  All outbound calls to the WS server:
  - `notifyChallengeUpdated(userId)` — challenge list changed
  - `notifyNotificationNew(userId, payload)` — new in-app notification
  - `broadcastGameUpdate({ gameId, game?, gameOver?, type?, ... })` — broadcast to game room (move, resign, draw, chat, timeout, disconnect-forfeit)
  - `isUserOnline(userId)`, `notifyChallengeAccepted(userId, gameId)` — used by challenge flow

Use these instead of calling `fetch(process.env.WS_SERVER_URL/...)` or duplicating WS URLs/secrets in routes.

---

## 7. Logging

- **`lib/logger.ts`**  
  Structured logger: `logger.info(event, data?)`, `logger.warn(...)`, `logger.error(...)`.

Use it for:
- Game lifecycle (game created, game ended, reason, stake)
- Auth (login, register)
- Deposit and any other balance-changing action
- Errors in try/catch (with `error: String(e)`)

Do not log passwords, tokens, or full session objects.

---

## 8. API route patterns

1. **Auth:** `const session = await getSession(); if (!session) return unauthorized();`
2. **Body:** Parse JSON in try/catch; on failure return `apiError("Invalid JSON", 400)`.
3. **Validation:** Check required fields and business rules; return `apiError(...)` or `notFound()`/`forbidden()` as appropriate.
4. **Stake/money:** Use `lib/ledger` and `lib/config` constants; do not hardcode amounts.
5. **Errors:** Wrap main logic in try/catch; on throw log with `logger.error` and return `apiError("...", 500)`.
6. **WS:** Use `broadcastGameUpdate` / other helpers from `lib/ws-notify`; do not inline `fetch(WS_SERVER_URL/...)` for broadcast or notify.

---

## 9. Database (Prisma)

- **`lib/prisma.ts`**  
  Single Prisma client instance.

Schema lives in `prisma/schema.prisma`. After editing schema run `npx prisma generate` (and migrations if applicable). All money and game state go through Prisma; no raw SQL unless necessary and documented.

---

## 10. Security and stakes

- **Server-to-server:** Endpoints used by the WS server (e.g. create-from-match, disconnect-forfeit, check-timeouts) must check `X-Matchmaking-Secret` against `MATCHMAKING_SECRET` from config.
- **Stakes:** Validate stake range with `STAKE_CENTS_MIN`/`STAKE_CENTS_MAX`; check both players’ balances before creating a game or accepting a challenge.
- **Idempotency:** Game creation and stake deduction are critical; avoid double-creating games or double-settling. Use transactions in `ledger.ts` where appropriate.

---

## 11. Finding and fixing issues

- **“Wrong balance or missing ledger entry”** → Check `lib/ledger.ts` and every caller (game create, resign, draw, timeout, disconnect-forfeit, deposit).
- **“WS not updating UI”** → Check `lib/ws-notify.ts` and that the route calls `broadcastGameUpdate` or the right notify helper with correct payload.
- **“Unauthorized or 401/403”** → Check `getSession()` and `api-response` helpers; confirm admin routes use admin auth where needed.
- **“Rate limit or 429”** → Check `lib/rate-limit.ts` and use of `lib/config` rate constants in the route.

Keeping config, ledger, WS, and API responses in the designated modules makes it easier to trace and fix bugs in a stakes-focused app.
