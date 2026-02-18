import { Contract, JsonRpcProvider } from "ethers";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { getDepositAddress, getDepositAddressToUserIdMap } from "./deposit-address";
import {
  getIndexerContractConfigs,
  getIndexerTransferConfigs,
  getIndexFromBlockEnv,
} from "./networks";

const DEPOSIT_ABI = [
  "event DepositFor(string userId, uint256 amount)",
] as const;
const ERC20_TRANSFER_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;

/** USDC has 6 decimals; we store cents (2 decimals). So amountCents = amount / 1e4 */
const USDC_TO_CENTS = 1e4;

/** Reintenta la operación hasta 3 veces si falla por 503 / server error. */
async function withRetry<T>(fn: () => Promise<T>, delayMs = 2000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e instanceof Error ? e.message : e);
      if (i < 2 && (msg.includes("503") || msg.includes("Unable to complete") || msg.includes("SERVER_ERROR"))) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Nº de bloques a escanear por ejecución (~10 min en Polygon). Si el cron corre cada 2 min, no se pierden depósitos. */
const INITIAL_BACKFILL_BLOCKS = 500;

/** Si no hay últimos eventos: solo desde env (ej. POLYGON_INDEX_FROM_BLOCK). Sin env, no backfill para no reprocesar depósitos antiguos. */
function defaultFromBlock(chainId: number, toBlock: number): number {
  const envKey = getIndexFromBlockEnv(chainId);
  const fromEnv = envKey ? process.env[envKey] : null;
  const n = fromEnv ? parseInt(fromEnv, 10) : NaN;
  if (!isNaN(n) && n >= 0) return Math.min(n, toBlock);
  return toBlock;
}

type ChainConfig = {
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  /** Si el RPC principal devuelve Internal error (-32000), se reintenta con este. */
  fallbackRpcUrl?: string;
};

type TransferChainConfig = {
  chainId: number;
  rpcUrl: string;
  usdcAddress: string;
  fallbackRpcUrl?: string;
};

function getChainConfigs(): ChainConfig[] {
  return getIndexerContractConfigs();
}

function getTransferChainConfigs(): TransferChainConfig[] {
  return getIndexerTransferConfigs();
}

/**
 * Index deposit events: (1) DepositFor from contract, (2) USDC Transfer to user deposit addresses.
 * Idempotent: each (chainId, txHash, logIndex) is processed at most once.
 */
