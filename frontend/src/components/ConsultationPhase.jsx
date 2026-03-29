import { Mic, Cpu, CheckCircle } from 'lucide-react'

const STEPS = [
  { key: 'listening', label: 'Listen', icon: Mic },
  { key: 'extracting', label: 'Extract', icon: Cpu },
  { key: 'complete', label: 'Done', icon: CheckCircle },
]

function deriveStep(clinicalNote, isRecording, processing) {
  if (!isRecording && !processing && !clinicalNote) return -1
  if (processing) return 1
  if (clinicalNote) {
    const { follow_up, medications, diagnosis } = clinicalNote
    if (follow_up || medications?.length > 0 || diagnosis?.length > 0) return 2
  }
  if (isRecording) return 0
  if (clinicalNote) return 2
  return -1
}

export default function ConsultationPhase({ clinicalNote, isRecording, processing, className = "" }) {
  const currentStep = deriveStep(clinicalNote, isRecording, processing)

  if (currentStep < 0) return null

  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {STEPS.map((step, i) => {
        const isActive = i === currentStep
        const isCompleted = i < currentStep
        const Icon = step.icon

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-1">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-2.5 h-2.5" />
                ) : (
                  <Icon className="w-2.5 h-2.5" />
                )}
              </div>
              <span
                className={`text-[10px] transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : isCompleted
                      ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-1">
                <div
                  className={`h-px transition-colors duration-300 ${
                    isCompleted ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
