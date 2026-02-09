# Roadmap MVP — Plataforma de Ajedrez con Stakes P2P (USDC)

Documento maestro del roadmap. Marca con `[x]` los ítems cumplidos para ir siguiendo el progreso.

---

## Fase 0 — Proyecto y entorno

- [x] Crear proyecto Next.js (App Router) en el repo
- [x] Configurar dependencias (React, Node, TypeScript)
- [ ] Configurar base de datos PostgreSQL (local o servicio)
- [x] Definir variables de entorno (.env.example, documentar)
- [x] Estructura de carpetas: `/app`, `/components`, `/lib`, `/api`, etc.

---

## Fase 1 — Sitio web (landing y estructura)

- [x] Rutas base: `/`, `/como-funciona`, `/entrar`, `/registro`, `/cuenta`, `/partida/[id]`, `/ranking`
- [x] Layout global: header con logo/nombre y navegación
- [x] Footer mínimo (enlaces, legal si aplica)
- [x] Página de inicio (landing): mensaje claro, CTAs "Registrarse" y "Entrar"
- [x] Página "Cómo funciona": explicación breve del flujo (stakes, 1v1, ELO, pago al ganador)
- [x] Estilos y diseño base (responsive, accesible)

---

## Fase 2 — Autenticación y usuarios

- [x] Modelo/schema de usuario en DB (email, password hash, nombre, etc.)
- [x] API: registro (validación, hash de contraseña)
- [x] API: login (verificación, sesión o JWT)
- [x] Páginas `/registro` y `/entrar` con formularios
- [x] Protección de rutas: solo usuarios autenticados en `/cuenta`, `/partida`, etc.
- [x] Página "Mi cuenta" básica (datos de usuario, enlace a partidas/historial)

---

## Fase 3 — Ajedrez: tablero y reglas

- [x] Integrar librería de ajedrez en cliente (p. ej. `chess.js`)
- [x] Componente de tablero visual (p. ej. `react-chessboard` o similar)
- [x] Ruta `/partida/[id]`: cargar partida por ID
- [x] Backend: modelo/schema de partida (jugadores, FEN, turno, resultado, stake)
- [x] API: crear partida (dos jugadores, stake elegido)
- [x] API: validar jugada en servidor (chess.js o Stockfish) — servidor como fuente de verdad
- [x] Flujo: turnos, actualizar FEN, detectar fin de partida (mate, tablas, etc.)

---

## Fase 4 — Tiempo real (WebSockets)

- [x] Servidor WebSocket (mismo repo, proceso separado o servicio)
- [x] Eventos: jugada enviada, partida actualizada, fin de partida
- [x] Cliente: conectar a WebSocket al entrar en `/partida/[id]`
- [x] Sincronizar tablero en tiempo real entre ambos jugadores
- [x] Manejo de desconexión/reconexión básico

---

## Fase 5 — Matchmaking y stakes

- [x] Modelo de "cola" o sesión de matchmaking (stake elegido: $1 / $5 / $10)
- [x] API o WebSocket: unirse a cola por stake
- [x] Lógica: emparejar dos jugadores con mismo stake (y opcionalmente ELO similar)
- [x] Crear partida automáticamente al emparejar y redirigir a `/partida/[id]`
- [x] UI: botón "Jugar por $1 / $5 / $10" y estado "Buscando rival..."

---

## Fase 6 — Ledger interno y ELO

- [x] Modelo/schema: balance por usuario (simulado USDC o testnet)
- [x] Ledger de movimientos: depósitos, apuestas, pagos al ganador (auditable)
- [x] Al crear partida: descontar stake a cada jugador (validar saldo)
- [x] Al terminar partida: acreditar bote al ganador; actualizar ELO de ambos
- [x] Cálculo ELO (fórmula estándar) y persistir en usuario
- [x] Página `/ranking` o sección en inicio: leaderboard por ELO
- [x] En "Mi cuenta": mostrar saldo y historial de partidas

---

## Fase 7 — Seguridad y robustez

- [x] Contraseñas: hash fuerte (bcrypt/argon2), nunca en logs
- [x] Validación en servidor de todas las acciones (no confiar en cliente)
- [x] Rate limiting en APIs sensibles (login, registro, unirse a cola)
- [x] Logs de eventos críticos (login, creación de partida, resultado, cambios de saldo)
- [x] Manejo de errores y mensajes claros al usuario

---

## Fase 8 — Admin y validación

- [ ] Panel admin mínimo (ruta protegida, p. ej. `/admin`)
- [ ] Listado de partidas recientes y estado
- [ ] Listado de usuarios (básico) y actividad
- [ ] Métricas básicas: partidas por día, retención (si hay datos)
- [ ] Documentar cómo desplegar (entorno, DB, WebSocket) para pruebas reales

---

## Criterios de éxito (MVP)

- [ ] 20–50 jugadores pueden registrarse y jugar partidas 1v1 por stake
- [ ] Stakes fijos $1 / $5 / $10 funcionan con ledger interno
- [ ] Emparejamiento por stake (y opcional ELO) operativo
- [ ] Liquidación automática al ganador sin conflictos
- [ ] Ranking ELO visible y actualizado
- [ ] Sitio web estable y usable en entorno de validación

---

## Fuera de alcance (no hacer en MVP)

- Torneos
- Múltiples modos de juego
- App móvil nativa
- Tokens propios
- Funciones sociales (chat, amigos, etc.)
- IA anti-cheat avanzada
- Análisis post-partida detallado
- Marketing
- USDC mainnet real (opcional: dejar listo para testnet/mainnet en fase posterior)

---

*Última actualización: enero 2025. Ir tachando ítems según se completen.*
