/**
 * Single source of truth for supported chains.
 * To add a new network: add an entry here and set the env vars (e.g. ARB_RPC_URL, ARB_USDC_ADDRESS).
 */

export type NetworkDef = {
  id: string;
  name: string;
  chainId: number;
  rpcEnv: string;
  usdcEnv: string;
  /** Optional: for contract-based deposits (depositFor). */
  depositContractEnv?: string;
  fallbackEnv?: string;
  defaultFallback?: string;
  defaultUsdc: string;
  logoUrl: string;
  /** Env key for indexer start block, e.g. POLYGON_INDEX_FROM_BLOCK */
  indexFromBlockEnv?: string;
};

export const NETWORK_DEFINITIONS: NetworkDef[] = [
  {
    id: "polygon",
    name: "Polygon",
    chainId: 137,
    rpcEnv: "POLYGON_RPC_URL",
    usdcEnv: "POLYGON_USDC_ADDRESS",
    depositContractEnv: "POLYGON_DEPOSIT_CONTRACT_ADDRESS",
    fallbackEnv: "POLYGON_RPC_FALLBACK",
    defaultFallback: "https://polygon-rpc.com",
    defaultUsdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    logoUrl: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/matic.svg",
    indexFromBlockEnv: "POLYGON_INDEX_FROM_BLOCK",
  },
  {
    id: "base",
    name: "Base",
    chainId: 8453,
    rpcEnv: "BASE_RPC_URL",
    usdcEnv: "BASE_USDC_ADDRESS",
    depositContractEnv: "BASE_DEPOSIT_CONTRACT_ADDRESS",
    defaultUsdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    logoUrl: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usdc.svg",
    indexFromBlockEnv: "BASE_INDEX_FROM_BLOCK",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    chainId: 1,
    rpcEnv: "ETH_RPC_URL",
    usdcEnv: "ETH_USDC_ADDRESS",
    depositContractEnv: "ETH_DEPOSIT_CONTRACT_ADDRESS",
    defaultUsdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    logoUrl: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
    indexFromBlockEnv: "ETH_INDEX_FROM_BLOCK",
  },
  {
    id: "bsc",
    name: "BSC",
    chainId: 56,
    rpcEnv: "BSC_RPC_URL",
    usdcEnv: "BSC_USDC_ADDRESS",
    depositContractEnv: "BSC_DEPOSIT_CONTRACT_ADDRESS",
    defaultUsdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    logoUrl: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/bnb.svg",
    indexFromBlockEnv: "BSC_INDEX_FROM_BLOCK",
  },
  // To add e.g. Arbitrum, uncomment and set ARB_RPC_URL, ARB_USDC_ADDRESS in .env:
  // {
  //   id: "arbitrum",
  //   name: "Arbitrum",
  //   chainId: 42161,
  //   rpcEnv: "ARB_RPC_URL",
  //   usdcEnv: "ARB_USDC_ADDRESS",
  //   defaultUsdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  //   logoUrl: "https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/eth.svg",
  //   indexFromBlockEnv: "ARB_INDEX_FROM_BLOCK",
  // },
];

/** Network ids that are supported for withdraw/deposit (used for API validation). */
export const SUPPORTED_NETWORK_IDS = NETWORK_DEFINITIONS.map((n) => n.id) as readonly string[];
export type NetworkId = (typeof SUPPORTED_NETWORK_IDS)[number];

/** ChainId → network id (e.g. 137 → "polygon") for balance sync after indexer credits. */
export function getNetworkIdByChainId(chainId: number): NetworkId | null {
  const def = NETWORK_DEFINITIONS.find((n) => n.chainId === chainId);
  return def ? (def.id as NetworkId) : null;
}

function getEnv(key: string): string | undefined {
  return process.env[key];
}

/** Returns networks that have RPC configured (for withdraw and deposit UI). */
export function getConfiguredNetworks(): { id: string; name: string; chainId: number; logoUrl: string }[] {
  return NETWORK_DEFINITIONS.filter((n) => getEnv(n.rpcEnv)).map((n) => ({
    id: n.id,
    name: n.name,
    chainId: n.chainId,
    logoUrl: n.logoUrl,
  }));
}

/** For withdraw: only networks with RPC + USDC (we need both to send). */
export function getWithdrawNetworks(): { id: string; name: string }[] {
  return NETWORK_DEFINITIONS.filter((n) => getEnv(n.rpcEnv) && getEnv(n.usdcEnv)).map((n) => ({
    id: n.id,
    name: n.name,
  }));
}

/** For withdraw execution: get rpcUrl, usdcAddress, chainId by network id. */
export function getWithdrawConfig(
  networkId: string
): { rpcUrl: string; usdcAddress: string; chainId: number; fallbackRpcUrl?: string } | null {
  const def = NETWORK_DEFINITIONS.find((n) => n.id === networkId);
  if (!def) return null;
  const rpcUrl = getEnv(def.rpcEnv);
  const usdcAddress = getEnv(def.usdcEnv) ?? def.defaultUsdc;
  if (!rpcUrl) return null;
  const fallbackRpcUrl = def.fallbackEnv ? getEnv(def.fallbackEnv) : undefined;
  return {
    rpcUrl,
    usdcAddress,
    chainId: def.chainId,
    fallbackRpcUrl: fallbackRpcUrl ?? def.defaultFallback,
  };
}

/** For indexer: transfer configs (index USDC transfers to deposit addresses). */
export function getIndexerTransferConfigs(): {
  chainId: number;
  rpcUrl: string;
  usdcAddress: string;
  fallbackRpcUrl?: string;
}[] {
  return NETWORK_DEFINITIONS.filter((n) => getEnv(n.rpcEnv) && getEnv(n.usdcEnv)).map((n) => ({
    chainId: n.chainId,
    rpcUrl: getEnv(n.rpcEnv)!,
    usdcAddress: getEnv(n.usdcEnv) ?? n.defaultUsdc,
    fallbackRpcUrl: (n.fallbackEnv ? getEnv(n.fallbackEnv) : undefined) ?? n.defaultFallback,
  }));
}

/** For indexer: contract configs (index DepositFor events). */
export function getIndexerContractConfigs(): {
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  fallbackRpcUrl?: string;
}[] {
  return NETWORK_DEFINITIONS.filter((n) => {
    const rpc = getEnv(n.rpcEnv);
    const contract = n.depositContractEnv ? getEnv(n.depositContractEnv) : undefined;
    return rpc && contract;
  }).map((n) => ({
    chainId: n.chainId,
    rpcUrl: getEnv(n.rpcEnv)!,
    contractAddress: getEnv(n.depositContractEnv!)!,
    fallbackRpcUrl: (n.fallbackEnv ? getEnv(n.fallbackEnv) : undefined) ?? n.defaultFallback,
  }));
}

/** Resolve defaultFromBlock env per chain (for indexer). */
export function getIndexFromBlockEnv(chainId: number): string | undefined {
  return NETWORK_DEFINITIONS.find((n) => n.chainId === chainId)?.indexFromBlockEnv;
}
