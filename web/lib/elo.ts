/**
 * Cálculo de ELO estándar.
 * K = 32 (típico para jugadores con menos de 2400 y pocas partidas).
 */

const K = 32;

export function calculateExpected(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

export function calculateNewElo(
  currentElo: number,
  expectedScore: number,
  actualScore: number // 1 = win, 0 = loss, 0.5 = draw
): number {
  return Math.round(currentElo + K * (actualScore - expectedScore));
}

export function getEloChanges(
  winnerElo: number,
  loserElo: number,
  isDraw: boolean = false
): { winnerNew: number; loserNew: number; winnerDelta: number; loserDelta: number } {
  const expectedWinner = calculateExpected(winnerElo, loserElo);
  const expectedLoser = calculateExpected(loserElo, winnerElo);

  const winnerScore = isDraw ? 0.5 : 1;
  const loserScore = isDraw ? 0.5 : 0;

  const winnerNew = calculateNewElo(winnerElo, expectedWinner, winnerScore);
  const loserNew = calculateNewElo(loserElo, expectedLoser, loserScore);

  return {
    winnerNew,
    loserNew,
    winnerDelta: winnerNew - winnerElo,
    loserDelta: loserNew - loserElo,
  };
}
