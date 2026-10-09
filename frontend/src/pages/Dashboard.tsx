import { useState, useEffect, useCallback } from 'react';
import SensorCard from '../components/SensorCard';
import EventCard from '../components/EventCard';
import RealMap from '../components/RealMap';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatISTTime } from '../utils/time';
import { getVehicleRestUrl, getVehicleWsUrl } from '../config/api';

// Helper to generate a smooth Bezier SVG curve from discrete coordinates
function generateSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }
  let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

export default function Dashboard() {
  const VEHICLE_ID = 1;
  const REST_API_URL = getVehicleRestUrl(VEHICLE_ID);
  const WS_URL = getVehicleWsUrl(VEHICLE_ID);

  const [isLoading, setIsLoading] = useState(true);
  const [vehicleStatus, setVehicleStatus] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [latestSensors, setLatestSensors] = useState<any>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Dynamic Real-time Risk Score & Sensor Telemetry Trend History
  const [riskTrend, setRiskTrend] = useState<any[]>([]);

  // Countdown timer state
  const [countdown, setCountdown] = useState<number>(0);

  // Latched Critical State: holds system in CRITICAL mode & engine locked OFF until reset
  const [isLatchedCritical, setIsLatchedCritical] = useState<boolean>(false);
  const [latchedReason, setLatchedReason] = useState<string | null>(null);

  const { status: wsStatus, lastMessage } = useWebSocket(WS_URL);

  const fetchDashboardData = useCallback(async (isInitial = false) => {
    try {
      const [statusRes, eventsRes, sensorsRes, trendRes] = await Promise.all([
        fetch(`${REST_API_URL}/status`),
        fetch(`${REST_API_URL}/events?limit=50`),
        fetch(`${REST_API_URL}/sensor-readings?limit=1`),
        fetch(`${REST_API_URL}/risk-trend?limit=25`)
      ]);
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setVehicleStatus(statusData);
        if (statusData.admin_cutoff) {
          setIsLatchedCritical(true);
          if (statusData.admin_timer > 0) setCountdown(statusData.admin_timer);
        } else if (statusData.critical_latched && (statusData.critical_timer == null || statusData.critical_timer <= 0)) {
          setIsLatchedCritical(true);
          setCountdown(0);
          if (statusData.reason) setLatchedReason(statusData.reason);
        } else if (statusData.current_status === 'CRITICAL' || statusData.status === 'CRITICAL' || statusData.critical_active) {
          setIsLatchedCritical(false);
          if (statusData.reason) setLatchedReason(statusData.reason);
          const rem = statusData.critical_timer > 0 ? statusData.critical_timer : 60;
          setCountdown(prev => (prev > 0 ? Math.min(prev, rem) : rem));
        } else if (statusData.current_status === 'SAFE' && !statusData.critical_latched) {
          setIsLatchedCritical(false);
          setLatchedReason(null);
          setCountdown(0);
        }
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setRecentEvents(eventsData);
      }

      if (sensorsRes.ok) {
        const sensors = await sensorsRes.json();
        if (sensors.length > 0) {
          setLatestSensors(sensors[0]);
        }
      }

      if (trendRes.ok) {
        const trendData = await trendRes.json();
        if (Array.isArray(trendData) && trendData.length > 0) {
          setRiskTrend(trendData);
        }
      }
    } catch (e) {
      if (isInitial) {
        console.error("Failed to fetch initial dashboard data", e);
      }
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  }, [REST_API_URL]);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Update when WebSocket delivers new status or events
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'vehicle_status') {
        setVehicleStatus(lastMessage);

        // Manage Critical Latched State & 1-Minute Countdown
        if (lastMessage.admin_cutoff) {
          setIsLatchedCritical(true);
          if (lastMessage.admin_timer > 0) {
            setCountdown(lastMessage.admin_timer);
          }
        } else if (lastMessage.critical_latched && (lastMessage.critical_timer == null || lastMessage.critical_timer <= 0)) {
          setIsLatchedCritical(true);
          setCountdown(0);
          if (lastMessage.reason) setLatchedReason(lastMessage.reason);
        } else if (lastMessage.status === 'CRITICAL' || lastMessage.critical_active) {
          setIsLatchedCritical(false);
          if (lastMessage.reason) setLatchedReason(lastMessage.reason);
          const rem = lastMessage.critical_timer > 0 ? lastMessage.critical_timer : 60;
          setCountdown(prev => (prev > 0 ? Math.min(prev, rem) : rem));
        } else if (lastMessage.reason?.includes('RESET') || (lastMessage.status === 'SAFE' && !lastMessage.critical_latched)) {
          setIsLatchedCritical(false);
          setLatchedReason(null);
          setCountdown(0);
        }

        setLatestSensors({
          alcohol_value: lastMessage.alcohol_value,
          accel_x: lastMessage.accel_x,
          accel_y: lastMessage.accel_y,
          accel_z: lastMessage.accel_z,
          gyro_x: lastMessage.gyro_x,
          gyro_y: lastMessage.gyro_y,
          gyro_z: lastMessage.gyro_z,
          temperature: lastMessage.temperature,
          latitude: lastMessage.latitude,
          longitude: lastMessage.longitude,
          timestamp: lastMessage.timestamp
        });

        // Append real-time data point to dynamic risk trend history
        const newPoint = {
          id: Date.now(),
          timestamp: lastMessage.timestamp || new Date().toISOString(),
          risk_score: (lastMessage.admin_cutoff || vehicleStatus?.admin_cutoff) ? 100 : (lastMessage.risk_score ?? 10),
          status: (lastMessage.admin_cutoff || vehicleStatus?.admin_cutoff) ? 'CRITICAL' : (lastMessage.status || 'SAFE'),
          alcohol_value: lastMessage.alcohol_value ?? 0,
          accel_x: lastMessage.accel_x ?? 0,
          accel_y: lastMessage.accel_y ?? 0,
          accel_z: lastMessage.accel_z ?? 9.8,
          gyro_x: lastMessage.gyro_x ?? 0,
          gyro_y: lastMessage.gyro_y ?? 0,
          gyro_z: lastMessage.gyro_z ?? 0,
          temperature: lastMessage.temperature ?? 30.0
        };
        setRiskTrend(prev => {
          const next = [...prev, newPoint];
          return next.slice(-25);
        });
      } else if (lastMessage.type === 'location_update') {
        setVehicleStatus((prev: any) => ({
          ...prev,
          latitude: lastMessage.latitude,
          longitude: lastMessage.longitude,
          gps_connected: true
        }));
        setLatestSensors((prev: any) => prev ? ({
          ...prev,
          latitude: lastMessage.latitude,
          longitude: lastMessage.longitude
        }) : null);
      } else if (lastMessage.type === 'safety_event') {
        setRecentEvents(prev => {
          if (prev.some(e => e.id === lastMessage.id)) return prev;
          return [lastMessage, ...prev].slice(0, 50);
        });
      }
    }
  }, [lastMessage, vehicleStatus]);

  // Dual Real-time Synchronization:
  // Active fast polling when disconnected (2.5s), periodic background sync when connected (6s)
  useEffect(() => {
    const pollIntervalMs = wsStatus === 'connected' ? 6000 : 2500;
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, pollIntervalMs);

    const handleFocus = () => {
      fetchDashboardData(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [wsStatus, fetchDashboardData]);

  // Smooth local 1-second countdown ticker
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // When 1-minute countdown reaches 0, the engine turns OFF and stays locked in latched critical!
          setIsLatchedCritical(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Remote Admin Actions
  const handleAdminCutoff = async () => {
    try {
      setIsActionLoading(true);
      setActionMessage("Sending Admin Cutoff Command...");
      const res = await fetch(`${REST_API_URL}/admin-cutoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage("Engine Shut Off by Admin! 1-Minute Timer Started.");
        setIsLatchedCritical(true);
        setLatchedReason("OFFED BY ADMIN");
        setCountdown(60);
        setRiskTrend(prev => [...prev, {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          risk_score: 100,
          status: 'CRITICAL',
          alcohol_value: 0,
          accel_x: 0, accel_y: 0, accel_z: 9.8,
          gyro_x: 0, gyro_y: 0, gyro_z: 0,
          temperature: 30.0
        }].slice(-25));
        setTimeout(() => fetchDashboardData(false), 500);
      } else {
        setActionMessage(data.detail || "Failed to trigger admin cutoff");
      }
    } catch (err) {
      setActionMessage("Network error during admin cutoff");
    } finally {
      setIsActionLoading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleSystemReset = async () => {
    try {
      setIsActionLoading(true);
      setActionMessage("Resetting vehicle system...");
      const res = await fetch(`${REST_API_URL}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setIsLatchedCritical(false);
        setLatchedReason(null);
        setActionMessage("System Reset Complete! Engine Restored & Operational.");
        setCountdown(0);
        setVehicleStatus((prev: any) => ({
          ...prev,
          current_status: 'SAFE',
          status: 'SAFE',
          current_risk_score: 0,
          risk_score: 0,
          engine_state: 'ON',
          critical_active: false,
          critical_latched: false,
          admin_cutoff: false,
          admin_timer: 0,
          reason: 'SYSTEM RESET - ENGINE RESTORED'
        }));
        setRiskTrend(prev => [...prev, {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          risk_score: 10,
          status: 'SAFE',
          alcohol_value: 70,
          accel_x: 0, accel_y: 0, accel_z: 9.8,
          gyro_x: 0, gyro_y: 0, gyro_z: 0,
          temperature: 30.0
        }].slice(-25));
        setTimeout(() => fetchDashboardData(false), 500);
      } else {
        setActionMessage(data.detail || "Failed to reset system");
      }
    } catch (err) {
      setActionMessage("Network error during system reset");
    } finally {
      setIsActionLoading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center p-6 bg-brand-background text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-brand-muted">Loading SafeRide Dashboard...</span>
        </div>
      </div>
    );
  }

  // Raw sensor values
  const alcoholVal = latestSensors ? (latestSensors.alcohol_value ?? 0) : 0;
  const accValue = latestSensors 
    ? Math.max(Math.abs(latestSensors.accel_x ?? 0), Math.abs(latestSensors.accel_y ?? 0), Math.abs((latestSensors.accel_z ?? 9.8) - 9.8)).toFixed(2)
    : '0.00';
  const gyroValue = latestSensors 
    ? Math.max(Math.abs(latestSensors.gyro_x ?? 0), Math.abs(latestSensors.gyro_y ?? 0), Math.abs(latestSensors.gyro_z ?? 0)).toFixed(2)
    : '0.00';

  // Strict Evaluation State (Admin Cutoff > Latched Critical > Alcohol / MPU)
  const isAdminCutoff = Boolean(
    vehicleStatus?.admin_cutoff || 
    vehicleStatus?.reason === "OFFED BY ADMIN" ||
    vehicleStatus?.reason === "ADMIN SHUTDOWN"
  );

  const isCritical = Boolean(
    isLatchedCritical ||
    vehicleStatus?.critical_latched ||
    isAdminCutoff ||
    vehicleStatus?.status === 'CRITICAL' ||
    vehicleStatus?.current_status === 'CRITICAL' ||
    (latestSensors && (latestSensors.alcohol_value ?? 0) > 1000)
  );

  // If Admin cutoff is active, DO NOT show alcohol or MPU per user requirement
  const isAlcoholWarnPhase1 = !isAdminCutoff && Boolean(alcoholVal >= 500 && alcoholVal <= 750);
  const isAlcoholWarnPhase2 = !isAdminCutoff && Boolean(alcoholVal >= 751 && alcoholVal <= 1000);
  const isAlcoholCrit = !isAdminCutoff && Boolean((alcoholVal > 1000) || (vehicleStatus?.status === 'CRITICAL' && (vehicleStatus?.reason?.includes('ALCOHOL') || alcoholVal >= 500)));
  const isAlcoholWarn = !isAdminCutoff && (isAlcoholWarnPhase1 || isAlcoholWarnPhase2 || Boolean(vehicleStatus?.alcohol_detected));
  const isRashWarn = !isAdminCutoff && Boolean(vehicleStatus?.rash_driving_detected);

  const riskScore = isCritical ? 100 : (vehicleStatus?.current_risk_score ?? vehicleStatus?.risk_score ?? 0);
  const currentStatus = isAdminCutoff 
    ? "OFFED BY ADMIN" 
    : isCritical 
    ? "CRITICAL" 
    : (vehicleStatus?.current_status ?? vehicleStatus?.status ?? "SAFE");
  // Engine State:
  // - Admin Cutoff -> OFF immediately
  // - Critical Latched (timer finished) -> OFF
  // - Critical Warning actively counting down (countdown > 0) -> ON (turns OFF after 1-min timer!)
  // - Critical with timer finished (countdown <= 0) -> OFF
  // - Normal safe operation -> based on vehicleStatus engine_state
  const isEngineOn = isAdminCutoff
    ? false
    : isLatchedCritical && countdown <= 0
    ? false
    : isCritical && countdown > 0
    ? true
    : isCritical && countdown <= 0
    ? false
    : (vehicleStatus?.engine_state === "ON" || vehicleStatus?.engine_state === 1 || vehicleStatus?.engine_state == null);

  // Real Speed and Distance
  const realSpeed = vehicleStatus?.speed != null ? Number(vehicleStatus.speed).toFixed(1) : '0.0';
  const realDistance = vehicleStatus?.distance != null ? Number(vehicleStatus.distance).toFixed(2) : '0.00';

  // Dynamic Real-time Risk Score Trend SVG Paths
  const effectiveTrend = riskTrend.length > 0 
    ? riskTrend 
    : [
        { risk_score: riskScore, timestamp: new Date().toISOString() },
        { risk_score: riskScore, timestamp: new Date().toISOString() }
      ];

  const riskSvgPoints = effectiveTrend.map((pt, idx, arr) => {
    const x = 30 + (idx / Math.max(1, arr.length - 1)) * 460;
    const scoreVal = isAdminCutoff ? 100 : (pt.risk_score != null ? pt.risk_score : 10);
    const clamped = Math.min(100, Math.max(0, scoreVal));
    const y = 180 - (clamped / 100) * 160;
    return { x, y, score: scoreVal, raw: pt };
  });

  const riskStrokeD = generateSmoothPath(riskSvgPoints);
  const firstRiskX = riskSvgPoints[0].x;
  const lastRiskX = riskSvgPoints[riskSvgPoints.length - 1].x;
  const riskAreaD = `${riskStrokeD} L ${lastRiskX.toFixed(1)} 180 L ${firstRiskX.toFixed(1)} 180 Z`;

  // Dynamic Highlight Points
  const latestRiskPoint = riskSvgPoints[riskSvgPoints.length - 1];
  const peakRiskPoint = riskSvgPoints.reduce((max, curr) => (curr.score > max.score ? curr : max), riskSvgPoints[0]);
  const currentRiskColor = riskScore >= 70 ? '#EF4444' : riskScore >= 30 ? '#F59E0B' : '#22C55E';

  // Dynamic Live Telemetry Waveform SVG Paths (Alcohol, Accel, Temp)
  const alcoholSvgPoints = effectiveTrend.map((pt, idx, arr) => {
    const x = 30 + (idx / Math.max(1, arr.length - 1)) * 460;
    const alcRaw = pt.alcohol_value ?? 0;
    const alcPct = Math.min(100, Math.max(0, (alcRaw / 1000) * 100));
    const y = 145 - (alcPct / 100) * 130;
    return { x, y };
  });

  const accelSvgPoints = effectiveTrend.map((pt, idx, arr) => {
    const x = 30 + (idx / Math.max(1, arr.length - 1)) * 460;
    const ax = pt.accel_x ?? 0;
    const ay = pt.accel_y ?? 0;
    const az = pt.accel_z ?? 9.8;
    const mag = Math.max(0, Math.sqrt(ax * ax + ay * ay + az * az) - 9.8);
    const accPct = Math.min(100, Math.max(0, (mag / 8.0) * 100));
    const y = 145 - (accPct / 100) * 130;
    return { x, y };
  });

  const tempSvgPoints = effectiveTrend.map((pt, idx, arr) => {
    const x = 30 + (idx / Math.max(1, arr.length - 1)) * 460;
    const tempRaw = pt.temperature ?? 30.0;
    const tempPct = Math.min(100, Math.max(0, ((tempRaw - 15) / 35) * 100));
    const y = 145 - (tempPct / 100) * 130;
    return { x, y };
  });

  const alcoholStrokeD = generateSmoothPath(alcoholSvgPoints);
  const accelStrokeD = generateSmoothPath(accelSvgPoints);
  const tempStrokeD = generateSmoothPath(tempSvgPoints);

  // Sensor Metric Cards
  const sensorData = [
    { 
      title: 'Alcohol Sensor', 
      subtitle: isAdminCutoff 
        ? 'MQ-3 Gas Sensor' 
        : isAlcoholCrit 
        ? 'Critical (>1000 Raw ADC)' 
        : isAlcoholWarnPhase2 
        ? 'Warn Phase 2 (751-1000)' 
        : isAlcoholWarnPhase1 
        ? 'Warn Phase 1 (500-750)' 
        : 'MQ-3 Gas Sensor (Safe <500)',
      value: latestSensors ? latestSensors.alcohol_value.toFixed(1) : '--', 
      unit: 'raw', 
      icon: 'alcohol', 
      status: isAdminCutoff 
        ? 'Normal' 
        : isAlcoholCrit 
        ? 'Critical' 
        : isAlcoholWarnPhase2 
        ? 'Warn Phase 2' 
        : isAlcoholWarnPhase1 
        ? 'Warn Phase 1' 
        : 'Normal', 
      isTriggered: isAlcoholWarn || isAlcoholCrit,
      levels: isAlcoholCrit 
        ? ['bg-red-500', 'bg-red-500', 'bg-red-500'] 
        : isAlcoholWarnPhase2 
        ? ['bg-amber-500', 'bg-amber-500', 'bg-amber-500'] 
        : isAlcoholWarnPhase1 
        ? ['bg-amber-500', 'bg-amber-500', 'bg-brand-border'] 
        : ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-border'] 
    },
    { 
      title: 'Acceleration', 
      subtitle: (!isAdminCutoff && vehicleStatus?.jerk_percentage) ? `MPU-6050 (${vehicleStatus.jerk_percentage}% Jerk)` : 'MPU-6050 3-Axis Accel',
      value: accValue, 
      unit: 'g', 
      icon: 'motion', 
      status: isRashWarn ? 'Warning' : 'Normal', 
      isTriggered: isRashWarn,
      levels: isRashWarn 
        ? ['bg-amber-500', 'bg-amber-500', 'bg-brand-border'] 
        : ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-border'] 
    },
    { 
      title: 'Gyroscope', 
      subtitle: (!isAdminCutoff && vehicleStatus?.jerk_beeps) ? `MPU-6050 (${vehicleStatus.jerk_beeps} Beeps)` : 'MPU-6050 3-Axis Gyro',
      value: gyroValue, 
      unit: '°/s', 
      icon: 'motion', 
      status: isRashWarn ? 'Warning' : 'Normal', 
      isTriggered: isRashWarn,
      levels: isRashWarn 
        ? ['bg-amber-500', 'bg-amber-500', 'bg-brand-border'] 
        : ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-border'] 
    },
    { 
      title: 'Temperature', 
      subtitle: 'DHT11 Sensor',
      value: latestSensors && latestSensors.temperature ? latestSensors.temperature.toFixed(1) : '--', 
      unit: '°C', 
      icon: 'temp', 
      status: 'Normal', 
      levels: ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-border'] 
    },
    { 
      title: 'GPS Status', 
      subtitle: vehicleStatus?.is_last_known_location 
        ? 'Last Known Position' 
        : (vehicleStatus?.gps_connected ? 'NEO-6M UART2 (Locked)' : 'NEO-6M UART2 (Searching)'),
      value: (latestSensors && latestSensors.latitude) ? `${latestSensors.latitude.toFixed(4)}° N` : (vehicleStatus?.latitude ? `${vehicleStatus.latitude.toFixed(4)}° N` : '--'), 
      subValue: (latestSensors && latestSensors.longitude) ? `${latestSensors.longitude.toFixed(4)}° E` : (vehicleStatus?.longitude ? `${vehicleStatus.longitude.toFixed(4)}° E` : '--'), 
      unit: '', 
      icon: 'gps', 
      status: vehicleStatus?.gps_connected 
        ? 'Connected' 
        : (latestSensors?.latitude || vehicleStatus?.latitude) 
        ? 'Last Known' 
        : 'Disconnected', 
      levels: vehicleStatus?.gps_connected
        ? ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-safe']
        : (latestSensors?.latitude || vehicleStatus?.latitude)
        ? ['bg-amber-500', 'bg-amber-500', 'bg-brand-border']
        : ['bg-red-500', 'bg-brand-border', 'bg-brand-border']
    },
    { 
      title: 'Engine / Relay', 
      subtitle: isAdminCutoff 
        ? 'Admin Cutoff Engaged' 
        : (isCritical && countdown > 0 
            ? `1-Min Shutdown (${countdown}s)` 
            : isCritical 
            ? 'Safety Cutoff Locked' 
            : 'Ignition Relay Pin 23'),
      value: isCritical && countdown > 0 && !isAdminCutoff 
        ? `ON (${countdown}s)` 
        : isEngineOn 
        ? 'ENGINE ON' 
        : 'ENGINE OFF', 
      unit: '', 
      icon: 'engine', 
      status: isCritical && countdown > 0 && !isAdminCutoff 
        ? `Cutoff in ${countdown}s` 
        : isEngineOn 
        ? 'Running' 
        : 'Cutoff / Stopped', 
      levels: isEngineOn && (!isCritical || countdown > 0)
        ? (isCritical ? ['bg-amber-500', 'bg-amber-500', 'bg-brand-border'] : ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-safe'])
        : ['bg-red-500', 'bg-red-500', 'bg-red-500'] 
    },
  ];

  // Dynamic Event Statistics from actual DB events
  const totalEvents = recentEvents.length;
  const safeEvents = recentEvents.filter(e => e.status === "SAFE").length;
  const warningEvents = recentEvents.filter(e => e.status === "WARNING").length;
  const criticalEvents = recentEvents.filter(e => e.status === "CRITICAL").length;

  const safePct = totalEvents > 0 ? Math.round((safeEvents / totalEvents) * 100) : 0;
  const warnPct = totalEvents > 0 ? Math.round((warningEvents / totalEvents) * 100) : 0;
  const critPct = totalEvents > 0 ? Math.round((criticalEvents / totalEvents) * 100) : 0;

  // Real SVG Donut calculation: Circumference = 2 * PI * 38 ≈ 239
  const circumference = 239;
  const safeArc = totalEvents > 0 ? (safeEvents / totalEvents) * circumference : 0;
  const warnArc = totalEvents > 0 ? (warningEvents / totalEvents) * circumference : 0;
  const critArc = totalEvents > 0 ? (criticalEvents / totalEvents) * circumference : 0;

  const mappedEvents = recentEvents.map(e => ({
    title: e.reason === "OFFED BY ADMIN" 
      ? "Admin Cutoff Triggered" 
      : e.status === "CRITICAL" 
      ? "Critical Shutdown Alert" 
      : e.status === "WARNING" 
      ? "Safety Warning Triggered" 
      : "Vehicle Safe Status",
    desc: e.reason || "Normal Driving Safe",
    time: formatISTTime(e.timestamp || e.created_at),
    type: e.status ? e.status.toLowerCase() : 'safe'
  }));

  return (
    <div className="p-6 space-y-6">
      {/* ACTION MESSAGE TOAST / BANNER */}
      {actionMessage && (
        <div className="bg-sky-500/20 border border-sky-400 text-sky-200 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between shadow-lg animate-fade-in">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-white hover:text-sky-300 font-bold ml-4">✕</button>
        </div>
      )}

      {/* PERSISTENT CRITICAL EMERGENCY & ENGINE LOCKOUT BANNER */}
      {(isCritical || countdown > 0 || isAdminCutoff || vehicleStatus?.critical_active) && (
        <div className={`p-4 sm:p-5 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl transition-all ${
          isAdminCutoff 
            ? 'bg-red-950/90 border-red-500 text-red-100 shadow-[0_0_40px_rgba(239,68,68,0.45)]' 
            : isEngineOn && countdown > 0
            ? 'bg-amber-950/85 border-amber-500 text-amber-100 shadow-[0_0_35px_rgba(245,158,11,0.4)]'
            : 'bg-red-950/90 border-red-500 text-red-100 shadow-[0_0_40px_rgba(239,68,68,0.45)]'
        } animate-pulse`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl font-black ${
              isEngineOn && countdown > 0 && !isAdminCutoff ? 'bg-amber-500 text-black' : 'bg-red-600 text-white'
            } shadow-lg`}>
              {isEngineOn && countdown > 0 && !isAdminCutoff ? '⏱️' : '⚠️'}
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black tracking-wide uppercase flex flex-wrap items-center gap-2">
                <span>
                  {isAdminCutoff 
                    ? 'ENGINE SHUT OFF BY ADMIN' 
                    : isEngineOn && countdown > 0 
                    ? `CRITICAL SAFETY WARNING: ENGINE CUTOFF IN ${countdown}s` 
                    : 'CRITICAL SAFETY EMERGENCY - ENGINE LOCKED OFF'}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-extrabold ${
                  isEngineOn 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400' 
                    : 'bg-black/60 border-red-400 text-red-300'
                }`}>
                  {isEngineOn ? `ENGINE ON (CUTOFF IN ${countdown}s)` : 'ENGINE OFF'}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${
                  isEngineOn ? 'bg-amber-500/30 text-amber-200 border-amber-400/50' : 'bg-red-500/20 border-red-400/40 text-red-200'
                }`}>
                  {isEngineOn ? '1-MIN WARNING TIMER' : 'LATCHED LOCKED'}
                </span>
              </div>
              <p className="text-xs text-red-200 mt-1 font-semibold max-w-2xl leading-relaxed">
                {isAdminCutoff 
                  ? 'Remote admin shutdown triggered. Engine relay cut off (GPIO 23 OPEN). System is locked in critical mode until Reset button is clicked.' 
                  : isEngineOn && countdown > 0
                  ? `Critical safety condition detected (${latchedReason || vehicleStatus?.reason || 'Heavy Alcohol'}). 1-minute countdown active! Engine will turn OFF after ${countdown}s. Pull vehicle over safely!`
                  : (latchedReason || vehicleStatus?.reason || 'Critical condition detected. Vehicle emergency shutdown protocol active. 1-minute timer expired: Engine is now OFF.')}
                <span className="block mt-0.5 text-white/95 font-bold">
                  {isEngineOn && countdown > 0 && !isAdminCutoff
                    ? `⚠️ Engine will cut off when 1-minute timer reaches 0s. Click button to cancel alarm or restore.`
                    : `⚠️ System will remain in CRITICAL mode and engine will stay OFF until you click "RESET & RESTORE ENGINE".`}
                </span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-shrink-0 w-full md:w-auto justify-end">
            {countdown > 0 && (
              <div className="bg-black/70 border border-amber-500/40 rounded-xl px-4 py-2 flex items-center gap-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300">Countdown:</span>
                <span className="text-2xl font-black font-mono text-amber-300 tracking-wider">
                  {countdown}s
                </span>
              </div>
            )}
            <button
              onClick={handleSystemReset}
              disabled={isActionLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all shadow-[0_0_25px_rgba(34,197,94,0.45)] active:scale-95 disabled:opacity-50 flex items-center gap-2 border border-emerald-400 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              {isEngineOn && countdown > 0 && !isAdminCutoff ? 'RESET & CANCEL CUTOFF' : 'RESET & RESTORE ENGINE'}
            </button>
          </div>
        </div>
      )}

      {/* Top Row Grid (Current Vehicle Status & Vehicle Info + Admin Controls) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5" data-purpose="status-overview-section">
        {/* Current Vehicle Status Card */}
        <div className="lg:col-span-7 bg-brand-surface border border-brand-border rounded-2xl p-6 flex flex-col justify-between shadow-lg relative" data-purpose="vehicle-status-card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-semibold text-brand-secondaryText uppercase tracking-wider">Current Vehicle Status</h3>
              <p className="text-[10px] text-brand-muted mt-1 uppercase tracking-widest font-semibold">
                Hardware State • Engine: {isEngineOn ? 'ON' : 'OFF'} • Relay: {isEngineOn ? 'ACTIVE' : 'CUTOFF'} • Buzzer: {vehicleStatus?.buzzer_action > 0 ? 'ACTIVE' : 'OFF'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider flex items-center gap-1.5 ${
                isCritical && countdown > 0 && !isAdminCutoff
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
                  : isEngineOn 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(34,197,94,0.3)]' 
                  : 'bg-red-500/25 text-red-400 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  isCritical && countdown > 0 && !isAdminCutoff ? 'bg-amber-400 animate-ping' : isEngineOn ? 'bg-emerald-400 animate-ping' : 'bg-red-400 animate-ping'
                }`}></span>
                {isCritical && countdown > 0 && !isAdminCutoff ? `ENGINE ON (${countdown}s)` : isEngineOn ? 'ENGINE ON' : 'ENGINE OFF'}
              </div>
              <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider ${wsStatus === 'connected' ? 'bg-brand-safe/20 text-brand-safe border border-brand-safe/30' : 'bg-brand-critical/20 text-brand-critical border border-brand-critical/30'}`}>
                LIVE WS: {wsStatus.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
            {/* Status Shield & Badge */}
            <div className="flex items-center gap-5">
              <div className={`w-24 h-24 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                currentStatus === 'SAFE' 
                  ? 'bg-brand-safe/10 border-brand-safe text-brand-safe shadow-[0_0_30px_rgba(34,197,94,0.15)]'
                  : currentStatus === 'WARNING'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)] animate-pulse'
                  : 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.25)] animate-pulse'
              }`}>
                <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className={`text-3xl font-black tracking-tight ${
                    currentStatus === 'SAFE' ? 'text-brand-safe' : currentStatus === 'WARNING' ? 'text-brand-warning' : 'text-brand-critical'
                  }`}>
                    {currentStatus}
                  </h1>

                  {/* ACCURATE SENSOR BADGE - ONLY SHOWS SATISFIED CONDITION */}
                  {currentStatus !== 'SAFE' && (
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md tracking-wider uppercase ${
                      currentStatus === 'CRITICAL' || isAdminCutoff
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {isAdminCutoff
                        ? '🛑 REMOTE KILL SWITCH: OFFED BY ADMIN (1-MIN TIMER)'
                        : (isAlcoholWarn && isRashWarn)
                        ? '🚨 SENSORS: MQ-3 (ALCOHOL) + MPU-6050 (RASH)'
                        : isAlcoholCrit
                        ? '🚨 SENSOR: MQ-3 GAS SENSOR (CRITICAL ALCOHOL > 1000)'
                        : isAlcoholWarnPhase2
                        ? '⚠️ SENSOR: MQ-3 GAS SENSOR (ALCOHOL WARN PHASE 2: 751-1000)'
                        : isAlcoholWarnPhase1
                        ? '⚠️ SENSOR: MQ-3 GAS SENSOR (ALCOHOL WARN PHASE 1: 500-750)'
                        : isAlcoholWarn
                        ? '⚠️ SENSOR: MQ-3 GAS SENSOR (ALCOHOL DETECTED)'
                        : isRashWarn
                        ? (vehicleStatus?.jerk_percentage 
                            ? `⚠️ SENSOR: MPU-6050 (${vehicleStatus.jerk_percentage}% JERK - ${vehicleStatus.jerk_beeps || 1} BEEPS)`
                            : '⚠️ SENSOR: MPU-6050 MOTION SENSOR (RASH DRIVING)')
                        : (vehicleStatus?.reason || 'ALERT DETECTED')}
                    </span>
                  )}
                </div>

                <p className="text-xs text-brand-secondaryText mt-1.5 flex items-center gap-2">
                  {isAdminCutoff ? (
                    <span className="font-semibold text-rose-300">
                      Engine was shut off remotely by Administrator. 1-minute shutdown active. Press Reset to restore.
                    </span>
                  ) : currentStatus === 'SAFE' ? (
                    'All parameters are within normal safe range'
                  ) : (
                    <span className="font-semibold text-slate-200">
                      {isAlcoholWarn && isRashWarn
                        ? `Dual Alert: Alcohol Raw ${alcoholVal.toFixed(0)} + Rash Accel ${accValue}g (${vehicleStatus?.jerk_percentage || 0}% Jerk)`
                        : isAlcoholCrit 
                        ? `MQ-3 Sensor Raw ADC: ${alcoholVal.toFixed(0)} (Critical Threshold > 1000) -> Emergency Shutdown Triggered`
                        : isAlcoholWarnPhase2 
                        ? `MQ-3 Sensor Raw ADC: ${alcoholVal.toFixed(0)} (Warn Phase 2: 751 - 1000 -> 15 Beeps)`
                        : isAlcoholWarnPhase1 
                        ? `MQ-3 Sensor Raw ADC: ${alcoholVal.toFixed(0)} (Warn Phase 1: 500 - 750 -> 6 Beeps)`
                        : isAlcoholWarn 
                        ? `MQ-3 Sensor Raw ADC: ${alcoholVal.toFixed(0)} (Warning Range: 500 - 1000)`
                        : isRashWarn 
                        ? (vehicleStatus?.jerk_percentage
                            ? `MPU-6050 Jerk: ${vehicleStatus.jerk_percentage}% Severity -> Pulsing ${vehicleStatus.jerk_beeps || 1} Beep(s)`
                            : `MPU-6050 Abnormal Motion (Accel: ${accValue}g, Gyro: ${gyroValue}°/s)`)
                        : (vehicleStatus?.reason || 'Safety alert detected')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Risk Score Metric */}
            <div className="w-full md:w-52 bg-brand-elevated/70 border border-brand-border/60 rounded-xl p-4">
              <span className="text-xs text-brand-muted font-medium block">Risk Score</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-white">{riskScore}</span>
                <span className="text-sm text-brand-muted">/ 100</span>
              </div>
              <div className="w-full bg-[#1e293b] h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${currentStatus === 'SAFE' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : currentStatus === 'WARNING' ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-red-500 to-rose-400'}`} 
                  style={{ width: `${Math.min(riskScore, 100)}%` }}
                ></div>
              </div>
              <div className="text-[11px] text-brand-muted mt-2">
                Telemetric status: <span className="text-slate-300 font-medium">Real-Time</span>
              </div>
            </div>
          </div>

          {/* DEDICATED PROMINENT ENGINE STATUS HERO WIDGET */}
          <div className={`mt-4 p-4 rounded-xl border-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
            isCritical && countdown > 0 && !isAdminCutoff
              ? 'bg-gradient-to-r from-amber-950/70 via-slate-900/80 to-slate-900/60 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.35)] animate-pulse'
              : isEngineOn
              ? 'bg-gradient-to-r from-emerald-950/50 via-slate-900/80 to-slate-900/60 border-emerald-500/50 shadow-[0_0_25px_rgba(34,197,94,0.2)]'
              : 'bg-gradient-to-r from-red-950/80 via-slate-900/80 to-slate-900/60 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.35)]'
          }`}>
            <div className="flex items-center gap-4">
              {/* Engine Icon Ring with pulse */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-black border-2 transition-all ${
                isCritical && countdown > 0 && !isAdminCutoff
                  ? 'bg-amber-500/20 text-amber-400 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.4)] animate-bounce'
                  : isEngineOn 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/50 shadow-[0_0_20px_rgba(34,197,94,0.35)]' 
                  : 'bg-red-500/30 text-red-400 border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-pulse'
              }`}>
                {isCritical && countdown > 0 && !isAdminCutoff ? (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                ) : isEngineOn ? (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="m14 14 3-3-3-3"></path>
                    <rect height="10" rx="2" width="14" x="5" y="7"></rect>
                    <path d="M5 10H2v4h3M19 12h3"></path>
                  </svg>
                ) : (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  </svg>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    ENGINE STATUS INDICATOR
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isCritical && countdown > 0 && !isAdminCutoff
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                      : isEngineOn 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                      : 'bg-red-500/30 text-red-200 border border-red-500/50'
                  }`}>
                    {isCritical && countdown > 0 && !isAdminCutoff 
                      ? `CUTOFF IN ${countdown}s` 
                      : isEngineOn 
                      ? 'RUNNING' 
                      : 'CUTOFF / STOPPED'}
                  </span>
                  {isCritical && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      countdown > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'bg-red-500/20 text-red-300 border border-red-400/40'
                    }`}>
                      {countdown > 0 ? '1-MIN WARNING TIMER' : 'LATCHED LOCKED'}
                    </span>
                  )}
                </div>
                <div className={`text-2xl font-black tracking-tight mt-0.5 flex items-center gap-2.5 ${
                  isCritical && countdown > 0 && !isAdminCutoff
                    ? 'text-amber-400'
                    : isEngineOn 
                    ? 'text-emerald-400' 
                    : 'text-red-400'
                }`}>
                  <span>
                    {isCritical && countdown > 0 && !isAdminCutoff
                      ? `ENGINE ON (OFF IN ${countdown}s)`
                      : isEngineOn
                      ? 'ENGINE ON'
                      : 'ENGINE OFF'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-slate-300">
                    RELAY PIN 23 • LED PIN 13
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
                  {isCritical && countdown > 0 && !isAdminCutoff
                    ? `⚠️ Critical condition detected! 1-minute safety window active (${countdown}s left). Engine Light & Relay stay ON so you can pull over safely, then shut OFF at 0s unless Reset.`
                    : isEngineOn 
                    ? 'Ignition relay (Pin 23) energized & Engine LED (Pin 13) ON. Vehicle engine is running safely.'
                    : 'Emergency cutoff active. Ignition relay disconnected (Cutoff LOW) & Engine LED OFF. Engine locked until Reset.'}
                </p>
              </div>
            </div>

            {/* Action Buttons on Engine Widget */}
            {(isCritical || !isEngineOn) && (
              <button
                onClick={handleSystemReset}
                disabled={isActionLoading}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(34,197,94,0.35)] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-400 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
                {isCritical && countdown > 0 && !isAdminCutoff ? 'RESET & CANCEL CUTOFF' : 'RESET & TURN ON ENGINE'}
              </button>
            )}
          </div>
        </div>

        {/* Vehicle Information & Admin Remote Controls Card */}
        <div className="lg:col-span-5 bg-brand-surface border border-brand-border rounded-2xl p-6 flex flex-col justify-between shadow-lg" data-purpose="vehicle-info-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-brand-secondaryText uppercase tracking-wider">Vehicle & Admin Controls</h3>
            <span className="text-[11px] text-brand-muted font-mono">ID: #1023</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Real Speed and Distance Key Metrics */}
            <div className="sm:col-span-12 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-brand-border/40">
                <div className="bg-brand-elevated/60 p-2.5 rounded-lg border border-brand-border/40">
                  <div className="text-[10px] text-brand-muted uppercase font-semibold">Real GPS Speed</div>
                  <div className="text-lg font-black text-white font-mono mt-0.5">{realSpeed} <span className="text-xs font-normal text-brand-muted">km/h</span></div>
                </div>
                <div className="bg-brand-elevated/60 p-2.5 rounded-lg border border-brand-border/40">
                  <div className="text-[10px] text-brand-muted uppercase font-semibold">Real Trip Distance</div>
                  <div className="text-lg font-black text-white font-mono mt-0.5">{realDistance} <span className="text-xs font-normal text-brand-muted">km</span></div>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                <span className="text-brand-muted">Driver</span>
                <span className="font-semibold text-white">Tejas Waykole</span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                <span className="text-brand-muted">Engine Relay Pin</span>
                <span className={`font-semibold ${isEngineOn ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isEngineOn ? 'GPIO 23 (RUNNING)' : 'GPIO 23 (CUT OFF)'}
                </span>
              </div>
            </div>
          </div>

          {/* ADMIN REMOTE ENGINE CONTROL BUTTONS */}
          <div className="mt-4 pt-3 border-t border-brand-border/60">
            <div className="text-[10px] uppercase font-bold text-brand-muted tracking-wider mb-2">
              Remote Admin Override
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleAdminCutoff}
                disabled={isActionLoading || isAdminCutoff}
                className="bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Immediately cutoff relay and start 1-minute shutdown timer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                  <line x1="12" y1="2" x2="12" y2="12"></line>
                </svg>
                {isAdminCutoff ? 'Admin Cutoff Active' : 'Off Relay / Engine'}
              </button>

              <button
                onClick={handleSystemReset}
                disabled={isActionLoading}
                className="bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-400 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
                title="Restore relay engine and clear alerts"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
                Reset / Turn On
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Sensor Metric Cards (6 Cards) */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5" data-purpose="sensor-metrics-bar">
        {sensorData.map((data, index) => (
          <SensorCard key={index} {...data} />
        ))}
      </section>

      {/* Middle Row Grid (Risk Score Trend & Real Location Map) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5" data-purpose="charts-and-map-section">
        {/* Risk Score Trend Chart Card */}
        <div className="lg:col-span-6 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between" data-purpose="risk-trend-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              <h3 className="text-sm font-semibold text-white">Risk Score Trend</h3>
            </div>
            <span className="text-xs text-brand-muted font-medium">Real-time Telemetry</span>
          </div>

          {/* SVG Chart Area - 100% Synced with OG Telemetry */}
          <div className="relative w-full h-56 pt-2">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 200">
              <defs>
                <linearGradient id="riskGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor={currentRiskColor} stopOpacity="0.45"></stop>
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.18"></stop>
                  <stop offset="100%" stopColor="#22C55E" stopOpacity="0.0"></stop>
                </linearGradient>
                <linearGradient id="riskStroke" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#22C55E"></stop>
                  <stop offset="35%" stopColor="#F59E0B"></stop>
                  <stop offset="70%" stopColor="#EF4444"></stop>
                  <stop offset="100%" stopColor={currentRiskColor}></stop>
                </linearGradient>
              </defs>
              <line stroke="#1f2937" strokeDasharray="3 3" strokeWidth="1" x1="30" x2="490" y1="20" y2="20"></line>
              <line stroke="#1f2937" strokeDasharray="3 3" strokeWidth="1" x1="30" x2="490" y1="65" y2="65"></line>
              <line stroke="#1f2937" strokeDasharray="3 3" strokeWidth="1" x1="30" x2="490" y1="110" y2="110"></line>
              <line stroke="#1f2937" strokeDasharray="3 3" strokeWidth="1" x1="30" x2="490" y1="155" y2="155"></line>
              <line stroke="#26313D" strokeWidth="1.2" x1="30" x2="490" y1="180" y2="180"></line>
              <text fill="#64748B" fontSize="10" x="5" y="24">100</text>
              <text fill="#64748B" fontSize="10" x="10" y="69">75</text>
              <text fill="#64748B" fontSize="10" x="10" y="114">50</text>
              <text fill="#64748B" fontSize="10" x="10" y="159">25</text>
              <text fill="#64748B" fontSize="10" x="16" y="184">0</text>

              {/* Dynamic Real-time Area Gradient */}
              {riskAreaD && (
                <path d={riskAreaD} fill="url(#riskGradient)" className="transition-all duration-300 ease-out" />
              )}

              {/* Dynamic Real-time Spline Stroke */}
              {riskStrokeD && (
                <path 
                  d={riskStrokeD} 
                  fill="none" 
                  stroke="url(#riskStroke)" 
                  strokeLinecap="round" 
                  strokeWidth="2.5" 
                  className="transition-all duration-300 ease-out" 
                />
              )}

              {/* Individual Reading Dots (Interactive Hover) */}
              {riskSvgPoints.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r="3"
                  fill={pt.score >= 70 ? '#EF4444' : pt.score >= 30 ? '#F59E0B' : '#22C55E'}
                  opacity={i === riskSvgPoints.length - 1 ? 0.9 : 0.4}
                >
                  <title>{`Risk: ${pt.score}/100 at ${pt.raw?.timestamp ? formatISTTime(pt.raw.timestamp) : 'Live'}`}</title>
                </circle>
              ))}

              {/* Peak Point Indicator if significant */}
              {peakRiskPoint && peakRiskPoint.score >= 30 && Math.abs(peakRiskPoint.x - latestRiskPoint.x) > 20 && (
                <g>
                  <circle cx={peakRiskPoint.x} cy={peakRiskPoint.y} fill="#EF4444" r="4.5" stroke="#ffffff" strokeWidth="1.5"></circle>
                  <text x={peakRiskPoint.x} y={Math.max(14, peakRiskPoint.y - 7)} fill="#F87171" fontSize="9" fontWeight="bold" textAnchor="middle">
                    Peak {peakRiskPoint.score}
                  </text>
                </g>
              )}

              {/* Real-time Current Position Marker (Always on latest point) */}
              {latestRiskPoint && (
                <g>
                  <circle cx={latestRiskPoint.x} cy={latestRiskPoint.y} fill={currentRiskColor} r="8" opacity="0.4" className="animate-ping"></circle>
                  <circle cx={latestRiskPoint.x} cy={latestRiskPoint.y} fill={currentRiskColor} r="4.5" stroke="#ffffff" strokeWidth="2"></circle>
                </g>
              )}
            </svg>
          </div>
          <div className="flex justify-between text-[11px] text-brand-muted pl-6 pr-2 pt-2">
            <span>Historical</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              Real-time ({effectiveTrend.length} pts)
            </span>
            <span className={`font-semibold ${currentRiskColor === '#EF4444' ? 'text-rose-400' : currentRiskColor === '#F59E0B' ? 'text-amber-400' : 'text-emerald-400'}`}>
              Current: {riskScore}/100
            </span>
          </div>
        </div>

        {/* REAL VEHICLE LOCATION MAP CARD */}
        <div className="lg:col-span-6 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative" data-purpose="vehicle-location-card">
          <div className="flex items-center justify-between mb-3 z-10">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <h3 className="text-sm font-semibold text-white">Live Vehicle Map</h3>
            </div>
            <span className={`px-2.5 py-1 text-xs rounded-full border flex items-center gap-1.5 font-medium ${
              vehicleStatus?.gps_connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : (latestSensors?.latitude || vehicleStatus?.latitude)
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                vehicleStatus?.gps_connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}></span>
              {vehicleStatus?.gps_connected 
                ? 'GPS Connected (Live Fix)' 
                : (latestSensors?.latitude || vehicleStatus?.latitude)
                ? 'Last Known Location (Waiting for Fix)' 
                : 'GPS Disconnected'}
            </span>
          </div>

          {/* REAL LEAFLET OPENSTREETMAP CONTAINER */}
          <div className="relative w-full h-56 rounded-xl overflow-hidden border border-brand-border/60">
            <RealMap 
              latitude={latestSensors?.latitude ?? vehicleStatus?.latitude} 
              longitude={latestSensors?.longitude ?? vehicleStatus?.longitude} 
              speed={vehicleStatus?.speed}
              height="224px"
              isLastKnownLocation={vehicleStatus?.is_last_known_location}
              serverTimeIst={vehicleStatus?.server_time_ist}
            />
          </div>
        </div>
      </section>

      {/* Bottom Row Grid (Live Sensor Multiline Chart, REAL Event Overview, Recent Events) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5" data-purpose="detailed-monitoring-section">
        {/* Sensor Data (Live) Multi-line Chart */}
        <div className="lg:col-span-5 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between" data-purpose="sensor-live-chart-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              <h3 className="text-sm font-semibold text-white">Live Telemetry Waveform</h3>
            </div>
            <span className="text-xs text-brand-muted">Sensors Active</span>
          </div>

          <div className="flex items-center gap-4 text-xs pt-1 pb-3 text-brand-secondaryText">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Alcohol (ADC)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Jerk Accel (g)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span> Temp (°C)</span>
          </div>

          <div className="relative w-full h-44">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 160">
              <line stroke="#1c2530" strokeWidth="1" x1="30" x2="490" y1="15" y2="15"></line>
              <line stroke="#1c2530" strokeWidth="1" x1="30" x2="490" y1="50" y2="50"></line>
              <line stroke="#1c2530" strokeWidth="1" x1="30" x2="490" y1="85" y2="85"></line>
              <line stroke="#1c2530" strokeWidth="1" x1="30" x2="490" y1="120" y2="120"></line>
              <line stroke="#26313D" strokeWidth="1" x1="30" x2="490" y1="145" y2="145"></line>
              <text fill="#64748B" fontSize="9" x="5" y="19">100</text>
              <text fill="#64748B" fontSize="9" x="10" y="54">75</text>
              <text fill="#64748B" fontSize="9" x="10" y="89">50</text>
              <text fill="#64748B" fontSize="9" x="10" y="124">25</text>
              <text fill="#64748B" fontSize="9" x="16" y="148">0</text>

              {/* Dynamic Real-time Alcohol Waveform */}
              {alcoholStrokeD && (
                <path d={alcoholStrokeD} fill="none" stroke="#38BDF8" strokeLinecap="round" strokeWidth="2" className="transition-all duration-300 ease-out" />
              )}

              {/* Dynamic Real-time Jerk Waveform */}
              {accelStrokeD && (
                <path d={accelStrokeD} fill="none" stroke="#F59E0B" strokeLinecap="round" strokeWidth="2" className="transition-all duration-300 ease-out" />
              )}

              {/* Dynamic Real-time Temperature Waveform */}
              {tempStrokeD && (
                <path d={tempStrokeD} fill="none" stroke="#C084FC" strokeLinecap="round" strokeWidth="2" className="transition-all duration-300 ease-out" />
              )}
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-brand-muted pl-6 pr-2 pt-1">
            <span>Sensors Live</span>
            <span className="text-emerald-400 font-medium">Synced with OG Hardware Telemetry</span>
          </div>
        </div>

        {/* 100% REAL EVENT OVERVIEW DONUT CHART */}
        <div className="lg:col-span-3 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between" data-purpose="event-overview-card">
          <h3 className="text-sm font-semibold text-white mb-2">Real Events Overview</h3>
          <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2 my-auto">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background ring */}
                <circle cx="50" cy="50" fill="transparent" r="38" stroke="#1c2530" strokeWidth="12"></circle>
                
                {/* Real Safe Arc */}
                {safeArc > 0 && (
                  <circle 
                    cx="50" cy="50" fill="transparent" r="38" stroke="#22C55E" 
                    strokeDasharray={`${safeArc} ${circumference}`} 
                    strokeDashoffset="0" 
                    strokeLinecap="butt" strokeWidth="12"
                  ></circle>
                )}

                {/* Real Warning Arc */}
                {warnArc > 0 && (
                  <circle 
                    cx="50" cy="50" fill="transparent" r="38" stroke="#F59E0B" 
                    strokeDasharray={`${warnArc} ${circumference}`} 
                    strokeDashoffset={String(-safeArc)} 
                    strokeLinecap="butt" strokeWidth="12"
                  ></circle>
                )}

                {/* Real Critical Arc */}
                {critArc > 0 && (
                  <circle 
                    cx="50" cy="50" fill="transparent" r="38" stroke="#EF4444" 
                    strokeDasharray={`${critArc} ${circumference}`} 
                    strokeDashoffset={String(-(safeArc + warnArc))} 
                    strokeLinecap="butt" strokeWidth="12"
                  ></circle>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-white leading-none">{totalEvents}</span>
                <span className="text-[9px] text-brand-muted tracking-tight mt-0.5 font-medium">Logged Events</span>
              </div>
            </div>

            <div className="space-y-3 text-xs w-full sm:w-auto">
              <div>
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <span className="w-2 h-2 rounded-full bg-brand-safe"></span> Safe
                </div>
                <span className="text-brand-muted text-[11px] pl-3.5">{safeEvents} ({safePct}%)</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <span className="w-2 h-2 rounded-full bg-brand-warning"></span> Warning
                </div>
                <span className="text-brand-muted text-[11px] pl-3.5">{warningEvents} ({warnPct}%)</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <span className="w-2 h-2 rounded-full bg-brand-critical"></span> Critical
                </div>
                <span className="text-brand-muted text-[11px] pl-3.5">{criticalEvents} ({critPct}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* REAL RECENT SAFETY EVENTS LIST */}
        <div className="lg:col-span-4 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between" data-purpose="recent-events-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Recent Safety Events</h3>
            <span className="text-xs text-brand-muted font-medium">{recentEvents.length} Recorded</span>
          </div>
          <div className="space-y-3 text-xs overflow-y-auto max-h-80 pr-1">
            {mappedEvents.length > 0 ? (
              mappedEvents.slice(0, 15).map((event, index) => (
                <EventCard key={index} {...event} />
              ))
            ) : (
              <p className="text-brand-muted text-center italic mt-6">No recent risk events logged.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
