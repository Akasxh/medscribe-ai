import { useRef, useState, useCallback, useEffect } from 'react'
import { showToast } from '../components/ToastNotification'

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

const MAX_RECONNECT_ATTEMPTS = 5

export default function useWebSocket(sessionId) {
  const wsRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const intentionalCloseRef = useRef(false)
  const [connected, setConnected] = useState(false)
  const [clinicalNote, setClinicalNote] = useState(null)
  const [fhirBundle, setFhirBundle] = useState(null)
  const [fhirQuality, setFhirQuality] = useState(null)
  const [cdsAlerts, setCdsAlerts] = useState([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [interimText, setInterimText] = useState('')
  const [totalTranscriptLength, setTotalTranscriptLength] = useState(0)

  const connect = useCallback(() => {
    if (!sessionId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    intentionalCloseRef.current = false

    const url = `${WS_BASE}/ws/transcribe/${sessionId}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setConnected(true)
      setError(null)
      reconnectAttemptsRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'clinical_note':
            setClinicalNote(msg.data)
            showToast('Clinical note extracted', 'success')
            break
          case 'fhir_bundle':
            setFhirBundle(msg.data)
            if (msg.quality_score) {
              setFhirQuality(msg.quality_score)
              showToast(`FHIR Bundle: Grade ${msg.quality_score.grade} (${msg.quality_score.score}%)`, 'success')
            }
            break
          case 'cds_alerts': {
            const alerts = msg.data || []
            setCdsAlerts(alerts)
            const criticalCount = alerts.filter(a => a.severity === 'critical').length
            if (criticalCount > 0) {
              showToast(`${criticalCount} CRITICAL safety alert${criticalCount > 1 ? 's' : ''} detected!`, 'critical')
            } else if (alerts.length > 0) {
              showToast(`${alerts.length} safety alert${alerts.length > 1 ? 's' : ''} detected`, 'warning')
            }
            break
          }
          case 'processing':
            setProcessing(msg.status === 'started')
            break
          case 'interim_transcript':
            setInterimText(msg.text)
            break
          case 'transcript_ack':
            setTotalTranscriptLength(msg.total_length)
            setInterimText('')
            break
          case 'session_complete':
            break
          case 'error':
            setError(msg.message)
            setProcessing(false)
            break
        }
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    ws.onclose = (event) => {
      setConnected(false)
      // Auto-reconnect on unclean close if under max attempts
      if (!intentionalCloseRef.current && !event.wasClean && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
        reconnectAttemptsRef.current += 1
        reconnectTimerRef.current = setTimeout(() => connect(), delay)
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection failed')
      setConnected(false)
    }

    wsRef.current = ws
  }, [sessionId])

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendTranscript = useCallback((text, isFinal) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'transcript',
        text,
        is_final: isFinal,
        timestamp: new Date().toISOString(),
      }))
    }
  }, [])

  const sendProcess = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'process' }))
    }
  }, [])

  const sendStop = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
    }
  }, [])

  const sendSpecialty = useCallback((specialty) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'specialty', specialty }))
    }
  }, [])

  useEffect(() => {
    return () => disconnect()
  }, [disconnect])

  return {
    connected,
    clinicalNote,
    fhirBundle,
    fhirQuality,
    cdsAlerts,
    processing,
    error,
    interimText,
    totalTranscriptLength,
    connect,
    disconnect,
    sendTranscript,
    sendProcess,
    sendStop,
    sendSpecialty,
  }
}
