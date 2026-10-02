import { useState, useEffect, useCallback, useRef } from 'react';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket(url: string) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    setStatus('connecting');
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setStatus('connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch (e) {
        console.error("Failed to parse websocket message", e);
      }
    };

    ws.current.onclose = () => {
      setStatus('disconnected');
      // Attempt reconnect after delay
      setTimeout(() => {
        if (ws.current?.readyState === WebSocket.CLOSED) {
          connect();
        }
      }, 3000);
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket Error:', err);
      ws.current?.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        // override onclose so we don't try to reconnect on intentional unmount
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [connect]);

  return { status, lastMessage };
}
