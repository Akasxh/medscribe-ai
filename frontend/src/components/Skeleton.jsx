export function SkeletonLine({ className = '' }) {
  return (
    <div className={`h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${className}`} />
  )
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card p-4 space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} className={i === 0 ? 'w-1/3' : i === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  )
}

export default SkeletonCard
