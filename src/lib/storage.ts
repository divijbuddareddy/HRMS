import crypto from 'crypto';

export interface StoredDocumentMetadata {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  uploadedBy: string;
  uploadedAt: Date;
  signedUrl: string;
}

export function generateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function generateSignedUrl(storageKey: string, expiresInMinutes = 60): string {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  const signature = crypto
    .createHmac('sha256', process.env.STORAGE_SECRET || 'storage-secret-ai-automation-labs-2026')
    .update(`${storageKey}:${expiresAt}`)
    .digest('hex');

  return `/api/storage/download?key=${encodeURIComponent(storageKey)}&expires=${expiresAt}&sig=${signature}`;
}

export function verifySignedUrl(storageKey: string, expires: number, signature: string): boolean {
  if (Date.now() > expires) return false;
  const expectedSig = crypto
    .createHmac('sha256', process.env.STORAGE_SECRET || 'storage-secret-ai-automation-labs-2026')
    .update(`${storageKey}:${expires}`)
    .digest('hex');

  return signature === expectedSig;
}
