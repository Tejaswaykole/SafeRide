import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import LiveMonitor from './pages/LiveMonitor';
import VehicleMap from './pages/VehicleMap';
import SensorData from './pages/SensorData';
import Events from './pages/Events';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center p-6 text-center text-white">
      <div className="w-16 h-16 mb-4 rounded-full bg-brand-surface border-2 border-brand-border flex items-center justify-center text-brand-secondaryText">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path></svg>
      </div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-brand-muted max-w-md">This module is under development and will be available in future phases of the SafeRide platform.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="live-monitor" element={<LiveMonitor />} />
          <Route path="vehicle-map" element={<VehicleMap />} />
          <Route path="sensor-data" element={<SensorData />} />
          <Route path="events" element={<Events />} />
          <Route path="settings" element={<Placeholder title="System Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
