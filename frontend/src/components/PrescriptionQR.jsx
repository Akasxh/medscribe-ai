import { useState, useCallback } from 'react'
import { QrCode, Download, X } from 'lucide-react'
import QRCode from 'qrcode'

export default function PrescriptionQR({ medications = [], patientInfo = {} }) {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [visible, setVisible] = useState(false)

  const generateQR = useCallback(async () => {
    if (!medications.length) {
      setError('No medications to encode')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const patientStr = [
        patientInfo.name || 'Unknown',
        patientInfo.gender ? patientInfo.gender.charAt(0).toUpperCase() : '',
        patientInfo.age || '',
      ].filter(Boolean).join(', ')

      const rxList = medications.map(m => ({
        n: m.generic_name || m.name || 'Unknown',
        dose: m.dosage || '',
        f: m.frequency || '',
        dur: m.duration || '',
      }))

      const payload = JSON.stringify({
        p: patientStr,
        d: new Date().toISOString().slice(0, 10),
        rx: rxList,
      })

      const dataUrl = await QRCode.toDataURL(payload, {
        width: 256,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      })

      setQrDataUrl(dataUrl)
      setVisible(true)
    } catch (err) {
      setError(`QR generation failed: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }, [medications, patientInfo])

  const downloadQR = useCallback(() => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = `prescription-${new Date().toISOString().slice(0, 10)}.png`
    link.href = qrDataUrl
    link.click()
  }, [qrDataUrl])

  if (!medications.length) return null

  return (
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
        {!visible ? (
          <button
            onClick={generateQR}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium text-sm transition-colors"
          >
            <QrCode className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Rx QR'}
          </button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* QR Image */}
            <div className="relative bg-white rounded-xl p-3 shadow-inner border border-slate-100">
              <button
                onClick={() => setVisible(false)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              </button>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="Prescription QR Code"
                  className="w-48 h-48"
                />
              )}
            </div>

            {/* Caption */}
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Scan at pharmacy to fill prescription
            </p>

            {/* Medication summary */}
            <div className="w-full text-xs text-slate-500 dark:text-slate-400 space-y-1">
              {medications.map((m, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-pink-400 shrink-0" />
                  <span className="truncate">
                    {m.name}{m.dosage ? ` ${m.dosage}` : ''}{m.frequency ? ` ${m.frequency}` : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Download */}
            <button
              onClick={downloadQR}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download QR
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
