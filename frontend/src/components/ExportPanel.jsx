import { Download, FileText, Copy, Check, Printer } from 'lucide-react'
import { useState, useCallback } from 'react'

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function generateClinicalNotePDF(data) {
  const { patient_info, chief_complaint, history_of_present_illness, symptoms, vitals, diagnosis, medications, allergies, follow_up, clinical_notes, differential_diagnosis, recommended_tests, risk_factors } = data

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Clinical Note - MedScribe AI</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1e293b; font-size: 14px; line-height: 1.6; }
  h1 { font-size: 20px; color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
  h2 { font-size: 16px; color: #0f172a; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .patient-banner { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb; }
  .patient-banner span { margin-right: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { padding: 6px 12px; text-align: left; border: 1px solid #e2e8f0; }
  th { background: #f8fafc; font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; margin-right: 4px; }
  .badge-confirmed { background: #dcfce7; color: #166534; }
  .badge-suspected { background: #fef9c3; color: #854d0e; }
  .badge-icd { background: #f1f5f9; color: #475569; font-family: monospace; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
<h1>Clinical Note</h1>
<p style="font-size: 12px; color: #64748b;">Generated: ${new Date().toLocaleString('en-IN')} | AI-Assisted Documentation</p>

${patient_info?.name || patient_info?.age || patient_info?.gender ? `
<div class="patient-banner">
  ${patient_info.name ? `<span><strong>Name:</strong> ${patient_info.name}</span>` : ''}
  ${patient_info.age ? `<span><strong>Age:</strong> ${patient_info.age}</span>` : ''}
  ${patient_info.gender ? `<span><strong>Gender:</strong> ${patient_info.gender}</span>` : ''}
</div>` : ''}

${chief_complaint ? `<h2>Chief Complaint</h2><p>${chief_complaint}</p>` : ''}
${history_of_present_illness ? `<h2>History of Present Illness</h2><p>${history_of_present_illness}</p>` : ''}

${symptoms?.length ? `<h2>Symptoms</h2><table><tr><th>Symptom</th><th>Duration</th><th>Severity</th></tr>
${symptoms.map(s => `<tr><td>${s.description}</td><td>${s.duration || '-'}</td><td>${s.severity || '-'}</td></tr>`).join('')}</table>` : ''}

${vitals && Object.values(vitals).some(v => v) ? `<h2>Vitals</h2><table><tr>
${vitals.temperature ? `<th>Temp</th>` : ''}${vitals.bp ? `<th>BP</th>` : ''}${vitals.pulse ? `<th>Pulse</th>` : ''}${vitals.spo2 ? `<th>SpO2</th>` : ''}${vitals.weight ? `<th>Weight</th>` : ''}
</tr><tr>
${vitals.temperature ? `<td>${vitals.temperature}</td>` : ''}${vitals.bp ? `<td>${vitals.bp}</td>` : ''}${vitals.pulse ? `<td>${vitals.pulse}</td>` : ''}${vitals.spo2 ? `<td>${vitals.spo2}</td>` : ''}${vitals.weight ? `<td>${vitals.weight}</td>` : ''}
</tr></table>` : ''}

${diagnosis?.length ? `<h2>Diagnosis</h2><table><tr><th>Condition</th><th>ICD-10</th><th>Certainty</th></tr>
${diagnosis.map(d => `<tr><td>${d.condition}</td><td><span class="badge badge-icd">${d.icd10_code}</span></td><td><span class="badge badge-${d.certainty}">${d.certainty}</span></td></tr>`).join('')}</table>` : ''}

${differential_diagnosis?.length ? `<h2>Differential Diagnosis</h2><table><tr><th>Condition</th><th>ICD-10</th><th>Likelihood</th><th>Evidence</th></tr>
${differential_diagnosis.map(d => `<tr><td>${d.condition}</td><td>${d.icd10_code}</td><td>${d.likelihood}</td><td>${d.supporting_evidence || '-'}</td></tr>`).join('')}</table>` : ''}

${medications?.length ? `<h2>Medications</h2><table><tr><th>Drug</th><th>Generic</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr>
${medications.map(m => `<tr><td>${m.name}</td><td>${m.generic_name}</td><td>${m.dosage}</td><td>${m.frequency}</td><td>${m.duration}</td></tr>`).join('')}</table>` : ''}

${allergies?.filter(a => a).length ? `<h2>Allergies</h2><p>${allergies.filter(a => a).join(', ')}</p>` : ''}
${recommended_tests?.length ? `<h2>Recommended Tests</h2><ul>${recommended_tests.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
${risk_factors?.length ? `<h2>Risk Factors</h2><ul>${risk_factors.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
${follow_up ? `<h2>Follow Up</h2><p>${follow_up}</p>` : ''}
${clinical_notes ? `<h2>Clinical Summary</h2><p>${clinical_notes}</p>` : ''}

<div class="footer">
  <p>Generated by MedScribe AI</p>
  <p>This is an AI-generated clinical note. Please review and verify all information before use.</p>
</div>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.left = '-9999px'
    iframe.style.width = '0'
    iframe.style.height = '0'
    document.body.appendChild(iframe)
    iframe.contentDocument.write(html)
    iframe.contentDocument.close()
    setTimeout(() => {
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }, 300)
    return
  }
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 300)
}

function ExportButton({ onClick, icon: Icon, label, variant = 'default', successLabel }) {
  const [success, setSuccess] = useState(false)

  const handleClick = useCallback(async () => {
    await onClick()
    if (successLabel) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    }
  }, [onClick, successLabel])

  const base = 'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border'
  const variants = {
    default: 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-500',
    success: 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
  }

  return (
    <button onClick={handleClick} className={`${base} ${variants[success ? 'success' : variant]} flex-1 sm:flex-initial`}>
      {success ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
      <span>{success ? successLabel : label}</span>
    </button>
  )
}

export default function ExportPanel({ clinicalNote, fhirBundle }) {
  if (!clinicalNote && !fhirBundle) return null

  const handleCopySummary = useCallback(async () => {
    if (!clinicalNote) return
    const { chief_complaint, diagnosis, medications, follow_up } = clinicalNote
    const lines = []
    if (chief_complaint) lines.push(`CC: ${chief_complaint}`)
    if (diagnosis?.length) lines.push(`Dx: ${diagnosis.map(d => `${d.condition} (${d.icd10_code})`).join(', ')}`)
    if (medications?.length) lines.push(`Rx: ${medications.map(m => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join(', ')}`)
    if (follow_up) lines.push(`F/U: ${follow_up}`)
    await navigator.clipboard.writeText(lines.join('\n'))
  }, [clinicalNote])

  return (
    <div className="card p-4">
      <div className="flex flex-col sm:flex-row gap-2">
      {clinicalNote && (
        <ExportButton
          onClick={() => generateClinicalNotePDF(clinicalNote)}
          icon={Printer}
          label="Print Note"
        />
      )}
      {fhirBundle && (
        <ExportButton
          onClick={() => downloadJSON(fhirBundle, `fhir-bundle-${new Date().toISOString().slice(0, 10)}.json`)}
          icon={Download}
          label="FHIR JSON"
          successLabel="Downloaded"
        />
      )}
      {clinicalNote && (
        <ExportButton
          onClick={handleCopySummary}
          icon={Copy}
          label="Copy Summary"
          successLabel="Copied"
        />
      )}
      </div>
    </div>
  )
}
