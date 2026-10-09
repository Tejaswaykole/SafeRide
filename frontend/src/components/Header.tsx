import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatISTTime } from '../utils/time';
import { getVehicleRestUrl, getVehicleWsUrl } from '../config/api';

export default function Header() {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentISTTime, setCurrentISTTime] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const VEHICLE_ID = 1;
  const { lastMessage } = useWebSocket(getVehicleWsUrl(VEHICLE_ID));

  // Live Indian Standard Time (IST UTC+05:30) Ticking Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentISTTime(now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }) + ' IST');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`${getVehicleRestUrl(VEHICLE_ID)}/events?limit=5`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (e) {
        console.warn("Failed to fetch notifications", e);
      }
    };
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'safety_event') {
      setNotifications(prev => {
        if (prev.some(n => n.id === lastMessage.id)) return prev;
        return [lastMessage, ...prev].slice(0, 10);
      });
      setUnreadCount(prev => prev + 1);
    }
  }, [lastMessage]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleNotifications = () => {
    setIsNotificationsOpen(!isNotificationsOpen);
    if (!isNotificationsOpen) {
      setUnreadCount(0);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'SAFE') return 'text-brand-safe bg-brand-safe/10 border-brand-safe/20';
    if (status === 'WARNING') return 'text-brand-warning bg-brand-warning/10 border-brand-warning/20';
    if (status === 'CRITICAL') return 'text-brand-critical bg-brand-critical/10 border-brand-critical/20';
    return 'text-slate-300 bg-slate-700/30 border-slate-600/30';
  };

  return (
    <header className="h-16 px-6 bg-brand-surface/90 border-b border-brand-border backdrop-blur-md flex items-center justify-between sticky top-0 z-30" data-purpose="top-header">
      {/* Left Subtitle / context */}
      <div className="hidden sm:block">
        <h2 className="text-xs font-medium text-brand-secondaryText tracking-wide uppercase">
          Intelligent Vehicle Safety &amp; Emergency Monitoring System
        </h2>
      </div>
      {/* Right Action Items */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Live IST Synchronized Clock Widget */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-brand-border/80 text-xs font-mono shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">IST:</span>
          <span className="text-amber-300 font-bold tracking-tight">{currentISTTime || 'SYNCING...'}</span>
        </div>

        {/* System Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-elevated border border-brand-border text-xs">
          <span className="w-2 h-2 rounded-full bg-brand-safe animate-pulse"></span>
          <span className="font-medium text-white">System Online</span>
        </div>
        
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={toggleNotifications}
            className="relative p-2 rounded-full bg-brand-elevated hover:bg-brand-border/80 border border-brand-border text-brand-secondaryText hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-critical text-[9px] font-bold text-white ring-2 ring-brand-surface">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-brand-surface border border-brand-border shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-brand-border flex justify-between items-center bg-brand-elevated">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] text-brand-accent cursor-pointer hover:underline" onClick={() => setUnreadCount(0)}>Mark all read</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-brand-muted">
                    No recent notifications.
                  </div>
                ) : (
                  <div className="divide-y divide-brand-border/50">
                    {notifications.map((notif, idx) => (
                      <div key={idx} className="p-4 hover:bg-brand-elevated/50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(notif.status)}`}>
                            {notif.status}
                          </span>
                          <span className="text-[10px] text-brand-muted font-mono">
                            {formatISTTime(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-white font-medium mt-1">
                          {notif.status === 'CRITICAL' ? 'High Risk Event Detected' : notif.status === 'WARNING' ? 'Safety Warning Issued' : 'System Status Changed'}
                        </p>
                        <p className="text-[11px] text-brand-secondaryText mt-0.5 line-clamp-2">
                          {notif.reason || 'Safety parameters updated.'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-2 bg-brand-elevated border-t border-brand-border text-center">
                <a href="/events" className="text-[11px] text-brand-accent hover:text-brand-accent/80 font-medium">View all events</a>
              </div>
            </div>
          )}
        </div>

        {/* Driver Profile */}
        <div className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full bg-brand-elevated border border-brand-border cursor-pointer hover:border-brand-muted transition">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">
            <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div className="text-left pr-1 leading-none">
            <span className="text-xs font-semibold text-white block">Driver</span>
            <span className="text-[10px] text-brand-muted">Vehicle #1023</span>
          </div>
          <svg className="w-3.5 h-3.5 text-brand-muted pr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </div>
      </div>
    </header>
  );
}
