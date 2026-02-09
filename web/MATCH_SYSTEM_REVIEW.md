# Revisión del sistema de match (1v1)

Última revisión: flujo de matchmaking, partida, desconexión y fin de partida.

---

## 1. Matchmaking (cola y emparejamiento)

| Escenario | Comportamiento |
|-----------|----------------|
| Dos usuarios distintos entran a la cola con el mismo stake ($1, $5 o $10) | WS hace `tryMatch(stake)`, crea partida vía `POST /api/games/create-from-match`, envía `{ type: "matched", gameId }` a ambos; ambos hacen `router.push(/partida/[gameId])`. |
| Mismo usuario en dos pestañas (mismo stake) | WS detecta `a.userId === b.userId`, no crea partida, devuelve a la cola a ambos y envía `matchError`: "Use two different accounts to play. Open an incognito window or another browser." |
| Usuario cancela búsqueda (Cancel) | Cliente cierra el WS; en el servidor `ws.on("close")` quita al usuario de la cola (`matchQueue`). |
| Usuario cierra la pestaña mientras busca | WS se cierra; el servidor quita al usuario de la cola. |
| Más de 5 intentos de cola en 1 minuto | `canJoinQueue` devuelve false; el servidor envía `matchError`: "Too many queue attempts. Wait a minute." |
| Stake inválido (no 100, 500, 1000) | El servidor ignora el mensaje `joinQueue`. |
| create-from-match falla (ej. saldo insuficiente tras validación) | WS captura el error y envía `matchError` a ambos con el mensaje; no se crea partida (la API devuelve 400 antes de crear el juego). |

**Nota:** La API create-from-match valida saldo antes de crear el juego; si `deductStakesForGame` fallara después de crear el juego, quedaría una partida creada sin stakes descontados (caso raro; mejora futura: transacción única o rollback).

---

## 2. Entrada a la partida (game room)

| Escenario | Comportamiento |
|-----------|----------------|
| Jugador abre `/partida/[id]` | Página requiere sesión; hace `GET /api/games/[id]`; si OK, monta ChessBoard que conecta WS con `?gameId=...` y envía `joinGame` con `userId`, `whiteId`, `blackId`. |
| Primer jugador entra a la sala | Servidor tiene `room.connections.size === 1`, `whiteId` y `blackId`; arranca **timer no-show** de 1 minuto para el jugador que falta. |
| Segundo jugador entra antes de 1 min | Al recibir su `joinGame`, `connections.size === 2`; se cancela el timer no-show; se hace broadcast de presence (ambos conectados). |
| Segundo jugador **no** entra en 1 min (no-show) | El timer no-show llama a `POST /api/games/[id]/disconnect-forfeit` con el `disconnectedUserId` del que nunca envió `joinGame`; ese jugador pierde, el que sí entró gana; se hace broadcast de `gameUpdate` + `gameOver`. |

---

## 3. Durante la partida

| Escenario | Comportamiento |
|-----------|----------------|
| Movimiento válido | Cliente hace `POST /api/games/[id]/move` con `from`, `to`, `promotion`; API valida turno, tiempo y movimiento; actualiza partida; hace `broadcastGameUpdate`; cliente recibe `gameUpdate` por WS y/o usa la respuesta del POST. |
| No es tu turno | API devuelve 403 "Not your turn". |
| Reloj en 0 (timeout de tiempo) | Lo puede detectar el move (si el movimiento llega con tiempo agotado) o el cron `GET /api/cron/check-timeouts` cada 5 s; partida pasa a `timeout`, el que se quedó sin tiempo pierde; `broadcastGameUpdate` con `gameOver`. |
| Resign | Cliente llama `POST /api/games/[id]/resign`; partida `resigned`, el otro gana; broadcast; modal muestra "You resigned" (no "Disconnected"). |
| Oferta de tablas / aceptar o rechazar | APIs `offer-draw` y `respond-draw`; si aceptan, partida `draw`, stakes devueltos, ELO actualizado; broadcast. |
| Chat | Cliente envía por WS `{ type: "chatMessage", userId, userName, text }`; servidor hace broadcast a la sala; el otro cliente escucha `game-chat-message-${gameId}` y muestra mensajes. |

