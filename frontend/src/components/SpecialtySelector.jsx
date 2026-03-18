const SPECIALTIES = [
  { value: "general", label: "General", icon: "\u{1F3E5}" },
  { value: "cardiology", label: "Cardio", icon: "\u2764\uFE0F" },
  { value: "diabetology", label: "Diabetes", icon: "\u{1F489}" },
  { value: "pediatrics", label: "Peds", icon: "\u{1F476}" },
  { value: "psychiatry", label: "Psych", icon: "\u{1F9E0}" },
  { value: "orthopedics", label: "Ortho", icon: "\u{1F9B4}" },
];

export default function SpecialtySelector({ value = "general", onChange, className = "" }) {
  return (
    <div
      className={`grid grid-cols-3 sm:grid-cols-6 gap-2 sm:flex sm:gap-1.5 sm:overflow-x-auto scrollbar-hide ${className}`}
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
      role="radiogroup"
      aria-label="Select medical specialty"
    >
      {SPECIALTIES.map((s) => {
        const isActive = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(s.value)}
            className={`
              inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[48px] rounded-full
              text-sm sm:text-xs font-medium
              whitespace-nowrap transition-all duration-150 flex-shrink-0 cursor-pointer
              ${isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 active:bg-slate-100 dark:active:bg-slate-700'
              }
            `}
          >
            <span className="text-base sm:text-sm leading-none">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
