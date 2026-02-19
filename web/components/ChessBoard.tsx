"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import GameActions from "@/components/GameActions";
import GameSummarySection from "@/components/GameSummarySection";
import GameOverModal from "@/components/GameOverModal";
import { getWsToken, wsUrlWithToken } from "@/lib/ws-auth";
import { PLATFORM_FEE_PERCENT } from "@/lib/commission";

const WS_URL = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002") : "";
const WS_BASE = typeof window !== "undefined" ? (WS_URL.startsWith("http") ? WS_URL.replace(/^http/, "ws") : WS_URL).split("?")[0].replace(/\/$/, "") : "";
const RECONNECT_DEADLINE_MS = 60 * 1000; // 1 minute to reconnect (must match WS server)
const SETTLEMENT_OVERLAY_MIN_MS = 3000; // mínimo tiempo mostrando "Acreditando fondos" / "Actualizando banca"
const CHECKMATE_REVEAL_MS = 2800; // tiempo mostrando la casilla del rey en rojo antes del modal
const BUTTON_BLUE = "#1e40af";
const POLL_MS_WS_HEALTHY = 10_000;
const POLL_MS_WS_UNHEALTHY = 1_000;
const POLL_MS_WAITING_OPPONENT = 1_200;
const POLL_MS_FAST_BURST = 700;
const FAST_BURST_MS = 4_000;

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const BLACK_PIECE_SYMBOLS: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const WHITE_PIECE_SYMBOLS: Record<string, string> = { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" };

const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;
const PROMOTION_LABELS: Record<string, string> = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight" };

function playMoveSound(type: "move" | "capture" | "check" | "checkmate") {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const duration = type === "checkmate" ? 0.35 : 0.1;
    gain.gain.setValueAtTime(type === "checkmate" ? 0.2 : 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    if (type === "move") {
      osc.frequency.setValueAtTime(400, ctx.currentTime);
    } else if (type === "capture") {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.setValueAtTime(350, ctx.currentTime + 0.05);
    } else if (type === "check") {
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05);
    } else {
      // checkmate: tono más grave y ascendente, más largo
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(400, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(550, ctx.currentTime + 0.2);
    }
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type GamePlayer = { id: string; email: string; name: string | null; elo: number };

type GameState = {
  id: string;
  fen: string;
  turn: string;
  status: string;
  winner: string | null;
  stake: number;
  whiteId: string;
  blackId: string;
  white: GamePlayer;
  black: GamePlayer;
  drawOfferBy: string | null;
  chatStatus: string | null;
  chatInitiatedBy: string | null;
  whiteTimeRemaining: number;
  blackTimeRemaining: number;
  turnStartedAt: string;
  moves: string | null;
  alreadyReported?: boolean;
  whiteEloBefore?: number | null;
  blackEloBefore?: number | null;
  whiteEloAfter?: number | null;
  blackEloAfter?: number | null;
  whiteBalanceBeforeCents?: number | null;
  blackBalanceBeforeCents?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type GameOverPayload = {
  winnerId: string | null;
  stake: number;
  eloWhiteDelta: number;
  eloBlackDelta: number;
  isDraw: boolean;
};

type PresenceState = {
  whiteConnected: boolean;
  blackConnected: boolean;
  disconnectStartedAt: { white?: number; black?: number };
};

type ChessBoardProps = {
  gameId: string;
  userId: string;
};

export default function ChessBoard({ gameId, userId }: ChessBoardProps) {
  const router = useRouter();
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameOverPayload, setGameOverPayload] = useState<GameOverPayload | null>(null);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [checkmateKingSquare, setCheckmateKingSquare] = useState<string | null>(null);
  const [settlementPending, setSettlementPending] = useState<null | "acreditando" | "actualizando">(null);
  const settlementPendingShownAtRef = useRef<number | null>(null);
  const settlementPendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkmateRevealScheduledRef = useRef(false);
  const gameOverPayloadFromServerRef = useRef<GameOverPayload | null>(null);
  const [moving, setMoving] = useState(false);
  const [tick, setTick] = useState(0);
  const [presence, setPresence] = useState<PresenceState | null>(null);
  const [rematchRequestedByMe, setRematchRequestedByMe] = useState(false);
  const [rematchRequestedByOpponent, setRematchRequestedByOpponent] = useState(false);
  const [rematchDeclined, setRematchDeclined] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsHealthyRef = useRef(false);
  const refetchOnDisconnectZeroRef = useRef(false);
  const cleanupRanRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fastSyncUntilRef = useRef(0);
  const wsSeqRef = useRef(0);
  const previousGameStatusRef = useRef<string | null>(null);
  const gameEndHandledRef = useRef(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const gameStatusRef = useRef<string | null>(null);
  gameStatusRef.current = game?.status ?? null;

  // Safety net: no matter the end-of-game path, never leave settlement overlay stuck.
  useEffect(() => {
    if (!settlementPending) {
      if (settlementPendingTimeoutRef.current) {
        clearTimeout(settlementPendingTimeoutRef.current);
        settlementPendingTimeoutRef.current = null;
      }
      return;
    }
    if (settlementPendingTimeoutRef.current) {
      clearTimeout(settlementPendingTimeoutRef.current);
    }
    settlementPendingTimeoutRef.current = setTimeout(() => {
      settlementPendingShownAtRef.current = null;
      setSettlementPending(null);
      settlementPendingTimeoutRef.current = null;
    }, SETTLEMENT_OVERLAY_MIN_MS);
    return () => {
      if (settlementPendingTimeoutRef.current) {
        clearTimeout(settlementPendingTimeoutRef.current);
        settlementPendingTimeoutRef.current = null;
      }
    };
  }, [settlementPending]);

  // Live clocks: tick every second when game is active
  useEffect(() => {
    if (!game || game.status !== "active") return;
    const interval = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [game?.id, game?.status]);

  const fetchGame = useCallback(async (isRefetch = false) => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load game");
        if (!isRefetch) setGame(null);
        return;
      }
      const data = await res.json();
      setGame(data.game);
      setError(null);
    } catch {
      setError("Connection error");
      if (!isRefetch) setGame(null);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  const isMyTurnLive =
    game != null &&
    game.status === "active" &&
    (game.turn === "w" ? game.whiteId === userId : game.blackId === userId);

  // Adaptive fallback sync:
  // - WS healthy + my turn: low-frequency safety polling
  // - WS healthy + waiting opponent: faster polling for snappy opponent-move updates
  // - WS unhealthy/reconnecting: aggressive polling until WS stabilizes
  useEffect(() => {
    if (!game || game.status !== "active") return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const nextDelay = () => {
      if (Date.now() < fastSyncUntilRef.current) return POLL_MS_FAST_BURST;
      if (!wsHealthyRef.current) return POLL_MS_WS_UNHEALTHY;
      if (!isMyTurnLive) return POLL_MS_WAITING_OPPONENT;
      return POLL_MS_WS_HEALTHY;
    };

    const schedule = () => {
      if (cancelled) return;
      timeout = setTimeout(async () => {
        await fetchGame(true);
        schedule();
      }, nextDelay());
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [game?.id, game?.status, isMyTurnLive, fetchGame]);

  // Fallback end-of-game transition handler: guarantees both players get
  // checkmate reveal + delayed modal when transitioning from active.
  useEffect(() => {
    if (!game) return;

    const prevStatus = previousGameStatusRef.current;
    previousGameStatusRef.current = game.status;

    if (game.status === "active") {
      gameEndHandledRef.current = false;
      return;
    }

    if (prevStatus !== "active") return;
    if (gameEndHandledRef.current || showGameOverModal || checkmateRevealScheduledRef.current) return;

    const payload =
      gameOverPayloadFromServerRef.current ??
      gameOverPayload ?? {
        winnerId: game.winner ?? null,
        stake: game.stake,
        eloWhiteDelta: 0,
        eloBlackDelta: 0,
        isDraw: !game.winner,
      };
    setGameOverPayload((current) => current ?? payload);
    gameEndHandledRef.current = true;

    const weWon = payload.winnerId === userId;
    const weLost = !!payload.winnerId && payload.winnerId !== userId;
    const maybeShowSettlementOverlay = () => {
      if (!weWon && !weLost) return;
      settlementPendingShownAtRef.current = Date.now();
      setSettlementPending(weWon ? "acreditando" : "actualizando");
      setTimeout(() => {
        settlementPendingShownAtRef.current = null;
        setSettlementPending(null);
      }, SETTLEMENT_OVERLAY_MIN_MS);
    };

    if (game.status === "checkmate") {
      let kingSquare: string | null = null;
      try {
        const chess = new Chess(game.fen);
        const cell = chess.board().flat().find((p) => p?.type === "k" && p.color === chess.turn());
        if (cell) kingSquare = cell.square;
      } catch {}

      if (kingSquare) {
        checkmateRevealScheduledRef.current = true;
        setCheckmateKingSquare(kingSquare);
        setTimeout(() => {
          checkmateRevealScheduledRef.current = false;
          setCheckmateKingSquare(null);
          setShowGameOverModal(true);
          maybeShowSettlementOverlay();
          if (typeof window !== "undefined") window.scrollTo(0, 0);
          router.refresh();
        }, CHECKMATE_REVEAL_MS);
        return;
      }
    }

    setShowGameOverModal(true);
    maybeShowSettlementOverlay();
    if (typeof window !== "undefined") window.scrollTo(0, 0);
    router.refresh();
  }, [game, gameOverPayload, showGameOverModal, userId, router]);

  // Cuando el contador de reconexión llega a 0, refetch tras 2.5s por si el forfeit se aplicó (cron/timer) y el WS no llegó
  useEffect(() => {
    if (!game || game.status !== "active" || !presence) return;
    const isPlayerWhite = game.whiteId === userId;
    const opponentKey = isPlayerWhite ? "black" : "white";
    const opponentConnected = opponentKey === "black" ? presence.blackConnected : presence.whiteConnected;
    const started = presence.disconnectStartedAt?.[opponentKey];
    if (opponentConnected || started == null) {
      refetchOnDisconnectZeroRef.current = false;
      return;
    }
    const deadline = started + RECONNECT_DEADLINE_MS;
    const check = () => {
      if (Date.now() < deadline || refetchOnDisconnectZeroRef.current) return;
      refetchOnDisconnectZeroRef.current = true;
      setTimeout(() => fetchGame(true), 2500);
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [game?.id, game?.status, presence, userId, fetchGame]);

  // WebSocket: connect to game room when we have a game (stay connected after game ends for rematch). Reconnect automatically if socket closes during active game.
  useEffect(() => {
    if (!game?.id || !WS_BASE) return;
    cleanupRanRef.current = false;
    const wsSeq = ++wsSeqRef.current;
    const whiteId = game.whiteId;
    const blackId = game.blackId;
    const gameIdParam = `gameId=${encodeURIComponent(gameId)}`;
    let cancelled = false;
    const scheduleReconnect = () => {
      if (cleanupRanRef.current || cancelled) return;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        setReconnectAttempt((a) => a + 1);
      }, 2000);
    };

    (async () => {
      const token = await getWsToken();
      if (cancelled) return;
      if (!token) {
        // Important: a transient ws-token failure must not kill reconnection forever.
        // Keep retrying while game remains active.
        console.warn("[FairMate WS] token missing, scheduling reconnect", {
          gameId,
          userId,
          wsSeq,
          reconnectAttempt,
        });
        if (gameStatusRef.current === "active") scheduleReconnect();
        return;
      }
      const url = wsUrlWithToken(`${WS_BASE}?${gameIdParam}`, token);
      if (cancelled) return;
      const ws = new WebSocket(url);
      (ws as WebSocket & { __intentionalClose?: boolean; __seq?: number }).__intentionalClose = false;
      (ws as WebSocket & { __intentionalClose?: boolean; __seq?: number }).__seq = wsSeq;
      wsRef.current = ws;
      console.log("[FairMate WS] opening game socket", { gameId, userId, wsSeq, reconnectAttempt });

      ws.onopen = () => {
        wsHealthyRef.current = true;
        console.log("[FairMate WS] game socket open", { gameId, userId, wsSeq });
        ws.send(JSON.stringify({ type: "joinGame", userId, whiteId, blackId }));
        // Keepalive every 10s — 1001/1005 often from browser suspending tab or proxy; frequent pings reduce "idle" perception.
        if (keepaliveIntervalRef.current) clearInterval(keepaliveIntervalRef.current);
        keepaliveIntervalRef.current = setInterval(() => {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
        }, 10000);
      };

      ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "gameUpdate" && msg.game) {
          fastSyncUntilRef.current = Date.now() + FAST_BURST_MS;
          const updates = msg.game;
          setGame((prev) => {
            const next = prev ? { ...prev, ...updates } : updates;
            const wasOpponentMove =
              prev &&
              prev.status === "active" &&
              next.status === "active" &&
              next.fen !== prev.fen &&
              ((next.turn === "w" && next.whiteId === userId) || (next.turn === "b" && next.blackId === userId));
            if (wasOpponentMove) {
              setTimeout(() => {
                try {
                  const chess = new Chess(next.fen);
                  const isCheckmate = chess.isCheckmate();
                  const inCheck = chess.inCheck();
                  const moves = next.moves ? JSON.parse(next.moves) : [];
                  const lastSan = Array.isArray(moves) && moves.length ? moves[moves.length - 1] : "";
                  const wasCapture = typeof lastSan === "string" && lastSan.includes("x");
                  if (isCheckmate) playMoveSound("checkmate");
                  else if (inCheck) playMoveSound("check");
                  else if (wasCapture) playMoveSound("capture");
                  else playMoveSound("move");
                } catch {}
              }, 0);
            }
            return next;
          });
          if (msg.gameOver) {
            gameOverPayloadFromServerRef.current = msg.gameOver;
            setGameOverPayload(msg.gameOver);
            setRematchRequestedByMe(false);
            setRematchRequestedByOpponent(false);
            setRematchDeclined(false);
            setRematchError(null);
            const weWon = msg.gameOver.winnerId === userId;
            const weLost = msg.gameOver.winnerId && msg.gameOver.winnerId !== userId;
            const updates = msg.game || {};
            const isCheckmate = updates.status === "checkmate" && updates.fen;
            let checkmateKingSquareFromUpdate: string | null = null;
            if (isCheckmate && updates.fen) {
              try {
                const chess = new Chess(updates.fen);
                const cell = chess.board().flat().find((p) => p?.type === "k" && p.color === chess.turn());
                if (cell) checkmateKingSquareFromUpdate = cell.square;
              } catch {}
            }
            if (checkmateKingSquareFromUpdate) {
              gameEndHandledRef.current = true;
              setCheckmateKingSquare(checkmateKingSquareFromUpdate);
              setTimeout(() => {
                setCheckmateKingSquare(null);
                setShowGameOverModal(true);
                if (weWon || weLost) {
                  settlementPendingShownAtRef.current = Date.now();
                  setSettlementPending(weWon ? "acreditando" : "actualizando");
                  setTimeout(() => {
                    settlementPendingShownAtRef.current = null;
                    setSettlementPending(null);
                  }, SETTLEMENT_OVERLAY_MIN_MS);
                }
                if (typeof window !== "undefined") window.scrollTo(0, 0);
                router.refresh();
              }, CHECKMATE_REVEAL_MS);
            } else {
              if (updates.status === "checkmate") {
                // If checkmate arrives without fen in this payload, let transition fallback
                // compute king square from latest state and play reveal for both players.
                gameEndHandledRef.current = false;
              } else {
                gameEndHandledRef.current = true;
                setShowGameOverModal(true);
                if (weWon || weLost) {
                  settlementPendingShownAtRef.current = Date.now();
                  setSettlementPending(weWon ? "acreditando" : "actualizando");
                  setTimeout(() => {
                    settlementPendingShownAtRef.current = null;
                    setSettlementPending(null);
                  }, SETTLEMENT_OVERLAY_MIN_MS);
                }
                if (typeof window !== "undefined") window.scrollTo(0, 0);
                router.refresh();
              }
            }
          }
        }
        if (msg.type === "presence") {
          const whiteConnected = !!msg.whiteConnected;
          const blackConnected = !!msg.blackConnected;
          setPresence({
            whiteConnected,
            blackConnected,
            disconnectStartedAt:
              whiteConnected && blackConnected ? {} : (msg.disconnectStartedAt || {}),
          });
        }
        if (msg.type === "rematchRequest" && msg.requestedBy !== userId) {
          setRematchRequestedByOpponent(true);
          setRematchDeclined(false);
          setRematchError(null);
        }
        if (msg.type === "rematchMatched" && msg.gameId) {
          router.push(`/game/${msg.gameId}`);
        }
        if (msg.type === "rematchDeclined" && msg.declinedBy !== userId) {
          setRematchRequestedByMe(false);
          setRematchDeclined(true);
        }
        if (msg.type === "rematchError" && msg.error) {
          setRematchRequestedByMe(false);
          setRematchError(msg.error);
        }
        if (msg.type === "drawOffer" && msg.drawOfferBy != null) {
          setGame((prev) => (prev ? { ...prev, drawOfferBy: msg.drawOfferBy } : prev));
        }
        if (msg.type === "drawDeclined") {
          setGame((prev) => (prev ? { ...prev, drawOfferBy: null } : prev));
        }
        if (msg.type === "chatRequest" && msg.chatInitiatedBy != null) {
          setGame((prev) =>
            prev ? { ...prev, chatStatus: "pending", chatInitiatedBy: msg.chatInitiatedBy } : prev
          );
        }
        if (msg.type === "chatRespond" && msg.chatStatus != null) {
          setGame((prev) =>
            prev
              ? {
                  ...prev,
                  chatStatus: msg.chatStatus,
                  ...(msg.chatStatus === "declined" ? { chatInitiatedBy: null } : {}),
                }
              : prev
          );
        }
        if (msg.type === "chatMessage" && msg.userId !== userId) {
          window.dispatchEvent(
            new CustomEvent(`game-chat-message-${gameId}`, {
              detail: { userId: msg.userId, userName: msg.userName, text: msg.text },
            })
          );
        }
      } catch {}
      };

      ws.onclose = (event) => {
        wsHealthyRef.current = false;
        const meta = ws as WebSocket & { __intentionalClose?: boolean; __seq?: number };
        const intentional = !!meta.__intentionalClose;
        if (gameStatusRef.current === "active") {
          console.warn(
            "[FairMate WS] Game socket closed — code:",
            event.code,
            "reason:",
            event.reason || "(none)",
            "— 1006 = red/proxy, 1001 = tab closed. Reconnecting in 2s…"
          );
          console.warn("[FairMate WS] close metadata", {
            gameId,
            userId,
            wsSeq: meta.__seq,
            intentional,
            cleanupRan: cleanupRanRef.current,
            reconnectAttempt,
          });
        }
        wsRef.current = null;
        setPresence(null);
        setRematchRequestedByMe(false);
        setRematchRequestedByOpponent(false);
        setRematchDeclined(false);
        setRematchError(null);
        if (cleanupRanRef.current) return;
        if (gameStatusRef.current === "active") {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        wsHealthyRef.current = false;
      };
    })();

    return () => {
      cancelled = true;
      cleanupRanRef.current = true;
      console.log("[FairMate WS] effect cleanup", {
        gameId,
        userId,
        wsSeq,
        reconnectAttempt,
        hasSocket: !!wsRef.current,
      });
      if (keepaliveIntervalRef.current) {
        clearInterval(keepaliveIntervalRef.current);
        keepaliveIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        (wsRef.current as WebSocket & { __intentionalClose?: boolean }).__intentionalClose = true;
        wsRef.current.close();
      }
      wsRef.current = null;
      setPresence(null);
      setRematchRequestedByMe(false);
      setRematchRequestedByOpponent(false);
      setRematchDeclined(false);
      setRematchError(null);
    };
  }, [gameId, userId, game?.id, reconnectAttempt]);

  const handleGameUpdate = useCallback(
    (updates: { drawOfferBy?: string | null; chatStatus?: string | null; chatInitiatedBy?: string | null }) => {
      setGame((prev) => (prev ? { ...prev, ...updates } : null));
    },
    []
  );

  const isMyTurn =
    game != null &&
    game.status === "active" &&
    (game.turn === "w" ? game.whiteId === userId : game.blackId === userId);

  const tryMove = useCallback(
    (from: string, to: string, promotion?: "q" | "r" | "b" | "n"): boolean => {
      if (!game || game.status !== "active" || moving) return false;
      const isWhite = game.whiteId === userId;
      const isWhiteTurn = game.turn === "w";
      if ((isWhiteTurn && !isWhite) || (!isWhiteTurn && isWhite)) return false;

      const chess = new Chess(game.fen);
      const piece = chess.get(from as Square);
      if (!piece) return false;
      const needPromotion =
        piece.type === "p" && (to[1] === "1" || to[1] === "8");
      if (needPromotion && !promotion) {
        setPendingPromotion({ from, to });
        return false;
      }
      const promotionPiece = needPromotion ? promotion : undefined;
      const move = chess.move({ from: from as Square, to: to as Square, promotion: promotionPiece ?? undefined });
      if (!move) return false;

      if (move.captured) playMoveSound("capture");
      else if (chess.isCheckmate()) playMoveSound("checkmate");
      else if (chess.inCheck()) playMoveSound("check");
      else playMoveSound("move");

      const prevFen = game.fen;
      const prevTurn = game.turn;
      const prevMoves = game.moves ?? null;
      const newMovesJson = game.moves
        ? JSON.stringify([...JSON.parse(game.moves), move.san])
        : JSON.stringify([move.san]);
      const gameEnded = chess.isCheckmate() || chess.isStalemate() || chess.isGameOver();
      const isDraw = chess.isStalemate() || chess.isDraw();
      const isCheckmate = chess.isCheckmate();
      setGame((prev) => {
        if (!prev) return prev;
        const next = { ...prev, fen: chess.fen(), turn: chess.turn(), moves: newMovesJson };
        if (isCheckmate) {
          next.status = "checkmate";
          next.winner = userId;
        } else if (isDraw) {
          next.status = chess.isStalemate() ? "stalemate" : "draw";
          next.winner = null;
        }
        return next;
      });
      setSelectedSquare(null);
      setPendingPromotion(null);
      setMoving(true);
      fastSyncUntilRef.current = Date.now() + FAST_BURST_MS;

      if (gameEnded) {
        if (isCheckmate) {
          const loserKingSquare = (() => {
            const board = chess.board();
            const turn = chess.turn();
            const cell = board.flat().find((p) => p?.type === "k" && p.color === turn);
            return cell?.square ?? null;
          })();
          if (loserKingSquare) {
            setCheckmateKingSquare(loserKingSquare);
            checkmateRevealScheduledRef.current = true;
            setTimeout(() => {
              checkmateRevealScheduledRef.current = false;
              setCheckmateKingSquare(null);
              setGameOverPayload(
                gameOverPayloadFromServerRef.current ?? {
                  winnerId: userId,
                  stake: game.stake,
                  eloWhiteDelta: 0,
                  eloBlackDelta: 0,
                  isDraw: false,
                }
              );
              setShowGameOverModal(true);
              settlementPendingShownAtRef.current = Date.now();
              setSettlementPending("acreditando");
              if (typeof window !== "undefined") window.scrollTo(0, 0);
            }, CHECKMATE_REVEAL_MS);
          } else {
            setGameOverPayload({
              winnerId: userId,
              stake: game.stake,
              eloWhiteDelta: 0,
              eloBlackDelta: 0,
              isDraw: false,
            });
            setShowGameOverModal(true);
            settlementPendingShownAtRef.current = Date.now();
            setSettlementPending("acreditando");
            if (typeof window !== "undefined") window.scrollTo(0, 0);
          }
        } else {
          setGameOverPayload({
            winnerId: isDraw ? null : userId,
            stake: game.stake,
            eloWhiteDelta: 0,
            eloBlackDelta: 0,
            isDraw: !!isDraw,
          });
          setShowGameOverModal(true);
          settlementPendingShownAtRef.current = Date.now();
          setSettlementPending("acreditando");
          if (typeof window !== "undefined") window.scrollTo(0, 0);
        }
      }

      fetch(`/api/games/${gameId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, promotion: promotionPiece ?? undefined }),
      })
        .then((res) => res.json())
        .then((data) => {
            if (data.error) {
            setGame((prev) =>
              prev ? { ...prev, fen: prevFen, turn: prevTurn, moves: prevMoves, status: "active", winner: null } : prev
            );
            if (gameEnded) {
              checkmateRevealScheduledRef.current = false;
              setCheckmateKingSquare(null);
              setShowGameOverModal(false);
              settlementPendingShownAtRef.current = null;
              setSettlementPending(null);
            }
            alert(data.error);
          } else if (data.game) {
            setGame((prev) => (prev ? { ...prev, ...data.game } : data.game));
            if (data.gameOver) {
              gameOverPayloadFromServerRef.current = data.gameOver;
              if (!checkmateRevealScheduledRef.current) {
                setGameOverPayload(data.gameOver);
                setShowGameOverModal(true);
                settlementPendingShownAtRef.current = Date.now();
                setSettlementPending("acreditando");
                const shownAt = settlementPendingShownAtRef.current;
                const remaining = shownAt != null ? SETTLEMENT_OVERLAY_MIN_MS - (Date.now() - shownAt) : 0;
                if (remaining <= 0) {
                  settlementPendingShownAtRef.current = null;
                  setSettlementPending(null);
                } else {
                  setTimeout(() => {
                    settlementPendingShownAtRef.current = null;
                    setSettlementPending(null);
                  }, remaining);
                }
                if (typeof window !== "undefined") window.scrollTo(0, 0);
              }
              router.refresh();
            }
          }
        })
        .catch(() => {
          setGame((prev) =>
            prev ? { ...prev, fen: prevFen, turn: prevTurn, moves: prevMoves, status: "active", winner: null } : prev
          );
          if (gameEnded) {
            checkmateRevealScheduledRef.current = false;
            setCheckmateKingSquare(null);
            setShowGameOverModal(false);
            settlementPendingShownAtRef.current = null;
            setSettlementPending(null);
          }
          alert("Move failed");
        })
        .finally(() => setMoving(false));
      return true;
    },
    [game, gameId, userId]
  );

  const handleSquareClick = useCallback(
    ({ square, piece }: { piece: { pieceType: string } | null; square: string }) => {
      if (!isMyTurn) return;
      const chess = new Chess(game?.fen ?? "start");
      const pieceAtSquare = chess.get(square as Square);
      const isOurPiece =
        pieceAtSquare &&
        (pieceAtSquare.color === "w") === (game?.whiteId === userId);

      if (selectedSquare) {
        if (square === selectedSquare) {
          setSelectedSquare(null);
          return;
        }
        // Si clicaste en otra pieza nuestra, cambiar selección al instante (deseleccionar la anterior y elegir la nueva)
        if (isOurPiece) {
          setSelectedSquare(square);
          return;
        }
        // Casilla vacía o enemiga: intentar mover
        const moved = tryMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }
      if (isOurPiece) setSelectedSquare(square);
    },
    [isMyTurn, selectedSquare, tryMove, game, userId]
  );

  function handlePieceDrop(args: {
    piece: { pieceType: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    const to = args.targetSquare;
    if (!to) return false;
    return tryMove(args.sourceSquare, to);
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-stone-600 bg-stone-800/50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-stone-500 border-t-white" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="rounded-xl border border-stone-600 bg-stone-800/80 p-8 text-center text-white">
        <p className="text-stone-300">{error || "Game not found"}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-stone-600 px-4 py-2 text-sm font-medium text-white hover:bg-stone-500"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const isPlayerWhite = game.whiteId === userId;
  const opponent = isPlayerWhite ? game.black : game.white;
  const opponentName = opponent.name || opponent.email.split("@")[0];
  const userName = (isPlayerWhite ? game.white : game.black).name || (isPlayerWhite ? game.white : game.black).email.split("@")[0];
  const isGameActive = game.status === "active";
  const showGameView = isGameActive || !!checkmateKingSquare;
  const showSummaryView = !showGameView;
  const boardOrientation = isPlayerWhite ? "white" : "black";

  const now = typeof window !== "undefined" ? Date.now() : 0;
  const turnStartedMs = new Date(game.turnStartedAt).getTime();
  const elapsed = Math.max(0, now - turnStartedMs);
  const whiteDisplayMs =
    game.turn === "b"
      ? game.whiteTimeRemaining
      : Math.max(0, game.whiteTimeRemaining - elapsed);
  const blackDisplayMs =
    game.turn === "w"
      ? game.blackTimeRemaining
      : Math.max(0, game.blackTimeRemaining - elapsed);

  const result: "win" | "loss" | "draw" =
    !game.winner ? "draw" : game.winner === userId ? "win" : "loss";
  const eloDelta =
    gameOverPayload && isPlayerWhite
      ? gameOverPayload.eloWhiteDelta
      : gameOverPayload
        ? gameOverPayload.eloBlackDelta
        : 0;
  const lossReason: "timeout" | "checkmate" | "disconnected" | "resigned" | undefined =
    result === "loss"
      ? game.status === "timeout"
        ? "timeout"
        : game.status === "resigned"
          ? "resigned"
          : game.status === "disconnected"
            ? "disconnected"
            : "checkmate"
      : undefined;

  const whiteName = game.white.name || game.white.email.split("@")[0];
  const blackName = game.black.name || game.black.email.split("@")[0];

  // Captured pieces per side (from game.moves) and material score
  const { whiteCaptured, blackCaptured, whiteScore, blackScore } = (() => {
    const white: string[] = [];
    const black: string[] = [];
    try {
      const movesJson = game.moves;
      if (!movesJson) return { whiteCaptured: white, blackCaptured: black, whiteScore: 0, blackScore: 0 };
      const moves: string[] = JSON.parse(movesJson);
      const chess = new Chess();
      for (const san of moves) {
        const move = chess.move(san);
        if (!move) continue;
        if (move.captured) {
          if (move.color === "w") white.push(move.captured);
          else black.push(move.captured);
        }
      }
      const sum = (list: string[]) => list.reduce((s, p) => s + (PIECE_VALUE[p] ?? 0), 0);
      return {
        whiteCaptured: white,
        blackCaptured: black,
        whiteScore: sum(white),
        blackScore: sum(black),
      };
    } catch {
      return { whiteCaptured: white, blackCaptured: black, whiteScore: 0, blackScore: 0 };
    }
  })();

  // Last move: get from/to from game.moves (chess.js has no history when loading FEN)
  const lastMoveSquares = (() => {
    try {
      const movesJson = game.moves;
      if (!movesJson) return {};
      const moves: string[] = JSON.parse(movesJson);
      if (moves.length === 0) return {};
      const chess = new Chess();
      for (let i = 0; i < moves.length - 1; i++) chess.move(moves[i]);
      const lastMove = chess.move(moves[moves.length - 1]);
      if (!lastMove) return {};
      const highlight = {
        boxShadow: "inset 0 0 0 3px rgba(250, 204, 21, 0.85)",
      };
      return {
        [lastMove.from]: highlight,
        [lastMove.to]: highlight,
      };
    } catch {
      return {};
    }
  })();

  // Selected square (only visible for the player whose turn it is)
  const selectedSquareStyle = selectedSquare && isMyTurn
    ? { [selectedSquare]: { boxShadow: "inset 0 0 0 3px rgba(59, 130, 246, 0.9)" } }
    : {};

  // Check: highlight king square
  const inCheckSquare = (() => {
    try {
      const chess = new Chess(game.fen);
      if (!chess.inCheck()) return undefined;
      const kingColor = chess.turn();
      const cell = chess.board().flat().find((p) => p?.type === "k" && p.color === kingColor);
      return cell?.square ?? undefined;
    } catch {
      return undefined;
    }
  })();
  const checkSquareStyle = inCheckSquare
    ? { [inCheckSquare]: { boxShadow: "inset 0 0 0 3px rgba(239, 68, 68, 0.9)" } }
    : {};
  const checkmateKingSquareStyle = checkmateKingSquare
    ? {
        [checkmateKingSquare]: {
          boxShadow: "inset 0 0 0 4px rgba(220, 38, 38, 1)",
          backgroundColor: "rgba(220, 38, 38, 0.45)",
          animation: "checkmate-pulse 0.6s ease-in-out infinite alternate",
        },
      }
    : {};

  const squareStyles: Record<string, object> = {
    ...lastMoveSquares,
    ...selectedSquareStyle,
    ...checkSquareStyle,
    ...checkmateKingSquareStyle,
  };

  const stakeDollars = (game.stake / 100).toFixed(2);
  const winAfterCommission = Math.floor(game.stake * 2 * (1 - PLATFORM_FEE_PERCENT)) / 100;
  const winDollars = winAfterCommission.toFixed(2);

  const whiteDisconnectStarted = presence?.disconnectStartedAt?.white;
  const blackDisconnectStarted = presence?.disconnectStartedAt?.black;
  const whiteSecondsRemaining =
    whiteDisconnectStarted != null
      ? Math.max(0, Math.ceil((RECONNECT_DEADLINE_MS - (Date.now() - whiteDisconnectStarted)) / 1000))
      : 0;
  const blackSecondsRemaining =
    blackDisconnectStarted != null
      ? Math.max(0, Math.ceil((RECONNECT_DEADLINE_MS - (Date.now() - blackDisconnectStarted)) / 1000))
      : 0;
  const whiteConnected = presence == null ? true : presence.whiteConnected;
  const blackConnected = presence == null ? true : presence.blackConnected;

  return (
    <div className="flex min-w-0 flex-col gap-0">
      {/* ——— Stake: azul elegante, barra fina ——— */}
      <div
        className="mt-2 mb-4 w-full min-w-0 rounded-xl px-3 py-3 sm:mt-4 sm:mb-5 sm:px-6 sm:py-4"
        style={{
          background: `linear-gradient(180deg, ${BUTTON_BLUE} 0%, #1e3a8a 100%)`,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="mx-auto flex max-w-md items-center justify-center gap-4 sm:gap-12">
          <div className="flex min-w-0 items-baseline gap-1.5 sm:gap-2.5">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">At stake</span>
            <span className="text-lg font-semibold tabular-nums text-white sm:text-xl">${stakeDollars}</span>
          </div>
          <span className="h-3 w-px shrink-0 bg-white/20 sm:h-4" aria-hidden />
          <div className="flex min-w-0 items-baseline gap-1.5 sm:gap-2.5">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-amber-200/80">Win up to</span>
            <span className="text-lg font-semibold tabular-nums text-amber-200 sm:text-xl">${winDollars}</span>
          </div>
        </div>
      </div>

      {/* ——— Opponent disconnected (if applicable) ——— */}
      {(() => {
        const opponentKey: "white" | "black" = isPlayerWhite ? "black" : "white";
        const opponentConnected = presence == null ? true : opponentKey === "black" ? presence.blackConnected : presence.whiteConnected;
        const opponentDisconnectStarted = presence?.disconnectStartedAt?.[opponentKey];
        const show = isGameActive && presence != null && !opponentConnected && opponentDisconnectStarted != null;
        const sec = show && opponentDisconnectStarted != null ? Math.max(0, Math.ceil((RECONNECT_DEADLINE_MS - (Date.now() - opponentDisconnectStarted)) / 1000)) : 0;
        return show ? (
          <div className="border-b border-amber-500/40 bg-amber-950/60 px-3 py-2.5 text-center text-xs sm:px-4 sm:text-sm">
            <span className="font-semibold text-amber-200">Opponent disconnected</span>
            <span className="ml-1 sm:ml-2 text-stone-400">— Reconnect in <span className="font-mono font-bold text-amber-300">{sec}</span> s or forfeit</span>
          </div>
        ) : null;
      })()}

      {/* Partida en curso (o animación de jaque mate): tablero + sidebar */}
      {showGameView && (
        <div className="grid w-full grid-cols-1 grid-rows-[auto_auto] gap-4 md:grid-cols-[1fr_280px] md:gap-6 md:grid-rows-1 md:items-stretch">
          {/* ——— Game table: White | board | Black ——— */}
          <div className="flex min-w-0 flex-col rounded-xl border-2 border-stone-600/80 bg-gradient-to-b from-stone-800/95 to-stone-900/95 p-3 shadow-xl sm:rounded-2xl sm:p-5 sm:shadow-2xl">
            {/* Opponent row (above board — always the other player) */}
            <div
              className={`flex flex-wrap items-center gap-2 rounded-t-lg border-x border-t border-stone-600/80 px-3 py-2.5 transition sm:gap-3 sm:rounded-t-xl sm:px-4 sm:py-3 ${
                game.turn === (isPlayerWhite ? "b" : "w")
                  ? "bg-stone-700/80 ring-2 ring-inset ring-amber-500/50"
                  : "bg-stone-800/60"
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-widest text-stone-500">{isPlayerWhite ? "Black" : "White"}</span>
              <span className="min-w-0 truncate font-semibold text-white text-base">{opponentName}</span>
              <span className="hidden text-xs text-stone-400 sm:inline">ELO {isPlayerWhite ? game.black.elo : game.white.elo}</span>
              <span className={`ml-auto font-mono text-xl font-bold tabular-nums ${game.turn === (isPlayerWhite ? "b" : "w") ? "text-amber-400" : "text-stone-500"}`}>
                {formatClock(isPlayerWhite ? blackDisplayMs : whiteDisplayMs)}
              </span>
              {(isPlayerWhite ? blackCaptured : whiteCaptured).length > 0 || (isPlayerWhite ? blackScore : whiteScore) > 0 ? (
                <span className="flex items-center gap-1 text-stone-400">
                  {(isPlayerWhite ? blackCaptured : whiteCaptured).map((p, i) => (
                    <span key={`opp-${i}-${p}`} title={p} className="text-lg leading-none">
                      {isPlayerWhite ? WHITE_PIECE_SYMBOLS[p] ?? p : BLACK_PIECE_SYMBOLS[p] ?? p}
                    </span>
                  ))}
                  {(isPlayerWhite ? blackScore : whiteScore) > 0 && (
                    <span className="rounded bg-stone-600 px-1.5 py-0.5 text-sm font-bold text-amber-300">
                      +{isPlayerWhite ? blackScore : whiteScore}
                    </span>
                  )}
                </span>
              ) : null}
              <span className="text-xs">
                {isPlayerWhite ? blackConnected : whiteConnected ? (
                  <span className="text-emerald-400">●</span>
                ) : (
                  <span className="text-amber-400">● {isPlayerWhite ? blackSecondsRemaining : whiteSecondsRemaining}s</span>
                )}
              </span>
            </div>

            {/* Turn / Check (band above board) */}
            <div className="border-x border-stone-600/80 bg-stone-900/80 py-1.5 text-center sm:py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                {checkmateKingSquare ? (
                  <span className="text-red-400">Checkmate!</span>
                ) : (
                  <>
                    {inCheckSquare ? <span className="text-red-400">Check! — </span> : null}
                    {game.turn === "w" ? "White" : "Black"} to move
                  </>
                )}
              </span>
            </div>

            {/* Tablero */}
            <div className="border-x border-stone-600/80 bg-stone-800/50 px-1 py-2 sm:px-4 sm:py-4">
              <div className="mx-auto w-full max-w-[min(100%,26rem)] [&_.react-chessboard]:!rounded-lg [&_.react-chessboard]:!overflow-hidden">
                <Chessboard
                  options={{
                    position: game.fen,
                    boardOrientation,
                    allowDragging: game.turn === "w" ? isPlayerWhite : !isPlayerWhite,
                    onPieceDrop: (args) => handlePieceDrop(args),
                    onSquareClick: handleSquareClick,
                    boardStyle: { borderRadius: "1rem" },
                    darkSquareStyle: { backgroundColor: "#1e40af" },
                    lightSquareStyle: { backgroundColor: "#fff" },
                    squareStyles,
                    showAnimations: true,
                    animationDurationInMs: 220,
                  }}
                />
              </div>
            </div>

            {/* You (below board — always the current player) */}
            <div
              className={`flex flex-wrap items-center gap-2 rounded-b-lg border-x border-b border-stone-600/80 px-3 py-2.5 transition sm:gap-3 sm:rounded-b-xl sm:px-4 sm:py-3 ${
                game.turn === (isPlayerWhite ? "w" : "b")
                  ? "bg-stone-700/80 ring-2 ring-inset ring-amber-500/50"
                  : "bg-stone-800/60"
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-widest text-stone-500">{isPlayerWhite ? "White" : "Black"}</span>
              <span className="min-w-0 truncate font-semibold text-white text-base">{userName}</span>
              <span className="hidden text-xs text-stone-400 sm:inline">ELO {isPlayerWhite ? game.white.elo : game.black.elo}</span>
              <span className={`ml-auto font-mono text-xl font-bold tabular-nums ${game.turn === (isPlayerWhite ? "w" : "b") ? "text-amber-400" : "text-stone-500"}`}>
                {formatClock(isPlayerWhite ? whiteDisplayMs : blackDisplayMs)}
              </span>
              {(isPlayerWhite ? whiteCaptured : blackCaptured).length > 0 || (isPlayerWhite ? whiteScore : blackScore) > 0 ? (
                <span className="flex items-center gap-1 text-stone-400">
                  {(isPlayerWhite ? whiteCaptured : blackCaptured).map((p, i) => (
                    <span key={`me-${i}-${p}`} title={p} className="text-lg leading-none">
                      {isPlayerWhite ? BLACK_PIECE_SYMBOLS[p] ?? p : WHITE_PIECE_SYMBOLS[p] ?? p}
                    </span>
                  ))}
                  {(isPlayerWhite ? whiteScore : blackScore) > 0 && (
                    <span className="rounded bg-stone-600 px-1.5 py-0.5 text-xs font-bold text-amber-300">
                      +{isPlayerWhite ? whiteScore : blackScore}
                    </span>
                  )}
                </span>
              ) : null}
              <span className="text-xs">
                {isPlayerWhite ? whiteConnected : blackConnected ? (
                  <span className="text-emerald-400">●</span>
                ) : (
                  <span className="text-amber-400">● {isPlayerWhite ? whiteSecondsRemaining : blackSecondsRemaining}s</span>
                )}
              </span>
            </div>
          </div>

          {/* ——— Sidebar: moves + actions ——— */}
          <aside className="flex min-h-0 w-full flex-col shrink-0 md:h-full md:sticky md:top-4 md:w-[280px]">
            <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-stone-600/40 bg-stone-800/50 shadow-inner">
              <div className="shrink-0 border-b border-stone-600/30 px-3 py-2.5 sm:px-4">
                <p className="text-xs font-medium uppercase tracking-widest text-stone-500/90">Moves</p>
                {(() => {
                  const moves: string[] = [];
                  try {
                    if (game.moves) moves.push(...JSON.parse(game.moves));
                  } catch {}
                  const pairs: { n: number; white?: string; black?: string }[] = [];
                  for (let i = 0; i < moves.length; i += 2) {
                    pairs.push({
                      n: Math.floor(i / 2) + 1,
                      white: moves[i],
                      black: moves[i + 1],
                    });
                  }
                  if (pairs.length === 0) {
                    return <p className="mt-1 text-xs text-stone-500">—</p>;
                  }
                  return (
                    <div className="mt-1.5 max-h-[3.75rem] overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono text-stone-400 sm:text-sm">
                        {pairs.map(({ n, white, black }) => (
                          <span key={n} className="flex items-baseline gap-1.5">
                            <span className="w-4 shrink-0 text-stone-500/80">{n}.</span>
                            <span className="min-w-[2rem]">{white ?? "—"}</span>
                            <span className="min-w-[2rem]">{black ?? "—"}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-3 py-2.5">
                <p className="shrink-0 text-xs font-medium uppercase tracking-widest text-stone-500/90">Actions</p>
                <div className="mt-1.5 flex min-h-0 flex-1 flex-col">
                  <GameActions
                    gameId={gameId}
                    userId={userId}
                    opponentName={opponentName}
                    drawOfferBy={game.drawOfferBy}
                    chatStatus={game.chatStatus ?? "none"}
                    chatInitiatedBy={game.chatInitiatedBy}
                    isGameActive={isGameActive}
                    wsRef={wsRef}
                    userName={userName}
                    onGameUpdate={handleGameUpdate}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Vista de resumen (después de asimilar el jaque mate o cuando la partida terminó sin checkmate): Back to home, Summary, Movimientos, Tablero */}
      {showSummaryView && (
        <>
          <Link
            href="/"
            className="mt-4 w-fit self-start inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-base font-medium text-white transition-opacity hover:opacity-90 sm:mt-6"
            style={{ backgroundColor: BUTTON_BLUE }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Back to home
          </Link>
          <section className="mt-4 w-full min-w-0 sm:mt-6" aria-label="Game summary">
            <GameSummarySection
              game={game}
              userId={userId}
              eloDelta={
                gameOverPayload
                  ? isPlayerWhite
                    ? gameOverPayload.eloWhiteDelta
                    : gameOverPayload.eloBlackDelta
                  : undefined
              }
            />
          </section>

          {/* Lista de movimientos */}
          <section className="mt-6 w-full min-w-0 sm:mt-8" aria-label="Move list">
            <div className="rounded-xl border border-stone-600/40 bg-stone-800/50 px-3 py-3 sm:px-6 sm:py-5">
              <p className="text-xs font-medium uppercase tracking-widest text-stone-500/90">Moves</p>
              {(() => {
                const moves: string[] = [];
                try {
                  if (game.moves) moves.push(...JSON.parse(game.moves));
                } catch {}
                const pairs: { n: number; white?: string; black?: string }[] = [];
                for (let i = 0; i < moves.length; i += 2) {
                  pairs.push({
                    n: Math.floor(i / 2) + 1,
                    white: moves[i],
                    black: moves[i + 1],
                  });
                }
                if (pairs.length === 0) {
                  return <p className="mt-2 text-sm text-stone-500">—</p>;
                }
                return (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-mono text-stone-300 sm:mt-3 sm:gap-x-6 sm:text-sm">
                    {pairs.map(({ n, white, black }) => (
                      <span key={n} className="flex items-baseline gap-1.5 sm:gap-2">
                        <span className="w-5 shrink-0 text-stone-500 sm:w-6">{n}.</span>
                        <span className="min-w-[2rem] sm:min-w-[2.5rem]">{white ?? "—"}</span>
                        <span className="min-w-[2rem] sm:min-w-[2.5rem]">{black ?? "—"}</span>
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Tablero (posición final) */}
          <section className="mt-6 w-full min-w-0 sm:mt-8" aria-label="Final position">
            <div className="flex min-w-0 max-w-2xl flex-col rounded-xl border-2 border-stone-600/80 bg-gradient-to-b from-stone-800/95 to-stone-900/95 p-3 shadow-xl sm:rounded-2xl sm:p-5 sm:shadow-2xl">
              <div className="flex flex-wrap items-center gap-2 rounded-t-lg border-x border-t border-stone-600/80 bg-stone-800/60 px-3 py-2.5 sm:gap-3 sm:rounded-t-xl sm:px-4 sm:py-3">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">{isPlayerWhite ? "Black" : "White"}</span>
                <span className="truncate font-semibold text-white">{opponentName}</span>
                <span className="text-xs text-stone-400">ELO {isPlayerWhite ? game.black.elo : game.white.elo}</span>
              </div>
              <div className="border-x border-stone-600/80 bg-stone-800/50 px-1 py-2 sm:px-4 sm:py-4">
                <div className="mx-auto w-full max-w-[min(100%,26rem)] [&_.react-chessboard]:!rounded-lg [&_.react-chessboard]:!overflow-hidden">
                  <Chessboard
                    options={{
                      position: game.fen,
                      boardOrientation,
                      allowDragging: false,
                      boardStyle: { borderRadius: "1rem" },
                      darkSquareStyle: { backgroundColor: "#1e40af" },
                      lightSquareStyle: { backgroundColor: "#fff" },
                      squareStyles,
                      showAnimations: false,
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-b-lg border-x border-b border-stone-600/80 bg-stone-800/60 px-3 py-2.5 sm:gap-3 sm:rounded-b-xl sm:px-4 sm:py-3">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-500">{isPlayerWhite ? "White" : "Black"}</span>
                <span className="min-w-0 truncate font-semibold text-white text-sm sm:text-base">{userName}</span>
                <span className="text-xs text-stone-400">ELO {isPlayerWhite ? game.white.elo : game.black.elo}</span>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Promotion modal */}
      {pendingPromotion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-label="Choose promotion piece">
          <div className="w-full max-w-sm rounded-xl border border-stone-600 bg-stone-800/95 p-4 shadow-2xl sm:p-5">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-300 sm:mb-4 sm:text-sm">
              Promote pawn to
            </p>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {PROMOTION_PIECES.map((piece) => (
                <button
                  key={piece}
                  type="button"
                  onClick={() => {
                    tryMove(pendingPromotion.from, pendingPromotion.to, piece);
                    setPendingPromotion(null);
                  }}
                  className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg border border-stone-600 bg-stone-700/80 py-3 px-2 text-white transition active:scale-95 hover:border-amber-500/60 hover:bg-stone-700 hover:shadow-inner touch-manipulation sm:min-h-[72px] sm:gap-1.5"
                >
                  <span className="text-2xl sm:text-3xl">
                    {isPlayerWhite ? WHITE_PIECE_SYMBOLS[piece] : BLACK_PIECE_SYMBOLS[piece]}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-stone-400">{PROMOTION_LABELS[piece]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {settlementPending && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-stone-500 border-t-white" />
          <p className="text-center text-lg font-medium text-white">
            {settlementPending === "acreditando" ? "Acreditando fondos…" : "Actualizando banca…"}
          </p>
        </div>
      )}

      {showGameOverModal && gameOverPayload && (
        <GameOverModal
          result={result}
          stake={game.stake}
          eloDelta={eloDelta}
          fen={game.fen}
          profitCents={
            result === "win"
              ? Math.floor(game.stake * 2 * (1 - PLATFORM_FEE_PERCENT)) - game.stake
              : result === "loss"
                ? -game.stake
                : 0
          }
          whiteName={whiteName}
          blackName={blackName}
          whiteElo={game.white.elo}
          blackElo={game.black.elo}
          onClose={() => {
            setShowGameOverModal(false);
            setCheckmateKingSquare(null);
            settlementPendingShownAtRef.current = null;
            setSettlementPending(null);
            gameOverPayloadFromServerRef.current = null;
            setRematchRequestedByMe(false);
            setRematchRequestedByOpponent(false);
            setRematchDeclined(false);
            setRematchError(null);
          }}
          lossReason={lossReason}
          gameId={gameId}
          alreadyReported={game.alreadyReported}
          opponentName={opponentName}
          rematchRequestedByMe={rematchRequestedByMe}
          rematchRequestedByOpponent={rematchRequestedByOpponent}
          rematchDeclined={rematchDeclined}
          rematchError={rematchError}
          onRematch={() => {
            if (wsRef.current?.readyState !== 1) return;
            setRematchRequestedByMe(true);
            setRematchDeclined(false);
            setRematchError(null);
            wsRef.current.send(
              JSON.stringify({ type: "rematchRequest", userId, userName })
            );
          }}
          onAcceptRematch={() => {
            if (wsRef.current?.readyState !== 1) return;
            setRematchRequestedByOpponent(false);
            wsRef.current.send(JSON.stringify({ type: "rematchAccept", userId }));
          }}
          onDeclineRematch={() => {
            if (wsRef.current?.readyState !== 1) return;
            setRematchRequestedByOpponent(false);
            wsRef.current.send(JSON.stringify({ type: "rematchDecline", userId }));
          }}
        />
      )}
    </div>
  );
}
