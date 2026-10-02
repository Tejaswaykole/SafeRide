import SensorCard from '../components/SensorCard';
import EventCard from '../components/EventCard';

export default function Dashboard() {
  const sensorData = [
    { title: 'Alcohol Sensor', value: '0.02', unit: 'mg/L', icon: 'alcohol', status: 'Normal', levels: ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-border'] },
    { title: 'Motion Sensor', value: '0.12', unit: 'g', icon: 'motion', status: 'Normal', levels: ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-border'] },
    { title: 'Temperature', value: '32.4', unit: '°C', icon: 'temp', status: 'Normal', levels: ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-border'] },
    { title: 'GPS', value: '18.5204° N', subValue: '73.8567° E', unit: '', icon: 'gps', status: 'Connected', levels: ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-safe'] },
    { title: 'Engine Status', value: 'ON', unit: '', icon: 'engine', status: 'Running', levels: ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-safe'] },
    { title: 'System Voltage', value: '12.6', unit: 'V', icon: 'battery', status: 'Normal', levels: ['bg-brand-safe', 'bg-brand-safe', 'bg-brand-safe'] },
  ];

  const recentEvents = [
    { title: 'High Risk Detected', desc: 'Abrupt acceleration', time: '10:18 AM', type: 'critical' },
    { title: 'Alcohol Level Warning', desc: 'Detected 0.18 mg/L', time: '09:52 AM', type: 'warning' },
    { title: 'Normal Driving', desc: 'All parameters normal', time: '09:36 AM', type: 'safe' },
    { title: 'High Temperature', desc: 'Cabin temperature 42°C', time: '09:21 AM', type: 'warning' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Top Row Grid (Current Vehicle Status & Vehicle Info) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5" data-purpose="status-overview-section">
        {/* Current Vehicle Status Card */}
        <div className="lg:col-span-7 bg-brand-surface border border-brand-border rounded-2xl p-6 flex flex-col justify-between shadow-lg" data-purpose="vehicle-status-card">
          <h3 className="text-sm font-semibold text-brand-secondaryText uppercase tracking-wider mb-4">Current Vehicle Status</h3>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
            {/* Shield & Status Banner */}
            <div className="flex items-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-brand-safe/10 border-2 border-brand-safe flex items-center justify-center text-brand-safe shadow-[0_0_30px_rgba(34,197,94,0.15)] flex-shrink-0">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold text-brand-safe tracking-tight">SAFE</h1>
                <p className="text-xs text-brand-secondaryText mt-1">All parameters are within normal range</p>
              </div>
            </div>
            {/* Risk Score Metric */}
            <div className="w-full md:w-56 bg-brand-elevated/70 border border-brand-border/60 rounded-xl p-4">
              <span className="text-xs text-brand-muted font-medium block">Risk Score</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-white">12</span>
                <span className="text-sm text-brand-muted">/ 100</span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-[#1e293b] h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full" style={{ width: '12%' }}></div>
              </div>
              <div className="text-[11px] text-brand-muted mt-2">
                Last Updated <span className="text-slate-300 font-medium">10:24:32 AM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Information Card */}
        <div className="lg:col-span-5 bg-brand-surface border border-brand-border rounded-2xl p-6 flex flex-col justify-between shadow-lg" data-purpose="vehicle-info-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-brand-secondaryText uppercase tracking-wider">Vehicle Information</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Vehicle Render / Realistic Car Outline */}
            <div className="sm:col-span-5 flex items-center justify-center p-2">
              <div className="relative w-full aspect-video rounded-xl bg-gradient-to-tr from-brand-elevated to-[#1c2836] border border-brand-border/50 flex items-center justify-center p-2 shadow-inner">
                {/* Vector Car Representation */}
                <svg className="w-full h-full text-slate-300 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 200 90">
                  <path d="M 15 58 C 15 50, 22 45, 35 44 L 55 42 L 72 26 C 78 20, 85 18, 98 18 L 140 18 C 150 18, 160 25, 166 35 L 180 44 C 188 47, 192 53, 192 60 L 192 68 C 192 71, 189 73, 186 73 L 172 73 C 170 65, 163 60, 153 60 C 143 60, 136 65, 134 73 L 64 73 C 62 65, 55 60, 45 60 C 35 60, 28 65, 26 73 L 15 73 C 13 73, 11 71, 11 68 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.8"></path>
                  <path d="M 60 40 L 75 25 C 78 22, 84 21, 95 21 L 135 21 C 144 21, 151 26, 155 33 L 165 40 Z" fill="#0f172a" opacity="0.8" stroke="#38BDF8" strokeWidth="1.2"></path>
                  <line stroke="#475569" strokeWidth="1.5" x1="110" x2="110" y1="21" y2="40"></line>
                  <circle cx="45" cy="70" fill="#0B0F14" r="10" stroke="#94A3B8" strokeWidth="2.5"></circle>
                  <circle cx="45" cy="70" fill="#38A8FF" r="4"></circle>
                  <circle cx="153" cy="70" fill="#0B0F14" r="10" stroke="#94A3B8" strokeWidth="2.5"></circle>
                  <circle cx="153" cy="70" fill="#38A8FF" r="4"></circle>
                  <path d="M 184 48 L 192 50 L 188 56 Z" fill="#38BDF8"></path>
                </svg>
              </div>
            </div>
            {/* Details Key-Value List */}
            <div className="sm:col-span-7 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                <span className="text-brand-muted flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-brand-secondaryText" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect height="18" rx="2" width="18" x="3" y="3"></rect><path d="M7 7h10"></path><path d="M7 12h10"></path><path d="M7 17h10"></path></svg>
                  Vehicle ID
                </span>
                <span className="font-semibold text-white">#1023</span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                <span className="text-brand-muted flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-brand-secondaryText" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  Driver
                </span>
                <span className="font-semibold text-white">Tejas Waykole</span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                <span className="text-brand-muted flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-brand-secondaryText" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  Trip Start
                </span>
                <span className="font-semibold text-white">09:15 AM</span>
              </div>
              <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                <span className="text-brand-muted flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-brand-secondaryText" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m14 18 4-4-4-4"></path><path d="m10 6-4 4 4 4"></path></svg>
                  Distance
                </span>
                <span className="font-semibold text-white">12.4 km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-muted flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-brand-secondaryText" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m12 14 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg>
                  Speed
                </span>
                <span className="font-semibold text-white">48 km/h</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal Sensor Metric Cards (6 Cards) */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5" data-purpose="sensor-metrics-bar">
        {sensorData.map((data, index) => (
          <SensorCard key={index} {...data} />
        ))}
      </section>

      {/* Middle Row Grid (Risk Score Trend & Vehicle Location Map) */}
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
            {/* Dropdown selector */}
            <button className="px-2.5 py-1 text-xs rounded-lg bg-brand-elevated border border-brand-border text-brand-secondaryText flex items-center gap-1.5 hover:text-white">
              Last 1 Hour
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>
            </button>
          </div>
          {/* SVG Chart Area */}
          <div className="relative w-full h-56 pt-2">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 200">
              <defs>
                <linearGradient id="riskGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.35"></stop>
                  <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.2"></stop>
                  <stop offset="100%" stopColor="#22C55E" stopOpacity="0.0"></stop>
                </linearGradient>
                <linearGradient id="riskStroke" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#22C55E"></stop>
                  <stop offset="40%" stopColor="#F59E0B"></stop>
                  <stop offset="60%" stopColor="#EF4444"></stop>
                  <stop offset="80%" stopColor="#F59E0B"></stop>
                  <stop offset="100%" stopColor="#22C55E"></stop>
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
              <path d="M 30 180 L 30 160 C 50 162, 70 148, 90 146 C 110 144, 130 156, 150 148 C 170 140, 190 130, 210 135 C 230 140, 240 120, 260 90 C 275 60, 290 35, 305 45 C 320 55, 335 110, 350 125 C 370 145, 390 140, 410 150 C 430 160, 450 166, 470 164 C 480 163, 490 160, 490 160 L 490 180 Z" fill="url(#riskGradient)"></path>
              <path d="M 30 160 C 50 162, 70 148, 90 146 C 110 144, 130 156, 150 148 C 170 140, 190 130, 210 135 C 230 140, 240 120, 260 90 C 275 60, 290 35, 305 45 C 320 55, 335 110, 350 125 C 370 145, 390 140, 410 150 C 430 160, 450 166, 470 164 C 480 163, 490 160, 490 160" fill="none" stroke="url(#riskStroke)" strokeLinecap="round" strokeWidth="2.5"></path>
              <circle cx="305" cy="45" fill="#EF4444" r="4" stroke="#ffffff" strokeWidth="1.5"></circle>
            </svg>
          </div>
          <div className="flex justify-between text-[11px] text-brand-muted pl-6 pr-2 pt-2">
            <span>09:30</span>
            <span>09:45</span>
            <span>10:00</span>
            <span>10:15</span>
            <span>10:30</span>
          </div>
        </div>

        {/* Vehicle Location Map Card */}
        <div className="lg:col-span-6 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between overflow-hidden relative" data-purpose="vehicle-location-card">
          <div className="flex items-center justify-between mb-3 z-10">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <h3 className="text-sm font-semibold text-white">Vehicle Location</h3>
            </div>
            <span className="px-2.5 py-1 text-xs rounded-full bg-brand-safe/10 border border-brand-safe/30 text-brand-safe flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-safe animate-pulse"></span>
              Live Location
            </span>
          </div>
          <div className="relative w-full h-56 rounded-xl bg-[#0e1622] border border-brand-border/60 overflow-hidden flex items-center justify-center">
            <svg className="w-full h-full object-cover" viewBox="0 0 600 280">
              <path d="M 0 40 Q 120 70 200 40 T 400 90 L 400 0 L 0 0 Z" fill="#131c26" opacity="0.6"></path>
              <path d="M 380 200 Q 480 220 600 180 L 600 280 L 380 280 Z" fill="#131c26" opacity="0.6"></path>
              <line stroke="#1f2c3d" strokeWidth="1.5" x1="40" x2="160" y1="0" y2="280"></line>
              <line stroke="#1f2c3d" strokeWidth="1.5" x1="180" x2="300" y1="0" y2="280"></line>
              <line stroke="#1f2c3d" strokeWidth="1.5" x1="320" x2="440" y1="0" y2="280"></line>
              <line stroke="#1f2c3d" strokeWidth="1.5" x1="0" x2="600" y1="180" y2="100"></line>
              <line stroke="#1f2c3d" strokeWidth="1.5" x1="0" x2="600" y1="90" y2="210"></line>
              <path d="M 0 140 C 150 160, 200 100, 360 120 C 440 130, 520 80, 600 110" fill="none" stroke="#253549" strokeWidth="4"></path>
              <path d="M 120 0 C 180 80, 260 140, 280 280" fill="none" stroke="#253549" strokeWidth="3"></path>
              <path d="M 70 130 Q 140 140 210 115 T 320 125 T 450 100 T 540 150" fill="none" filter="drop-shadow(0 0 6px rgba(56,168,255,0.6))" stroke="#38A8FF" strokeDasharray="1 0" strokeLinecap="round" strokeWidth="3.5"></path>
              <text fill="#94A3B8" fontSize="11" fontWeight="500" x="70" y="115">Hinjawadi</text>
              <text fill="#94A3B8" fontSize="11" fontWeight="500" x="180" y="90">Baner</text>
              <text fill="#94A3B8" fontSize="11" fontWeight="500" x="235" y="135">Kothrud</text>
              <text fill="#F8FAFC" fontSize="14" fontWeight="700" x="340" y="150">Pune</text>
              <text fill="#94A3B8" fontSize="11" fontWeight="500" x="460" y="145">Hadapsar</text>
              <g transform="translate(320, 125)">
                <circle className="animate-ping" cx="0" cy="0" fill="#38A8FF" fillOpacity="0.25" r="14"></circle>
                <circle cx="0" cy="0" fill="#0B0F14" r="10" stroke="#38A8FF" strokeWidth="2.5"></circle>
                <path d="M -4 2 L -2 -3 L 2 -3 L 4 2 Z" fill="#38A8FF"></path>
              </g>
            </svg>
            <div className="absolute bottom-3 left-3 bg-brand-surface/90 border border-brand-border rounded-md shadow-md flex flex-col text-slate-300">
              <button className="px-2 py-1 hover:bg-brand-elevated text-xs font-bold border-b border-brand-border">+</button>
              <button className="px-2 py-1 hover:bg-brand-elevated text-xs font-bold">-</button>
            </div>
            <div className="absolute bottom-1 right-2 text-[9px] text-brand-muted/80">
              Leaflet | © OpenStreetMap contributors
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Row Grid (Sensor Data Live, Event Overview, Recent Events) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5" data-purpose="detailed-monitoring-section">
        {/* Card 1: Sensor Data (Live) Multi-line Chart */}
        <div className="lg:col-span-5 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between" data-purpose="sensor-live-chart-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              <h3 className="text-sm font-semibold text-white">Sensor Data (Live)</h3>
            </div>
            <button className="px-2.5 py-1 text-xs rounded-lg bg-brand-elevated border border-brand-border text-brand-secondaryText flex items-center gap-1 hover:text-white">
              Last 15 Minutes
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs pt-1 pb-3 text-brand-secondaryText">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Alcohol (mg/L)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Acceleration (g)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span> Temperature (°C)</span>
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
              <path d="M 30 135 C 70 138, 120 130, 160 134 C 200 138, 240 132, 280 136 C 320 140, 360 130, 400 133 C 440 136, 470 132, 490 134" fill="none" stroke="#38BDF8" strokeLinecap="round" strokeWidth="2"></path>
              <path d="M 30 115 C 60 110, 90 120, 130 116 C 170 112, 210 118, 250 114 C 290 110, 330 122, 370 110 C 410 118, 450 112, 490 114" fill="none" stroke="#F59E0B" strokeLinecap="round" strokeWidth="2"></path>
              <path d="M 30 70 C 60 66, 90 74, 130 68 C 170 72, 210 65, 250 78 C 290 74, 330 62, 370 65 C 410 74, 450 63, 490 68" fill="none" stroke="#C084FC" strokeLinecap="round" strokeWidth="2"></path>
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-brand-muted pl-6 pr-2 pt-1">
            <span>10:10</span><span>10:12</span><span>10:14</span><span>10:16</span><span>10:18</span><span>10:20</span><span>10:22</span><span>10:24</span>
          </div>
        </div>

        {/* Card 2: Event Overview Donut Chart */}
        <div className="lg:col-span-3 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between" data-purpose="event-overview-card">
          <h3 className="text-sm font-semibold text-white mb-2">Event Overview</h3>
          <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2 my-auto">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="transparent" r="38" stroke="#1c2530" strokeWidth="12"></circle>
                <circle cx="50" cy="50" fill="transparent" r="38" stroke="#22C55E" strokeDasharray="179 239" strokeDashoffset="0" strokeLinecap="butt" strokeWidth="12"></circle>
                <circle cx="50" cy="50" fill="transparent" r="38" stroke="#F59E0B" strokeDasharray="41 239" strokeDashoffset="-179" strokeLinecap="butt" strokeWidth="12"></circle>
                <circle cx="50" cy="50" fill="transparent" r="38" stroke="#EF4444" strokeDasharray="19 239" strokeDashoffset="-220" strokeLinecap="butt" strokeWidth="12"></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-white leading-none">24</span>
                <span className="text-[9px] text-brand-muted tracking-tight mt-0.5">Total Events</span>
              </div>
            </div>
            <div className="space-y-3 text-xs w-full sm:w-auto">
              <div>
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <span className="w-2 h-2 rounded-full bg-brand-safe"></span> Safe
                </div>
                <span className="text-brand-muted text-[11px] pl-3.5">18 (75%)</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <span className="w-2 h-2 rounded-full bg-brand-warning"></span> Warning
                </div>
                <span className="text-brand-muted text-[11px] pl-3.5">4 (17%)</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-white font-medium">
                  <span className="w-2 h-2 rounded-full bg-brand-critical"></span> Critical
                </div>
                <span className="text-brand-muted text-[11px] pl-3.5">2 (8%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Recent Safety Events List */}
        <div className="lg:col-span-4 bg-brand-surface border border-brand-border rounded-2xl p-5 flex flex-col justify-between" data-purpose="recent-events-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Recent Safety Events</h3>
            <a className="text-xs text-brand-accent hover:underline font-medium" href="#">View All</a>
          </div>
          <div className="space-y-3 text-xs">
            {recentEvents.map((event, index) => (
              <EventCard key={index} {...event} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
