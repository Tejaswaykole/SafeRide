import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function MainLayout() {
  return (
    <div className="bg-brand-bg text-brand-primaryText min-h-screen flex flex-col md:flex-row antialiased selection:bg-brand-accent selection:text-white">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header />
        <Outlet />
      </main>
    </div>
  );
}
