import { Users, ShieldCheck, Award, AlertOctagon, Pill, UserCheck } from 'lucide-react'

function KPICard({ icon: Icon, label, value, sub, color }) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    violet: 'bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
    red: 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    pink: 'bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  }

  const iconBg = {
    blue: 'bg-blue-100 dark:bg-blue-900/50',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/50',
    violet: 'bg-violet-100 dark:bg-violet-900/50',
    red: 'bg-red-100 dark:bg-red-900/50',
    pink: 'bg-pink-100 dark:bg-pink-900/50',
    amber: 'bg-amber-100 dark:bg-amber-900/50',
  }

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${colorMap[color]} transition-shadow hover:shadow-md`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs font-medium opacity-70 truncate">{label}</p>
        </div>
      </div>
      {sub && <p className="text-[11px] opacity-50 mt-2">{sub}</p>}
    </div>
  )
}

export default function KPICards({ sessions }) {
  const total = sessions.length
  const completed = sessions.filter(s => s.status === 'completed').length

  // Active doctors (unique doctor names/ids)
  const activeDoctors = new Set(
    sessions.map(s => s.doctor_name || s.clinical_note?.doctor_name || 'Unknown')
  ).size

  // Average safety score
  const avgSafety = sessions.length > 0
    ? Math.round(
        sessions.reduce((sum, s) => {
          const criticals = (s.cds_alerts || []).filter(a => a.severity === 'critical').length
          const warnings = (s.cds_alerts || []).filter(a => a.severity === 'warning').length
          const score = Math.max(0, 100 - criticals * 25 - warnings * 10)
          return sum + score
        }, 0) / sessions.length
      )
    : 0

  // FHIR Grade A percentage
  const fhirACount = sessions.filter(s => s.fhir_quality?.grade === 'A').length
  const fhirAPct = total > 0 ? Math.round((fhirACount / total) * 100) : 0

  // Total prescriptions
  const totalPrescriptions = sessions.reduce(
    (sum, s) => sum + (s.clinical_note?.medications || []).length,
    0
  )

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <KPICard
        icon={Users}
        label="Total Consultations"
        value={total}
        sub={`${completed} completed`}
        color="blue"
      />
      <KPICard
        icon={UserCheck}
        label="Active Doctors"
        value={activeDoctors}
        sub="Unique practitioners"
        color="amber"
      />
      <KPICard
        icon={ShieldCheck}
        label="Avg Safety Score"
        value={total > 0 ? `${avgSafety}/100` : '--'}
        sub={total > 0 ? 'Based on CDS alerts' : 'Awaiting data'}
        color="emerald"
      />
      <KPICard
        icon={Award}
        label="FHIR Grade A"
        value={total > 0 ? `${fhirAPct}%` : '--'}
        sub={total > 0 ? `${fhirACount} of ${total} sessions` : 'Awaiting data'}
        color="violet"
      />
      <KPICard
        icon={Pill}
        label="Total Prescriptions"
        value={totalPrescriptions}
        sub={total > 0 ? `~${(totalPrescriptions / Math.max(total, 1)).toFixed(1)} per visit` : 'No sessions yet'}
        color="pink"
      />
    </div>
  )
}
