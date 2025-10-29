import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

let encryptionKey: Buffer | null = null;

function initializeEncryptionKey(): void {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key || key.length < 32) {
    // Encryption is REQUIRED for secure message handling
    // Fail fast to prevent deploying insecure systems
    throw new Error(
      "ENCRYPTION_KEY not set or too short. Message encryption is REQUIRED. " +
      "Set ENCRYPTION_KEY environment variable (minimum 32 characters)"
    );
  }
  
  encryptionKey = crypto.createHash('sha256').update(key).digest();
  console.log("Message encryption enabled");
}

initializeEncryptionKey();

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encryptMessage(text: string): EncryptedData {
  if (!encryptionKey) {
    throw new Error("Encryption is not enabled. Set ENCRYPTION_KEY environment variable.");
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

export function decryptMessage(encryptedData: EncryptedData): string {
  if (!encryptionKey) {
    throw new Error("Encryption is not enabled. Cannot decrypt messages.");
  }
  
  if (!encryptedData.iv || !encryptedData.tag) {
    throw new Error("Invalid encrypted data: missing IV or tag");
  }
  
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function isEncryptionEnabled(): boolean {
  return encryptionKey !== null;
}
