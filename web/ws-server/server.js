/**
 * Servidor WebSocket: partidas en tiempo real + matchmaking.
 * - Conexión con ?gameId=xxx → sala de partida (broadcast).
 * - Conexión sin gameId → matchmaking (joinQueue, matched).
 */

const http = require("http");
const { WebSocketServer } = require("ws");

const WS_PORT = parseInt(process.env.WS_PORT || "3002", 10);
const NEXT_API_URL = process.env.NEXT_API_URL || "http://localhost:3001";
const MATCHMAKING_SECRET = process.env.MATCHMAKING_SECRET || "dev-matchmaking-secret";

const DISCONNECT_FORFEIT_MS = 1 * 60 * 1000; // 1 minute to reconnect or forfeit
const NOSHOW_FORFEIT_MS = 1 * 60 * 1000; // 1 minute for opponent to join game page or they forfeit
const HEARTBEAT_INTERVAL_MS = 5000; // ping game room sockets every 5s to detect closed tabs
const ELO_MARGIN = 100; // only match players within ± this ELO

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
  return {
    type: "presence",
    whiteConnected,
    blackConnected,
    disconnectStartedAt: room.disconnectStartedAt || {},
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

function startDisconnectTimer(gameId, userId, room) {
  clearDisconnectTimer(room, userId);
  clearNoShowTimer(room);
  const key = userId === room.whiteId ? "white" : "black";
  room.disconnectStartedAt = room.disconnectStartedAt || {};
  room.disconnectStartedAt[key] = Date.now();

  const timeout = setTimeout(async () => {
    room.disconnectTimers.delete(userId);
    if (room.disconnectStartedAt) delete room.disconnectStartedAt[key];
    try {
      await fetch(`${NEXT_API_URL}/api/games/${gameId}/disconnect-forfeit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Matchmaking-Secret": MATCHMAKING_SECRET,
        },
        body: JSON.stringify({ disconnectedUserId: userId }),
      });
    } catch (e) {
      console.error("[WS] disconnect-forfeit error:", e);
    }
  }, DISCONNECT_FORFEIT_MS);

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

  if (aIndex < 0 || bIndex < 0) return; // no compatible pair

  const a = queue.splice(Math.max(aIndex, bIndex), 1)[0];
  const b = queue.splice(Math.min(aIndex, bIndex), 1)[0];

  if (queue.length === 0) matchQueue.delete(stake);

  createGameFromMatch(a.userId, b.userId, stake)
    .then((game) => {
      const payload = JSON.stringify({ type: "matched", gameId: game.id });
      if (a.ws.readyState === 1) a.ws.send(payload);
      if (b.ws.readyState === 1) b.ws.send(payload);
    })
    .catch((err) => {
      console.error("[WS] create-from-match error:", err);
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
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const gameId = getGameIdFromUrl(req.url || "");

  if (gameId) {
    // Game room: track presence and disconnect timer
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
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "chatMessage" && msg.userId && typeof msg.text === "string") {
          const text = String(msg.text).slice(0, 500);
          if (text.trim()) {
            broadcastToRoomExcept(gameId, ws, { type: "chatMessage", userId: msg.userId, userName: msg.userName || null, text });
          }
          return;
        }
        if (msg.type === "rematchRequest" && msg.userId && msg.userName !== undefined) {
          room.pendingRematchRequest = { requestedBy: msg.userId, userName: msg.userName };
          const payload = JSON.stringify({ type: "rematchRequest", requestedBy: msg.userId, userName: msg.userName });
          // Enviar a todos los sockets de la sala excepto al que envió la petición (así el rival siempre recibe)
          for (const socket of room.sockets) {
            if (socket !== ws && socket.readyState === 1) socket.send(payload);
          }
          return;
        }
        if (msg.type === "rematchAccept" && msg.userId) {
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
        if (msg.type === "rematchDecline" && msg.userId) {
          room.pendingRematchRequest = null;
          broadcastToRoom(gameId, { type: "rematchDeclined", declinedBy: msg.userId });
          return;
        }
        if (msg.type !== "joinGame" || !msg.userId) return;
        const userId = msg.userId;
        const whiteId = msg.whiteId || null;
        const blackId = msg.blackId || null;
        if (whiteId) room.whiteId = whiteId;
        if (blackId) room.blackId = blackId;

        room.connections.set(userId, ws);
        clearDisconnectTimer(room, userId);
        if (room.connections.size === 2) clearNoShowTimer(room);
        else if (room.whiteId && room.blackId && room.connections.size === 1) startNoShowTimer(gameId, room);
        broadcastToRoom(gameId, getPresencePayload(room));
        if (room.pendingRematchRequest && room.pendingRematchRequest.requestedBy !== userId && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "rematchRequest", requestedBy: room.pendingRematchRequest.requestedBy, userName: room.pendingRematchRequest.userName }));
        }
      } catch {}
    });

    ws.on("close", () => {
      room.sockets.delete(ws);
      let disconnectedUserId = null;
      for (const [uid, w] of room.connections) {
        if (w === ws) {
          disconnectedUserId = uid;
          room.connections.delete(uid);
          break;
        }
      }
      if (disconnectedUserId && room.whiteId && room.blackId) {
        startDisconnectTimer(gameId, disconnectedUserId, room);
        broadcastToRoom(gameId, getPresencePayload(room));
      }
      if (room.sockets.size === 0) {
        clearNoShowTimer(room);
        for (const t of room.disconnectTimers.values()) clearTimeout(t);
        rooms.delete(gameId);
      }
    });
    return;
  }

  // Matchmaking / presencia: sin gameId
  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "presence" && msg.userId) {
        presence.set(msg.userId, ws);
        ws.presenceUserId = msg.userId;
        return;
      }
      if (msg.type !== "joinQueue" || !msg.userId || msg.stake == null) return;
      if (!canJoinQueue(msg.userId)) {
        ws.send(JSON.stringify({ type: "matchError", error: "Too many queue attempts. Wait a minute." }));
        return;
      }
      const stake = Number(msg.stake);
      if (![100, 500, 1000].includes(stake)) return; // $1, $5, $10
      if (!matchQueue.has(stake)) matchQueue.set(stake, []);
      const queue = matchQueue.get(stake);
      const existing = queue.findIndex((e) => e.userId === msg.userId);
      if (existing !== -1) queue.splice(existing, 1);

      const elo = await fetchUserElo(msg.userId);
      if (elo === null) {
        ws.send(JSON.stringify({ type: "matchError", error: "Could not load your rating. Try again." }));
        return;
      }
      queue.push({ userId: msg.userId, ws, elo });
      tryMatch(stake);
    } catch {}
  });
  ws.on("close", () => {
    if (ws.presenceUserId) {
      if (presence.get(ws.presenceUserId) === ws) presence.delete(ws.presenceUserId);
      ws.presenceUserId = null;
    }
    for (const [stake, queue] of matchQueue) {
      const i = queue.findIndex((e) => e.ws === ws);
      if (i !== -1) {
        queue.splice(i, 1);
        if (queue.length === 0) matchQueue.delete(stake);
        break;
      }
    }
  });
});

server.listen(WS_PORT, "0.0.0.0", () => {
  console.log(`[WS] Server listening on ws://0.0.0.0:${WS_PORT} (and ws://localhost:${WS_PORT})`);

  // Heartbeat: ping game room sockets; if no pong, terminate so "close" fires and presence updates
  setInterval(() => {
    for (const [, room] of rooms) {
      const sockets = [...room.sockets];
      for (const ws of sockets) {
        if (ws.isAlive === false) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
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
