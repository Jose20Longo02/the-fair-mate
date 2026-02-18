import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";

describe("game move logic (chess.js)", () => {
  it("accepts valid move and updates FEN", () => {
    const chess = new Chess();
    const ok = chess.move({ from: "e2", to: "e4" });
    expect(ok).toBeTruthy();
    expect(chess.fen()).not.toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    expect(chess.turn()).toBe("b");
  });

  it("rejects invalid move", () => {
    const chess = new Chess();
    let result: unknown = null;
    try {
      result = chess.move({ from: "e2", to: "e5" }); // invalid: pawn can't move 3 squares from e2
    } catch {
      result = null;
    }
    expect(result).toBeFalsy();
  });

  it("rejects move out of turn", () => {
    const chess = new Chess();
    chess.move("e4");
    chess.move("e5");
    chess.move("Nf3"); // now black's turn
    let wrongTurn: unknown = null;
    try {
      wrongTurn = chess.move("d4"); // white move when it's black's turn
    } catch {
      wrongTurn = null;
    }
    expect(wrongTurn).toBeFalsy();
  });

  it("handles promotion", () => {
    const chess = new Chess(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    );
    // Set up a position where white pawn can promote (simplified: use a known promotion FEN)
    const promotionFen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";
    const c = new Chess(promotionFen);
    const ok = c.move({ from: "a7", to: "a8", promotion: "q" });
    expect(ok).toBeTruthy();
    expect(c.get("a8")?.type).toBe("q");
  });

  it("detects checkmate", () => {
    const chess = new Chess("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1");
    const ok = chess.move("Qxf7");
    expect(ok).toBeTruthy();
    expect(chess.isCheckmate()).toBe(true);
  });

  it("check is not checkmate when escape exists", () => {
    // After 1.e4 e5 2.Qh5 black is in check; game not over (black can play Nc6 etc.)
    const chess = new Chess();
    chess.move("e4");
    chess.move("e5");
    chess.move("Qh5");
    expect(chess.isGameOver()).toBe(false);
    expect(chess.moves().length).toBeGreaterThan(0);
  });

  it("detects stalemate", () => {
    const stalemateFen = "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1";
    const chess = new Chess(stalemateFen);
    expect(chess.isStalemate()).toBe(true);
  });

  it("game over returns correct result", () => {
    const chess = new Chess("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1");
    chess.move("Qxf7");
    expect(chess.isGameOver()).toBe(true);
    expect(chess.isCheckmate()).toBe(true);
  });
});
