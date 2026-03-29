import { useMemo, useState, useCallback } from 'react'
import {
  Users, Scale, Activity, Wind, ShieldAlert, Thermometer,
  Calendar, Clock, TestTube, AlertTriangle, Baby, Lightbulb,
  CheckCircle2, X,
} from 'lucide-react'

const ICON_MAP = {
  Users,
  Scale,
  Activity,
  Wind,
  ShieldAlert,
  Thermometer,
  Calendar,
  Clock,
  TestTube,
  AlertTriangle,
  Baby,
}

const CATEGORY_CONFIG = {
  vitals: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  history: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800' },
  safety: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' },
  'follow-up': { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
  tests: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800' },
}

const NUDGE_RULES = [
  // Diabetes-related
  {
    check: d => d.diagnosis?.some(dx => /diabetes|DM|sugar/i.test(dx.condition)) && !d.risk_factors?.some(r => /family|hereditary/i.test(r)),
    text: 'Ask about family history of diabetes',
    icon: 'Users',
    category: 'history',
  },
  {
    check: d => d.diagnosis?.some(dx => /diabetes/i.test(dx.condition)) && !d.vitals?.weight,
    text: 'Record patient weight for BMI',
    icon: 'Scale',
    category: 'vitals',
  },
  // Hypertension
  {
    check: d => d.symptoms?.some(s => /headache|dizziness|giddiness/i.test(s.description)) && !d.vitals?.bp,
    text: 'Check blood pressure',
    icon: 'Activity',
    category: 'vitals',
  },
  // Cardiac
  {
    check: d => d.diagnosis?.some(dx => /cardiac|heart|chest pain|angina/i.test(dx.condition)) && !d.risk_factors?.some(r => /smoking|tobacco/i.test(r)),
    text: 'Ask about smoking/tobacco use',
    icon: 'Wind',
    category: 'history',
  },
  {
    check: d => d.medications?.some(m => /aspirin|ecosprin|clopidogrel/i.test(m.generic_name || m.name)) && !d.vitals?.bp,
    text: 'Record blood pressure for antiplatelet monitoring',
    icon: 'Activity',
    category: 'vitals',
  },
  // General
  {
    check: d => !d.allergies?.length && d.medications?.length > 0,
    text: 'Ask about known drug allergies',
    icon: 'ShieldAlert',
    category: 'safety',
  },
  {
    check: d => d.symptoms?.some(s => /fever|bukhar/i.test(s.description)) && !d.vitals?.temperature,
    text: 'Record temperature',
    icon: 'Thermometer',
    category: 'vitals',
  },
  {
    check: d => !d.follow_up && d.medications?.length > 0,
    text: 'Set follow-up date',
    icon: 'Calendar',
    category: 'follow-up',
  },
  {
    check: d => d.symptoms?.some(s => /cough|khansi/i.test(s.description)) && !d.symptoms?.some(s => /duration/i.test(s.duration || '')),
    text: 'Ask about duration of cough',
    icon: 'Clock',
    category: 'history',
  },
  {
    check: d => d.diagnosis?.some(dx => /infection|fever|viral/i.test(dx.condition)) && !d.recommended_tests?.length,
    text: 'Consider ordering CBC/blood tests',
    icon: 'TestTube',
    category: 'tests',
  },
  // Respiratory
  {
    check: d => d.symptoms?.some(s => /breathing|dyspnea|sans/i.test(s.description)) && !d.vitals?.spo2,
    text: 'Check SpO2 levels',
    icon: 'Wind',
    category: 'vitals',
  },
  // Medication safety
  {
    check: d => d.medications?.some(m => /nsaid|ibuprofen|diclofenac/i.test(m.generic_name || m.name)) && !d.observations?.some(o => /kidney|renal|creatinine/i.test(typeof o === 'string' ? o : o?.description || '')),
    text: 'Check renal function before NSAID use',
    icon: 'AlertTriangle',
    category: 'safety',
  },
  // Pediatric
  {
    check: d => {
      const age = d.patient_info?.age
      if (!age) return false
      return /\b([0-9]|1[0-2])\s*(year|yr|month|mo)/i.test(age) && !d.observations?.some(o => /weight|immunization/i.test(typeof o === 'string' ? o : o?.description || ''))
    },
    text: 'Record weight and immunization status for pediatric patient',
    icon: 'Baby',
    category: 'vitals',
  },
]

export default function ClinicalNudges({ clinicalNote }) {
  const [dismissed, setDismissed] = useState(new Set())

  const nudges = useMemo(() => {
    if (!clinicalNote) return []

    return NUDGE_RULES
      .map((rule, idx) => {
        try {
          if (rule.check(clinicalNote)) {
            return { id: idx, ...rule }
          }
        } catch {
          // Rule check failed — skip silently
        }
        return null
      })
      .filter(Boolean)
  }, [clinicalNote])

  const visibleNudges = nudges.filter(n => !dismissed.has(n.id))

  const dismissNudge = useCallback((id) => {
    setDismissed(prev => new Set([...prev, id]))
  }, [])

  if (!clinicalNote) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Clinical Nudges</h3>
        {visibleNudges.length > 0 ? (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 font-bold">
            {visibleNudges.length} suggestion{visibleNudges.length > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold">
            All covered
          </span>
        )}
      </div>

      <div className="p-3">
        {visibleNudges.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">All areas covered</span>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleNudges.map((nudge) => {
              const catConfig = CATEGORY_CONFIG[nudge.category] || CATEGORY_CONFIG.vitals
              const IconComponent = ICON_MAP[nudge.icon] || Lightbulb

              return (
                <div
                  key={nudge.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${catConfig.bg} ${catConfig.border} animate-slide-up transition-all`}
                >
                  <IconComponent className={`w-4 h-4 shrink-0 ${catConfig.color}`} />
                  <span className={`flex-1 text-xs font-medium ${catConfig.color}`}>
                    {nudge.text}
                  </span>
                  <button
                    onClick={() => dismissNudge(nudge.id)}
                    className="p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                    aria-label={`Dismiss: ${nudge.text}`}
                  >
                    <X className={`w-3.5 h-3.5 ${catConfig.color} opacity-60`} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
