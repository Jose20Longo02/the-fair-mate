/**
 * Servidor WebSocket: partidas en tiempo real + matchmaking.
 * - Conexión con ?gameId=xxx → sala de partida (broadcast).
 * - Conexión sin gameId → matchmaking (joinQueue, matched).
 */

try {
  require("dotenv").config({ path: require("path").resolve(process.cwd(), ".env") });
} catch (_) {}

const http = require("http");
const { WebSocketServer } = require("ws");

const WS_PORT = parseInt(process.env.WS_PORT || "3002", 10);
const NEXT_API_URL = process.env.NEXT_API_URL || "http://localhost:3001";
const MATCHMAKING_SECRET = process.env.MATCHMAKING_SECRET || "dev-matchmaking-secret";

const DISCONNECT_FORFEIT_MS = 1 * 60 * 1000; // 1 minute to reconnect or forfeit
const DISCONNECT_FORFEIT_1001_MS = 90 * 1000; // 90s when code 1001 (browser suspend / tab background)
const NOSHOW_FORFEIT_MS = 1 * 60 * 1000; // 1 minute for opponent to join game page or they forfeit
const HEARTBEAT_INTERVAL_MS = 5000; // ping game room sockets every 5s to detect closed tabs
const ELO_MARGIN = 200; // only match players within ± this ELO

// gameId -> { whiteId, blackId, sockets, connections, disconnectTimers, disconnectStartedAt, noShowTimer }
const rooms = new Map();
// stake (cents) -> [{ userId, ws, elo }]
const matchQueue = new Map();
// userId -> ws (presencia en /jugar para retos; permite notificar "challengeAccepted")
const presence = new Map();

// Rate limit: joinQueue by userId (5 per min)
const joinQueueLimit = new Map(); // userId -> { count, resetAt }
function canJoinQueue(userId) {
  const now = Date.now();
  const window = 60_000;
  let entry = joinQueueLimit.get(userId);
  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + window };
    joinQueueLimit.set(userId, entry);
    return true;
  }
  entry.count++;
  return entry.count <= 5;
}

function getGameIdFromUrl(url) {
  try {
    const u = new URL(url, "http://localhost");
    return u.searchParams.get("gameId") || null;
  } catch {
    return null;
  }
}

function getTokenFromUrl(url) {
  try {
    const u = new URL(url, "http://localhost");
    return u.searchParams.get("token") || null;
  } catch {
    return null;
  }
}

