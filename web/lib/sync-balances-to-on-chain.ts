import { Contract, JsonRpcProvider } from "ethers";
import { prisma } from "./prisma";
import { getDepositAddress } from "./deposit-address";
import { getWithdrawConfig, type NetworkId } from "./networks";
import { logger } from "./logger";

const ERC20_ABI = ["function balanceOf(address account) view returns (uint256)"] as const;
/** USDC 6 decimals; we store cents → amountCents = balanceWei / 1e4 */
const USDC_WEI_TO_CENTS = 1e4;
const USDC_WEI_TO_CENTS_BI = BigInt(USDC_WEI_TO_CENTS);
const MAX_CENTS_SAFE_BI = BigInt(Number.MAX_SAFE_INTEGER);
const BALANCE_RPC_TIMEOUT_MS = Math.max(
  3_000,
  parseInt(process.env.SYNC_BALANCES_RPC_TIMEOUT_MS || "12000", 10) || 12000
);
const MAX_USERS_PER_RUN = Math.max(
  1,
  parseInt(process.env.SYNC_BALANCES_MAX_USERS_PER_RUN || "500", 10) || 500
);
const SYNC_BALANCES_CURSOR_CHAIN_ID = -999_001;

const DEFAULT_NETWORK = "polygon";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function readUsdcBalanceWithFallback(
  primaryRpcUrl: string,
  fallbackRpcUrl: string | undefined,
  usdcAddress: string,
  address: string
): Promise<bigint> {
  const primaryProvider = new JsonRpcProvider(primaryRpcUrl);
  const primaryUsdc = new Contract(usdcAddress, ERC20_ABI, primaryProvider);
  try {
    return await withTimeout(primaryUsdc.balanceOf(address), BALANCE_RPC_TIMEOUT_MS, "balanceOf");
  } catch (primaryErr) {
    if (!fallbackRpcUrl || fallbackRpcUrl === primaryRpcUrl) {
      throw primaryErr;
    }
    const fallbackProvider = new JsonRpcProvider(fallbackRpcUrl);
    const fallbackUsdc = new Contract(usdcAddress, ERC20_ABI, fallbackProvider);
    return await withTimeout(
      fallbackUsdc.balanceOf(address),
      BALANCE_RPC_TIMEOUT_MS,
      "balanceOf (fallback)"
    );
  }
}

/**
 * Syncs a single user's DB balance to match their deposit wallet USDC on-chain.
 * Call after every deposit, withdrawal, and game settlement so the app balance always matches the wallet.
 * Does not throw — logs errors so the main flow is not broken.
 */
export async function syncUserBalanceFromOnChain(
  userId: string,
  network: string = DEFAULT_NETWORK
): Promise<void> {
  const networkNorm = network.trim().toLowerCase();
  const cfg = getWithdrawConfig(networkNorm as NetworkId);
  if (!cfg) return;

  if (!process.env.DEPOSIT_MASTER_SECRET || process.env.DEPOSIT_MASTER_SECRET.length < 16) return;

  try {
    const address = getDepositAddress(userId);
    const balanceWei = await readUsdcBalanceWithFallback(
      cfg.rpcUrl,
      cfg.fallbackRpcUrl,
      cfg.usdcAddress,
      address
    );
    const onChainCentsBi = balanceWei / USDC_WEI_TO_CENTS_BI;
    if (onChainCentsBi > MAX_CENTS_SAFE_BI) {
      logger.error("sync_user_balance_overflow", { userId, network: networkNorm });
      return;
    }
    const onChainCents = Number(onChainCentsBi);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user || user.balance === onChainCents) return;

    const delta = onChainCents - user.balance;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { balance: onChainCents },
      }),
      prisma.ledgerEntry.create({
        data: {
          userId,
          amount: delta,
          type: "adjustment",
          description: `Balance synced to on-chain USDC (${networkNorm})`,
        },
      }),
    ]);
    logger.info("sync_user_balance_to_on_chain", {
      userId,
      previousBalanceCents: user.balance,
      onChainCents,
      network: networkNorm,
    });
  } catch (e) {
    logger.error("sync_user_balance_error", { userId, network: networkNorm, error: String(e) });
  }
}

export type SyncResult = {
  ok: true;
  network: string;
  totalUsers: number;
  totalUsersInDb: number;
  windowOffset: number;
  nextOffset: number;
  updated: number;
  failed: number;
  details: {
    userId: string;
    previousBalanceCents: number;
    onChainCents: number;
    newBalanceCents: number;
    adjusted: boolean;
    error?: string;
  }[];
};

export type SyncError = { ok: false; error: string };

/**
 * Syncs every user's DB balance to match their deposit wallet USDC balance on-chain.
 * On-chain is the source of truth. Creates "adjustment" ledger entries when correcting.
 */
