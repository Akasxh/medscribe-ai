import { lazy, Suspense } from 'react'
import ClinicalNote from '../ClinicalNote'
import FHIRQualityBadge from '../FHIRQualityBadge'
import { Stethoscope } from 'lucide-react'

const CDSAlerts = lazy(() => import('../CDSAlerts'))
const ExportPanel = lazy(() => import('../ExportPanel'))
const FHIRViewer = lazy(() => import('../FHIRViewer'))

function LazyFallback() {
  return (
    <div className="card p-6 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function ConsultationDetail({ session }) {
  if (!session) {
    return (
      <div className="card rounded-2xl p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 h-full flex flex-col items-center justify-center min-h-[300px]">
        <Stethoscope className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-base font-medium text-slate-500 dark:text-slate-400">Select a consultation</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          Click a patient from the list to view details
        </p>
      </div>
    )
  }

  const { clinical_note, cds_alerts, fhir_quality, fhir_bundle, id, transcript } = session

  return (
    <div className="space-y-3">
      {/* FHIR Quality */}
      {fhir_quality && <FHIRQualityBadge quality={fhir_quality} />}

      {/* Clinical Note */}
      <ClinicalNote
        data={clinical_note}
        processing={false}
        sessionId={id}
        transcript={transcript || ''}
      />

      {/* CDS Alerts */}
      {cds_alerts && cds_alerts.length > 0 && (
        <Suspense fallback={<LazyFallback />}>
          <CDSAlerts alerts={cds_alerts} />
        </Suspense>
      )}

      {/* FHIR Viewer */}
      {fhir_bundle && (
        <Suspense fallback={<LazyFallback />}>
          <FHIRViewer bundle={fhir_bundle} />
        </Suspense>
      )}

      {/* Export */}
      {clinical_note && (
        <Suspense fallback={<LazyFallback />}>
          <ExportPanel clinicalNote={clinical_note} fhirBundle={fhir_bundle} />
        </Suspense>
      )}
    </div>
  )
}
