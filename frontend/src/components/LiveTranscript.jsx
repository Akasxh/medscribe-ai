import { FileText, ChevronDown } from 'lucide-react'
import { useRef, useEffect, useState, useCallback } from 'react'
import { formatTime } from '../utils/formatters'

export default function LiveTranscript({ transcript, interimText, isRecording }) {
  const hasContent = transcript.length > 0 || interimText
  const scrollRef = useRef(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const startTimeRef = useRef(null)
  const segmentTimesRef = useRef([])

  // Track when segments arrive for timestamps
  useEffect(() => {
    if (transcript.length === 1 && !startTimeRef.current) {
      startTimeRef.current = Date.now()
      segmentTimesRef.current = [0]
    } else if (transcript.length > segmentTimesRef.current.length && startTimeRef.current) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      segmentTimesRef.current.push(elapsed)
    }
  }, [transcript.length])

  // Reset on clear
  useEffect(() => {
    if (transcript.length === 0) {
      startTimeRef.current = null
      segmentTimesRef.current = []
      setUserScrolled(false)
    }
  }, [transcript.length])

  // Auto-scroll unless user has scrolled up
  useEffect(() => {
    if (scrollRef.current && !userScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript.length, interimText, userScrolled])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40
    setUserScrolled(!isAtBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      setUserScrolled(false)
    }
  }, [])

  const wordCount = transcript.join(' ').split(/\s+/).filter(Boolean).length

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-sm text-slate-800 dark:text-white">Live Transcript</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {wordCount} words
            </span>
          )}
          {isRecording && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wider">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Transcript body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative p-4 min-h-[140px] max-h-[420px] overflow-y-auto scroll-smooth"
      >
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Transcript will appear here during recording</p>
            <p className="text-xs mt-1.5 opacity-60">Supports Hindi-English code-mixed speech</p>
          </div>
        ) : (
          <div className="space-y-0">
            {transcript.map((line, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 py-2.5 animate-fade-in ${
                  i < transcript.length - 1 ? 'border-b border-slate-50 dark:border-slate-700/50' : ''
                }`}
              >
                <div className="w-0.5 self-stretch bg-blue-400 dark:bg-blue-500 rounded-full flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
                  {line}
                </p>
                <span className="text-[10px] text-slate-300 dark:text-slate-600 tabular-nums flex-shrink-0 mt-0.5 font-mono">
                  {formatTime(segmentTimesRef.current[i] ?? 0)}
                </span>
              </div>
            ))}

            {/* Interim text with typing indicator */}
            {interimText && (
              <div className="flex items-start gap-3 py-2.5">
                <div className="w-0.5 self-stretch bg-slate-200 dark:bg-slate-600 rounded-full flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-slate-400 dark:text-slate-500 italic leading-relaxed">
                    {interimText}
                  </p>
                </div>
              </div>
            )}

            {/* Typing dots when recording but no interim */}
            {isRecording && !interimText && (
              <div className="flex items-center gap-3 py-2.5">
                <div className="w-0.5 h-4 bg-slate-200 dark:bg-slate-600 rounded-full flex-shrink-0" />
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scroll to bottom FAB */}
        {userScrolled && hasContent && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-md text-xs text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors z-10"
          >
            <ChevronDown className="w-3 h-3" />
            Latest
          </button>
        )}
      </div>

      {/* Footer stats */}
      {hasContent && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex justify-between text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
          <span>{transcript.length} segment{transcript.length !== 1 ? 's' : ''}</span>
          <span>{wordCount} words</span>
        </div>
      )}
    </div>
  )
}
