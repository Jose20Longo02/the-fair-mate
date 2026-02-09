/**
 * Build a PGN string from game metadata and SAN moves.
 * Used for exporting to Lichess (paste) or other tools.
 */
export function buildPgn(options: {
  whiteName: string;
  blackName: string;
  whiteElo?: number;
  blackElo?: number;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  date: Date;
  moves: string[];
}): string {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const { whiteName, blackName, whiteElo, blackElo, result, date, moves } = options;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}.${month}.${day}`;

  const headers = [
    '[Event "Stakes Chess Game"]',
    '[Site "Stakes Chess"]',
    `[Date "${dateStr}"]`,
    `[White "${escape(whiteName)}"]`,
    `[Black "${escape(blackName)}"]`,
    ...(whiteElo != null ? [`[WhiteElo "${whiteElo}"]`] : []),
    ...(blackElo != null ? [`[BlackElo "${blackElo}"]`] : []),
    `[Result "${result}"]`,
    "",
  ].join("\n");

  if (moves.length === 0) {
    return headers + "*";
  }

  // Format moves as "1. e4 e5 2. Nf3 Nc6"
  const movePairs: string[] = [];
  let i = 0;
  let moveNum = 1;
  while (i < moves.length) {
    const whiteMove = moves[i];
    const blackMove = i + 1 < moves.length ? moves[i + 1] : null;
    if (blackMove != null) {
      movePairs.push(`${moveNum}. ${whiteMove} ${blackMove}`);
    } else {
      movePairs.push(`${moveNum}. ${whiteMove}`);
    }
    i += 2;
    moveNum += 1;
  }

  return headers + movePairs.join(" ") + " " + result;
}
