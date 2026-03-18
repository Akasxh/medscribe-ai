import { useMemo } from 'react'
import { Mic, MicOff, Square, Loader2 } from 'lucide-react'
import { formatTime } from '../utils/formatters'

function WaveformBars() {
  const barDurations = useMemo(
    () => Array.from({ length: 8 }, (_, i) => 0.4 + (i * 0.09) % 0.4),
    []
  )
  return (
    <div className="flex items-center justify-center gap-[4px] h-8 px-4 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40">
      {barDurations.map((duration, i) => (
        <div
          key={i}
          className="w-[2px] bg-red-400 dark:bg-red-400 rounded-full waveform-bar"
          style={{
            animationDelay: `${i * 0.12}s`,
            animationDuration: `${duration}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function RecordButton({ isRecording, elapsed, supported, processing, onStart, onStop }) {
  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 sm:py-6">
        <div className="w-[80px] h-[80px] sm:w-[72px] sm:h-[72px] rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <MicOff className="w-8 h-8 sm:w-7 sm:h-7 text-slate-400" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
          Speech recognition is not supported in this browser. Please use Chrome or Edge.
        </p>
      </div>
    )
  }

  if (processing) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 sm:py-6">
        <div className="w-[80px] h-[80px] sm:w-[72px] sm:h-[72px] rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Loader2 className="w-8 h-8 sm:w-7 sm:h-7 text-blue-600 animate-spin" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Processing...
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 py-4 sm:py-6">
      {/* LIVE indicator + timer */}
      {isRecording && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Live</span>
          </div>
          <span className="text-xl font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums tracking-wide">
            {formatTime(elapsed)}
          </span>
        </div>
      )}

      {/* Main button */}
      <button
        onClick={isRecording ? onStop : onStart}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        role="switch"
        aria-checked={isRecording}
        className={`
          relative w-[80px] h-[80px] sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center transition-all duration-300
          ${isRecording
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-95'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-600/30'
          }
          cursor-pointer
        `}
      >
        {isRecording ? (
          <Square className="w-6 h-6 fill-current" />
        ) : (
          <Mic className="w-7 h-7" />
        )}

        {/* Single clean pulse ring when recording */}
        {isRecording && (
          <span className="absolute -inset-1.5 rounded-full border-2 border-red-400/40 animate-pulse-ring" />
        )}
      </button>

      {/* Waveform visualization */}
      {isRecording && <WaveformBars />}

      {/* Action hint */}
      <p className="text-sm sm:text-xs text-slate-400 dark:text-slate-500 font-medium">
        {isRecording ? 'Tap to stop' : 'Tap to start recording'}
      </p>

      {/* Language pills */}
      {!isRecording && (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
            HI
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/60 text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
            EN
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Code-mixed support</span>
        </div>
      )}
    </div>
  )
}
