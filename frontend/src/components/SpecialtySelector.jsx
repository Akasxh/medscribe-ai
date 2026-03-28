import { Stethoscope, Heart, Syringe, Baby, Brain, Bone } from 'lucide-react'

const SPECIALTIES = [
  { value: "general", label: "General", icon: Stethoscope },
  { value: "cardiology", label: "Cardio", icon: Heart },
  { value: "diabetology", label: "Diabetes", icon: Syringe },
  { value: "pediatrics", label: "Peds", icon: Baby },
  { value: "psychiatry", label: "Psych", icon: Brain },
  { value: "orthopedics", label: "Ortho", icon: Bone },
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
              whitespace-nowrap flex-shrink-0 cursor-pointer
              hover:scale-105 active:scale-95 transition-transform duration-150
              ${isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 active:bg-slate-100 dark:active:bg-slate-700'
              }
            `}
          >
            <s.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
