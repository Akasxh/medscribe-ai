import {
  ClipboardList, Thermometer, Stethoscope, Pill, AlertTriangle,
  CalendarCheck, FileText, ChevronDown, ChevronRight, User, GitBranch,
  FlaskConical, ShieldAlert, Pencil, Check, Brain, Heart, Wind, Scale,
  Activity, X
} from 'lucide-react'
import { useState, useCallback, useRef, useEffect } from 'react'

// ─── Animated collapsible section ───
function Section({ icon: Icon, title, color, children, defaultOpen = true, count }) {
  const [open, setOpen] = useState(defaultOpen)
  const contentRef = useRef(null)
  const [height, setHeight] = useState(defaultOpen ? 'auto' : 0)

  useEffect(() => {
    if (!contentRef.current) return
    if (open) {
      setHeight(contentRef.current.scrollHeight)
      const timer = setTimeout(() => setHeight('auto'), 250)
      return () => clearTimeout(timer)
    } else {
      setHeight(contentRef.current.scrollHeight)
      requestAnimationFrame(() => setHeight(0))
    }
  }, [open])

  if (!children) return null

  return (
    <div className="py-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30 rounded-md"
      >
        <Icon className={`w-4 h-4 ${color} shrink-0`} />
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 tracking-tight flex-1">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
        <ChevronRight
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <div
        ref={contentRef}
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        className="overflow-hidden transition-[height] duration-250 ease-in-out"
      >
        <div className="px-4 pb-3 pt-1">{children}</div>
      </div>
    </div>
  )
}

