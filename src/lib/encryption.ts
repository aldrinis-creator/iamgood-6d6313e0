/**
 * AES-256-GCM encryption utilities using Web Crypto API.
 * Zero-knowledge: encryption/decryption happens entirely client-side.
 * Key derivation: PBKDF2 with 100,000 iterations and SHA-256.
 */

const PBKDF2_ITERATIONS = 100_000;

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(
  plaintext: string,
  pin: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    ciphertext: toBase64(encrypted),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

export async function decrypt(
  ciphertext: string,
  ivB64: string,
  saltB64: string,
  pin: string
): Promise<string> {
  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const key = await deriveKey(pin, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    fromBase64(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

export async function hashPin(pin: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(pin)
  );
  return toBase64(hash);
}
