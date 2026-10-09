import { useState, useEffect, useCallback } from 'react';
import { formatISTDateTime } from '../utils/time';
import { getVehicleRestUrl, getVehicleWsUrl } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function SensorData() {
  const [readings, setReadings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { lastMessage } = useWebSocket(getVehicleWsUrl(1));

  const fetchReadings = useCallback(async (showRefreshingState = false) => {
    if (showRefreshingState) setIsRefreshing(true);
    try {
      const res = await fetch(`${getVehicleRestUrl(1)}/sensor-readings?limit=100`);
      if (res.ok) {
        setReadings(await res.json());
      }
    } catch (e) {
      console.warn("Failed to fetch sensor readings", e);
    } finally {
      setIsLoading(false);
      if (showRefreshingState) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  }, []);

  useEffect(() => {
    fetchReadings(false);
    // Auto-refresh sensor readings every 3 seconds in background
    const interval = setInterval(() => {
      fetchReadings(false);
    }, 3000);

    const handleFocus = () => fetchReadings(false);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchReadings]);

  // Instant real-time WebSocket push for new telemetry readings
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'vehicle_status' && lastMessage.alcohol_value !== undefined) {
      setReadings(prev => {
        const newReading = {
          id: Date.now(),
          timestamp: lastMessage.timestamp || new Date().toISOString(),
          alcohol_value: lastMessage.alcohol_value,
          accel_x: lastMessage.accel_x ?? 0,
          accel_y: lastMessage.accel_y ?? 0,
          accel_z: lastMessage.accel_z ?? 9.8,
          gyro_x: lastMessage.gyro_x ?? 0,
          gyro_y: lastMessage.gyro_y ?? 0,
          gyro_z: lastMessage.gyro_z ?? 0,
          temperature: lastMessage.temperature ?? 30,
          latitude: lastMessage.latitude,
          longitude: lastMessage.longitude
        };
        return [newReading, ...prev].slice(0, 100);
      });
    }
  }, [lastMessage]);

  if (isLoading) {
    return <div className="p-6 text-white text-center">Loading Sensor Logs...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Sensor Data Logs</h1>
          <p className="text-sm text-brand-muted">Raw telemetry data recorded from vehicle hardware.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono px-3 py-1.5 rounded-lg flex items-center gap-2 border text-emerald-400 bg-emerald-950/60 border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Stream Active</span>
          </div>
          <button 
            onClick={() => fetchReadings(true)} 
            disabled={isRefreshing}
            className="px-4 py-2 bg-brand-elevated hover:bg-brand-border border border-brand-border rounded-lg text-sm font-medium transition text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-brand-secondaryText">
            <thead className="bg-brand-elevated text-xs uppercase text-brand-muted border-b border-brand-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Timestamp (IST)</th>
                <th className="px-4 py-3 font-semibold">Alcohol (raw)</th>
                <th className="px-4 py-3 font-semibold">Accel (X, Y, Z)</th>
                <th className="px-4 py-3 font-semibold">Gyro (X, Y, Z)</th>
                <th className="px-4 py-3 font-semibold">Temp (°C)</th>
                <th className="px-4 py-3 font-semibold">GPS (Lat, Lon)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {readings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-brand-muted">No telemetry recorded yet.</td>
                </tr>
              ) : (
                readings.map((reading, idx) => (
                  <tr key={idx} className="hover:bg-brand-elevated/30 transition font-mono text-xs">
                    <td className="px-4 py-3 text-white">
                      {formatISTDateTime(reading.timestamp || reading.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={
                        (reading.alcohol_value ?? 0) > 1000 
                          ? 'text-red-400 font-bold bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/40' 
                          : (reading.alcohol_value ?? 0) >= 751 
                          ? 'text-amber-300 font-bold bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/30'
                          : (reading.alcohol_value ?? 0) >= 500 
                          ? 'text-amber-400 font-semibold' 
                          : ''
                      }>
                        {typeof reading.alcohol_value === 'number' ? reading.alcohol_value.toFixed(2) : '0.00'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(reading.accel_x ?? 0).toFixed(2)}, {(reading.accel_y ?? 0).toFixed(2)}, {(reading.accel_z ?? 9.8).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {(reading.gyro_x ?? 0).toFixed(2)}, {(reading.gyro_y ?? 0).toFixed(2)}, {(reading.gyro_z ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{(reading.temperature ?? 30).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {reading.latitude ? `${reading.latitude.toFixed(5)}, ${reading.longitude.toFixed(5)}` : 'No Signal'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
