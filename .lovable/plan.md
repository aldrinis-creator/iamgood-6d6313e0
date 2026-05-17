## Fix: "Maximum Call Stack size exceeded" when saving Medical Vault attachments

### Root cause
`src/lib/encryption.ts` uses `String.fromCharCode(...new Uint8Array(buffer))` inside `toBase64()`. Spreading a large `Uint8Array` (any image/PDF more than ~100KB) exceeds the JS engine's argument limit and throws "Maximum call stack size exceeded". This is hit by `encryptBytes` when saving a Vault attachment.

### Fix
Rewrite `toBase64` in `src/lib/encryption.ts` to encode the buffer in fixed-size chunks (8KB) instead of spreading the whole array:

```ts
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000; // 32KB
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}
```

No other files need changes — all other callers (text `encrypt`, IV/salt encoding) use small buffers and continue working unchanged. Decryption path is unaffected.

### Verification
- Save an image / PDF attachment >1MB in Medical Vault → should succeed.
- Existing text-only encrypted vault entries continue to encrypt/decrypt correctly.
