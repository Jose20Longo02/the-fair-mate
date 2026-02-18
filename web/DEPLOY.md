# Deployment guide (Stakes Chess MVP)

Steps to deploy the app for real-world testing.

## 1. Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. Neon, Supabase, Railway). For local SQLite you can use `file:./dev.db` and Prisma SQLite config. |
| `SESSION_SECRET` | Long random string for signing user JWTs. Generate with `openssl rand -base64 32`. |
| `ADMIN_SECRET` | Secret to log in at `/admin`. Keep private. |
| `NEXT_PUBLIC_WS_URL` | Public WebSocket URL (e.g. `wss://ws.yourdomain.com`). |
| `WS_SERVER_URL` | Same server’s URL for internal health/status if needed. |
| `MATCHMAKING_SECRET` | Shared secret between Next.js API and WebSocket server for create-from-match. |

In production, use strong random values and never commit `.env`.

## 2. Database

- **PostgreSQL (recommended for production):** Create a DB, set `DATABASE_URL`, then:
  ```bash
  npx prisma migrate deploy
  # or first: npx prisma migrate dev  # then use deploy on server
  ```
- **SQLite (dev only):** Ensure schema is in sync:
  ```bash
  npx prisma db push
  ```
- Regenerate client after schema changes:
  ```bash
  npx prisma generate
  ```

## 3. Build and run Next.js

```bash
npm run build
npm run start
```

Default port is 3001. Set `PORT` if your host expects another port.

## 4. WebSocket server

The matchmaking and real-time game updates use a separate WebSocket server.

- Run it on the same machine or a separate instance that can call your Next.js API (e.g. `NEXT_API_URL` or default `http://localhost:3001`).
- Start: `npm run dev:ws` (dev) or run `node ws-server/server.js` with the same env (e.g. `NEXT_API_URL`, `MATCHMAKING_SECRET`).
- Expose it via a reverse proxy (e.g. Nginx/WebSocket upgrade) and set `NEXT_PUBLIC_WS_URL` to that public URL so the browser connects to it.

## 5. Admin panel

- URL: `/admin` (redirects to `/admin/login` if not logged in).
- Log in with the value of `ADMIN_SECRET`.
- Use a strong, unique `ADMIN_SECRET` in production.

## 6. Optional: cron for timeouts

If you use a cron to forfeit on disconnect/timeout, point it to your deployed API, e.g.:

`GET/POST https://yourdomain.com/api/cron/check-timeouts`

(Implement auth or IP allowlist if the route is public.) Use header `X-Matchmaking-Secret: <MATCHMAKING_SECRET>`.

## 6.1. Real money (USDC) — deposits and withdrawals

- **Deploy deposit contract (Polygon):** Set `POLYGON_RPC_URL`, `TREASURY_ADDRESS`, `TREASURY_PRIVATE_KEY`, then:
  ```bash
  npm run deploy:deposit
  ```
  Add the printed address to `.env` as `POLYGON_DEPOSIT_CONTRACT_ADDRESS`. Optionally set `POLYGON_USDC_ADDRESS` (default: native USDC on Polygon).
- **Index deposits:** A **Vercel Cron** runs every 2 minutes and calls `/api/cron/index-deposits` (see `vercel.json`). In the Vercel project, set env var **`CRON_SECRET`** to the same value as `MATCHMAKING_SECRET` so the cron request is authenticated. If you don’t use Vercel, call the endpoint yourself every 1–2 min with header `X-Matchmaking-Secret: <MATCHMAKING_SECRET>`.
- **Withdrawals:** Users withdraw from the account page. Ensure the treasury holds enough USDC on the chosen network (Polygon/Base). Set `BASE_RPC_URL`, `BASE_USDC_ADDRESS`, `BASE_DEPOSIT_CONTRACT_ADDRESS` if you enable Base.

### Estabilidad de direcciones de depósito (evitar que el job no acredite)

El indexador acredita depósitos cuando la transferencia USDC va a la **dirección derivada** de `DEPOSIT_MASTER_SECRET` + `userId`. Para que el job funcione sin tener que acreditar manualmente:

1. **No cambies `DEPOSIT_MASTER_SECRET`** una vez que hayas mostrado direcciones de depósito a usuarios. Si lo cambias, la dirección que derivamos para cada usuario será otra y las transferencias a la dirección antigua no se reconocerán (`processed: 0`).
2. **No reemplaces usuarios** (borrar y crear de nuevo con el mismo “nombre”): el `userId` (cuid) es lo que determina la dirección; un usuario nuevo tiene otro id y otra dirección.
3. Si en el pasado cambiaste el secret o recreaste usuarios, los depósitos ya enviados a la dirección vieja se pueden acreditar una sola vez con el endpoint manual: `POST /api/cron/credit-deposit-by-tx` con `txHash`, `chainId` y `userName` o `userId` (ver cabecera del archivo de la ruta).

## 7. Checklist

- [ ] `DATABASE_URL` set and migrations applied
- [ ] `SESSION_SECRET` and `ADMIN_SECRET` set to random values
- [ ] `NEXT_PUBLIC_WS_URL` points to the WebSocket server
- [ ] WebSocket server running and able to call Next.js API
- [ ] `MATCHMAKING_SECRET` same in Next.js and WS server
- [ ] HTTPS in production; secure cookies will be used automatically when `NODE_ENV=production`
- [ ] (USDC) Deposit contract deployed; `POLYGON_DEPOSIT_CONTRACT_ADDRESS` set; cron hitting `/api/cron/index-deposits`
- [ ] (USDC) `DEPOSIT_MASTER_SECRET` fijado y no cambiado una vez en uso (evita que el indexador no reconozca depósitos)
