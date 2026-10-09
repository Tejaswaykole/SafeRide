import { useState, useEffect, useCallback, useRef } from 'react';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket(url: string) {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);
  const pingInterval = useRef<any>(null);
  const reconnectTimeout = useRef<any>(null);
  const isUnmounted = useRef<boolean>(false);

  const cleanupSocket = useCallback(() => {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (ws.current) {
      ws.current.onopen = null;
      ws.current.onmessage = null;
      ws.current.onclose = null;
      ws.current.onerror = null;
      try {
        ws.current.close();
      } catch {}
      ws.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (isUnmounted.current) return;
    cleanupSocket();

    setStatus('connecting');
    try {
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        if (isUnmounted.current) return;
        setStatus('connected');

        // Start 20-second heartbeat ping to prevent cloud proxy (Render/ALB) timeouts
        if (pingInterval.current) clearInterval(pingInterval.current);
        pingInterval.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({ type: 'ping' }));
            } catch {}
          }
        }, 20000);
      };

      socket.onmessage = (event) => {
        if (isUnmounted.current) return;
        try {
          if (typeof event.data === 'string') {
            if (event.data === 'pong' || event.data.includes('"pong"')) {
              return; // Ignore heartbeat responses
            }
            const data = JSON.parse(event.data);
            if (data?.type === 'pong') return;
            setLastMessage(data);
          }
        } catch (e) {
          console.warn('Failed to parse websocket message', e);
        }
      };

      socket.onclose = () => {
        if (isUnmounted.current) return;
        setStatus('disconnected');
        if (pingInterval.current) {
          clearInterval(pingInterval.current);
          pingInterval.current = null;
        }

        // Schedule auto-reconnect with backoff
        if (!reconnectTimeout.current) {
          reconnectTimeout.current = setTimeout(() => {
            reconnectTimeout.current = null;
            if (!isUnmounted.current) {
              connect();
            }
          }, 3000);
        }
      };

      socket.onerror = (err) => {
        console.warn('SafeRide WebSocket connection warning:', err);
        try {
          socket.close();
        } catch {}
      };
    } catch (e) {
      console.warn('SafeRide WebSocket creation error:', e);
      setStatus('disconnected');
      if (!reconnectTimeout.current) {
        reconnectTimeout.current = setTimeout(() => {
          reconnectTimeout.current = null;
          if (!isUnmounted.current) connect();
        }, 3500);
      }
    }
  }, [url, cleanupSocket]);

  useEffect(() => {
    isUnmounted.current = false;
    connect();

    // Reconnect immediately if tab wakes up or internet recovers
    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible' && (!ws.current || ws.current.readyState === WebSocket.CLOSED)) {
        connect();
      }
    };

    window.addEventListener('online', handleVisibilityOrOnline);
    document.addEventListener('visibilitychange', handleVisibilityOrOnline);

    return () => {
      isUnmounted.current = true;
      window.removeEventListener('online', handleVisibilityOrOnline);
      document.removeEventListener('visibilitychange', handleVisibilityOrOnline);
      cleanupSocket();
    };
  }, [connect, cleanupSocket]);

  const sendMessage = useCallback((msg: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }, []);

  return { status, lastMessage, isConnected: status === 'connected', sendMessage, reconnect: connect };
}