export async function indexDeposits(): Promise<{
  processed: number;
  errors: string[];
  /** Rango escaneado por cadena (para comparar con el bloque de tu tx en PolygonScan). */
  scanned?: { chainId: number; fromBlock: number; toBlock: number }[];
}> {
  const contractConfigs = getChainConfigs();
  const transferConfigs = getTransferChainConfigs();
  if (contractConfigs.length === 0 && transferConfigs.length === 0) {
    return { processed: 0, errors: ["No chain config (POLYGON_* or BASE_* env vars)"] };
  }

  let totalProcessed = 0;
  const errors: string[] = [];
  const scanned: { chainId: number; fromBlock: number; toBlock: number }[] = [];

  for (const cfg of contractConfigs) {
    try {
      const result = await indexDepositsForChain(cfg);
      totalProcessed += result.processed;
      errors.push(...result.errors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Chain ${cfg.chainId} (contract): ${msg}`);
      logger.error("index_deposits_chain_error", { chainId: cfg.chainId, error: msg });
    }
  }

  if (process.env.DEPOSIT_MASTER_SECRET && process.env.DEPOSIT_MASTER_SECRET.length >= 16) {
    const userIds = await prisma.user.findMany({ select: { id: true }, where: {} }).then((u) => u.map((r) => r.id));
    const depositAddressToUser = getDepositAddressToUserIdMap(userIds);
    for (const cfg of transferConfigs) {
      try {
        const provider = new JsonRpcProvider(cfg.rpcUrl);
        const toB = await provider.getBlockNumber();
        const chunkSize = 10;
        let startFrom: number;
        let useCursor = false;
        try {
          const cursor = await prisma.indexedTransferCursor.findUnique({
            where: { chainId: cfg.chainId },
            select: { lastBlockNumber: true },
          });
          startFrom = cursor ? cursor.lastBlockNumber + 1 : defaultFromBlock(cfg.chainId, toB);
          useCursor = true;
        } catch {
          startFrom = defaultFromBlock(cfg.chainId, toB);
        }
        if (startFrom <= toB) {
          scanned.push({ chainId: cfg.chainId, fromBlock: startFrom, toBlock: toB });
          let lastScannedBlock = startFrom - 1;
          for (let fromB = startFrom; fromB <= toB; fromB += chunkSize) {
            const endB = Math.min(fromB + chunkSize - 1, toB);
            const result = await indexTransfersToDepositAddresses(cfg, depositAddressToUser, fromB, endB);
            totalProcessed += result.processed;
            errors.push(...result.errors);
            lastScannedBlock = endB;
          }
          if (useCursor) {
            try {
              await prisma.indexedTransferCursor.upsert({
                where: { chainId: cfg.chainId },
                create: { chainId: cfg.chainId, lastBlockNumber: lastScannedBlock },
                update: { lastBlockNumber: lastScannedBlock },
              });
            } catch {
              // Prisma client sin modelo indexedTransferCursor (proceso antiguo)
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Chain ${cfg.chainId} (transfer): ${msg}`);
        logger.error("index_transfers_chain_error", { chainId: cfg.chainId, error: msg });
      }
    }
  }

  return { processed: totalProcessed, errors, scanned: scanned.length ? scanned : undefined };
}

/**
 * Acredita un depósito por txHash (útil cuando la dirección no coincide con el mapa por cambio de secret/user).
 * Si userIdOverride viene, se acredita el primer Transfer USDC de la tx a ese usuario (manual/soporte).
 * Protegido por cron/matchmaking secret. Idempotente.
 */
export async function creditDepositByTxHash(
  chainId: number,
  txHash: string,
  userIdOverride?: string
): Promise<{ ok: boolean; processed: number; error?: string }> {
  const configs = getIndexerTransferConfigs();
  const cfg = configs.find((c) => c.chainId === chainId);
  if (!cfg) return { ok: false, processed: 0, error: `Chain ${chainId} not configured` };

  if (!userIdOverride && (!process.env.DEPOSIT_MASTER_SECRET || process.env.DEPOSIT_MASTER_SECRET.length < 16)) {
    return { ok: false, processed: 0, error: "DEPOSIT_MASTER_SECRET not set" };
  }

  const allUserIds = await prisma.user.findMany({ select: { id: true }, where: {} }).then((u) => u.map((r) => r.id));
  const allDepositMap = getDepositAddressToUserIdMap(allUserIds);
  const depositAddressesSet = new Set(allDepositMap.keys());

  let depositAddressToUser: Map<string, string>;
  if (userIdOverride) {
    const user = await prisma.user.findUnique({ where: { id: userIdOverride }, select: { id: true } });
    if (!user) return { ok: false, processed: 0, error: "User not found" };
    depositAddressToUser = new Map();
  } else {
    depositAddressToUser = allDepositMap;
  }

  const provider = new JsonRpcProvider(cfg.fallbackRpcUrl || cfg.rpcUrl);
  const receipt = await provider.getTransactionReceipt(txHash.trim().toLowerCase());
  if (!receipt) return { ok: false, processed: 0, error: "Transaction not found" };

  const usdc = new Contract(cfg.usdcAddress, ERC20_TRANSFER_ABI, provider);
  const transferEvent = usdc.interface.getEvent("Transfer");
  if (!transferEvent) return { ok: false, processed: 0, error: "Transfer event not found in ABI" };
  const transferTopic = transferEvent.topicHash;
  let processed = 0;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== cfg.usdcAddress.toLowerCase() || log.topics[0] !== transferTopic) continue;
    const parsed = usdc.interface.parseLog({ topics: log.topics as string[], data: log.data });
    if (!parsed || parsed.name !== "Transfer") continue;
    const from = (parsed.args as { from?: string }).from?.toLowerCase();
    if (from && depositAddressesSet.has(from)) continue;
    const to = (parsed.args.to as string).toLowerCase();
    const value = parsed.args.value as bigint;
    const userId = userIdOverride
      ? (to === getDepositAddress(userIdOverride).toLowerCase() ? userIdOverride : null)
      : depositAddressToUser.get(to);
    if (!userId) continue;

    const txHashLow = receipt.hash.toLowerCase();
    const logIndex = log.index;
    const existing = await prisma.processedDepositEvent.findUnique({
      where: { chainId_txHash_logIndex: { chainId, txHash: txHashLow, logIndex } },
    });
    if (existing) continue;

    const amountCents = Math.floor(Number(value) / USDC_TO_CENTS);
    if (amountCents <= 0) continue;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.processedDepositEvent.create({
          data: { chainId, txHash: txHashLow, logIndex, blockNumber: receipt.blockNumber },
        });
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amountCents } },
        });
        await tx.ledgerEntry.create({
          data: {
            userId,
            amount: amountCents,
            type: "deposit",
            description: userIdOverride
              ? `Manual credit by txHash (chain ${chainId})`
              : `Transfer to deposit address (chain ${chainId}, manual credit by txHash)`,
          },
        });
      });
      processed++;
      logger.info("credit_deposit_by_tx_hash", { userId, amountCents, chainId, txHash: txHashLow });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, processed, error: msg };
    }
  }

  if (processed === 0) {
    return {
      ok: true,
      processed: 0,
      error: "No Transfer to a known deposit address in this tx, or already credited",
    };
  }
  return { ok: true, processed };
}

