import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatISTTime } from '../utils/time';
import { getVehicleRestUrl } from '../config/api';

interface RealMapProps {
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
  height?: string;
  className?: string;
  autoSyncToBackend?: boolean;
  isLastKnownLocation?: boolean;
  serverTimeIst?: string | null;
}

interface LastLocation {
  lat: number;
  lon: number;
  timestamp: number;
  timeString: string;
  source: string;
}

export default function RealMap({
  latitude,
  longitude,
  speed = 0,
  height = '100%',
  className = '',
  autoSyncToBackend = false,
  isLastKnownLocation = false,
  serverTimeIst
}: RealMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const osmLayerRef = useRef<any>(null);
  const satLayerRef = useRef<any>(null);
  const satLabelsRef = useRef<any>(null);

  // Baseline fallback coordinate (SafeRide Demo Center)
  const defaultFallbackLat = 19.0760;
  const defaultFallbackLon = 72.8777;

  // Map Type State ('default' street OSM vs 'satellite' Esri)
  const [mapType, setMapType] = useState<'default' | 'satellite'>(() => {
    return (localStorage.getItem('saferide_map_type') as 'default' | 'satellite') || 'satellite';
  });

  // Last Active Location persistence
  const [lastActiveLocation, setLastActiveLocation] = useState<LastLocation | null>(() => {
    try {
      const saved = localStorage.getItem('saferide_last_active_location');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Dynamic Browser & IP Location State
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [ipCoords, setIpCoords] = useState<{ lat: number; lon: number; city?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const hasCoords = typeof latitude === 'number' && !isNaN(latitude) && latitude !== 0;
  const isLiveGpsLocked = hasCoords && !isLastKnownLocation;

  // Persist Last Active Location whenever valid live fix arrives or when backend provides last known location
  useEffect(() => {
    if (hasCoords && latitude != null && longitude != null) {
      const newLoc: LastLocation = {
        lat: latitude,
        lon: longitude,
        timestamp: Date.now(),
        timeString: serverTimeIst || formatISTTime(Date.now()),
        source: isLiveGpsLocked ? 'Hardware GPS' : 'Last Known Location'
      };
      setLastActiveLocation(newLoc);
      try {
        localStorage.setItem('saferide_last_active_location', JSON.stringify(newLoc));
      } catch (e) {
        console.warn('Failed to save last location', e);
      }
    }
  }, [hasCoords, isLiveGpsLocked, latitude, longitude, serverTimeIst]);

  // Determine active coordinates to display:
  // 1. Live hardware GPS fix
  // 2. Last known active coordinates from vehicle
  // 3. Saved localStorage last active location
  // 4. Default baseline fallback
  let activeLat: number = defaultFallbackLat;
  let activeLon: number = defaultFallbackLon;
  let activeSource: 'hardware' | 'last_known' | 'device' | 'ip' = 'last_known';

  if (isLiveGpsLocked && latitude != null && longitude != null) {
    activeLat = latitude;
    activeLon = longitude;
    activeSource = 'hardware';
  } else if (hasCoords && latitude != null && longitude != null) {
    activeLat = latitude;
    activeLon = longitude;
    activeSource = 'last_known';
  } else if (lastActiveLocation) {
    activeLat = lastActiveLocation.lat;
    activeLon = lastActiveLocation.lon;
    activeSource = 'last_known';
  } else if (deviceCoords) {
    activeLat = deviceCoords.lat;
    activeLon = deviceCoords.lon;
    activeSource = 'device';
  } else if (ipCoords) {
    activeLat = ipCoords.lat;
    activeLon = ipCoords.lon;
    activeSource = 'ip';
  }

  // 1. Acquire Real Device Geolocation (Browser GPS) for manual reference only - DO NOT AUTO-OVERRIDE
  useEffect(() => {
    let watchId: number | null = null;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          setDeviceCoords({ lat, lon, accuracy: acc });
        },
        (err) => {
          console.warn('Browser geolocation error:', err.message);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const acc = pos.coords.accuracy;
          setDeviceCoords({ lat, lon, accuracy: acc });
        },
        (err) => {
          console.warn('Geolocation watch error:', err.message);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
      );
    }

    // 2. Network IP Geolocation fallback
    const fetchIpLocation = async () => {
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        if (res.ok) {
          const data = await res.json();
          const lat = parseFloat(data.latitude);
          const lon = parseFloat(data.longitude);
          if (!isNaN(lat) && !isNaN(lon)) {
            setIpCoords({ lat, lon, city: data.city || data.region });
          }
        }
      } catch (e) {
        console.warn('Network location error:', e);
      }
    };
    fetchIpLocation();

    return () => {
      if (watchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isLiveGpsLocked, autoSyncToBackend]);

  // Sync real coordinates to vehicle backend
  const syncLocationToBackend = useCallback(async (lat: number, lon: number) => {
    try {
      setIsSyncing(true);
      await fetch(`${getVehicleRestUrl(1)}/sync-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lon })
      });
    } catch (e) {
      console.warn('Sync location error:', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Center map on current active position
  const centerOnRealLocation = () => {
    if (mapInstanceRef.current && activeLat && activeLon) {
      mapInstanceRef.current.setView([activeLat, activeLon], 16);
    }
  };

  // Toggle map type between default and satellite
  const handleToggleMapType = (type: 'default' | 'satellite') => {
    setMapType(type);
    localStorage.setItem('saferide_map_type', type);

    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      if (type === 'satellite') {
        if (osmLayerRef.current && map.hasLayer(osmLayerRef.current)) map.removeLayer(osmLayerRef.current);
        if (satLayerRef.current && !map.hasLayer(satLayerRef.current)) satLayerRef.current.addTo(map);
        if (satLabelsRef.current && !map.hasLayer(satLabelsRef.current)) satLabelsRef.current.addTo(map);
      } else {
        if (satLayerRef.current && map.hasLayer(satLayerRef.current)) map.removeLayer(satLayerRef.current);
        if (satLabelsRef.current && map.hasLayer(satLabelsRef.current)) map.removeLayer(satLabelsRef.current);
        if (osmLayerRef.current && !map.hasLayer(osmLayerRef.current)) osmLayerRef.current.addTo(map);
      }
    }
  };

  // 3. Initialize & Update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (typeof L === 'undefined') return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [activeLat, activeLon],
        zoom: 15,
        zoomControl: false,
        attributionControl: false
      });

      // Default OpenStreetMap standard tiles
      osmLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; OpenStreetMap contributors'
      });

      // Esri Satellite high-res tiles (Free, No API key needed)
      satLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri World Imagery'
      });

      // Esri Satellite road & boundary labels
      satLabelsRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: ''
      });

      // Apply initial layer
      if (mapType === 'satellite') {
        satLayerRef.current.addTo(map);
        satLabelsRef.current.addTo(map);
      } else {
        osmLayerRef.current.addTo(map);
      }

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);

      mapInstanceRef.current = map;
    }

    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;

      // Always maintain camera centered on current coordinate
      map.setView([activeLat, activeLon], map.getZoom() || 15);

      // Visual styling according to GPS status
      const isDisconnected = activeSource === 'last_known';
      const coreColor = isDisconnected ? '#f59e0b' : '#1a73e8'; // Google Blue (#1a73e8) or Amber (#f59e0b)
      const sourceTitle = activeSource === 'hardware'
        ? 'SafeRide Hardware GPS (Locked)' 
        : isDisconnected 
        ? 'SafeRide GPS Disconnected (Last Active Location)'
        : 'SafeRide Live GPS Location';

      // 1. LEAFLET ACCURACY HALO CIRCLE (L.circle)
      // Smooth translucent accuracy aura centered on active vehicle coordinate
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle([activeLat, activeLon], {
          radius: 50,
          color: coreColor,
          fillColor: coreColor,
          fillOpacity: 0.16,
          weight: 1.5,
          dashArray: isDisconnected ? '5, 5' : undefined,
          pane: 'overlayPane'
        }).addTo(map);
      } else {
        accuracyCircleRef.current.setLatLng([activeLat, activeLon]);
        accuracyCircleRef.current.setRadius(50);
        accuracyCircleRef.current.setStyle({
          color: coreColor,
          fillColor: coreColor,
          fillOpacity: 0.16,
          dashArray: isDisconnected ? '5, 5' : undefined
        });
      }

      // 2. ICONIC GOOGLE MAPS LIVE LOCATION BLUE DOT WITH WHITE RING & DIRECTIONAL CONE
      // 100% Guaranteed visible on all layers (Satellite & Default)
      const gradId = `beamGrad_${Math.abs(Math.round(activeLat * 100))}`;
      const customIcon = L.divIcon({
        className: 'custom-vehicle-marker',
        html: `
          <div style="position: relative; width: 80px; height: 80px; pointer-events: none;">
            <!-- Directional Flashlight Beam Cone projecting down-left (Google Maps style) -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80" style="position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible;">
              <defs>
                <radialGradient id="${gradId}" cx="40" cy="40" r="38" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="${coreColor}" stop-opacity="0.85" />
                  <stop offset="65%" stop-color="${coreColor}" stop-opacity="0.30" />
                  <stop offset="100%" stop-color="${coreColor}" stop-opacity="0" />
                </radialGradient>
              </defs>
              <!-- 65-degree flashlight cone sector projecting down-left -->
              <path d="M 40 40 L 22 74 A 38 38 0 0 1 3 44 Z" fill="url(#${gradId})" />
            </svg>

            <!-- Outer Pulsating Radar Wave -->
            <div class="radar-ping-anim" style="position: absolute; top: 18px; left: 18px; width: 44px; height: 44px; border-radius: 50%; background: ${coreColor}; opacity: 0.35; pointer-events: none;"></div>

            <!-- EXACT GOOGLE MAPS LIVE LOCATION BLUE CIRCLE: Solid Core + Crisp Pure White Ring -->
            <div style="position: absolute; top: 29px; left: 29px; width: 22px; height: 22px; border-radius: 50%; background-color: ${coreColor}; border: 3.5px solid #ffffff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.55); pointer-events: auto; z-index: 10;"></div>

            ${isDisconnected ? `
              <div style="position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); background: #b45309; color: #ffffff; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 4px; border: 1px solid #f59e0b; box-shadow: 0 2px 4px rgba(0,0,0,0.6); white-space: nowrap; letter-spacing: 0.5px; z-index: 20;">
                LAST ACTIVE
              </div>
            ` : ''}
          </div>
        `,
        iconSize: [80, 80],
        iconAnchor: [40, 40]
      });

      const popupHtml = `
        <div style="font-family: sans-serif; font-size: 12px; color: #0f172a; padding: 4px; min-width: 190px;">
          <div style="font-weight: 700; color: ${coreColor}; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            <span>${isDisconnected ? '⚠️' : '📍'}</span>
            <span>${sourceTitle}</span>
          </div>
          <div><b>Lat:</b> ${activeLat.toFixed(5)}° N</div>
          <div><b>Lon:</b> ${activeLon.toFixed(5)}° E</div>
          ${!isDisconnected ? `<div><b>Speed:</b> ${speed != null ? speed.toFixed(1) : '0.0'} km/h</div>` : ''}
          ${isDisconnected && lastActiveLocation?.timeString ? `
            <div style="color: #b45309; font-weight: 600; font-size: 11px; margin-top: 3px;">
              Last Recorded: ${lastActiveLocation.timeString}
            </div>
          ` : ''}
        </div>
      `;

      if (!markerRef.current) {
        markerRef.current = L.marker([activeLat, activeLon], { icon: customIcon }).addTo(map);
        markerRef.current.bindPopup(popupHtml);
      } else {
        markerRef.current.setIcon(customIcon);
        markerRef.current.setLatLng([activeLat, activeLon]);
        markerRef.current.setPopupContent(popupHtml);
      }
    }
  }, [activeLat, activeLon, activeSource, speed, deviceCoords, lastActiveLocation, mapType]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        accuracyCircleRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-slate-950 ${className}`} style={{ height }}>
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" style={{ height: '100%', minHeight: '180px' }} />

      {/* Floating Status Badge (Top-Left) */}
      <div className="absolute top-2.5 left-2.5 z-[400] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2.5 max-w-[calc(100%-195px)]">
        <span 
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            activeSource === 'hardware' 
              ? 'bg-emerald-400 animate-pulse' 
              : activeSource === 'last_known'
              ? 'bg-amber-400 ring-2 ring-amber-400/40'
              : 'bg-sky-400 animate-pulse'
          }`}
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate">
              {activeSource === 'hardware' 
                ? 'Hardware GPS (Locked)' 
                : activeSource === 'last_known'
                ? `GPS Disconnected • Last Active (${lastActiveLocation?.timeString || 'Recorded'})`
                : 'Live Device GPS (Real Location)'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-white font-semibold truncate">
            {`${activeLat.toFixed(5)}° N, ${activeLon.toFixed(5)}° E`}
          </span>
        </div>
      </div>

      {/* Floating Map Controls (Top-Right): Map Type & Center */}
      <div className="absolute top-2.5 right-2.5 z-[400] flex items-center gap-1.5">
        {/* SATELLITE VS DEFAULT SWITCHER */}
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-0.5 flex items-center shadow-xl">
          <button
            onClick={() => handleToggleMapType('default')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
              mapType === 'default' 
                ? 'bg-sky-600 text-white shadow-sm ring-1 ring-white/20' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Default Street Map"
          >
            <span>🗺️</span>
            <span className="hidden sm:inline">Default</span>
          </button>
          <button
            onClick={() => handleToggleMapType('satellite')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
              mapType === 'satellite' 
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-white/20' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Satellite Aerial Imagery"
          >
            <span>🛰️</span>
            <span className="hidden sm:inline">Satellite</span>
          </button>
        </div>

        {/* Center on Active Location Button */}
        <button
          onClick={centerOnRealLocation}
          title="Center on Location"
          className="bg-slate-900/95 hover:bg-slate-800 text-sky-400 hover:text-white border border-slate-700/80 p-1.5 rounded-lg shadow-xl backdrop-blur-md transition-all flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"></circle>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3M2 12h3m14 0h3"></path>
          </svg>
        </button>

        {/* Sync Device GPS Button */}
        {deviceCoords && !isLiveGpsLocked && (
          <button
            onClick={() => syncLocationToBackend(deviceCoords.lat, deviceCoords.lon)}
            disabled={isSyncing}
            title="Sync device location to vehicle backend"
            className="bg-emerald-600/95 hover:bg-emerald-500 text-white px-2 py-1 rounded-lg shadow-xl backdrop-blur-md transition-all flex items-center gap-1 text-xs font-semibold"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
            </svg>
            <span className="hidden md:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>
        )}
      </div>

      {/* Attribution Badge (Bottom-Left) */}
      <div className="absolute bottom-1.5 left-2.5 z-[400] text-[9px] text-slate-300 bg-slate-950/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-slate-800">
        {mapType === 'satellite' ? 'Esri World Imagery • SafeRide' : 'OpenStreetMap • SafeRide'}
      </div>
    </div>
  );
}