export async function syncBalancesToOnChain(
  network: string = "polygon"
): Promise<SyncResult | SyncError> {
  const networkNorm = network.trim().toLowerCase();
  const cfg = getWithdrawConfig(networkNorm as NetworkId);
  if (!cfg) {
    return { ok: false, error: `Network "${network}" is not configured` };
  }

  if (!process.env.DEPOSIT_MASTER_SECRET || process.env.DEPOSIT_MASTER_SECRET.length < 16) {
    return { ok: false, error: "DEPOSIT_MASTER_SECRET not set" };
  }

  try {
    const totalUsersInDb = await prisma.user.count();
    let windowOffset = 0;
    let canPersistCursor = true;
    try {
      const cursor = await prisma.indexedTransferCursor.findUnique({
        where: { chainId: SYNC_BALANCES_CURSOR_CHAIN_ID },
        select: { lastBlockNumber: true },
      });
      if (cursor && Number.isFinite(cursor.lastBlockNumber)) {
        windowOffset = Math.max(0, cursor.lastBlockNumber);
      }
    } catch {
      // Older deployments may not have indexed_transfer_cursors yet.
      canPersistCursor = false;
      windowOffset = 0;
    }
    if (windowOffset >= totalUsersInDb) windowOffset = 0;

    let users = await prisma.user.findMany({
      select: { id: true, balance: true },
      orderBy: { id: "asc" },
      skip: windowOffset,
      take: MAX_USERS_PER_RUN,
    });
    if (users.length === 0 && windowOffset > 0) {
      // Safety: if offset points past end due concurrent user deletions, wrap to start.
      windowOffset = 0;
      users = await prisma.user.findMany({
        select: { id: true, balance: true },
        orderBy: { id: "asc" },
        take: MAX_USERS_PER_RUN,
      });
    }

    const details: SyncResult["details"] = [];
    let updatedCount = 0;
    let failedCount = 0;

    for (const user of users) {
      try {
        const address = getDepositAddress(user.id);
        const balanceWei = await readUsdcBalanceWithFallback(
          cfg.rpcUrl,
          cfg.fallbackRpcUrl,
          cfg.usdcAddress,
          address
        );
        const onChainCentsBi = balanceWei / USDC_WEI_TO_CENTS_BI;
        if (onChainCentsBi > MAX_CENTS_SAFE_BI) {
          throw new Error("on-chain balance exceeds supported integer range");
        }
        const onChainCents = Number(onChainCentsBi);
        const previousBalanceCents = user.balance;
        const delta = onChainCents - previousBalanceCents;
        const adjusted = delta !== 0;

        if (adjusted) {
          await prisma.$transaction([
            prisma.user.update({
              where: { id: user.id },
              data: { balance: onChainCents },
            }),
            prisma.ledgerEntry.create({
              data: {
                userId: user.id,
                amount: delta,
                type: "adjustment",
                description: `Balance synced to on-chain USDC (${networkNorm})`,
              },
            }),
          ]);
          updatedCount++;
          logger.info("sync_balance_to_on_chain", {
            userId: user.id,
            previousBalanceCents,
            onChainCents,
            network: networkNorm,
          });
        }

        details.push({
          userId: user.id,
          previousBalanceCents,
          onChainCents,
          newBalanceCents: onChainCents,
          adjusted,
        });
      } catch (e) {
        failedCount++;
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("sync_balance_user_failed", {
          userId: user.id,
          network: networkNorm,
          error: msg,
        });
        details.push({
          userId: user.id,
          previousBalanceCents: user.balance,
          onChainCents: user.balance,
          newBalanceCents: user.balance,
          adjusted: false,
          error: msg,
        });
      }
    }

    const nextOffset =
      totalUsersInDb === 0 || users.length === 0
        ? 0
        : windowOffset + users.length >= totalUsersInDb
          ? 0
          : windowOffset + users.length;
    if (canPersistCursor) {
      try {
        await prisma.indexedTransferCursor.upsert({
          where: { chainId: SYNC_BALANCES_CURSOR_CHAIN_ID },
          create: { chainId: SYNC_BALANCES_CURSOR_CHAIN_ID, lastBlockNumber: nextOffset },
          update: { lastBlockNumber: nextOffset },
        });
      } catch {
        // Non-fatal: sync result is still valid for this run.
      }
    }

    return {
      ok: true,
      network: networkNorm,
      totalUsers: users.length,
      totalUsersInDb,
      windowOffset,
      nextOffset,
      updated: updatedCount,
      failed: failedCount,
      details,
    };
  } catch (e) {
    logger.error("sync_balances_to_on_chain_error", { error: String(e) });
    return { ok: false, error: String(e) };
  }
}
