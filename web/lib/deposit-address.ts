import { keccak256, toUtf8Bytes, concat, Wallet } from "ethers";

/**
 * Deterministic deposit address per user (like Polymarket).
 * Derived from DEPOSIT_MASTER_SECRET + userId so we can index USDC transfers to this address.
 * Server-side only (secret must stay in env).
 *
 * IMPORTANTE: No cambies DEPOSIT_MASTER_SECRET una vez que usuarios ya hayan recibido
 * depósitos en su dirección. Si cambias el secret, la nueva dirección derivada será distinta
 * y el indexador no reconocerá transferencias a la dirección antigua (processed: 0).
 * Tampoco reemplaces usuarios (mismo userId) o la dirección dejará de coincidir.
 */
export function getDepositAddress(userId: string): string {
  return getDepositWallet(userId).address;
}

/**
 * Returns the Wallet (signer) for the user's deposit address.
 * Used to send withdrawal txs from the user's on-chain balance.
 * Server-side only.
 */
export function getDepositWallet(userId: string): Wallet {
  const secret = process.env.DEPOSIT_MASTER_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("DEPOSIT_MASTER_SECRET must be set and at least 16 characters");
  }
  const hash = keccak256(concat([toUtf8Bytes(secret), toUtf8Bytes(userId)]));
  return new Wallet(hash);
}

/**
 * Builds a map of depositAddress (lowercase) -> userId for the indexer.
 */
export function getDepositAddressToUserIdMap(userIds: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const userId of userIds) {
    try {
      const addr = getDepositAddress(userId);
      map.set(addr.toLowerCase(), userId);
    } catch {
      // skip if secret not set
    }
  }
  return map;
}
