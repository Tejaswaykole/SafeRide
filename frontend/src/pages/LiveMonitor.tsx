import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatISTDateTime } from '../utils/time';
import { getVehicleWsUrl } from '../config/api';

export default function LiveMonitor() {
  const [logs, setLogs] = useState<string[]>([]);
  const { lastMessage } = useWebSocket(getVehicleWsUrl(1));
  const terminalEndRef = useRef<HTMLDivElement>(null);

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
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand-safe/10 border border-brand-safe/20 text-brand-safe text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-brand-safe animate-pulse"></span>
          STREAMING LIVE
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
            Connected. Awaiting telemetry...
          </div>
          
          {logs.map((log, i) => (
            <div key={i} className={log.startsWith('[EVENT]') ? 'text-brand-warning font-bold' : 'text-slate-300'}>
              {log}
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
