import { useState, useEffect, useCallback } from 'react';
import { formatISTDateTime } from '../utils/time';
import { getVehicleRestUrl, getVehicleWsUrl } from '../config/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Events() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { lastMessage } = useWebSocket(getVehicleWsUrl(1));

  const fetchEvents = useCallback(async (showRefreshingState = false) => {
    if (showRefreshingState) setIsRefreshing(true);
    try {
      const res = await fetch(`${getVehicleRestUrl(1)}/events?limit=100`);
      if (res.ok) {
        setEvents(await res.json());
      }
    } catch (e) {
      console.warn("Failed to fetch events", e);
    } finally {
      setIsLoading(false);
      if (showRefreshingState) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  }, []);

  useEffect(() => {
    fetchEvents(false);
    // Auto-refresh events every 3.5 seconds in background
    const interval = setInterval(() => {
      fetchEvents(false);
    }, 3500);

    const handleFocus = () => fetchEvents(false);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchEvents]);

  // Instant real-time WebSocket push for new events
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'safety_event') {
      setEvents(prev => {
        if (prev.some(e => e.id === lastMessage.id)) return prev;
        return [lastMessage, ...prev].slice(0, 100);
      });
    }
  }, [lastMessage]);

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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Events History</h1>
          <p className="text-sm text-brand-muted">Comprehensive log of all safety alerts and system changes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-mono px-3 py-1.5 rounded-lg flex items-center gap-2 border text-emerald-400 bg-emerald-950/60 border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Live Auto-Sync Active</span>
          </div>
          <button 
            onClick={() => fetchEvents(true)} 
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
