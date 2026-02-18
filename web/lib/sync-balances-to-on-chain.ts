import { Contract, JsonRpcProvider } from "ethers";
import { prisma } from "./prisma";
import { getDepositAddress } from "./deposit-address";
import { getWithdrawConfig, type NetworkId } from "./networks";
import { logger } from "./logger";

const ERC20_ABI = ["function balanceOf(address account) view returns (uint256)"] as const;
/** USDC 6 decimals; we store cents → amountCents = balanceWei / 1e4 */
const USDC_WEI_TO_CENTS = 1e4;

const DEFAULT_NETWORK = "polygon";

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
    const provider = new JsonRpcProvider(cfg.rpcUrl);
    const usdc = new Contract(cfg.usdcAddress, ERC20_ABI, provider);
    const balanceWei = await usdc.balanceOf(address);
    const onChainCents = Math.floor(Number(balanceWei) / USDC_WEI_TO_CENTS);

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
  updated: number;
  details: {
    userId: string;
    previousBalanceCents: number;
    onChainCents: number;
    newBalanceCents: number;
    adjusted: boolean;
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
    const users = await prisma.user.findMany({
      select: { id: true, balance: true },
      orderBy: { id: "asc" },
    });

    const provider = new JsonRpcProvider(cfg.rpcUrl);
    const usdc = new Contract(cfg.usdcAddress, ERC20_ABI, provider);

    const details: SyncResult["details"] = [];
    let updatedCount = 0;

    for (const user of users) {
      let address: string;
      try {
        address = getDepositAddress(user.id);
      } catch {
        details.push({
          userId: user.id,
          previousBalanceCents: user.balance,
          onChainCents: 0,
          newBalanceCents: user.balance,
          adjusted: false,
        });
        continue;
      }

      const balanceWei = await usdc.balanceOf(address);
      const onChainCents = Math.floor(Number(balanceWei) / USDC_WEI_TO_CENTS);
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
    }

    return {
      ok: true,
      network: networkNorm,
      totalUsers: users.length,
      updated: updatedCount,
      details,
    };
  } catch (e) {
    logger.error("sync_balances_to_on_chain_error", { error: String(e) });
    return { ok: false, error: String(e) };
  }
}
