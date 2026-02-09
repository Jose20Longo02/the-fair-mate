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

(Implement auth or IP allowlist if the route is public.)

## 7. Checklist

- [ ] `DATABASE_URL` set and migrations applied
- [ ] `SESSION_SECRET` and `ADMIN_SECRET` set to random values
- [ ] `NEXT_PUBLIC_WS_URL` points to the WebSocket server
- [ ] WebSocket server running and able to call Next.js API
- [ ] `MATCHMAKING_SECRET` same in Next.js and WS server
- [ ] HTTPS in production; secure cookies will be used automatically when `NODE_ENV=production`
