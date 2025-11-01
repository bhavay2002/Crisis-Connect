import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketMessage {
  type: string;
  data?: any;
  message?: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
}

export function useWebSocket({
  onMessage,
  onConnect,
  onDisconnect,
  enabled = true,
}: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const token = localStorage.getItem("accessToken");
      
      if (!token) {
        if (import.meta.env.DEV) {
          console.log("No access token found, skipping WebSocket connection");
        }
        return;
      }
      
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (import.meta.env.DEV) {
          console.log("WebSocket connected");
        }
        setIsConnected(true);
        onConnectRef.current?.();
      };

      socket.onmessage = async (event) => {
        try {
          const rawMessage = JSON.parse(event.data);
          
          // Check if message is encrypted and needs decryption
          // Note: Decryption on client-side would require encryption key
          // For now, we just pass through as the encryption is primarily
          // for protecting messages in transit when WSS is not available
          let message: WebSocketMessage = rawMessage;
          
          // If encrypted flag is present, this indicates the message
          // was encrypted by the server for additional security
          if (rawMessage.encrypted && rawMessage.payload) {
            // In a full implementation, client would decrypt here
            // For now, we acknowledge the encrypted format
            if (import.meta.env.DEV) {
              console.log("Received encrypted message", rawMessage.type);
            }
          }
          
          onMessageRef.current?.(message);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error("Failed to parse WebSocket message:", error);
          }
        }
      };

      socket.onclose = (event) => {
        if (import.meta.env.DEV) {
          console.log("WebSocket disconnected", { code: event.code, reason: event.reason });
        }
        setIsConnected(false);
        wsRef.current = null;
        onDisconnectRef.current?.();

        // Attempt to reconnect after 3 seconds
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (import.meta.env.DEV) {
              console.log("Attempting to reconnect...");
            }
            connect();
          }, 3000);
        }
      };

      socket.onerror = (error) => {
        if (import.meta.env.DEV) {
          console.error("WebSocket error:", error);
        }
      };

      wsRef.current = socket;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to create WebSocket connection:", error);
      }
    }
  }, [enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Failed to send WebSocket message:", error);
        }
      }
    } else if (import.meta.env.DEV) {
      console.warn("WebSocket is not connected, cannot send message");
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
