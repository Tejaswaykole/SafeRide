import { useState, useEffect } from 'react';
import { formatISTDateTime } from '../utils/time';
import { getVehicleRestUrl } from '../config/api';

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${getVehicleRestUrl(1)}/events?limit=100`);
        if (res.ok) {
          setEvents(await res.json());
        }
      } catch (e) {
        console.error("Failed to fetch events", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'SAFE') return 'text-brand-safe bg-brand-safe/10 border-brand-safe/20';
    if (status === 'WARNING') return 'text-brand-warning bg-brand-warning/10 border-brand-warning/20';
    if (status === 'CRITICAL') return 'text-brand-critical bg-brand-critical/10 border-brand-critical/20';
    return 'text-slate-300 bg-slate-700/30 border-slate-600/30';
  };

  if (isLoading) {
    return <div className="p-6 text-white text-center">Loading Events...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Events History</h1>
          <p className="text-sm text-brand-muted">Comprehensive log of all safety alerts and system changes.</p>
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
                <th className="px-6 py-4 font-semibold">Timestamp (IST)</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Risk Score</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 font-semibold">Hardware Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-brand-muted">No events recorded yet.</td>
                </tr>
              ) : (
                events.map((event, idx) => (
                  <tr key={idx} className="hover:bg-brand-elevated/30 transition">
                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                      {formatISTDateTime(event.timestamp || event.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${getStatusColor(event.status)}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{event.risk_score}</span>
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${event.risk_score > 50 ? 'bg-brand-critical' : event.risk_score > 20 ? 'bg-brand-warning' : 'bg-brand-safe'}`} style={{ width: `${Math.min(event.risk_score, 100)}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-brand-secondaryText" title={event.reason}>
                      {event.reason || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 text-[11px]">
                        <span>Engine: <strong className={event.engine_state === 'OFF' ? 'text-brand-critical' : 'text-brand-safe'}>{event.engine_state}</strong></span>
                        <span>Buzzer: <strong>{event.buzzer_action === '0' ? 'OFF' : event.buzzer_action}</strong></span>
                      </div>
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
