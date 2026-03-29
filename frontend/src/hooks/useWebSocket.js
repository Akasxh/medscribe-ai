import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
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

  // Reset all state when sessionId changes (new consultation)
  const prevSessionRef = useRef(sessionId)
  useEffect(() => {
    if (prevSessionRef.current !== sessionId) {
      prevSessionRef.current = sessionId
      setClinicalNote(null)
      setFhirBundle(null)
      setFhirQuality(null)
      setCdsAlerts([])
      setProcessing(false)
      setError(null)
      setInterimText('')
      setTotalTranscriptLength(0)
      reconnectAttemptsRef.current = 0
    }
  }, [sessionId])

  const connect = useCallback(() => {
    if (!sessionId) return
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return
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
            break
          case 'fhir_bundle':
            setFhirBundle(msg.data)
            if (msg.quality_score) {
              setFhirQuality(msg.quality_score)
            }
            break
          case 'cds_alerts': {
            const alerts = msg.data || []
            setCdsAlerts(alerts)
            const criticalCount = alerts.filter(a => a.severity === 'critical').length
            if (criticalCount > 0) {
              showToast(`${criticalCount} CRITICAL safety alert${criticalCount > 1 ? 's' : ''} detected!`, 'critical')
            }
            break
          }
          case 'processing':
            if (msg.status === 'started') {
              setProcessing(true)
            } else {
              setProcessing(false)
              if (msg.status === 'completed') {
                showToast('Clinical note generated successfully', 'success')
                try { localStorage.removeItem('medscribe_autosave') } catch {}
              }
            }
            break
          case 'interim_transcript':
            setInterimText(msg.text)
            break
          case 'transcript_ack':
            setTotalTranscriptLength(msg.total_length)
            setInterimText('')
            break
          case 'session_complete':
            setProcessing(false)
            // Clear autosave — session processed successfully
            try { localStorage.removeItem('medscribe_autosave') } catch {}
            break
          case 'error':
            setError(msg.message)
            setProcessing(false)
            break
        }
      } catch (e) {
        console.error('WS parse error:', e)
        setProcessing(false)
      }
    }

    ws.onclose = (event) => {
      setConnected(false)
      // Auto-reconnect on unclean close if under max attempts
      if (!intentionalCloseRef.current && !event.wasClean) {
        reconnectAttemptsRef.current += 1
        if (reconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 10000)
          reconnectTimerRef.current = setTimeout(() => connect(), delay)
        } else {
          setError('Connection lost. Please refresh the page.')
        }
      }
    }

    ws.onerror = (event) => {
      console.error('WebSocket error:', event)
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
    // Optimistically clear interim text the moment a final transcript is
    // committed locally, rather than waiting for the backend transcript_ack.
    // This eliminates the visual duplication window where the same text
    // appears both in transcriptLines and in interimText simultaneously.
    if (isFinal) {
      setInterimText('')
    }
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

  const sendAbhaId = useCallback((abhaId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'abha_id', abha_id: abhaId }))
    }
  }, [])

  useEffect(() => {
    return () => disconnect()
  }, [disconnect])

  return useMemo(() => ({
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
    sendAbhaId,
  }), [connected, clinicalNote, fhirBundle, fhirQuality, cdsAlerts, processing, error, interimText, totalTranscriptLength, connect, disconnect, sendTranscript, sendProcess, sendStop, sendSpecialty, sendAbhaId])
}
