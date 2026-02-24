/**
 * On-chain settlement when a game ends with a winner.
 * From the loser's wallet: (pot minus platform fee) to winner, platform fee to treasury.
 * Winner keeps their stake in their wallet; we only move the loser's stake.
 */

import { Contract, JsonRpcProvider } from "ethers";
import { prisma } from "./prisma";
import { getDepositWallet } from "./deposit-address";
import { getWithdrawConfig, type NetworkId } from "./networks";
import { sendGasTopUp } from "./withdraw";
import { logger } from "./logger";
import { PLATFORM_FEE_PERCENT } from "./commission";
import { syncUserBalanceFromOnChain } from "./sync-balances-to-on-chain";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
] as const;
const CENTS_TO_USDC = 1e4;

const DEFAULT_NETWORK: NetworkId = "polygon";

export type SettleOnChainResult =
  | { ok: true }
  | { ok: false; error: string };

const SETTLEMENT_MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Liquidación on-chain: desde el perdedor se envía (stake − fee) al ganador y fee a TREASURY_ADDRESS.
 * El ganador no mueve su stake (menos gas, DB y wallet quedan alineados).
 */
export async function executeOnChainSettlement(
  winnerId: string,
  loserId: string,
  stakeCents: number,
  networkId?: NetworkId
): Promise<SettleOnChainResult> {
  const network = String(networkId ?? process.env.SETTLEMENT_NETWORK ?? DEFAULT_NETWORK)
    .trim()
    .toLowerCase() as NetworkId;
  const cfg = getWithdrawConfig(network);
  if (!cfg) {
    return { ok: false, error: `Settlement network ${network} is not configured` };
  }

  const totalPotCents = 2 * stakeCents;
  const feeCents = Math.floor(totalPotCents * PLATFORM_FEE_PERCENT);
  const winnerGetsCents = stakeCents - feeCents;

  const treasuryAddress = process.env.TREASURY_ADDRESS;
  if (!treasuryAddress?.startsWith("0x")) {
    return { ok: false, error: "TREASURY_ADDRESS not set; required for on-chain commission" };
  }

  const provider = new JsonRpcProvider(cfg.rpcUrl);
  const loserWallet = getDepositWallet(loserId).connect(provider);
  const winnerAddress = getDepositWallet(winnerId).address;
  const usdc = new Contract(cfg.usdcAddress, ERC20_ABI, loserWallet);

  const loserBalanceWei = await usdc.balanceOf(loserWallet.address);
  const requiredWei = BigInt(stakeCents) * BigInt(CENTS_TO_USDC);
  if (loserBalanceWei < requiredWei) {
    return {
      ok: false,
      error: `Loser's address has insufficient USDC on ${network} for settlement (need ${stakeCents} cents).`,
    };
  }

  const topUp = await sendGasTopUp(provider, loserWallet.address, network, 2);
  if (!topUp.ok) return topUp;

  const winnerWei = BigInt(winnerGetsCents) * BigInt(CENTS_TO_USDC);
  const feeWei = BigInt(feeCents) * BigInt(CENTS_TO_USDC);

  try {
    const tx1 = await usdc.transfer(winnerAddress, winnerWei);
    await tx1.wait(1);
    const tx2 = await usdc.transfer(treasuryAddress, feeWei);
    await tx2.wait(1);
    logger.info("settle_on_chain_done", {
      network,
      winnerId,
      loserId,
      stakeCents,
      winnerGetsCents,
      feeCents,
      txHash1: tx1.hash,
      txHash2: tx2.hash,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("settle_on_chain_failed", { network, winnerId, loserId, error: msg });
    return { ok: false, error: msg };
  }
}

/**
 * Runs on-chain settlement and updates Game.settlementStatus (pending → completed | failed).
 * Call this after settleGame() when there is a winner. On failure, logs and sets "failed" so cron can retry.
 */
export async function executeOnChainSettlementAndUpdateGame(
  gameId: string,
  winnerId: string,
  loserId: string,
  stakeCents: number,
  networkId?: NetworkId
): Promise<SettleOnChainResult> {
  await prisma.game.update({
    where: { id: gameId },
    data: { settlementStatus: "pending" },
  });

  const network = String(networkId ?? process.env.SETTLEMENT_NETWORK ?? DEFAULT_NETWORK)
    .trim()
    .toLowerCase() as NetworkId;
  let result: SettleOnChainResult = { ok: false, error: "Settlement not attempted" };
  try {
    for (let attempt = 1; attempt <= SETTLEMENT_MAX_ATTEMPTS; attempt++) {
      result = await executeOnChainSettlement(winnerId, loserId, stakeCents, network);
      if (result.ok) break;
      logger.warn("settlement_attempt_failed", {
        gameId,
        winnerId,
        loserId,
        attempt,
        maxAttempts: SETTLEMENT_MAX_ATTEMPTS,
        error: result.error,
      });
      if (attempt < SETTLEMENT_MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  } catch (e) {
    result = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    logger.error("settlement_unexpected_error", { gameId, winnerId, loserId, error: result.error });
  }

  await prisma.game.update({
    where: { id: gameId },
    data: { settlementStatus: result.ok ? "completed" : "failed" },
  });

  // Keep app balances aligned with on-chain even if settlement partially failed/retried.
  // This prevents DB/wallet drift from accumulating between games.
  try {
    await Promise.all([
      syncUserBalanceFromOnChain(winnerId, network),
      syncUserBalanceFromOnChain(loserId, network),
    ]);
  } catch (e) {
    logger.warn("post_settlement_balance_sync_failed", {
      gameId,
      winnerId,
      loserId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  if (!result.ok) {
    logger.error("settlement_failed_admin_alert", { gameId, winnerId, loserId, error: result.error });
  }

  return result;
}
