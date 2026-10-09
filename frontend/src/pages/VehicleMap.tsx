import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import RealMap from '../components/RealMap';
import { formatISTTime } from '../utils/time';
import { getVehicleRestUrl, getVehicleWsUrl } from '../config/api';

export default function VehicleMap() {
  const [readings, setReadings] = useState<any[]>([]);
  const REST_API_URL = getVehicleRestUrl(1);
  const { lastMessage } = useWebSocket(getVehicleWsUrl(1));

  const fetchLocationsData = async () => {
    try {
      const [readingsRes, statusRes] = await Promise.all([
        fetch(`${REST_API_URL}/sensor-readings?limit=50`),
        fetch(`${REST_API_URL}/status`)
      ]);
      if (readingsRes.ok) {
        const data = await readingsRes.json();
        setReadings(data);
      }
      if (statusRes.ok) {
        const status = await statusRes.json();
        if (status.latitude && status.longitude) {
          setReadings(prev => {
            if (prev.length > 0 && prev[0].latitude === status.latitude && prev[0].longitude === status.longitude) {
              return prev;
            }
            return [status, ...prev.slice(0, 49)];
          });
        }
      }
    } catch (e) {
      console.warn("Failed to fetch locations", e);
    }
  };

  useEffect(() => {
    fetchLocationsData();
    // Auto-poll every 3 seconds to ensure real-time tracking even if WS is silent
    const interval = setInterval(fetchLocationsData, 3000);
    const handleFocus = () => fetchLocationsData();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [REST_API_URL]);

  useEffect(() => {
    if (lastMessage && (lastMessage.type === 'vehicle_status' || lastMessage.type === 'location_update') && lastMessage.latitude) {
      setReadings(prev => [lastMessage, ...prev].slice(0, 50));
    }
  }, [lastMessage]);

  const latest = readings.find(r => r.latitude != null) || readings[0] || {};
  
  // Read saved last active location if live telemetry is disconnected
  const lastSavedLoc = (() => {
    try {
      const s = localStorage.getItem('saferide_last_active_location');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  })();

  const displayLat = latest.latitude ?? lastSavedLoc?.lat;
  const displayLon = latest.longitude ?? lastSavedLoc?.lon;
  const isGpsActive = latest.latitude != null && !latest.is_last_known_location;

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Vehicle GPS Tracking</h1>
          <p className="text-sm text-brand-muted">Real-time OpenStreetMap tracking and telemetry coordinate history.</p>
        </div>
        <div className={`text-xs font-mono px-3 py-1.5 rounded-lg flex items-center gap-2 border ${
          isGpsActive 
            ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30' 
            : displayLat 
            ? 'text-amber-400 bg-amber-950/60 border-amber-500/30' 
            : 'text-sky-400 bg-sky-950/60 border-sky-500/30'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            isGpsActive ? 'bg-emerald-400 animate-pulse' : displayLat ? 'bg-amber-400' : 'bg-sky-400 animate-ping'
          }`}></span>
          {isGpsActive 
            ? `${displayLat.toFixed(5)}° N, ${displayLon.toFixed(5)}° E (Live GPS)` 
            : displayLat 
            ? `Last Active: ${displayLat.toFixed(5)}° N, ${displayLon.toFixed(5)}° E (Waiting for New Coords)` 
            : 'Searching GPS...'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 bg-brand-surface border border-brand-border rounded-xl overflow-hidden shadow-lg relative flex flex-col">
          {/* Real Map Component */}
          <div className="flex-1 w-full h-full relative min-h-[400px]">
            <RealMap 
              latitude={latest.latitude} 
              longitude={latest.longitude} 
              speed={latest.speed}
              height="100%"
              isLastKnownLocation={latest.is_last_known_location ?? !isGpsActive}
              serverTimeIst={latest.server_time_ist}
            />
          </div>
        </div>


        <div className="bg-brand-surface border border-brand-border rounded-xl flex flex-col overflow-hidden shadow-lg">
          <div className="p-4 border-b border-brand-border bg-brand-elevated">
            <h3 className="font-semibold text-white">Location History</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {readings.filter(r => r.latitude).map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-brand-bg/50 border border-brand-border/30">
                <div className="mt-1 text-brand-accent">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"></path></svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-white font-mono">
                    {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                  </div>
                  <div className="text-xs text-brand-muted mt-0.5">
                    {formatISTTime(r.timestamp || r.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
