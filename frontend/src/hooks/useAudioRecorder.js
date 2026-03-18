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

export default function useAudioRecorder(onTranscript, onCommand) {
  const recognitionRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const isRecordingRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  const [supported, setSupported] = useState(true)
  const fullTranscriptRef = useRef([])
  const [lastCommand, setLastCommand] = useState(null)
  const commandTimeoutRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
    }
  }, [])

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'hi-IN' // Hindi with English code-mixing support
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          // Check for voice commands before forwarding
          const command = detectCommand(transcript)
          if (command) {
            setLastCommand(command)
            // Clear command indicator after 2s
            if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
            commandTimeoutRef.current = setTimeout(() => setLastCommand(null), 2000)
            onCommand?.(command)
            // Don't send command text as transcript
            continue
          }
          fullTranscriptRef.current.push(transcript)
          onTranscript?.(transcript, true)
        } else {
          interim += transcript
        }
      }
      if (interim) {
        onTranscript?.(interim, false)
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

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
  }, [onTranscript, onCommand])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      isRecordingRef.current = false
      setIsRecording(false) // Set first so onend doesn't restart
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
