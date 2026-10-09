import { useState, useEffect } from 'react';
import { formatISTDateTime } from '../utils/time';
import { getVehicleRestUrl } from '../config/api';

export default function SensorData() {
  const [readings, setReadings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReadings = async () => {
      try {
        const res = await fetch(`${getVehicleRestUrl(1)}/sensor-readings?limit=100`);
        if (res.ok) {
          setReadings(await res.json());
        }
      } catch (e) {
        console.error("Failed to fetch sensor readings", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReadings();
  }, []);

  if (isLoading) {
    return <div className="p-6 text-white text-center">Loading Sensor Logs...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sensor Data Logs</h1>
          <p className="text-sm text-brand-muted">Raw telemetry data recorded from vehicle hardware.</p>
        </div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-brand-elevated hover:bg-brand-border border border-brand-border rounded-lg text-sm font-medium transition text-white">
          Refresh Data
        </button>
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
                        reading.alcohol_value > 1000 
                          ? 'text-red-400 font-bold bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/40' 
                          : reading.alcohol_value >= 751 
                          ? 'text-amber-300 font-bold bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/30'
                          : reading.alcohol_value >= 500 
                          ? 'text-amber-400 font-semibold' 
                          : ''
                      }>
                        {reading.alcohol_value.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {reading.accel_x.toFixed(2)}, {reading.accel_y.toFixed(2)}, {reading.accel_z.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {reading.gyro_x.toFixed(2)}, {reading.gyro_y.toFixed(2)}, {reading.gyro_z.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{reading.temperature.toFixed(2)}</td>
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
