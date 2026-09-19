/**
 * Identyfikatory generowane na urzadzeniu.
 *
 * To jeden z filarow synchronizacji: skoro identyfikator treningu powstaje
 * lokalnie, ten sam trening wyslany dwa razy trafia na serwerze w ten sam
 * wiersz (upsert po kluczu glownym) i nigdy sie nie zdubluje.
 */

/**
 * UUID v4. Korzystamy z natywnego crypto, gdy jest dostepne, a w ostatecznosci
 * schodzimy do Math.random - identyfikator ma byc unikalny, a nie tajny.
 */
/**
 * Opisujemy tylko te dwie metody, ktorych naprawde uzywamy, zamiast siegac po
 * typ `Crypto` z DOM - ten sam kod dziala wtedy w React Native, w Node i w testach.
 */
interface MinimalCrypto {
  randomUUID?: () => string;
  getRandomValues?: <T extends Uint8Array>(array: T) => T;
}

export function newId(): string {
  const globalCrypto = (globalThis as { crypto?: MinimalCrypto }).crypto;

  if (globalCrypto?.randomUUID !== undefined) {
    return globalCrypto.randomUUID();
  }

  if (globalCrypto?.getRandomValues !== undefined) {
    const bytes = globalCrypto.getRandomValues(new Uint8Array(16));
    return formatUuid(bytes);
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return formatUuid(bytes);
}

function formatUuid(bytes: Uint8Array): string {
  // Ustawiamy wersje (4) i wariant zgodnie z RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Krotki kod znajomego, np. "7KQ4M2". Bez znakow mylacych (0/O, 1/I). */
export function newFriendCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
