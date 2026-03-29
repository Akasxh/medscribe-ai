import { useRef, useState, useCallback, useEffect } from 'react'

const VOICE_COMMANDS = [
  { pattern: /\b(show|switch to)\s*(fhir|fire|resources?)\b/i, action: 'tab:fhir' },
  { pattern: /\b(show|switch to)\s*(safety|alerts?|warnings?)\b/i, action: 'tab:cds' },
  { pattern: /\b(show|switch to)\s*(notes?|clinical)\b/i, action: 'tab:note' },
  { pattern: /\b(process|analyze)\s*(now|this)?\b/i, action: 'process' },
]

function detectCommand(text) {
  for (const cmd of VOICE_COMMANDS) {
    if (cmd.pattern.test(text)) {
      return cmd.action
    }
  }
  return null
}

/** Determine the backend URL for the /api/transcribe endpoint. */
function getTranscribeUrl() {
  const base = import.meta.env.VITE_API_URL || ''
  return `${base}/api/transcribe`
}

export default function useAudioRecorder(onTranscript, onCommand, language = 'hi-IN', useSarvam = false) {
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const sarvamIntervalRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const isRecordingRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  const [supported, setSupported] = useState(true)
  const fullTranscriptRef = useRef([])
  const accumulatedSarvamTextRef = useRef('')
  const lastFinalTextRef = useRef('')
  const [lastCommand, setLastCommand] = useState(null)
  const commandTimeoutRef = useRef(null)
  // Stable refs so interval/onstop closures never capture stale callbacks
  const onTranscriptRef = useRef(onTranscript)
  const onCommandRef = useRef(onCommand)
  const languageRef = useRef(language)
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])
  useEffect(() => { onCommandRef.current = onCommand }, [onCommand])
  useEffect(() => { languageRef.current = language }, [language])

  useEffect(() => {
    if (useSarvam) {
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        setSupported(false)
      } else {
        setSupported(true)
      }
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      setSupported(Boolean(SpeechRecognition))
    }
  }, [useSarvam])

  /** Send accumulated audio chunks to Sarvam API. */
  const sendChunksToSarvam = useCallback(async () => {
    if (chunksRef.current.length === 0) return

    const snapshot = chunksRef.current
    chunksRef.current = []

    const blob = new Blob(snapshot, { type: 'audio/webm;codecs=opus' })
    // Skip chunks under 5KB — too short for meaningful transcription
    if (blob.size < 5000) return

    const formData = new FormData()
    formData.append('file', blob, 'audio.webm')
    formData.append('language', languageRef.current)

    try {
      const res = await fetch(getTranscribeUrl(), {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        console.error('Sarvam transcription failed:', res.status, res.statusText)
        chunksRef.current = [...snapshot, ...chunksRef.current]
        return
      }
      const data = await res.json()
      if (data.transcript && data.transcript.trim()) {
        const rawText = data.transcript.trim()

        const command = detectCommand(rawText)
        if (command) {
          setLastCommand(command)
          if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
          commandTimeoutRef.current = setTimeout(() => setLastCommand(null), 2000)
          onCommandRef.current?.(command)
          return
        }

        // Dedup: Sarvam sometimes returns full history, not just new segment
        const accumulated = accumulatedSarvamTextRef.current

        if (rawText === accumulated) return

        let newText = rawText

        if (accumulated && rawText.startsWith(accumulated)) {
          newText = rawText.slice(accumulated.length).trim()
          if (!newText) return
        } else if (accumulated) {
          const accWords = accumulated.split(/\s+/)
          for (let overlap = Math.min(accWords.length, 8); overlap >= 2; overlap--) {
            const suffix = accWords.slice(-overlap).join(' ')
            if (rawText.startsWith(suffix)) {
              newText = rawText.slice(suffix.length).trim()
              break
            }
          }
          if (!newText) return
        }

        accumulatedSarvamTextRef.current = accumulated
          ? accumulated + ' ' + newText
          : newText

        lastFinalTextRef.current = newText
        fullTranscriptRef.current.push(newText)
        onTranscriptRef.current?.(newText, true)
      }
    } catch (err) {
      console.error('Sarvam STT fetch error:', err)
      chunksRef.current = [...snapshot, ...chunksRef.current]
    }
  }, [])

  /** Start recording with Sarvam AI (MediaRecorder -> REST API). */
  const startSarvamRecording = useCallback(async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { exact: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      chunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        sendChunksToSarvam()
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(500) // 500ms chunks for smooth accumulation

      // Send to Sarvam every 10 seconds — longer chunks = better context
      sarvamIntervalRef.current = setInterval(() => {
        sendChunksToSarvam()
      }, 10000)

      setIsRecording(true)
      isRecordingRef.current = true
      setElapsed(0)
      fullTranscriptRef.current = []
      accumulatedSarvamTextRef.current = ''
      lastFinalTextRef.current = ''

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      if (stream) stream.getTracks().forEach(t => t.stop())
      console.error('Failed to start Sarvam recording:', err)
      setSupported(false)
    }
  }, [sendChunksToSarvam])

  /** Stop Sarvam recording. */
  const stopSarvamRecording = useCallback(() => {
    if (sarvamIntervalRef.current) {
      clearInterval(sarvamIntervalRef.current)
      sarvamIntervalRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    setIsRecording(false)
    isRecordingRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** Start recording with Web Speech API (browser-native). */
  const startBrowserRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    function createAndStart() {
      if (!isRecordingRef.current) return

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = languageRef.current
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        let currentInterim = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0].transcript.trim()
          if (!transcript) continue

          if (result.isFinal) {
            const command = detectCommand(transcript)
            if (command) {
              setLastCommand(command)
              if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
              commandTimeoutRef.current = setTimeout(() => setLastCommand(null), 2000)
              onCommandRef.current?.(command)
              continue
            }
            if (transcript === lastFinalTextRef.current) continue
            lastFinalTextRef.current = transcript
            fullTranscriptRef.current.push(transcript)
            onTranscriptRef.current?.(transcript, true)
          } else {
            currentInterim = transcript
          }
        }
        if (currentInterim) {
          onTranscriptRef.current?.(currentInterim, false)
        }
      }

      recognition.onerror = (event) => {
        const error = event.error
        if (error === 'no-speech' || error === 'aborted') return
        console.error('Speech recognition error:', error)

        if (error === 'not-allowed') {
          setSupported(false)
        }
        // Only kill recording for persistent failures, not transient network errors
        if (error === 'audio-capture' || error === 'service-not-allowed') {
          isRecordingRef.current = false
          setIsRecording(false)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        }
      }

      recognition.onend = () => {
        if (isRecordingRef.current) {
          createAndStart()
        }
      }

      recognitionRef.current = recognition
      try {
        recognition.start()
      } catch (e) {
        console.warn('SpeechRecognition.start() failed:', e)
        isRecordingRef.current = false
        setIsRecording(false)
      }
    }

    setIsRecording(true)
    isRecordingRef.current = true
    setElapsed(0)
    fullTranscriptRef.current = []
    lastFinalTextRef.current = ''

    createAndStart()

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
  }, [])

  /** Stop browser-native recording. */
  const stopBrowserRecording = useCallback(() => {
    if (recognitionRef.current) {
      isRecordingRef.current = false
      setIsRecording(false)
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(() => {
    if (useSarvam) {
      startSarvamRecording()
    } else {
      startBrowserRecording()
    }
  }, [useSarvam, startSarvamRecording, startBrowserRecording])

  const stopRecording = useCallback(() => {
    if (useSarvam) {
      stopSarvamRecording()
    } else {
      stopBrowserRecording()
    }
  }, [useSarvam, stopSarvamRecording, stopBrowserRecording])

  const getFullTranscript = useCallback(() => {
    return fullTranscriptRef.current.join(' ')
  }, [])

  useEffect(() => {
    return () => {
      isRecordingRef.current = false
      if (recognitionRef.current) recognitionRef.current.stop()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (timerRef.current) clearInterval(timerRef.current)
      if (sarvamIntervalRef.current) clearInterval(sarvamIntervalRef.current)
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
    }
  }, [])

  return {
    isRecording,
    elapsed,
    supported,
    startRecording,
    stopRecording,
    getFullTranscript,
    lastCommand,
  }
}
