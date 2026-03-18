import { useState, useCallback } from 'react'
import { QrCode, Download, X, ExternalLink } from 'lucide-react'
import QRCode from 'qrcode'

const RX_BASE_URL = `${window.location.origin}/rx`

export default function PrescriptionQR({ medications = [], patientInfo = {}, sessionId, doctorName }) {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const generateQR = useCallback(async () => {
    if (!medications.length) {
      setError('No medications to encode')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const rxUrl = `${RX_BASE_URL}/${sessionId || 'unknown'}`

      const fallbackPayload = {
        id: sessionId || 'unknown',
        doctor: doctorName || 'Doctor',
        patient: patientInfo?.name || 'Patient',
        date: new Date().toISOString().slice(0, 10),
        rx: medications.map(m => ({
          drug: m.generic_name || m.name || 'Unknown',
          dose: m.dosage || '',
          freq: m.frequency || '',
          dur: m.duration || '',
        })),
      }

      // Try URL first (shorter), fall back to full data if URL is too long
      let qrContent = rxUrl
      const fullPayload = JSON.stringify({ url: rxUrl, ...fallbackPayload })

      // If payload is small enough for QR, encode the full data
      if (fullPayload.length < 2000) {
        qrContent = fullPayload
      }

      const dataUrl = await QRCode.toDataURL(qrContent, {
        width: 320,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      })

      setQrDataUrl(dataUrl)
      setShowModal(true)
    } catch (err) {
      setError(`QR generation failed: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }, [medications, patientInfo, sessionId, doctorName])

  const downloadQR = useCallback(() => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = `prescription-${sessionId || 'rx'}-${new Date().toISOString().slice(0, 10)}.png`
    link.href = qrDataUrl
    link.click()
  }, [qrDataUrl, sessionId])

  if (!medications.length) return null

  return (
    <>
      {/* Inline card with generate button */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Prescription QR</h3>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 font-medium">
            {medications.length} med{medications.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="p-4">
          {/* Medication summary */}
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-3">
            {medications.slice(0, 4).map((m, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-pink-400 shrink-0" />
                <span className="truncate">
                  {m.name}{m.dosage ? ` ${m.dosage}` : ''}{m.frequency ? ` ${m.frequency}` : ''}
                </span>
              </div>
            ))}
            {medications.length > 4 && (
              <p className="text-slate-400 text-[10px]">+{medications.length - 4} more</p>
            )}
          </div>

          <button
            onClick={generateQR}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium text-sm transition-colors"
          >
            <QrCode className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Prescription QR'}
          </button>

          {error && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
          )}
        </div>
      </div>

      {/* Modal overlay */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Prescription QR</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 flex flex-col items-center gap-4">
              {/* QR image */}
              {qrDataUrl && (
                <div className="bg-white rounded-xl p-4 shadow-inner border border-slate-100">
                  <img
                    src={qrDataUrl}
                    alt="Prescription QR Code"
                    className="w-64 h-64"
                  />
                </div>
              )}

              {/* Caption */}
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Scan to view prescription
              </p>

              {/* Session ID */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Session</span>
                <code className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                  {sessionId ? (sessionId.length > 24 ? sessionId.slice(0, 24) + '...' : sessionId) : 'N/A'}
                </code>
              </div>

              {/* Link preview */}
              <a
                href={`${RX_BASE_URL}/${sessionId || 'unknown'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open prescription link
              </a>

              {/* Actions */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={downloadQR}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download QR
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
