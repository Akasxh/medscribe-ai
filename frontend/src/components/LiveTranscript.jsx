import { FileText } from 'lucide-react'
import { useRef, useEffect } from 'react'

export default function LiveTranscript({ transcript, interimText, isRecording }) {
  const hasContent = transcript.length > 0 || interimText
  const scrollRef = useRef(null)

  const wordCount = transcript.join(' ').split(/\s+/).filter(Boolean).length

  // Always auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript.length, interimText])

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

      {/* Transcript body — single flowing paragraph */}
      <div
        ref={scrollRef}
        className="p-4 min-h-[200px] max-h-[420px] overflow-y-auto scroll-smooth"
      >
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Transcript will appear here during recording</p>
            <p className="text-xs mt-1.5 opacity-60">Supports Hindi-English code-mixed speech</p>
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
            {transcript.join(' ')}
            {interimText && (
              <span className="text-slate-400 dark:text-slate-500 italic ml-1">
                {interimText}
              </span>
            )}
            {isRecording && !interimText && transcript.length > 0 && (
              <span className="inline-flex items-center gap-0.5 ml-1.5 align-middle">
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
