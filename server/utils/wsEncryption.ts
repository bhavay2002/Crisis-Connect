import { logger } from "./logger";
import { config } from "../config";
import { webcrypto } from "crypto";

export interface EncryptedMessage {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface SecureWebSocketMessage {
  type: string;
  data?: any;
  message?: string;
  encrypted?: boolean;
  payload?: EncryptedMessage;
}

const crypto = webcrypto as unknown as Crypto;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Node.js-compatible base64 encoding/decoding
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return Buffer.from(base64, 'base64').buffer;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = config.session.secret;
  const key = await crypto.subtle.digest('SHA-256', textEncoder.encode(keyMaterial));
  
  return crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWebSocketMessage(
  message: SecureWebSocketMessage
): Promise<SecureWebSocketMessage> {
  // Only encrypt in production or when explicitly enabled
  // In development with WSS, encryption adds overhead without benefit
  const shouldEncrypt = !config.isDevelopment || process.env.FORCE_MESSAGE_ENCRYPTION === 'true';
  
  if (shouldEncrypt) {
    try {
      const key = await getEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = textEncoder.encode(JSON.stringify(message));

      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      const encryptedArray = new Uint8Array(encrypted);
      const tag = encryptedArray.slice(-16);
      const ciphertext = encryptedArray.slice(0, -16);

      return {
        type: message.type,
        encrypted: true,
        payload: {
          encrypted: arrayBufferToBase64(ciphertext),
          iv: arrayBufferToBase64(iv),
          tag: arrayBufferToBase64(tag),
        },
      };
    } catch (error) {
      logger.error("WebSocket message encryption failed", error instanceof Error ? error : undefined);
      // Fall back to unencrypted on error
      return message;
    }
  }
  
  // In development with WSS, skip encryption
  return message;
}

export async function decryptWebSocketMessage(
  encrypted: EncryptedMessage
): Promise<SecureWebSocketMessage | null> {
  try {
    const key = await getEncryptionKey();
    const iv = base64ToArrayBuffer(encrypted.iv);
    const ciphertext = base64ToArrayBuffer(encrypted.encrypted);
    const tag = base64ToArrayBuffer(encrypted.tag);

    const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
    combined.set(new Uint8Array(ciphertext), 0);
    combined.set(new Uint8Array(tag), ciphertext.byteLength);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      combined
    );

    const text = textDecoder.decode(decrypted);
    return JSON.parse(text);
  } catch (error) {
    logger.error("WebSocket message decryption failed", error instanceof Error ? error : undefined);
    return null;
  }
}

export function shouldEncryptMessage(messageType: string): boolean {
  // Always return false in development since we have WSS
  // In production, encrypt sensitive message types as defense-in-depth
  if (config.isDevelopment && process.env.FORCE_MESSAGE_ENCRYPTION !== 'true') {
    return false;
  }
  
  const sensitiveTypes = [
    'chat_message',
    'user_data',  
    'location_update',
    'sos_alert',
    'resource_request',
  ];
  
  return sensitiveTypes.includes(messageType);
}
