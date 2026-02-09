"use client";

import { Chessboard } from "react-chessboard";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const SQUARE_DARK = "#1e40af";

export default function MiniChessBoard() {
  return (
    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg shadow-md sm:h-28 sm:w-28 md:h-32 md:w-32 [&_.react-chessboard]:!rounded-lg [&_.react-chessboard]:!h-full [&_.react-chessboard]:!w-full [&_.react-chessboard]:!min-h-0 [&_.react-chessboard]:!min-w-0">
      <Chessboard
        options={{
          position: START_FEN,
          allowDragging: false,
          boardOrientation: "white",
          showNotation: false,
          boardStyle: { borderRadius: "0.5rem" },
          darkSquareStyle: { backgroundColor: SQUARE_DARK },
          lightSquareStyle: { backgroundColor: "#fff" },
          showAnimations: false,
        }}
      />
    </div>
  );
}
