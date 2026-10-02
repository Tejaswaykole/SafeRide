interface EventCardProps {
  title: string;
  desc: string;
  time: string;
  type: string;
}

export default function EventCard({ title, desc, time, type }: EventCardProps) {
  const isCritical = type === 'critical';
  const isWarning = type === 'warning';


  const bgColor = isCritical ? 'bg-brand-critical/15' : isWarning ? 'bg-brand-warning/15' : 'bg-brand-safe/15';
  const textColor = isCritical ? 'text-brand-critical' : isWarning ? 'text-brand-warning' : 'text-brand-safe';

  const icon = isCritical ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
      <line x1="12" x2="12" y1="9" y2="13"></line>
      <line x1="12" x2="12.01" y1="17" y2="17"></line>
    </svg>
  ) : isWarning ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
      <line x1="12" x2="12" y1="9" y2="13"></line>
      <line x1="12" x2="12.01" y1="17" y2="17"></line>
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="m9 12 2 2 4-4"></path>
    </svg>
  );

  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-brand-elevated/60 border border-brand-border/40">
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-lg ${bgColor} ${textColor} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div>
          <h4 className={`font-semibold ${textColor} leading-tight`}>{title}</h4>
          <p className="text-[11px] text-brand-muted">{desc}</p>
        </div>
      </div>
      <span className="text-[11px] text-brand-muted whitespace-nowrap">{time}</span>
    </div>
  );
}
