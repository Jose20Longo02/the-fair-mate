# Stakes Chess — MVP

Plataforma web de ajedrez 1v1 con stakes en USDC. Ver [ROADMAP_MVP.md](./ROADMAP_MVP.md) para el plan completo.

## Cómo ejecutar el sitio web

La aplicación Next.js está en la carpeta `web/`.

### 1. Base de datos (PostgreSQL)

Necesitas PostgreSQL y una URL de conexión. Crea un archivo `web/.env` (puedes copiar `web/.env.example`):

```env
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/chess_mvp
SESSION_SECRET=un-secreto-largo-y-aleatorio
```

Crea la base y las tablas:

```bash
cd web
npm run db:push
```

(O bien `npm run db:migrate` si prefieres migraciones.)

### 2. Arrancar la app

```bash
cd web
npm install   # si aún no lo has hecho
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001) en el navegador.

### 3. Tiempo real (Fase 4)

Para que el tablero se actualice en vivo sin refrescar, arranca el servidor WebSocket en **otra terminal**:

```bash
cd web
npm run dev:ws
```

Deja esa terminal abierta. El WS escucha en el puerto 3002. Añade a tu `.env` (opcional, esos son los valores por defecto):

```env
NEXT_PUBLIC_WS_URL=ws://localhost:3002
WS_SERVER_URL=http://localhost:3002
```

## Estructura

- `web/` — Aplicación Next.js (frontend + API)
- `ROADMAP_MVP.md` — Roadmap del MVP con checkboxes para ir tachando pasos
- `Plataforma_Ajedrez_Stakes_P2P_MVP_USDC.pdf` — Especificación del producto

## Rutas actuales

| Ruta | Descripción |
|------|-------------|
| `/` | Landing |
| `/como-funciona` | Explicación del flujo |
| `/entrar` | Login (formulario en Fase 2) |
| `/registro` | Registro (formulario en Fase 2) |
| `/cuenta` | Mi cuenta (protegido en Fase 2) |
| `/ranking` | Leaderboard ELO (Fase 6) |
| `/partida/[id]` | Partida en vivo (Fase 3–4) |
