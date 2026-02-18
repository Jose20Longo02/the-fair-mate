# Docker

## Levantar todo (app + WS + PostgreSQL + Redis)

Desde la **raíz del repo** (donde está `docker-compose.yml`):

```bash
docker compose up -d
```

- **App Next.js:** http://localhost:3001  
- **WebSocket:** ws://localhost:3002  
- **PostgreSQL:** localhost:5432 (usuario `chess`, contraseña `chess_secret`, base `chess`)  
- **Redis:** localhost:6379  

## Primera vez: crear tablas en la base

Después del primer `up`:

```bash
docker compose run --rm app npx prisma db push
```

## Variables de entorno

Por defecto el compose usa valores de desarrollo. Para producción, define en tu `.env` (en la raíz o en `web/`) o pásalas al levantar:

- `SESSION_SECRET`
- `ADMIN_SECRET`
- `MATCHMAKING_SECRET`

Ejemplo:

```bash
SESSION_SECRET=tu-secreto docker compose up -d
```

## Solo build / rebuild

```bash
docker compose build
docker compose up -d --build
```

## Parar y borrar volúmenes

```bash
docker compose down
docker compose down -v   # borra datos de Postgres y Redis
```