/** Verify WS token via Next API; returns { userId } or null. */
async function verifyToken(token) {
  try {
    const res = await fetch(`${NEXT_API_URL}/api/internal/verify-ws-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Matchmaking-Secret": MATCHMAKING_SECRET,
      },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.userId ? { userId: data.userId } : null;
  } catch (err) {
    console.error("[WS] verify-ws-token error:", err);
    return null;
  }
}

function broadcastToRoom(gameId, payload) {
  const room = rooms.get(gameId);
  if (!room || !room.sockets) return;
  const data = JSON.stringify(payload);
  for (const ws of room.sockets) {
    if (ws.readyState === 1) ws.send(data);
  }
}

/** Like broadcastToRoom but skip one socket (e.g. sender for chatMessage). */
function broadcastToRoomExcept(gameId, excludeWs, payload) {
  const room = rooms.get(gameId);
  if (!room || !room.sockets) return;
  const data = JSON.stringify(payload);
  for (const ws of room.sockets) {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(data);
  }
}

function getPresencePayload(room) {
  const whiteConnected = room.connections.has(room.whiteId);
  const blackConnected = room.connections.has(room.blackId);
  const disconnectStartedAt = { ...(room.disconnectStartedAt || {}) };
  if (whiteConnected) delete disconnectStartedAt.white;
  if (blackConnected) delete disconnectStartedAt.black;
  return {
    type: "presence",
    whiteConnected,
    blackConnected,
    disconnectStartedAt,
  };
}

function clearDisconnectTimer(room, userId) {
  const t = room.disconnectTimers.get(userId);
  if (t) {
    clearTimeout(t);
    room.disconnectTimers.delete(userId);
  }
  if (room.disconnectStartedAt) {
    if (userId === room.whiteId) delete room.disconnectStartedAt.white;
    if (userId === room.blackId) delete room.disconnectStartedAt.black;
  }
}

function clearNoShowTimer(room) {
  if (room.noShowTimer) {
    clearTimeout(room.noShowTimer);
    room.noShowTimer = null;
  }
}

function startDisconnectTimer(gameId, userId, room, closeCode) {
  clearDisconnectTimer(room, userId);
  clearNoShowTimer(room);
  const key = userId === room.whiteId ? "white" : "black";
  room.disconnectStartedAt = room.disconnectStartedAt || {};
  room.disconnectStartedAt[key] = Date.now();

  const ms = closeCode === 1001 ? DISCONNECT_FORFEIT_1001_MS : DISCONNECT_FORFEIT_MS;
  const timeout = setTimeout(async () => {
    room.disconnectTimers.delete(userId);
    if (room.disconnectStartedAt) delete room.disconnectStartedAt[key];
    if (room.connections.has(userId)) {
      console.log("[WS] disconnect timer fired but user reconnected — skipping forfeit", { gameId, userId });
      try {
        await fetch(`${NEXT_API_URL}/api/games/${gameId}/clear-disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Matchmaking-Secret": MATCHMAKING_SECRET,
          },
          body: JSON.stringify({ userId }),
        });
      } catch (e) {
        console.error("[WS] clear-disconnect (timer skip) error:", e);
      }
      return;
    }
    const lastClose = room._lastClose || {};
    console.log("[WS] APPLYING DISCONNECT FORFEIT — user did not reconnect in 60s", {
      gameId,
      disconnectedUserId: userId,
      closeCode: lastClose.code,
      closeReason: lastClose.reason,
    });
    const otherUserId = userId === room.whiteId ? room.blackId : room.whiteId;
    const otherKey = otherUserId === room.whiteId ? "white" : "black";
    const otherDisconnectStarted = room.disconnectStartedAt && room.disconnectStartedAt[otherKey];
    const bothDisconnectedOver1Min =
      otherUserId &&
      !room.connections.has(otherUserId) &&
      otherDisconnectStarted &&
      Date.now() - otherDisconnectStarted >= DISCONNECT_FORFEIT_MS;
    if (bothDisconnectedOver1Min) {
      clearDisconnectTimer(room, otherUserId);
      try {
        const res = await fetch(`${NEXT_API_URL}/api/games/${gameId}/disconnect-forfeit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Matchmaking-Secret": MATCHMAKING_SECRET,
          },
          body: JSON.stringify({ drawBecauseBothDisconnected: true }),
        });
        if (!res.ok) console.error("[WS] disconnect-forfeit draw API error:", res.status, await res.text());
      } catch (e) {
        console.error("[WS] disconnect-forfeit draw error:", e);
      }
    } else {
      try {
        const res = await fetch(`${NEXT_API_URL}/api/games/${gameId}/disconnect-forfeit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Matchmaking-Secret": MATCHMAKING_SECRET,
          },
          body: JSON.stringify({ disconnectedUserId: userId }),
        });
        if (!res.ok) console.error("[WS] disconnect-forfeit API error:", res.status, await res.text());
      } catch (e) {
        console.error("[WS] disconnect-forfeit error:", e);
      }
    }
    if (room.sockets.size === 0) rooms.delete(gameId);
  }, ms);

  room.disconnectTimers.set(userId, timeout);
}

