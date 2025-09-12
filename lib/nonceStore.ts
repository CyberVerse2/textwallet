// Simple in-memory nonce store. Replace with Redis/DB in production.
const nonceSet = new Set<string>();

export function addNonce(nonce: string): void {
  nonceSet.add(nonce);
}

export function consumeNonce(nonce: string): boolean {
  return nonceSet.delete(nonce);
}

export function hasNonce(nonce: string): boolean {
  return nonceSet.has(nonce);
}
