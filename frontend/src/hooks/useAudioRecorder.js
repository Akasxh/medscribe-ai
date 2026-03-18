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
  const lastFinalTextRef = useRef('')
  const lastProcessedIndexRef = useRef(0)
  const [lastCommand, setLastCommand] = useState(null)
  const commandTimeoutRef = useRef(null)

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

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    chunksRef.current = []

    if (blob.size < 1000) return // Skip tiny chunks

    const formData = new FormData()
    formData.append('file', blob, 'audio.webm')
    formData.append('language', language)

    try {
      const res = await fetch(getTranscribeUrl(), {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.transcript && data.transcript.trim()) {
        let text = data.transcript.trim()
        // Check for voice commands
        const command = detectCommand(text)
        if (command) {
          setLastCommand(command)
          if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
          commandTimeoutRef.current = setTimeout(() => setLastCommand(null), 2000)
          onCommand?.(command)
          return
        }
        // Deduplicate: skip if identical to last final text
        if (text === lastFinalTextRef.current) return
        // Strip overlapping prefix: if the new text starts with the end of the last text,
        // remove the overlapping portion to avoid repeated words from chunk boundaries
        if (lastFinalTextRef.current) {
          const lastWords = lastFinalTextRef.current.split(/\s+/)
          // Check overlap of up to 8 words (typical chunk boundary overlap)
          for (let overlap = Math.min(lastWords.length, 8); overlap >= 2; overlap--) {
            const suffix = lastWords.slice(-overlap).join(' ')
            if (text.startsWith(suffix)) {
              text = text.slice(suffix.length).trim()
              break
            }
          }
          if (!text) return // Entire text was overlap
        }
        lastFinalTextRef.current = text
        fullTranscriptRef.current.push(text)
        onTranscript?.(text, true)
      }
    } catch (err) {
      console.error('Sarvam STT fetch error:', err)
    }
  }, [language, onTranscript, onCommand])

  /** Start recording with Sarvam AI (MediaRecorder -> REST API). */
  const startSarvamRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
        // Send any remaining chunks
        sendChunksToSarvam()
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // Collect 1s chunks

      // Send to Sarvam every 5 seconds
      sarvamIntervalRef.current = setInterval(() => {
        if (chunksRef.current.length > 0) {
          sendChunksToSarvam()
        }
      }, 5000)

      setIsRecording(true)
      isRecordingRef.current = true
      setElapsed(0)
      fullTranscriptRef.current = []
      lastFinalTextRef.current = ''

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    } catch (err) {
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

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      // Start from the greater of event.resultIndex or our last processed index
      // to avoid re-processing already-finalized results on browsers that reset resultIndex
      const startIdx = Math.max(event.resultIndex, lastProcessedIndexRef.current)
      let currentInterim = ''

      for (let i = startIdx; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0].transcript.trim()
        if (!transcript) continue

        if (result.isFinal) {
          // Advance the processed index past this finalized result
          lastProcessedIndexRef.current = i + 1

          // Check for voice commands before forwarding
          const command = detectCommand(transcript)
          if (command) {
            setLastCommand(command)
            if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
            commandTimeoutRef.current = setTimeout(() => setLastCommand(null), 2000)
            onCommand?.(command)
            continue
          }
          // Deduplicate: skip if identical to last final text
          if (transcript === lastFinalTextRef.current) continue
          lastFinalTextRef.current = transcript
          fullTranscriptRef.current.push(transcript)
          onTranscript?.(transcript, true)
        } else {
          // Only capture the current interim (the one being spoken right now)
          currentInterim = transcript
        }
      }
      if (currentInterim) {
        onTranscript?.(currentInterim, false)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return // Ignore no-speech errors
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        setSupported(false)
      }
    }

    // Auto-restart on end (browser stops after silence)
    recognition.onend = () => {
      if (isRecordingRef.current && recognitionRef.current) {
        // Reset processed index — new recognition session starts fresh results
        lastProcessedIndexRef.current = 0
        try {
          recognitionRef.current.start()
        } catch (e) {
          // Already started
        }
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    isRecordingRef.current = true
    setElapsed(0)
    fullTranscriptRef.current = []
    lastFinalTextRef.current = ''
    lastProcessedIndexRef.current = 0

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
  }, [onTranscript, onCommand, language])

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
