import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { getDepositWallet } from "./deposit-address";
import { getWithdrawConfig, type NetworkId } from "./networks";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
] as const;

/** 1 USDC = 1e6; 1 cent = 1e4. So amountCents -> chain amount = amountCents * 1e4 */
const CENTS_TO_USDC = 1e4;

/** Gas limit for one ERC20 transfer (buffer over typical ~65k). */
const GAS_LIMIT_ERC20 = 80_000n;
/** Multiplier over estimated gas cost so user's wallet has enough after top-up. */
const GAS_TOPUP_MULTIPLIER = 150; // 1.5x

export type Network = NetworkId;

export type WithdrawResult =
  | { success: true; txHash: string }
  | { success: false; error: string };

/**
 * Sends native token (MATIC/ETH/etc.) from treasury to user's deposit address so they can pay gas.
 * Waits for 1 confirmation. Requires TREASURY_PRIVATE_KEY.
 * @param numTransfers - Number of ERC20 transfers the recipient will need to make (default 1).
 */
export async function sendGasTopUp(
  provider: JsonRpcProvider,
  userDepositAddress: string,
  networkId: string,
  numTransfers: number = 1
): Promise<{ ok: true } | { ok: false; error: string }> {
  const treasuryPk = process.env.TREASURY_PRIVATE_KEY;
  if (!treasuryPk) {
    return { ok: false, error: "Treasury not configured (TREASURY_PRIVATE_KEY) for gas top-up" };
  }
  const treasury = new Wallet(treasuryPk, provider);
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 50n * 10n ** 9n; // fallback 50 gwei
  const gasLimit = GAS_LIMIT_ERC20 * BigInt(Math.max(1, numTransfers));
  const nativeWei = (gasLimit * gasPrice * BigInt(GAS_TOPUP_MULTIPLIER)) / 100n;

  const treasuryBalance = await provider.getBalance(treasury.address);
  if (treasuryBalance < nativeWei) {
    return {
      ok: false,
      error: `Treasury has insufficient native token (e.g. MATIC) for gas top-up on ${networkId}. Please fund the treasury.`,
    };
  }

  try {
    const topUpTx = await treasury.sendTransaction({
      to: userDepositAddress,
      value: nativeWei,
    });
    await topUpTx.wait(1);
    logger.info("withdraw_gas_topup_sent", {
      networkId,
      to: userDepositAddress.slice(0, 10) + "...",
      txHash: topUpTx.hash,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("withdraw_gas_topup_failed", { networkId, error: msg });
    return { ok: false, error: msg };
  }
}

/**
 * Validate balance, send USDC from the user's deposit address to destination, update DB.
 * For non-platform users: treasury sends native token (MATIC/ETH) to the user's deposit address first so they can pay gas, then we execute the USDC transfer.
 */
export async function executeWithdraw(
  userId: string,
  amountCents: number,
  network: Network,
  destinationAddress: string
): Promise<WithdrawResult> {
  if (amountCents <= 0) return { success: false, error: "Amount must be positive" };
  const cfg = getWithdrawConfig(network);
  if (!cfg) return { success: false, error: `Network ${network} is not configured` };

  const provider = new JsonRpcProvider(cfg.rpcUrl);
  let wallet: Wallet;
  try {
    wallet = getDepositWallet(userId).connect(provider);
  } catch {
    return { success: false, error: "Deposit addresses not configured (DEPOSIT_MASTER_SECRET)" };
  }
  const topUp = await sendGasTopUp(provider, wallet.address, network);
  if (!topUp.ok) return { success: false, error: topUp.error };

  // Lock user row and verify balance atomically before sending on-chain tx
  try {
    await prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRawUnsafe<{ balance: number }[]>(
        `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
        userId
      );
      if (!row || row.balance < amountCents) {
        throw new Error("Insufficient balance");
      }
      // Deduct immediately while row is locked to prevent double-spend
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amountCents } },
      });
      await tx.ledgerEntry.create({
        data: {
          userId,
          amount: -amountCents,
          type: "withdrawal",
          description: `Withdrawal to ${destinationAddress.slice(0, 10)}... (${network})`,
        },
      });
    });
  } catch {
    return { success: false, error: "Insufficient balance" };
  }

  const amountWei = BigInt(amountCents) * BigInt(CENTS_TO_USDC);
  const usdc = new Contract(cfg.usdcAddress, ERC20_ABI, wallet);

  const onChainBalance = await usdc.balanceOf(wallet.address);
  if (onChainBalance < amountWei) {
    // Rollback: re-credit the balance since on-chain funds are insufficient
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { balance: { increment: amountCents } } }),
      prisma.ledgerEntry.create({
        data: {
          userId,
          amount: amountCents,
          type: "refund",
          description: `Withdrawal rollback — insufficient USDC on ${network}`,
        },
      }),
    ]);
    return {
      success: false,
      error: `Insufficient USDC on ${network}. Withdraw on the network where you deposited (e.g. Polygon).`,
    };
  }

  let tx;
  try {
    tx = await usdc.transfer(destinationAddress, amountWei);
    await tx.wait();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("withdraw_tx_failed", { userId, amountCents, network, error: msg });
    // Rollback: re-credit the balance since the on-chain tx failed
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { balance: { increment: amountCents } } }),
      prisma.ledgerEntry.create({
        data: {
          userId,
          amount: amountCents,
          type: "refund",
          description: `Withdrawal rollback — tx failed on ${network}`,
        },
      }),
    ]);
    if (msg.toLowerCase().includes("insufficient funds") || msg.toLowerCase().includes("gas")) {
      return { success: false, error: "Not enough native token (e.g. MATIC) for gas on your deposit address." };
    }
    return { success: false, error: msg };
  }

  const txHash = tx.hash;

  logger.info("withdraw_completed", {
    userId,
    amountCents,
    network,
    destinationAddress: destinationAddress.slice(0, 10) + "...",
    txHash,
  });

  return { success: true, txHash };
}
