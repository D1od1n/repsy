/**
 * Bezpieczne przechowywanie sesji uzytkownika.
 *
 * Tokeny trzymamy w expo-secure-store (Keychain na iOS, EncryptedSharedPreferences
 * na Androidzie), a nie w zwyklym AsyncStorage - tam lezalyby niezaszyfrowane.
 *
 * Problem: SecureStore ma limit ok. 2 KB na wpis, a token sesji Supabase potrafi
 * ten limit przekroczyc. Dlatego dzielimy wartosc na kawalki i sklejamy przy
 * odczycie. Liczbe kawalkow zapisujemy w osobnym kluczu, zeby wiedziec, ile ich
 * odczytac i ile posprzatac przy usuwaniu.
 */
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800; // z zapasem ponizej limitu 2048 bajtow
const COUNT_SUFFIX = '__chunks';

async function readChunkCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}${COUNT_SUFFIX}`);
  const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function removeChunks(key: string): Promise<void> {
  const count = await readChunkCount(key);
  for (let i = 0; i < count; i += 1) {
    await SecureStore.deleteItemAsync(`${key}__${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}${COUNT_SUFFIX}`);
}

export const secureStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const count = await readChunkCount(key);
      if (count === 0) return null;

      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await SecureStore.getItemAsync(`${key}__${i}`);
        // Brakujacy kawalek oznacza uszkodzony zapis - lepiej zwrocic null
        // i wymusic ponowne logowanie niz podac Supabase polowe tokenu.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    await removeChunks(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(`${key}__${i}`, chunks[i]!);
    }
    await SecureStore.setItemAsync(`${key}${COUNT_SUFFIX}`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    await removeChunks(key);
  },
};
