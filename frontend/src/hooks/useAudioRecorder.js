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

export default function useAudioRecorder(onTranscript, onCommand, language = 'hi-IN') {
  const recognitionRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const isRecordingRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  const [supported, setSupported] = useState(true)
  const fullTranscriptRef = useRef([])
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
    } else {
      setSupported(true)
    }
  }, [])

  /** Start recording with Web Speech API (browser-native). */
  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    /**
     * Factory: build a fresh SpeechRecognition instance and start it.
     * Called once on initial record and again on every auto-restart (onend).
     *
     * ROOT CAUSE OF DUPLICATION: Chrome keeps a live `event.results` list on
     * the SpeechRecognition instance. Calling .start() on the SAME object
     * after onend causes the browser to re-deliver all previously finalized
     * results in the next onresult event — event.resultIndex resets to 0 but
     * the list still contains old entries.
     *
     * Fix: create a new SpeechRecognition instance for every recognition
     * segment. A new instance always has an empty result list.
     */
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
            // Deduplicate: skip if identical to the last emitted final segment
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

        if (['network', 'audio-capture', 'service-not-allowed'].includes(error)) {
          // Don't kill recording for transient network errors — let onend restart
          // Only stop for persistent failures (audio-capture = mic disconnected)
          if (error === 'audio-capture' || error === 'service-not-allowed') {
            isRecordingRef.current = false
            setIsRecording(false)
            if (timerRef.current) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
          }
          // network errors: let onend handler auto-restart via createAndStart()
        }
      }

      // On natural end (silence timeout), create a brand-new instance.
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

  /** Stop recording. */
  const stopRecording = useCallback(() => {
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

  const getFullTranscript = useCallback(() => {
    return fullTranscriptRef.current.join(' ')
  }, [])

  useEffect(() => {
    return () => {
      isRecordingRef.current = false
      if (recognitionRef.current) recognitionRef.current.stop()
      if (timerRef.current) clearInterval(timerRef.current)
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