function startNoShowTimer(gameId, room) {
  clearNoShowTimer(room);
  if (!room.whiteId || !room.blackId || room.connections.size !== 1) return;
  const missingUserId = room.connections.has(room.whiteId) ? room.blackId : room.whiteId;
  room.noShowTimer = setTimeout(async () => {
    room.noShowTimer = null;
    if (room.connections.size !== 1) return;
    try {
      await fetch(`${NEXT_API_URL}/api/games/${gameId}/disconnect-forfeit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Matchmaking-Secret": MATCHMAKING_SECRET,
        },
        body: JSON.stringify({ disconnectedUserId: missingUserId }),
      });
    } catch (e) {
      console.error("[WS] no-show forfeit error:", e);
    }
  }, NOSHOW_FORFEIT_MS);
}

async function createGameFromMatch(player1Id, player2Id, stake) {
  const res = await fetch(`${NEXT_API_URL}/api/games/create-from-match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Matchmaking-Secret": MATCHMAKING_SECRET,
    },
    body: JSON.stringify({ player1Id, player2Id, stake }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Create game failed");
  return data.game;
}

async function fetchUserElo(userId) {
  try {
    const res = await fetch(`${NEXT_API_URL}/api/internal/user/${encodeURIComponent(userId)}/elo`, {
      headers: { "X-Matchmaking-Secret": MATCHMAKING_SECRET },
    });
    const data = await res.json();
    if (!res.ok) return null;
    return typeof data.elo === "number" ? data.elo : null;
  } catch (err) {
    console.error("[WS] fetchUserElo error:", err);
    return null;
  }
}

function tryMatch(stake) {
  const queue = matchQueue.get(stake);
  if (!queue || queue.length < 2) return;

  // Find two players within ELO margin (±ELO_MARGIN); prefer first valid pair
  let aIndex = -1;
  let bIndex = -1;
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      if (queue[i].userId === queue[j].userId) continue;
      const diff = Math.abs((queue[i].elo ?? 1200) - (queue[j].elo ?? 1200));
      if (diff <= ELO_MARGIN) {
        aIndex = i;
        bIndex = j;
        break;
      }
    }
    if (aIndex >= 0) break;
  }

  if (aIndex < 0 || bIndex < 0) {
    console.log("[WS] tryMatch: no compatible pair for stake", stake, "queue size", queue.length, "entries:", queue.map((e) => ({ id: e.userId?.slice(0, 8), elo: e.elo })));
    return;
  }

  const a = queue.splice(Math.max(aIndex, bIndex), 1)[0];
  const b = queue.splice(Math.min(aIndex, bIndex), 1)[0];

  if (queue.length === 0) matchQueue.delete(stake);

  console.log("[WS] tryMatch: pairing", a.userId?.slice(0, 8), "vs", b.userId?.slice(0, 8), "stake", stake);
  createGameFromMatch(a.userId, b.userId, stake)
    .then((game) => {
      const payload = JSON.stringify({ type: "matched", gameId: game.id });
      if (a.ws.readyState === 1) a.ws.send(payload);
      if (b.ws.readyState === 1) b.ws.send(payload);
    })
    .catch((err) => {
      console.error("[WS] create-from-match error:", err?.message || err);
      const errMsg = err?.message || "Could not create game";
      const errPayload = JSON.stringify({ type: "matchError", error: errMsg });
      if (a.ws.readyState === 1) a.ws.send(errPayload);
      if (b.ws.readyState === 1) b.ws.send(errPayload);
    });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/broadcast") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const { gameId, game, gameOver, type: customType } = parsed;
        if (!gameId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "gameId required" }));
          return;
        }
        if (customType) {
          broadcastToRoom(gameId, parsed);
        } else if (game) {
          broadcastToRoom(gameId, { type: "gameUpdate", game, gameOver });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid body" }));
      }
    });
    return;
  }
  if (req.method === "GET" && req.url?.startsWith("/online")) {
    const u = new URL(req.url, "http://localhost");
    const userId = u.searchParams.get("userId");
    const online = !!userId && presence.has(userId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ online }));
    return;
  }
  if (req.method === "POST" && req.url === "/notify-challenge-accepted") {
    const auth = req.headers["x-matchmaking-secret"];
    if (auth !== MATCHMAKING_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { userId, gameId } = JSON.parse(body);
        const p = userId && presence.get(userId);
        if (p && p.readyState === 1) {
          p.send(JSON.stringify({ type: "challengeAccepted", gameId }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid body" }));
      }
    });
    return;
  }
  if (req.method === "POST" && req.url === "/notify-challenge-updated") {
    const auth = req.headers["x-matchmaking-secret"];
    if (auth !== MATCHMAKING_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { userId } = JSON.parse(body);
        const p = userId && presence.get(userId);
        if (p && p.readyState === 1) {
          p.send(JSON.stringify({ type: "challengeUpdated" }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid body" }));
      }
    });
    return;
  }
  if (req.method === "POST" && req.url === "/notify-notification-new") {
    const auth = req.headers["x-matchmaking-secret"];
    if (auth !== MATCHMAKING_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { userId, id, title, message, linkUrl } = JSON.parse(body);
        const p = userId && presence.get(userId);
        if (p && p.readyState === 1) {
          p.send(JSON.stringify({ type: "notificationNew", notification: { id, title, message, linkUrl } }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid body" }));
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", port: WS_PORT }));
    return;
  }
  // Debug: estado de la cola de matchmaking (solo con secret)
  if (req.method === "GET" && req.url === "/queue-status") {
    const auth = req.headers["x-matchmaking-secret"];
    if (auth !== MATCHMAKING_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    const status = {};
    for (const [stake, queue] of matchQueue) {
      status[stake] = queue.map((e) => ({ userId: e.userId?.slice(0, 8), elo: e.elo }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ queue: status }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = req.url || "";
  const gameId = getGameIdFromUrl(url);
  const token = getTokenFromUrl(url);

  if (!token) {
    ws.close(4001, "Missing token");
    return;
  }

  // El cliente puede enviar mensajes en onopen antes de que verifyToken resuelva
  // (joinGame/joinQueue). Bufferizamos SIEMPRE para evitar carreras de autenticacion.
  ws._pendingAuthMessages = [];
  const preAuthBufferListener = (raw) => {
    ws._pendingAuthMessages.push(raw);
  };
  ws.on("message", preAuthBufferListener);

  verifyToken(token).then((payload) => {
    if (!payload) {
      if (ws.readyState === 0 || ws.readyState === 1) ws.close(4001, "Invalid token");
      return;
    }
    ws.userId = payload.userId;

    const pending = ws._pendingAuthMessages || [];
    ws.removeListener("message", preAuthBufferListener);
    delete ws._pendingAuthMessages;

    if (gameId) {
      attachGameRoomHandlers(ws, gameId);
      pending.forEach((raw) => {
        if (ws.readyState === 1) ws.emit("message", raw);
      });
      return;
    }

    ws.removeAllListeners("message");
    attachMatchmakingHandlers(ws);
    pending.forEach((raw) => {
      if (ws.readyState === 1) ws.emit("message", raw);
    });
  }).catch((err) => {
    console.error("[WS] verify token error:", err);
    if (ws.readyState === 0 || ws.readyState === 1) ws.close(4001, "Auth error");
  });
});

function attachGameRoomHandlers(ws, gameId) {
  if (!rooms.has(gameId)) {
    rooms.set(gameId, {
      whiteId: null,
      blackId: null,
      sockets: new Set(),
      connections: new Map(),
      disconnectTimers: new Map(),
      disconnectStartedAt: {},
      pendingRematchRequest: null,
    });
  }
  const room = rooms.get(gameId);
  room.sockets.add(ws);
  ws._connectedAt = Date.now();
  ws._lastMsgAt = Date.now();
  ws._lastPingAt = 0;
  ws.on("pong", () => {});

  ws.on("message", (raw) => {
    try {
      ws._lastMsgAt = Date.now();
      const msg = JSON.parse(raw.toString());
      const userId = ws.userId;
      if (msg.type === "ping") {
        ws._lastPingAt = Date.now();
        return;
      }
      if (msg.type === "chatMessage" && typeof msg.text === "string") {
        const text = String(msg.text).slice(0, 500);
        if (text.trim()) {
          broadcastToRoomExcept(gameId, ws, { type: "chatMessage", userId, userName: msg.userName || null, text });
        }
        return;
      }
      if (msg.type === "rematchRequest" && msg.userName !== undefined) {
        room.pendingRematchRequest = { requestedBy: userId, userName: msg.userName };
        const payload = JSON.stringify({ type: "rematchRequest", requestedBy: userId, userName: msg.userName });
        for (const socket of room.sockets) {
          if (socket !== ws && socket.readyState === 1) socket.send(payload);
        }
        return;
      }
      if (msg.type === "rematchAccept") {
        room.pendingRematchRequest = null;
        fetch(`${NEXT_API_URL}/api/games/rematch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Matchmaking-Secret": MATCHMAKING_SECRET,
          },
          body: JSON.stringify({ gameId }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.game && data.game.id) {
              broadcastToRoom(gameId, { type: "rematchMatched", gameId: data.game.id });
            } else {
              broadcastToRoom(gameId, { type: "rematchError", error: data.error || "Rematch failed" });
            }
          })
          .catch((e) => {
            console.error("[WS] rematch error:", e);
            broadcastToRoom(gameId, { type: "rematchError", error: "Rematch failed" });
          });
        return;
      }
      if (msg.type === "rematchDecline") {
        room.pendingRematchRequest = null;
        broadcastToRoom(gameId, { type: "rematchDeclined", declinedBy: userId });
        return;
      }
      if (msg.type !== "joinGame") return;
      const whiteId = msg.whiteId || null;
      const blackId = msg.blackId || null;
      if (whiteId) room.whiteId = whiteId;
      if (blackId) room.blackId = blackId;

      const previousWs = room.connections.get(userId);
      room.connections.set(userId, ws);
      // En reconexiones rápidas puede quedar un socket viejo "vivo" por unos segundos.
      // Forzamos socket único por usuario para que el contador de desconexión sea consistente.
      if (previousWs && previousWs !== ws) {
        try {
          previousWs._supersededByNewerSocket = true;
          if (previousWs.readyState === 1 || previousWs.readyState === 0) {
            previousWs.close(4001, "superseded");
          }
        } catch {}
      }
      clearDisconnectTimer(room, userId);
      fetch(`${NEXT_API_URL}/api/games/${gameId}/clear-disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Matchmaking-Secret": MATCHMAKING_SECRET,
        },
        body: JSON.stringify({ userId }),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error("[WS] clear-disconnect API error:", gameId, userId, res.status, await res.text());
            return;
          }
          console.log("[WS] clear-disconnect ok", { gameId, userId, connections: room.connections.size });
        })
        .catch((e) => console.error("[WS] clear-disconnect error:", e));
      if (room.connections.size === 2) clearNoShowTimer(room);
      else if (room.whiteId && room.blackId && room.connections.size === 1) startNoShowTimer(gameId, room);
      broadcastToRoom(gameId, getPresencePayload(room));
      if (room.pendingRematchRequest && room.pendingRematchRequest.requestedBy !== userId && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "rematchRequest", requestedBy: room.pendingRematchRequest.requestedBy, userName: room.pendingRematchRequest.userName }));
      }
    } catch {}
  });

  ws.on("close", (code, reason) => {
    room.sockets.delete(ws);
    let disconnectedUserId = null;
    for (const [uid, w] of room.connections) {
      if (w === ws) {
        disconnectedUserId = uid;
        room.connections.delete(uid);
        break;
      }
    }
    const reasonStr = (reason && reason.toString()) || "";
    const now = Date.now();
    room._lastClose = { code, reason: reasonStr, disconnectedUserId, at: Date.now() };
    console.log("[WS] game room socket closed", {
      gameId,
      disconnectedUserId: disconnectedUserId || null,
      code,
      reason: reasonStr,
      superseded: !!ws._supersededByNewerSocket,
      hint: code === 1006 ? "1006=abnormal (network/proxy?), 1001=going away" : "",
      connectedMs: ws._connectedAt ? now - ws._connectedAt : null,
      sinceLastMsgMs: ws._lastMsgAt ? now - ws._lastMsgAt : null,
      sinceLastPingMs: ws._lastPingAt ? now - ws._lastPingAt : null,
    });
    if (disconnectedUserId && room.whiteId && room.blackId) {
      startDisconnectTimer(gameId, disconnectedUserId, room, code);
      broadcastToRoom(gameId, getPresencePayload(room));
      console.log("[WS] recording disconnect (1min timer started)", { gameId, disconnectedUserId, code, reason: reasonStr });
      fetch(`${NEXT_API_URL}/api/games/${gameId}/record-disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Matchmaking-Secret": MATCHMAKING_SECRET,
        },
        body: JSON.stringify({ disconnectedUserId }),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error("[WS] record-disconnect API error:", gameId, disconnectedUserId, res.status, await res.text());
            return;
          }
          console.log("[WS] record-disconnect ok", {
            gameId,
            disconnectedUserId,
            disconnectTimers: room.disconnectTimers.size,
          });
        })
        .catch((e) => console.error("[WS] record-disconnect error:", e));
    }
    if (room.sockets.size === 0) {
      clearNoShowTimer(room);
      if (room.disconnectTimers.size === 0) rooms.delete(gameId);
    }
  });
}

function attachMatchmakingHandlers(ws) {
  const userId = ws.userId;
  ws._presencePrev = presence.get(userId) || null;
  presence.set(userId, ws);
  ws.presenceUserId = userId;

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "presence") {
        return;
      }
      if (msg.type !== "joinQueue" || msg.stake == null) {
        if (msg.type === "joinQueue" && msg.stake == null) {
          console.warn("[WS] joinQueue: stake missing or null", { stake: msg.stake });
        }
        return;
      }
      if (!canJoinQueue(userId)) {
        ws.send(JSON.stringify({ type: "matchError", error: "Too many queue attempts. Wait a minute." }));
        return;
      }
      const stake = Number(msg.stake);
      if (![100, 500, 1000].includes(stake)) {
        console.warn("[WS] joinQueue: invalid stake", stake, "(allowed: 100, 500, 1000)");
        return;
      }
      if (!matchQueue.has(stake)) matchQueue.set(stake, []);
      const queue = matchQueue.get(stake);
      const existing = queue.findIndex((e) => e.userId === userId);
      if (existing !== -1) queue.splice(existing, 1);

      const elo = await fetchUserElo(userId);
      if (elo === null) {
        console.warn("[WS] joinQueue: fetchUserElo failed for userId", userId?.slice(0, 8));
        ws.send(JSON.stringify({ type: "matchError", error: "Could not load your rating. Try again." }));
        return;
      }
      queue.push({ userId, ws, elo });
      console.log("[WS] joinQueue: userId", userId?.slice(0, 8), "stake", stake, "elo", elo, "queue size", queue.length);
      tryMatch(stake);
    } catch (err) {
      console.error("[WS] joinQueue error:", err);
    }
  });

  ws.on("close", () => {
    if (ws.presenceUserId && presence.get(ws.presenceUserId) === ws) {
      const prev = ws._presencePrev;
      if (prev && prev.readyState === 1 && prev.presenceUserId === ws.presenceUserId) {
        // Restore previous still-open presence socket (e.g. NotificationBell),
        // so transient matchmaking sockets don't break challenge updates.
        presence.set(ws.presenceUserId, prev);
      } else {
        presence.delete(ws.presenceUserId);
      }
    }
    ws.presenceUserId = null;
    ws._presencePrev = null;
    for (const [stake, queue] of matchQueue) {
      const i = queue.findIndex((e) => e.ws === ws);
      if (i !== -1) {
        queue.splice(i, 1);
        if (queue.length === 0) matchQueue.delete(stake);
        break;
      }
    }
  });
}

server.listen(WS_PORT, "0.0.0.0", () => {
  console.log(`[WS] Server listening on ws://0.0.0.0:${WS_PORT} (and ws://localhost:${WS_PORT})`);

  // Keepalive ping only (no terminate on missing pong — browsers often don't reply to server pings, which was causing false disconnects and wrong forfeits)
  setInterval(() => {
    for (const [, room] of rooms) {
      for (const ws of room.sockets) {
        if (ws.readyState === 1) ws.ping();
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Re-broadcast presence every 2s while someone is in disconnect window (so other client gets update)
  setInterval(() => {
    for (const [gameId, room] of rooms) {
      if (room.disconnectTimers && room.disconnectTimers.size > 0 && room.whiteId && room.blackId) {
        broadcastToRoom(gameId, getPresencePayload(room));
      }
    }
  }, 2000);

  // Check for timeouts every 5 seconds
  setInterval(async () => {
    try {
      await fetch(`${NEXT_API_URL}/api/cron/check-timeouts`, {
        headers: { "X-Matchmaking-Secret": MATCHMAKING_SECRET },
      });
    } catch {}
  }, 5000);
});
