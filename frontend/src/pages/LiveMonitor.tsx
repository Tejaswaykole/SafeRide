import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatISTDateTime } from '../utils/time';
import { getVehicleWsUrl, getVehicleRestUrl } from '../config/api';

export default function LiveMonitor() {
  const [logs, setLogs] = useState<string[]>([]);
  const { lastMessage, status: wsStatus } = useWebSocket(getVehicleWsUrl(1));
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const REST_API_URL = getVehicleRestUrl(1);

  // Fetch initial recent logs on mount
  useEffect(() => {
    const fetchRecentLogs = async () => {
      try {
        const res = await fetch(`${REST_API_URL}/sensor-readings?limit=15`);
        if (res.ok) {
          const readings = await res.json();
          if (Array.isArray(readings) && readings.length > 0) {
            const formatted = readings.reverse().map((r: any) => {
              const ts = formatISTDateTime(r.timestamp || r.created_at);
              return `[TELEMETRY] ${ts} | STATUS:LOGGED | ALC:${r.alcohol_value?.toFixed(2) || '0.00'} | ACCEL:(${r.accel_x?.toFixed(1) || '0'},${r.accel_y?.toFixed(1) || '0'},${r.accel_z?.toFixed(1) || '0'}) | GPS:(${r.latitude ? r.latitude.toFixed(4) : 'N/A'}, ${r.longitude ? r.longitude.toFixed(4) : 'N/A'})`;
            });
            setLogs(prev => prev.length === 0 ? formatted : prev);
          }
        }
      } catch (e) {
        console.warn("Failed to load initial logs", e);
      }
    };
    fetchRecentLogs();
  }, [REST_API_URL]);

  // Append live stream from WebSocket
  useEffect(() => {
    if (lastMessage) {
      let logLine = "";
      if (lastMessage.type === 'vehicle_status') {
        const trigger = lastMessage.reason 
          ? lastMessage.reason 
          : lastMessage.alcohol_detected 
          ? 'MQ-3 Alcohol' 
          : lastMessage.rash_driving_detected 
          ? 'MPU-6050 Motion' 
          : 'NORMAL';
        const ts = formatISTDateTime(lastMessage.timestamp);
        logLine = `[TELEMETRY] ${ts} | STATUS:${lastMessage.status} | CAUSE:${trigger} | ALC:${lastMessage.alcohol_value?.toFixed(2) || '0.00'} | ACCEL:(${lastMessage.accel_x?.toFixed(1) || '0'},${lastMessage.accel_y?.toFixed(1) || '0'},${lastMessage.accel_z?.toFixed(1) || '0'})`;
      } else if (lastMessage.type === 'safety_event') {
        const ts = formatISTDateTime(lastMessage.timestamp);
        logLine = `[EVENT] ===> ${ts} | ${lastMessage.status} | RISK:${lastMessage.risk_score} | TRIGGER: ${lastMessage.reason}`;
      }
      
      if (logLine) {
        setLogs(prev => [...prev, logLine].slice(-100)); // Keep last 100 lines
      }
    }
  }, [lastMessage]);

  // Fallback poll if WS is disconnected to keep logs updating
  useEffect(() => {
    if (wsStatus === 'connected') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${REST_API_URL}/sensor-readings?limit=1`);
        if (res.ok) {
          const readings = await res.json();
          if (Array.isArray(readings) && readings.length > 0) {
            const r = readings[0];
            const ts = formatISTDateTime(r.timestamp || r.created_at);
            const line = `[POLL-SYNC] ${ts} | ALC:${r.alcohol_value?.toFixed(2) || '0.00'} | ACCEL:(${r.accel_x?.toFixed(1) || '0'},${r.accel_y?.toFixed(1) || '0'},${r.accel_z?.toFixed(1) || '0'})`;
            setLogs(prev => {
              if (prev.length > 0 && prev[prev.length - 1] === line) return prev;
              return [...prev, line].slice(-100);
            });
          }
        }
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [wsStatus, REST_API_URL]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Monitor Terminal</h1>
          <p className="text-sm text-brand-muted">Real-time raw data stream from the vehicle.</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium ${
          wsStatus === 'connected' 
            ? 'bg-brand-safe/10 border-brand-safe/20 text-brand-safe' 
            : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-brand-safe animate-pulse' : 'bg-amber-400'}`}></span>
          {wsStatus === 'connected' ? 'STREAMING LIVE (WSS)' : 'AUTO-SYNCING (REST)'}
        </div>
      </div>

      <div className="flex-1 bg-black border border-brand-border rounded-xl shadow-2xl font-mono text-sm overflow-hidden flex flex-col">
        <div className="bg-brand-elevated border-b border-brand-border px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-critical"></div>
          <div className="w-3 h-3 rounded-full bg-brand-warning"></div>
          <div className="w-3 h-3 rounded-full bg-brand-safe"></div>
          <span className="ml-2 text-xs text-brand-muted">saferide-tty1</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="text-brand-safe mb-4">
            SafeRide Diagnostic Terminal v1.0<br/>
            Connecting to Vehicle #1 (SAFERIDE-001)...<br/>
            Connection active. Telemetry stream synchronized.
          </div>
          
          {logs.map((log, i) => (
            <div key={i} className={log.startsWith('[EVENT]') ? 'text-brand-warning font-bold' : log.startsWith('[POLL-SYNC]') ? 'text-sky-300' : 'text-slate-300'}>
              {log}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
