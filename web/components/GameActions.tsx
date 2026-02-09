"use client";

import { useState, useRef, useEffect } from "react";

type GameActionsProps = {
  gameId: string;
  userId: string;
  opponentName: string;
  drawOfferBy: string | null;
  chatStatus: string | null;
  chatInitiatedBy: string | null;
  isGameActive: boolean;
  wsRef: React.RefObject<WebSocket | null>;
  userName: string;
  onGameUpdate: (updates: { drawOfferBy?: string | null; chatStatus?: string | null; chatInitiatedBy?: string | null }) => void;
};

type ChatMessage = {
  userId: string;
  userName: string | null;
  text: string;
  isMe: boolean;
  receivedAt?: number;
};

export default function GameActions({
  gameId,
  userId,
  opponentName,
  drawOfferBy,
  chatStatus,
  chatInitiatedBy,
  isGameActive,
  wsRef,
  userName,
  onGameUpdate,
}: GameActionsProps) {
  const [resigning, setResigning] = useState(false);
  const [offeringDraw, setOfferingDraw] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const status = chatStatus ?? "none";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function handleResign() {
    if (!confirm("Are you sure you want to resign? You will lose this game.")) return;
    setResigning(true);
    fetch(`/api/games/${gameId}/resign`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) alert(data.error);
      })
      .finally(() => setResigning(false));
  }

  function handleOfferDraw() {
    setOfferingDraw(true);
    fetch(`/api/games/${gameId}/offer-draw`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          setOfferingDraw(false);
        } else {
          onGameUpdate({ drawOfferBy: userId });
          setOfferingDraw(false);
        }
      })
      .catch(() => setOfferingDraw(false));
  }

  function handleDrawRespond(accept: boolean) {
    fetch(`/api/games/${gameId}/respond-draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) alert(data.error);
        else onGameUpdate({ drawOfferBy: null });
      });
  }

  function handleChatRequest() {
    fetch(`/api/games/${gameId}/chat-request`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) alert(data.error);
        else onGameUpdate({ chatStatus: "pending", chatInitiatedBy: userId });
      });
  }

  function handleChatRespond(accept: boolean) {
    fetch(`/api/games/${gameId}/chat-respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) alert(data.error);
        else onGameUpdate({ chatStatus: accept ? "accepted" : "declined", chatInitiatedBy: accept ? chatInitiatedBy : null });
      });
  }

  function sendChatMessage() {
    const text = chatInput.trim().slice(0, 500);
    if (!text || status !== "accepted" || !wsRef.current || wsRef.current.readyState !== 1) return;
    setChatMessages((prev) => [...prev, { userId, userName, text, isMe: true }]);
    wsRef.current.send(JSON.stringify({ type: "chatMessage", userId, userName, text }));
    setChatInput("");
  }

  function handleChatMessage(data: { userId: string; userName: string | null; text: string }) {
    if (data.userId === userId) return;
    const now = Date.now();
    setChatMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.isMe && last.userId === data.userId && last.text === data.text && (last.receivedAt ?? 0) > now - 500) {
        return prev;
      }
      return [...prev, { ...data, isMe: false, receivedAt: now }];
    });
  }

  useEffect(() => {
    const handler = (e: CustomEvent<{ userId: string; userName: string | null; text: string }>) => {
      handleChatMessage(e.detail);
    };
    window.addEventListener(`game-chat-message-${gameId}` as any, handler);
    return () => window.removeEventListener(`game-chat-message-${gameId}` as any, handler);
  }, [gameId, userId]);

  if (!isGameActive) return null;

  const isDrawOfferToMe = drawOfferBy && drawOfferBy !== userId;
  const iOfferedDraw = drawOfferBy === userId;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-stone-600 bg-stone-800/80 p-4 text-white shadow-xl sm:p-6">
      <h3 className="shrink-0 text-sm font-semibold text-white sm:text-base">Game actions</h3>
      <div className="mt-3 shrink-0 flex flex-wrap gap-2 sm:mt-4 sm:gap-3">
        <button
          type="button"
          onClick={handleOfferDraw}
          disabled={!!drawOfferBy || offeringDraw}
          className="min-h-[44px] flex-1 basis-0 rounded-lg border border-stone-500 bg-stone-700/80 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-stone-600/80 disabled:opacity-50 touch-manipulation sm:flex-none sm:basis-auto"
        >
          {offeringDraw ? "Offering…" : "Offer draw"}
        </button>
        <button
          type="button"
          onClick={handleResign}
          disabled={resigning}
          className="min-h-[44px] flex-1 basis-0 rounded-lg border border-red-500/50 bg-red-900/30 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-900/50 disabled:opacity-50 touch-manipulation sm:flex-none sm:basis-auto"
        >
          {resigning ? "Resigning…" : "Resign"}
        </button>
      </div>

      {isDrawOfferToMe && (
        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-900/30 p-3 sm:mt-4 sm:p-4">
          <p className="text-xs font-medium text-amber-200 sm:text-sm">{opponentName} offers a draw</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleDrawRespond(true)}
              className="min-h-[44px] flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 touch-manipulation"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => handleDrawRespond(false)}
              className="min-h-[44px] flex-1 rounded-lg border border-stone-500 bg-stone-700/80 px-4 py-2.5 text-sm text-stone-300 hover:bg-stone-600/80 touch-manipulation"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {iOfferedDraw && (
        <p className="mt-4 text-sm text-stone-400">Waiting for {opponentName} to respond to your draw offer.</p>
      )}

      {/* Chat: siempre visible con estética de chat; escribir solo tras solicitar y aceptar */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-stone-600/80 pt-5">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Chat</h4>
          {status === "accepted" && (
            <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-500/90">● Active</span>
          )}
        </div>
        {/* Área de mensajes: siempre visible; crece hasta igualar altura del tablero */}
        <div className="min-h-[10rem] flex-1 overflow-y-auto rounded-xl border border-stone-600/60 bg-stone-900/60 p-3 text-sm shadow-inner">
          {status === "accepted" ? (
            <>
              {chatMessages.length === 0 ? (
                <p className="py-4 text-center text-stone-500">No messages yet. Say hi!</p>
              ) : (
                <div className="space-y-2.5">
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
                          m.isMe
                            ? "rounded-br-md bg-blue-600/90 text-white"
                            : "rounded-bl-md bg-stone-600/80 text-stone-200"
                        }`}
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                          {m.isMe ? "You" : m.userName || "Opponent"}
                        </span>
                        <p className="mt-0.5 break-words">{m.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          ) : status === "pending" && chatInitiatedBy === userId ? (
            <div className="flex h-full min-h-[8rem] flex-col items-center justify-center text-center">
              <p className="text-stone-400">Waiting for {opponentName} to accept chat.</p>
              <p className="mt-1 text-xs text-stone-500">You can send messages once they accept.</p>
            </div>
          ) : status === "pending" && chatInitiatedBy !== userId ? (
            <div className="flex h-full min-h-[8rem] flex-col items-center justify-center text-center">
              <p className="text-stone-300">{opponentName} wants to chat</p>
              <p className="mt-1 text-xs text-stone-500">Accept or decline below.</p>
            </div>
          ) : status === "declined" ? (
            <div className="flex h-full min-h-[8rem] flex-col items-center justify-center text-center">
              <p className="text-stone-400">Chat was declined.</p>
              <p className="mt-1 text-xs text-stone-500">You can request again below.</p>
            </div>
          ) : (
            <div className="flex h-full min-h-[8rem] flex-col items-center justify-center text-center">
              <p className="text-stone-400">Chat with {opponentName}</p>
              <p className="mt-1 text-xs text-stone-500">Request chat below to enable messaging.</p>
            </div>
          )}
        </div>
        {/* Barra de input: habilitada solo cuando chat aceptado; resto = solicitar o aceptar/rechazar */}
        <div className="mt-3 flex shrink-0 items-center gap-2">
          {status === "accepted" ? (
            <>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Type a message…"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-stone-600 bg-stone-800/90 px-3 py-2.5 text-base text-white placeholder-stone-500 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500 sm:px-3.5 sm:text-sm"
                maxLength={500}
              />
              <button
                type="button"
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                className="min-h-[44px] shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 touch-manipulation"
              >
                Send
              </button>
            </>
          ) : status === "pending" && chatInitiatedBy !== userId ? (
            <>
              <button
                type="button"
                onClick={() => handleChatRespond(true)}
                className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 touch-manipulation"
              >
                Accept chat
              </button>
              <button
                type="button"
                onClick={() => handleChatRespond(false)}
                className="min-h-[44px] shrink-0 rounded-xl border border-stone-500 bg-stone-700/80 px-4 py-2.5 text-sm text-stone-300 hover:bg-stone-600/80 touch-manipulation"
              >
                Decline
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleChatRequest}
              className="min-h-[44px] w-full rounded-xl border border-stone-500/80 bg-stone-700/60 py-2.5 text-sm font-medium text-stone-300 transition hover:bg-stone-600/60 hover:text-stone-200 touch-manipulation"
            >
              {status === "declined" ? "Request chat again" : "Request chat"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
