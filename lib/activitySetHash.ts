export async function hashActivitySet<T extends { id: string }>(activities: readonly T[]): Promise<string> {
  const canonicalContent = JSON.stringify(
    activities.map((activity) => ({ ...activity, id: undefined })),
  );
  const payload = new TextEncoder().encode(canonicalContent);

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', payload);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  let hash = 2166136261;
  for (const byte of payload) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
}
