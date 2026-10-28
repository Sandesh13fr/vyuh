import type { Address, Hex, WalletClient } from "viem";
import { EIP712_DOMAIN_NAME, EIP712_DOMAIN_VERSION, MANDATE_TYPES, type Mandate } from "@vyuh/shared";

export function mandateDomain(registry: Address, chainId: number) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract: registry,
  } as const;
}

/** Owner's EIP-712 signature for MandateRegistry.setMandate. */
export async function signMandate(
  walletClient: WalletClient,
  mandate: Mandate,
  registry: Address,
  chainId: number,
): Promise<Hex> {
  const account = walletClient.account;
  if (!account) throw new Error("signMandate: walletClient has no account");
  return walletClient.signTypedData({
    account,
    domain: mandateDomain(registry, chainId),
    types: MANDATE_TYPES,
    primaryType: "Mandate",
    message: mandate,
  });
}
