import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  const navItems = [
    {
      name: 'Dashboard',
      path: '/',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      )
    },
    {
      name: 'Live Monitor',
      path: '/live-monitor',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      )
    },
    {
      name: 'Vehicle Map',
      path: '/vehicle-map',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      )
    },
    {
      name: 'Sensor Data',
      path: '/sensor-data',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
          <path d="M12 12v9"></path>
          <path d="m8 17 4 4 4-4"></path>
        </svg>
      )
    },
    {
      name: 'Events',
      path: '/events',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" x2="8" y1="13" y2="13"></line>
          <line x1="16" x2="8" y1="17" y2="17"></line>
          <line x1="10" x2="8" y1="9" y2="9"></line>
        </svg>
      )
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      )
    }
  ];

  return (
    <aside className="w-full md:w-60 lg:w-64 bg-brand-surface border-r border-brand-border flex-shrink-0 flex flex-col justify-between" data-purpose="sidebar-navigation">
      <div>
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-brand-border/60">
          <div className="w-10 h-10 rounded-xl bg-brand-accent/10 border border-brand-accent/30 flex items-center justify-center text-brand-accent shadow-inner">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center">
              Safe<span className="text-brand-accent">Ride</span>
            </span>
            <p className="text-[10px] text-brand-muted leading-tight font-medium">Intelligent Vehicle Safety</p>
          </div>
        </div>
        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5" data-purpose="main-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                isActive
                  ? 'flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#18283a] text-brand-accent font-medium text-sm transition-colors border-l-2 border-brand-accent'
                  : 'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-brand-secondaryText hover:text-white hover:bg-brand-elevated text-sm font-medium transition-colors'
              }
            >
              {({ isActive }) => (
                <>
                  <div className={isActive ? '' : 'text-brand-muted'}>
                    {item.icon}
                  </div>
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      {/* Sidebar footer tag */}
      <div className="p-4 border-t border-brand-border/60">
        <div className="px-3 py-2 rounded-lg bg-brand-elevated border border-brand-border text-[11px] text-brand-muted">
          <span className="text-white font-medium">SafeRide Telematics</span><br />v2.4.1 Production
        </div>
      </div>
    </aside>
  );
}
