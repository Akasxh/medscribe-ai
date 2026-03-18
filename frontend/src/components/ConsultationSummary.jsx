import { Share2, Check, Pill, AlertTriangle, Award, Shield, GitBranch, FlaskConical, ChevronDown, ChevronUp, Clock, User } from 'lucide-react'
import { useState } from 'react'

export default function ConsultationSummary({ clinicalNote, fhirQuality, cdsAlerts = [], elapsed }) {
  const [copied, setCopied] = useState(false)
  const [showDifferentials, setShowDifferentials] = useState(false)

  if (!clinicalNote) return null

  const { patient_info, chief_complaint, diagnosis, medications, allergies, differential_diagnosis, recommended_tests, vitals, follow_up } = clinicalNote

  const hasCriticalAlerts = cdsAlerts.some(a => a.severity === 'critical')
  const totalAlerts = cdsAlerts.length
  const timeSavedMultiplier = elapsed > 0 ? Math.max(1, Math.round(600 / elapsed)) : 0

  const handleShare = async () => {
    const summary = generateTextSummary(clinicalNote, fhirQuality, cdsAlerts, elapsed)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'MedScribe AI - Consultation Summary', text: summary })
      } else {
        await navigator.clipboard.writeText(summary)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
        <h2 className="text-subheading text-slate-900 dark:text-white flex-1">Consultation Summary</h2>
        {fhirQuality && (
          <span className="badge badge-success">
            <Award className="w-3 h-3" />
            FHIR {fhirQuality.grade}
          </span>
        )}
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Patient + Chief Complaint */}
          <div className="col-span-2 md:col-span-1 flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 text-sm font-semibold flex-shrink-0">
              {patient_info?.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {patient_info?.name || 'Patient'}
              </div>
              <div className="text-caption text-slate-500 dark:text-slate-400">
                {[patient_info?.age, patient_info?.gender].filter(Boolean).join(' / ')}
              </div>
            </div>
          </div>

          {/* Diagnosis */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="text-caption text-slate-500 dark:text-slate-400 mb-0.5">Diagnosis</div>
            {diagnosis?.length > 0 ? (
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{diagnosis[0].condition}</div>
                {diagnosis[0].confidence != null && (
                  <span className="text-[10px] font-mono text-slate-400">{Math.round(diagnosis[0].confidence * 100)}% confidence</span>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400">--</div>
            )}
          </div>

          {/* Medications + Allergies */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="text-caption text-slate-500 dark:text-slate-400 mb-0.5">Medications</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {medications?.length || 0} prescribed
              </span>
              {allergies?.length > 0 && (
                <span className="badge badge-danger">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {allergies.length}
                </span>
              )}
            </div>
          </div>

          {/* Time saved */}
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <div className="text-caption text-slate-500 dark:text-slate-400 mb-0.5">Documentation</div>
            {elapsed > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{timeSavedMultiplier}x faster</span>
                <span className="text-[10px] text-slate-400">{Math.round(elapsed)}s</span>
              </div>
            ) : (
              <div className="text-sm text-slate-400">--</div>
            )}
          </div>
        </div>

        {/* Safety Alerts */}
        {totalAlerts > 0 && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            hasCriticalAlerts
              ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
              : 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
          }`}>
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {hasCriticalAlerts && `${cdsAlerts.filter(a => a.severity === 'critical').length} critical / `}
              {totalAlerts} safety alert{totalAlerts > 1 ? 's' : ''} detected
            </span>
          </div>
        )}

        {/* Vitals inline */}
        {vitals && Object.values(vitals).some(v => v) && (
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'temperature', label: 'Temp' },
              { key: 'bp', label: 'BP' },
              { key: 'pulse', label: 'HR' },
              { key: 'spo2', label: 'SpO2' },
            ].filter(({ key }) => vitals[key]).map(({ key, label }) => (
              <span key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs">
                <span className="text-slate-400 font-medium">{label}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{vitals[key]}</span>
              </span>
            ))}
          </div>
        )}

        {/* Diagnosis details */}
        {diagnosis?.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-caption text-slate-500 dark:text-slate-400 uppercase tracking-wider">Diagnosis</div>
            {diagnosis.map((d, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1">{d.condition}</span>
                {d.confidence != null && (
                  <span className="text-[10px] font-mono text-slate-400">{Math.round(d.confidence * 100)}%</span>
                )}
                <span className="badge badge-accent text-[10px]">{d.icd10_code}</span>
                <span className={`badge text-[10px] ${
                  d.certainty === 'confirmed' ? 'badge-success' : 'badge-warning'
                }`}>{d.certainty}</span>
              </div>
            ))}
          </div>
        )}

        {/* Differential Diagnosis — accordion */}
        {differential_diagnosis?.length > 0 && (
          <div className="border border-slate-100 dark:border-slate-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDifferentials(!showDifferentials)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-caption text-slate-600 dark:text-slate-300 flex-1 uppercase tracking-wider">
                Differentials ({differential_diagnosis.length})
              </span>
              {showDifferentials
                ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              }
            </button>
            {showDifferentials && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                {differential_diagnosis.map((dd, i) => (
                  <span key={i} className="badge badge-neutral text-[10px]">
                    {dd.condition} ({dd.likelihood})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Medications */}
        {medications?.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-caption text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <Pill className="w-3 h-3" /> Medications ({medications.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {medications.map((m, i) => (
                <div key={i} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{m.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{m.dosage} · {m.frequency} · {m.duration}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Tests */}
        {recommended_tests?.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-caption text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <FlaskConical className="w-3 h-3" /> Recommended Tests
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recommended_tests.map((t, i) => (
                <span key={i} className="badge badge-accent text-[10px]">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Follow Up */}
        {follow_up && (
          <div className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
            <span className="text-caption text-blue-600 dark:text-blue-400 font-medium">Follow-up: </span>
            <span className="text-sm text-blue-800 dark:text-blue-300">{follow_up}</span>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500">
          {elapsed > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.round(elapsed)}s
            </span>
          )}
          {fhirQuality && <span>{fhirQuality.total_resources} FHIR resources</span>}
          <span className="ml-auto">AI-assisted · MedScribe</span>
        </div>
      </div>
    </div>
  )
}

function generateTextSummary(note, quality, alerts, elapsed) {
  const lines = ['=== MedScribe AI - Consultation Summary ===', '']

  if (note.patient_info?.name) lines.push(`Patient: ${note.patient_info.name} | ${note.patient_info.age || ''} | ${note.patient_info.gender || ''}`)
  if (note.chief_complaint) lines.push(`Chief Complaint: ${note.chief_complaint}`)

  if (note.diagnosis?.length) {
    lines.push('', 'Diagnosis:')
    note.diagnosis.forEach(d => lines.push(`  - ${d.condition} [${d.icd10_code}] (${d.certainty})`))
  }

  if (note.differential_diagnosis?.length) {
    lines.push('', 'Differential Diagnosis:')
    note.differential_diagnosis.forEach(d => lines.push(`  - ${d.condition} [${d.icd10_code}] (${d.likelihood})`))
  }

  if (note.medications?.length) {
    lines.push('', 'Medications:')
    note.medications.forEach(m => lines.push(`  - ${m.name} (${m.generic_name}) ${m.dosage} ${m.frequency} x ${m.duration}`))
  }

  if (alerts.length) {
    lines.push('', 'Safety Alerts:')
    alerts.forEach(a => lines.push(`  [${a.severity.toUpperCase()}] ${a.title}`))
  }

  if (note.recommended_tests?.length) {
    lines.push('', `Recommended Tests: ${note.recommended_tests.join(', ')}`)
  }

  if (note.follow_up) lines.push('', `Follow-up: ${note.follow_up}`)

  if (quality) lines.push('', `FHIR R4 Compliance: Grade ${quality.grade} (${quality.score}%) | ${quality.total_resources} resources`)
  if (elapsed > 0) lines.push(`Documentation Time: ${Math.round(elapsed)}s (vs ~10min manual)`)

  lines.push('', '--- Generated by MedScribe AI ---')
  return lines.join('\n')
}
