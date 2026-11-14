import crypto from 'crypto';
import { query } from '../config/database';

const ALGO = 'aes-256-gcm';

const vaultKey = () => {
  const secret = process.env.JWT_SECRET || 'ksp-local-vault-key';
  return crypto.createHash('sha256').update(`ksp-password-vault:${secret}`).digest();
};

export const encryptPassword = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, vaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
};

export const decryptPassword = (vault?: string | null): string | null => {
  if (!vault) return null;
  try {
    const [ivB64, tagB64, dataB64] = String(vault).split('.');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(ALGO, vaultKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
};

let vaultReady: Promise<void> | null = null;

export const ensurePasswordVaultColumn = async () => {
  if (!vaultReady) {
    vaultReady = query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_vault TEXT`
    ).then(() => undefined);
  }
  await vaultReady;
};
