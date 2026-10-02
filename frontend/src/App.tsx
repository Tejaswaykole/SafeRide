import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          {/* Placeholders for other pages to ensure navigation works without crashing */}
          <Route path="live-monitor" element={<div className="p-6">Live Monitor Content</div>} />
          <Route path="vehicle-map" element={<div className="p-6">Vehicle Map Content</div>} />
          <Route path="sensor-data" element={<div className="p-6">Sensor Data Content</div>} />
          <Route path="events" element={<div className="p-6">Events Content</div>} />
          <Route path="settings" element={<div className="p-6">Settings Content</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
