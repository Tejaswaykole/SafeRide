interface SensorCardProps {
  title: string;
  value: string;
  subValue?: string;
  unit: string;
  icon: string;
  status: string;
  levels: string[];
}

export default function SensorCard({ title, value, subValue, unit, icon, status, levels }: SensorCardProps) {
  const getIcon = () => {
    switch (icon) {
      case 'alcohol':
        return (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M8 22h8M12 11v11M19 3H5l4 8h6l4-8Z"></path>
          </svg>
        );
      case 'motion':
        return (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
        );
      case 'temp':
        return (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"></path>
          </svg>
        );
      case 'gps':
        return (
          <svg className="w-4 h-4 text-brand-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        );
      case 'engine':
        return (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m14 14 3-3-3-3"></path>
            <rect height="10" rx="2" width="14" x="5" y="7"></rect>
            <path d="M5 10H2v4h3M19 12h3"></path>
          </svg>
        );
      case 'battery':
        return (
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect height="10" rx="2" width="16" x="2" y="7"></rect>
            <line x1="22" x2="22" y1="11" y2="13"></line>
            <path d="m11 10-2 4h4l-2 4"></path>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-3.5 flex flex-col justify-between">
      <div className="flex items-center justify-between text-brand-muted mb-2">
        <span className="text-xs font-medium">{title}</span>
        {getIcon()}
      </div>
      <div>
        {subValue ? (
          <div className="text-[13px] font-semibold text-white tracking-tight leading-tight">
            {value}<br /><span className="text-brand-secondaryText font-normal text-xs">{subValue}</span>
          </div>
        ) : (
          <div className="text-xl font-bold text-white tracking-tight">
            {value} {unit && <span className="text-xs font-normal text-brand-muted">{unit}</span>}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-brand-border/40 text-[11px]">
          <span className="flex items-center gap-1 text-brand-safe font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-safe"></span> {status}
          </span>
          <div className="flex items-end gap-0.5 h-2.5">
            {levels.map((level, i) => (
              <span key={i} className={`w-1 ${i === 0 ? 'h-1' : i === 1 ? (levels.length === 3 && title === 'Temperature' ? 'h-1.5' : 'h-2') : 'h-2.5'} ${level} rounded-sm`}></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