function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium leading-tight ${className}`}>
      {children}
    </span>
  )
}

function EditableText({ value, onChange, editing, multiline = false, className = '' }) {
  if (!editing) {
    return <span className={className}>{value}</span>
  }
  const baseClass = 'w-full bg-transparent border-b-2 border-blue-400 dark:border-blue-500 px-1 py-0.5 text-sm focus:outline-none focus:border-blue-600 transition-colors'
  if (multiline) {
    return (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className={`${baseClass} resize-none ${className}`}
        rows={3}
      />
    )
  }
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className={`${baseClass} ${className}`}
    />
  )
}

// ─── Vitals helpers ───
const VITAL_CONFIG = [
  { key: 'temperature', label: 'Temp', unit: '\u00B0F', icon: Thermometer, normal: (v) => { const n = parseFloat(v); return n >= 97 && n <= 99.5 } },
  { key: 'bp', label: 'BP', unit: 'mmHg', icon: Activity, normal: (v) => { const m = v?.match?.(/(\d+)/); return m && parseInt(m[1]) < 140 } },
  { key: 'pulse', label: 'Pulse', unit: 'bpm', icon: Heart, normal: (v) => { const n = parseFloat(v); return n >= 60 && n <= 100 } },
  { key: 'spo2', label: 'SpO\u2082', unit: '%', icon: Wind, normal: (v) => { const n = parseFloat(v); return n >= 95 } },
  { key: 'respiratory_rate', label: 'RR', unit: '/min', icon: Wind, normal: (v) => { const n = parseFloat(v); return n >= 12 && n <= 20 } },
  { key: 'weight', label: 'Weight', unit: 'kg', icon: Scale, normal: () => true },
]

function getVitalStatus(config, value) {
  if (!value) return 'missing'
  try {
    return config.normal(value) ? 'normal' : 'abnormal'
  } catch {
    return 'normal'
  }
}

const vitalStatusStyles = {
  normal: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20',
  abnormal: 'border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20',
  missing: 'border-dashed border-slate-200 dark:border-slate-700 bg-transparent',
}
const vitalValueStyles = {
  normal: 'text-emerald-700 dark:text-emerald-400',
  abnormal: 'text-red-700 dark:text-red-400',
  missing: 'text-slate-300 dark:text-slate-600',
}

// ─── Confidence bar ───
function ConfidenceBar({ value }) {
  const raw = typeof value === 'number' ? value : (typeof value === 'string' ? parseFloat(value) : 0)
  // Gemini returns 0.0-1.0; normalize to 0-100
  const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5 flex-1 max-w-[100px]">
      <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 font-mono w-7 text-right">{pct}%</span>
    </div>
  )
}

// ─── Skeleton loader ───
function SkeletonLoader() {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
        <div className="skeleton w-4 h-4 rounded" />
        <div className="skeleton h-4 w-28" />
      </div>
      <div className="p-4 space-y-5">
        <div className="skeleton h-12 w-full rounded-lg" />
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          <div className="skeleton h-5 w-2/3 rounded" />
          <div className="skeleton h-5 w-1/2 rounded" />
        </div>
        <div className="space-y-2">
          <div className="skeleton h-12 w-full rounded" />
          <div className="skeleton h-12 w-full rounded" />
        </div>
      </div>
    </div>
  )
}

export default function ClinicalNote({ data, processing, sessionId, transcript = '', onNoteUpdated }) {
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [correctionCount, setCorrectionCount] = useState(0)

  const startEditing = useCallback(() => {
    setEditData(JSON.parse(JSON.stringify(data)))
    setEditing(true)
  }, [data])

  const saveEdits = useCallback(async () => {
    if (!editData || !data) return
    setSaving(true)

    const changes = findChanges(data, editData)

    try {
      for (const change of changes) {
        await fetch('/api/sessions/corrections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId || 'unknown',
            transcript: transcript,
            original_note: data,
            corrected_note: editData,
            field_path: change.path,
          }),
        })
      }
      setCorrectionCount(prev => prev + changes.length)
      if (onNoteUpdated) onNoteUpdated(editData)
    } catch (e) {
      console.error('Failed to save corrections:', e)
    }

    setEditing(false)
    setSaving(false)
  }, [editData, data, sessionId, transcript, onNoteUpdated])

  const cancelEditing = useCallback(() => {
    setEditing(false)
    setEditData(null)
  }, [])

  const updateField = useCallback((path, value) => {
    setEditData(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      setNestedValue(next, path, value)
      return next
    })
  }, [])

  if (!data) {
    if (processing) return <SkeletonLoader />
    return (
      <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
          <ClipboardList className="w-10 h-10 mb-3 opacity-40 stroke-[1.5]" />
          <p className="text-sm font-medium">Clinical note will appear after processing</p>
          <p className="text-xs mt-1.5 text-slate-400/70 dark:text-slate-600">
            Start recording to generate AI-extracted clinical documentation
          </p>
        </div>
      </div>
    )
  }

  const d = editing ? editData : data
  const {
    patient_info, chief_complaint, history_of_present_illness, symptoms,
    vitals, diagnosis, medications, observations, allergies, follow_up,
    clinical_notes, differential_diagnosis, risk_factors, recommended_tests
  } = d

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* ─── Header ─── */}
      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-[13px] font-semibold text-slate-800 dark:text-white tracking-tight">Clinical Note</h2>

        {correctionCount > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded">
            <Brain className="w-3 h-3" />
            <span>{correctionCount} correction{correctionCount > 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {!editing ? (
            <>
              <span className="badge badge-success text-[10px]">AI Generated</span>
              <button
                onClick={startEditing}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-600 transition-colors"
                title="Edit to improve AI"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={saveEdits}
                disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <Check className="w-3 h-3" />
                {saving ? 'Saving...' : 'Save & Teach AI'}
              </button>
              <button
                onClick={cancelEditing}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Edit mode banner ─── */}
      {editing && (
        <div className="px-4 py-2 bg-blue-50/80 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 shrink-0" />
          <span>Edit any field below. Corrections train the AI to be more accurate.</span>
        </div>
      )}

      {/* ─── Patient Banner ─── */}
      {patient_info && (patient_info.name || patient_info.age || patient_info.gender) && (
        <div className="mx-4 mt-3 mb-1 border-l-4 border-blue-500 bg-slate-50/80 dark:bg-slate-700/50 rounded-r-lg px-3 py-2 flex items-center gap-3 flex-wrap">
          <User className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          {patient_info.name && (
            editing ? (
              <EditableText value={editData.patient_info.name} onChange={v => updateField('patient_info.name', v)} editing={true} className="w-36" />
            ) : (
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{patient_info.name}</span>
            )
          )}
          {patient_info.age && (
            <Badge className="bg-slate-200/70 text-slate-600 dark:bg-slate-600 dark:text-slate-300">{patient_info.age}</Badge>
          )}
          {patient_info.gender && (
            <Badge className="bg-slate-200/70 text-slate-600 dark:bg-slate-600 dark:text-slate-300 capitalize">{patient_info.gender}</Badge>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto">
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      )}

      {/* ─── Sections ─── */}
      <div className="divide-y divide-slate-100/80 dark:divide-slate-700/40">

        {/* Chief Complaint */}
        {chief_complaint && (
          <Section icon={AlertTriangle} title="Chief Complaint" color="text-amber-500">
            <EditableText
              value={chief_complaint}
              onChange={v => updateField('chief_complaint', v)}
              editing={editing}
              className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed"
            />
          </Section>
        )}

        {/* HPI */}
        {history_of_present_illness && (
          <Section icon={FileText} title="History of Present Illness" color="text-blue-500">
            <EditableText
              value={history_of_present_illness}
              onChange={v => updateField('history_of_present_illness', v)}
              editing={editing}
              multiline={true}
              className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed"
            />
          </Section>
        )}

        {/* Symptoms */}
        {symptoms?.length > 0 && (
          <Section icon={Stethoscope} title="Symptoms" color="text-red-500" count={symptoms.length}>
            <div className="space-y-1.5">
              {symptoms.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/70 mt-1.5 shrink-0" />
                  <div className="flex-1 flex items-baseline gap-2 flex-wrap">
                    <EditableText
                      value={s.description}
                      onChange={v => updateField(`symptoms.${i}.description`, v)}
                      editing={editing}
                      className="text-slate-700 dark:text-slate-300"
                    />
                    {s.duration && <span className="text-[11px] text-slate-400">{s.duration}</span>}
                    {s.severity && (
                      <Badge className={
                        s.severity === 'severe' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        s.severity === 'moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      }>{s.severity}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Vitals */}
        {vitals && (
          <Section icon={Thermometer} title="Vitals" color="text-emerald-500">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VITAL_CONFIG.map(({ key, label, unit, icon: VIcon }) => {
                const val = vitals[key]
                const status = getVitalStatus(VITAL_CONFIG.find(v => v.key === key), val)
                return (
                  <div key={key} className={`border rounded-lg p-2 text-center transition-colors ${vitalStatusStyles[status]}`}>
                    <VIcon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${status === 'missing' ? 'text-slate-300 dark:text-slate-600' : status === 'abnormal' ? 'text-red-500' : 'text-emerald-500'}`} />
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{label}</div>
                    {editing && val ? (
                      <EditableText
                        value={val}
                        onChange={v => updateField(`vitals.${key}`, v)}
                        editing={true}
                        className="w-full text-center text-xs"
                      />
                    ) : (
                      <div className={`text-sm font-semibold ${vitalValueStyles[status]}`}>
                        {val || '\u2014'}
                      </div>
                    )}
                    {val && <div className="text-[9px] text-slate-400 dark:text-slate-500">{unit}</div>}
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Diagnosis */}
        {diagnosis?.length > 0 && (
          <Section icon={AlertTriangle} title="Diagnosis" color="text-amber-500" count={diagnosis.length}>
            <div className="space-y-2">
              {diagnosis.map((dx, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    dx.certainty === 'confirmed' ? 'bg-emerald-500' :
                    dx.certainty === 'differential' ? 'bg-slate-400' :
                    'bg-amber-500'
                  }`} />
                  <EditableText
                    value={dx.condition}
                    onChange={v => updateField(`diagnosis.${i}.condition`, v)}
                    editing={editing}
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  />
                  <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 font-mono text-[10px]">
                    {dx.icd10_code}
                  </Badge>
                  {dx.confidence !== undefined && <ConfidenceBar value={dx.confidence} />}
                  <Badge className={
                    dx.certainty === 'confirmed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    dx.certainty === 'differential' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }>{dx.certainty}</Badge>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Medications */}
        {medications?.length > 0 && (
          <Section icon={Pill} title="Medications" color="text-rose-500" count={medications.length}>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                    <th className="text-left py-1.5 px-2">Drug</th>
                    <th className="text-left py-1.5 px-2">Dosage</th>
                    <th className="text-left py-1.5 px-2 hidden sm:table-cell">Frequency</th>
                    <th className="text-left py-1.5 px-2 hidden sm:table-cell">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {medications.map((m, i) => (
                    <tr key={i} className={`border-t border-slate-100 dark:border-slate-700/40 ${i % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}>
                      <td className="py-2 px-2">
                        <div className="flex items-baseline gap-1 flex-wrap">
                          <EditableText
                            value={m.name}
                            onChange={v => updateField(`medications.${i}.name`, v)}
                            editing={editing}
                            className="font-medium text-slate-700 dark:text-slate-200 text-[13px]"
                          />
                          {m.generic_name && m.generic_name !== m.name && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">({m.generic_name})</span>
                          )}
                        </div>
                        {/* Mobile-only: show freq/duration below */}
                        <div className="sm:hidden flex gap-2 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                          {m.frequency && <span>{m.frequency}</span>}
                          {m.duration && <span>{m.duration}</span>}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-[13px]">{m.dosage || '\u2014'}</td>
                      <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-[13px] hidden sm:table-cell">{m.frequency || '\u2014'}</td>
                      <td className="py-2 px-2 text-slate-600 dark:text-slate-400 text-[13px] hidden sm:table-cell">{m.duration || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Allergies */}
        {allergies?.length > 0 && allergies.some(a => a) && (
          <Section icon={ShieldAlert} title="Allergies" color="text-orange-500" count={allergies.filter(a => a).length}>
            <div className="flex flex-wrap gap-1.5">
              {allergies.filter(a => a).map((a, i) => (
                <Badge key={i} className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50">
                  <ShieldAlert className="w-3 h-3 mr-0.5" />
                  {a}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {/* Differential Diagnosis */}
        {differential_diagnosis?.length > 0 && (
          <Section icon={GitBranch} title="Differential Diagnosis" color="text-purple-500" count={differential_diagnosis.length} defaultOpen={false}>
            <div className="space-y-2.5">
              {differential_diagnosis.map((dd, i) => (
                <div key={i} className="border border-slate-200/70 dark:border-slate-700/50 rounded-lg p-3 bg-slate-50/30 dark:bg-slate-800/20">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">{dd.condition}</span>
                    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 font-mono text-[10px]">{dd.icd10_code}</Badge>
                    <Badge className={
                      dd.likelihood === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      dd.likelihood === 'moderate' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }>{dd.likelihood}</Badge>
                  </div>
                  {dd.supporting_evidence && (
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1.5 italic leading-relaxed">
                      {dd.supporting_evidence}
                    </p>
                  )}
                  {dd.distinguishing_tests && (
                    <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 not-italic">Distinguishing test:</span>{' '}
                      {dd.distinguishing_tests}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Recommended Tests */}
        {recommended_tests?.length > 0 && (
          <Section icon={FlaskConical} title="Recommended Tests" color="text-cyan-500" count={recommended_tests.length}>
            <div className="space-y-1">
              {recommended_tests.map((test, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                  <FlaskConical className="w-3 h-3 text-cyan-500/60 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">{test}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Risk Factors */}
        {risk_factors?.length > 0 && (
          <Section icon={ShieldAlert} title="Risk Factors" color="text-orange-500" count={risk_factors.length}>
            <div className="flex flex-wrap gap-1.5">
              {risk_factors.map((rf, i) => (
                <Badge key={i} className="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-200/70 dark:border-orange-800/40">
                  {rf}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {/* Follow Up */}
        {follow_up && (
          <Section icon={CalendarCheck} title="Follow Up" color="text-indigo-500">
            <EditableText
              value={follow_up}
              onChange={v => updateField('follow_up', v)}
              editing={editing}
              className="text-sm text-slate-600 dark:text-slate-400"
            />
          </Section>
        )}

        {/* Clinical Summary */}
        {clinical_notes && (
          <Section icon={FileText} title="Clinical Summary" color="text-slate-500" defaultOpen={false}>
            <EditableText
              value={clinical_notes}
              onChange={v => updateField('clinical_notes', v)}
              editing={editing}
              multiline={true}
              className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap"
            />
          </Section>
        )}
      </div>
    </div>
  )
}

// Helper: set a nested value using dot-path like "diagnosis.0.condition"
function setNestedValue(obj, path, value) {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i].match(/^\d+$/) ? parseInt(parts[i]) : parts[i]
    current = current[key]
  }
  const lastKey = parts[parts.length - 1].match(/^\d+$/) ? parseInt(parts[parts.length - 1]) : parts[parts.length - 1]
  current[lastKey] = value
}

// Helper: find what changed between original and edited data
function findChanges(original, edited, prefix = '') {
  const changes = []
  if (!original || !edited) return changes

  for (const key of Object.keys(edited)) {
    const path = prefix ? `${prefix}.${key}` : key
    const origVal = original[key]
    const editVal = edited[key]

    if (typeof editVal === 'string' && typeof origVal === 'string') {
      if (editVal !== origVal) {
        changes.push({ path, original: origVal, edited: editVal })
      }
    } else if (Array.isArray(editVal) && Array.isArray(origVal)) {
      for (let i = 0; i < editVal.length; i++) {
        if (i < origVal.length) {
          changes.push(...findChanges(origVal[i], editVal[i], `${path}.${i}`))
        }
      }
    } else if (typeof editVal === 'object' && editVal && typeof origVal === 'object' && origVal) {
      changes.push(...findChanges(origVal, editVal, path))
    }
  }

  return changes
}
