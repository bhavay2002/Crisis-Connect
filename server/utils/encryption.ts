import crypto from "crypto";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const DEV_KEY_FILE = path.join(process.cwd(), '.dev-encryption-key');

let encryptionKey: Buffer | null = null;

function initializeEncryptionKey(): void {
  let key = process.env.ENCRYPTION_KEY;
  
  if (!key || key.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        "ENCRYPTION_KEY not set or too short. Message encryption is REQUIRED for production. " +
        "Set ENCRYPTION_KEY environment variable (minimum 32 characters)"
      );
    }
    
    logger.warn("ENCRYPTION_KEY not set. Using auto-generated key for DEVELOPMENT ONLY.");
    logger.warn("For production, set a secure ENCRYPTION_KEY environment variable.");
    
    try {
      if (fs.existsSync(DEV_KEY_FILE)) {
        key = fs.readFileSync(DEV_KEY_FILE, 'utf8').trim();
        logger.info("Loaded development encryption key from file");
      } else {
        key = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(DEV_KEY_FILE, key, 'utf8');
        logger.info("Generated new development encryption key and saved to .dev-encryption-key");
      }
    } catch (error) {
      logger.error("Failed to read/write development key file", error as Error);
      key = crypto.randomBytes(32).toString('hex');
      logger.info("Using temporary encryption key (not persisted)");
    }
  }
  
  encryptionKey = crypto.createHash('sha256').update(key).digest();
  logger.info("Message encryption enabled");
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