async function indexTransfersToDepositAddresses(
  cfg: TransferChainConfig,
  depositAddressToUser: Map<string, string>,
  fromBlock: number,
  endBlock: number
): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  const provider = new JsonRpcProvider(cfg.rpcUrl);
  const usdc = new Contract(cfg.usdcAddress, ERC20_TRANSFER_ABI, provider);

  let events: Awaited<ReturnType<typeof usdc.queryFilter>>;
  try {
    events = await withRetry(() =>
      usdc.queryFilter(usdc.getEvent("Transfer"), fromBlock, endBlock)
    );
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (cfg.fallbackRpcUrl && (msg.includes("Internal error") || msg.includes("-32000"))) {
      const fallbackProvider = new JsonRpcProvider(cfg.fallbackRpcUrl);
      const fallbackUsdc = new Contract(cfg.usdcAddress, ERC20_TRANSFER_ABI, fallbackProvider);
      events = await fallbackUsdc.queryFilter(
        fallbackUsdc.getEvent("Transfer"),
        fromBlock,
        endBlock
      );
    } else {
      throw e;
    }
  }

  const depositAddressesSet = new Set(depositAddressToUser.keys());
  let processed = 0;
  for (const event of events) {
    const e = event as { blockNumber: number; transactionHash: string; index: number; args?: unknown };
    const { blockNumber, transactionHash, index: logIndex } = e;
    const txHash = transactionHash.toLowerCase();
    const args = e.args as { from?: string; to?: string; value?: bigint } | undefined;
    const from = args?.from?.toLowerCase();
    if (from && depositAddressesSet.has(from)) continue;
    const to = args?.to?.toLowerCase();
    const amountRaw = args?.value;
    if (!to || amountRaw == null) continue;
    const userId = depositAddressToUser.get(to);
    if (!userId) continue;

    const existing = await prisma.processedDepositEvent.findUnique({
      where: {
        chainId_txHash_logIndex: { chainId: cfg.chainId, txHash, logIndex },
      },
    });
    if (existing) continue;

    const amountCents = Math.floor(Number(amountRaw) / USDC_TO_CENTS);
    if (amountCents <= 0) continue;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.processedDepositEvent.create({
          data: { chainId: cfg.chainId, txHash, logIndex, blockNumber },
        });
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amountCents } },
        });
        await tx.ledgerEntry.create({
          data: {
            userId,
            amount: amountCents,
            type: "deposit",
            description: `Transfer to deposit address (chain ${cfg.chainId})`,
          },
        });
      });
      processed++;
      logger.info("index_transfer_credited", { userId, amountCents, chainId: cfg.chainId, txHash });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Transfer credit failed ${txHash}:${logIndex}: ${msg}`);
    }
  }
  return { processed, errors };
}

async function indexDepositsForChain(cfg: ChainConfig): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  const provider = new JsonRpcProvider(cfg.rpcUrl);
  const contract = new Contract(cfg.contractAddress, DEPOSIT_ABI, provider);

  const toBlock = await provider.getBlockNumber();
  const lastProcessed = await prisma.processedDepositEvent.findFirst({
    where: { chainId: cfg.chainId },
    orderBy: { blockNumber: "desc" },
    select: { blockNumber: true },
  });
  const fromBlock = lastProcessed ? lastProcessed.blockNumber + 1 : defaultFromBlock(cfg.chainId, toBlock);
  if (fromBlock > toBlock) return { processed: 0, errors };

  // Alchemy free tier permite solo 10 bloques por eth_getLogs; con plan de pago se puede subir (ej. 2000)
  const maxRange = 10;
  const endBlock = Math.min(fromBlock + maxRange - 1, toBlock);
  let events: Awaited<ReturnType<typeof contract.queryFilter>>;
  try {
    events = await withRetry(() =>
      contract.queryFilter(contract.getEvent("DepositFor"), fromBlock, endBlock)
    );
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (cfg.fallbackRpcUrl && (msg.includes("Internal error") || msg.includes("-32000"))) {
      const fallbackProvider = new JsonRpcProvider(cfg.fallbackRpcUrl);
      const fallbackContract = new Contract(cfg.contractAddress, DEPOSIT_ABI, fallbackProvider);
      events = await fallbackContract.queryFilter(
        fallbackContract.getEvent("DepositFor"),
        fromBlock,
        endBlock
      );
    } else {
      throw e;
    }
  }

  let processed = 0;
  for (const event of events) {
    const e = event as { blockNumber: number; transactionHash: string; index: number; args?: unknown };
    const { blockNumber, transactionHash, index: logIndex } = e;
    const txHash = transactionHash.toLowerCase();

    const existing = await prisma.processedDepositEvent.findUnique({
      where: {
        chainId_txHash_logIndex: { chainId: cfg.chainId, txHash, logIndex },
      },
    });
    if (existing) continue;

    const args = e.args as { userId?: string; amount?: bigint } | undefined;
    const userId = args?.userId;
    const amountRaw = args?.amount;
    if (userId == null || amountRaw == null) {
      errors.push(`Invalid event at ${txHash}:${logIndex}`);
      continue;
    }

    const amountCents = Math.floor(Number(amountRaw) / USDC_TO_CENTS);
    if (amountCents <= 0) continue;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      logger.warn("index_deposit_unknown_user", { userId, chainId: cfg.chainId, txHash });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.processedDepositEvent.create({
          data: {
            chainId: cfg.chainId,
            txHash,
            logIndex,
            blockNumber,
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amountCents } },
        });
        await tx.ledgerEntry.create({
          data: {
            userId,
            amount: amountCents,
            type: "deposit",
            description: `On-chain deposit (chain ${cfg.chainId})`,
          },
        });
      });
      processed++;
      logger.info("index_deposit_credited", { userId, amountCents, chainId: cfg.chainId, txHash });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Credit failed ${txHash}:${logIndex}: ${msg}`);
    }
  }

  return { processed, errors };
}
