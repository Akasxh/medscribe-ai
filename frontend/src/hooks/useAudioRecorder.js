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
  // In dev mode Vite proxies /api to the backend; in prod it's same-origin.
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
  // For Sarvam dedup: track the FULL accumulated text seen so far (not just the
  // last stripped chunk), so full-history repeats from Sarvam are detected.
  const accumulatedSarvamTextRef = useRef('')
  const lastFinalTextRef = useRef('')
  const lastProcessedIndexRef = useRef(0)
  // Rolling window of the last 20 normalised final segments already sent.
  // Used to catch duplicates that arrive after a Web Speech API restart
  // (onend resets resultIndex to 0, making old results look new again).
  const recentFinalsRef = useRef(/** @type {string[]} */ ([]))
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
      // Sarvam mode uses MediaRecorder — check for it
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        setSupported(false)
      } else {
        setSupported(true)
      }
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        setSupported(false)
      } else {
        setSupported(true)
      }
    }
  }, [useSarvam])

  /** Send accumulated audio chunks to Sarvam API. */
  const sendChunksToSarvam = useCallback(async () => {
    if (chunksRef.current.length === 0) return

    // Drain the buffer atomically: snapshot and clear before await so that new
    // ondataavailable events during the fetch go into a fresh array and are not
    // included in this blob (prevents double-send on the next call).
    const snapshot = chunksRef.current
    chunksRef.current = []

    const blob = new Blob(snapshot, { type: 'audio/webm' })
    if (blob.size < 1000) return // Skip tiny/empty chunks

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
        // On failure restore the chunks so they can be retried on next interval/stop
        chunksRef.current = [...snapshot, ...chunksRef.current]
        return
      }
      const data = await res.json()
      if (data.transcript && data.transcript.trim()) {
        const rawText = data.transcript.trim()

        // Check for voice commands first
        const command = detectCommand(rawText)
        if (command) {
          setLastCommand(command)
          if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
          commandTimeoutRef.current = setTimeout(() => setLastCommand(null), 2000)
          onCommandRef.current?.(command)
          return
        }

        // --- Deduplication ---
        // Sarvam sometimes returns the FULL transcript from the start of the
        // recording, not just the new segment.  We track the entire accumulated
        // text we have already emitted (`accumulatedSarvamTextRef`) and strip any
        // leading prefix that matches it before forwarding new text.
        const accumulated = accumulatedSarvamTextRef.current

        // 1. Exact duplicate of everything we have seen — skip entirely.
        if (rawText === accumulated) return

        let newText = rawText

        // 2. The new response starts with the full accumulated text (full-history
        //    repeat from Sarvam).  Strip the known prefix.
        if (accumulated && rawText.startsWith(accumulated)) {
          newText = rawText.slice(accumulated.length).trim()
          if (!newText) return
        } else if (accumulated) {
          // 3. Partial word-boundary overlap at the seam (normal chunk boundary).
          //    Only look at the tail of `accumulated` vs the head of `rawText`.
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

        // Update accumulated to the full rawText (not just the delta), so that
        // next chunk can always compare against the full known history.
        accumulatedSarvamTextRef.current = accumulated
          ? accumulated + ' ' + newText
          : newText

        lastFinalTextRef.current = newText
        fullTranscriptRef.current.push(newText)
        onTranscriptRef.current?.(newText, true)
      }
    } catch (err) {
      console.error('Sarvam STT fetch error:', err)
      // Restore chunks on network error so the next attempt can retry them
      chunksRef.current = [...snapshot, ...chunksRef.current]
    }
  }, []) // No deps — all external values accessed via stable refs

  /** Start recording with Sarvam AI (MediaRecorder -> REST API). */
  const startSarvamRecording = useCallback(async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
        // Send any remaining chunks accumulated after the last interval tick.
        // clearInterval() in stopSarvamRecording fires before .stop(), so the
        // interval is already dead here — no double-send risk.
        sendChunksToSarvam()
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // Collect 1s chunks

      // Send to Sarvam every 5 seconds
      sarvamIntervalRef.current = setInterval(() => {
        sendChunksToSarvam()
      }, 5000)

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
      // Stop media stream tracks to release the microphone
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
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

    /**
     * Factory: build a fresh SpeechRecognition instance and start it.
     * Called once on initial record and again on every auto-restart (onend).
     *
     * ROOT CAUSE OF DUPLICATION: Chrome keeps a live `event.results` list on
     * the SpeechRecognition instance. Calling .start() on the SAME object
     * after onend causes the browser to re-deliver all previously finalized
     * results in the next onresult event — event.resultIndex resets to 0 but
     * the list still contains old entries. Resetting lastProcessedIndexRef to 0
     * in onend made the guard completely ineffective: every prior final result
     * was re-iterated, and only the very last one was caught by the exact-match
     * dedup. The rolling-window dedup (recentFinalsRef) helped but is bounded
     * at 20 entries — sessions with > 20 distinct finals still leak duplicates.
     *
     * Fix: create a new SpeechRecognition instance for every recognition
     * segment. A new instance always has an empty result list, so
     * event.resultIndex=0 truly means "first result of this segment."
     */
    function createAndStart() {
      if (!isRecordingRef.current) return

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = languageRef.current
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        // Fresh instance — event.resultIndex is the correct lower bound.
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
          isRecordingRef.current = false
        }
      }

      // On natural end (silence timeout), create a brand-new instance.
      // NEVER call .start() on the old object — that causes the duplication.
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
      }
    }

    setIsRecording(true)
    isRecordingRef.current = true
    setElapsed(0)
    fullTranscriptRef.current = []
    lastFinalTextRef.current = ''
    lastProcessedIndexRef.current = 0

    createAndStart()

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
  }, []) // No deps — all external values accessed via stable refs

  /** Stop browser-native recording. */
  const stopBrowserRecording = useCallback(() => {
    isRecordingRef.current = false
    setIsRecording(false)
    if (recognitionRef.current) {
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
      isRecordingRef.current = false  // Prevent onend from restarting
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