---

## 4. Desconexión y reconexión

| Escenario | Comportamiento |
|-----------|----------------|
| Un jugador cierra la pestaña o pierde conexión | El WS del servidor puede recibir `close`; si no, el **heartbeat** (ping cada 5 s, sin pong → `ws.terminate()`) hace que en ~5–10 s se dispare `close`. En `close` se quita al usuario de `room.connections`, se llama `startDisconnectTimer(1 min)` y se hace broadcast de **presence** (uno conectado, otro no; `disconnectStartedAt`). |
| El otro jugador ve estado | ChessBoard recibe `presence`; muestra "Conectado" / "Desconectado (X s para reconectar)" por jugador; banner "Opponent disconnected" con cuenta atrás; cada 2 s el servidor reenvía presence si hay timer de desconexión activo. |
| El desconectado vuelve en &lt; 1 min | Abre de nuevo `/partida/[id]`; nuevo WS, envía `joinGame`; servidor hace `clearDisconnectTimer` y broadcast de presence (ambos conectados); el otro deja de ver "Desconectado" y el banner. |
| El desconectado no vuelve en 1 min | El timer del servidor llama `POST /api/games/[id]/disconnect-forfeit` con su `userId`; partida `disconnected`, el otro gana; broadcast `gameUpdate` + `gameOver`; modal "Disconnected" para el que se quedó. |

---

## 5. Fin de partida (resumen)

| Resultado | status | Quién gana | UI (modal / summary) |
|-----------|--------|------------|------------------------|
| Checkmate | `checkmate` | El que da mate | "Game over" / resumen |
| Stalemate / draw | `stalemate` / `draw` | Nadie | "Draw" / resumen |
| Resign | `resigned` | El otro | "You resigned" (quien se rinde) / "Victory" (el otro) |
| Timeout (reloj) | `timeout` | El otro | "Out of time" / resumen |
| Disconnect (1 min sin reconectar) | `disconnected` | El que se quedó | "Disconnected" / resumen |
| No-show (no entra a la partida en 1 min) | `disconnected` | El que sí entró | Igual que disconnect |

Todos los fines de partida que tocan balance y ELO usan `settleGame` (comisión 5%) y actualizan `whiteEloBefore/After`, `blackEloBefore/After`, `whiteBalanceBeforeCents`, `blackBalanceBeforeCents` donde aplica; y hacen `broadcastGameUpdate` para que ambos clientes actualicen modal, resumen y header (router.refresh).

---

## 6. Componentes y rutas clave

- **Matchmaking UI:** `Home1v1Card` (home) y `MatchmakingPanel` (jugar): WS sin `gameId`, envían `joinQueue`; escuchan `matched` → `router.push(/partida/[gameId])` y `matchError` → mensaje.
- **Partida:** `app/partida/[id]/page.tsx` + `ChessBoard`: WS con `?gameId=...`, envían `joinGame`; escuchan `gameUpdate`, `presence`, `chatMessage`; movimientos vía `POST /api/games/[id]/move`.
- **WS server:** `ws-server/server.js`: cola por stake, `tryMatch`, heartbeat, salas por `gameId`, presence, disconnect timer (1 min), **no-show timer** (1 min), re-broadcast de presence cada 2 s cuando hay disconnect activo.
- **APIs:** create-from-match, move, resign, offer-draw, respond-draw, disconnect-forfeit; cron check-timeouts. Todas las que terminan partida hacen `broadcastGameUpdate`.

Con esta revisión, los escenarios de match, entrada a partida, desconexión, reconexión, no-show y fin de partida quedan cubiertos de forma coherente.
