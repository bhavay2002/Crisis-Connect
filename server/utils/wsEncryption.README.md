# WebSocket Message Encryption Utilities

## ⚠️ Important: Not Currently Used

These utilities provide **optional** message-level encryption for WebSocket messages using AES-GCM. They are **not currently integrated** into the main WebSocket pipeline.

## Why Not Enabled?

For Crisis Connect, **WSS (WebSocket Secure) transport encryption is sufficient** because:

1. **Server processes messages** - The server needs to read, validate, and broadcast messages
2. **WSS provides transport security** - Same as HTTPS, industry standard
3. **Performance** - Message-level encryption adds latency
4. **Complexity** - Adds key management, error handling, debugging overhead
5. **Standard practice** - Most WebSocket applications use WSS, not message encryption

## When You Would Need This

Enable message-level encryption only if you have:

- **End-to-end encryption requirements** - Client-to-client encryption where server cannot decrypt
- **Regulatory compliance** - HIPAA, GDPR extreme cases requiring encrypted at-rest messages
- **Untrusted infrastructure** - Don't trust the server/network layer
- **Message storage** - Need to store messages in encrypted form

## How to Integrate (If Needed)

### 1. Server-Side Broadcasting

```typescript
import { encryptWebSocketMessage, shouldEncryptMessage } from "../utils/wsEncryption";

function broadcastToAll(message: any) {
  // Encrypt sensitive message types
  if (shouldEncryptMessage(message.type)) {
    encryptWebSocketMessage(message).then(encrypted => {
      const messageStr = JSON.stringify(encrypted);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });
    });
  } else {
    // Send unencrypted for non-sensitive types
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}
```

### 2. Client-Side Receiving

```typescript
socket.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  
  // Check if message is encrypted
  if (message.encrypted && message.payload) {
    const decrypted = await decryptWebSocketMessage(message.payload);
    if (decrypted) {
      onMessageRef.current?.(decrypted);
    }
  } else {
    onMessageRef.current?.(message);
  }
};
```

### 3. Configure Sensitive Message Types

Edit `server/utils/wsEncryption.ts`:

```typescript
export function shouldEncryptMessage(messageType: string): boolean {
  const sensitiveTypes = [
    'chat_message',      // 1-on-1 chats
    'user_data',         // PII
    'location_update',   // Real-time GPS
    'sos_alert',         // Emergency alerts
    'medical_info',      // Health data
  ];
  
  return sensitiveTypes.includes(messageType);
}
```

## Performance Impact

Message-level encryption adds:
- **~5-10ms** per message encryption
- **~5-10ms** per message decryption
- **~100 bytes** overhead per encrypted message

For high-frequency updates (GPS tracking, live dashboards), this can impact user experience.

## Best Practice

**For Crisis Connect and most WebSocket applications:**

✅ **DO**: Use WSS in production
✅ **DO**: Validate and sanitize messages
✅ **DO**: Use secure session authentication
✅ **DO**: Implement rate limiting

❌ **DON'T**: Add message encryption unless required
❌ **DON'T**: Use `ws://` in production
❌ **DON'T**: Send sensitive data without validation

## Current Recommendation

**Keep these utilities as dormant code for future use if regulatory requirements change. Continue using WSS as the primary security mechanism.**
