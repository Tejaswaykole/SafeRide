export default function Header() {
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
        {/* System Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-elevated border border-brand-border text-xs">
          <span className="w-2 h-2 rounded-full bg-brand-safe animate-pulse"></span>
          <span className="font-medium text-white">System Online</span>
          <span className="text-brand-muted border-l border-brand-border/80 pl-2">Mon, 26 May 2025 10:24 AM</span>
        </div>
        {/* Notification Bell */}
        <button className="relative p-2 rounded-full bg-brand-elevated hover:bg-brand-border/80 border border-brand-border text-brand-secondaryText hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 bg-brand-critical rounded-full ring-2 ring-brand-surface"></span>
        </button>
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
