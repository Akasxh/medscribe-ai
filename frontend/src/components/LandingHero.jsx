import { Mic, Shield, Globe, Stethoscope, Database, ChevronRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: Globe,
    title: 'Hindi-English Code-Mixed',
    description: 'Speak in any mix of Hindi and English. Our AI understands code-mixed medical conversations.',
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
  },
  {
    icon: Database,
    title: 'FHIR R4 + ABDM Ready',
    description: 'Generates interoperable health records aligned with India\'s Ayushman Bharat Digital Mission.',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    icon: Shield,
    title: 'Clinical Safety Engine',
    description: 'Real-time drug interaction checks, allergy alerts, and dosage validation.',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
]

const trustIndicators = [
  { label: '6 Medical Specialties', icon: Stethoscope },
  { label: '15+ Drug Interaction Rules', icon: Shield },
  { label: 'ICD-10 + SNOMED + LOINC', icon: Database },
  { label: 'AES-256 Encrypted', icon: Shield },
]

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
}

export default function LandingHero({ onStart }) {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50/50 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/20" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 py-10 sm:py-16 lg:py-20">
        {/* Badge */}
        <motion.div
          className="flex justify-center mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm">
            <Sparkles className="w-3 h-3 text-amber-500" />
            HACKMATRIX 2.0 × Jilo Health
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          className="text-center text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white tracking-tight"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          AI-Powered Clinical
          <span className="block mt-1 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Documentation
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          className="mt-4 sm:mt-5 text-center text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Speak naturally with your patient. Get structured clinical notes, FHIR R4 resources,
          and safety alerts&nbsp;&mdash;&nbsp;in real-time.
        </motion.p>

        {/* Feature cards */}
        <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="group relative bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 sm:p-6 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300"
              custom={i}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center mb-3`}>
                <f.icon className={`w-5 h-5 ${f.gradient.includes('violet') ? 'text-violet-600 dark:text-violet-400' : f.gradient.includes('blue') ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">{f.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Trust indicators */}
        <motion.div
          className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {trustIndicators.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
            >
              <item.icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>{item.label}</span>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="mt-8 sm:mt-10 flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <button
            onClick={onStart}
            className="group inline-flex items-center gap-2.5 px-7 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label="Start a new consultation"
          >
            <Mic className="w-5 h-5" />
            Start Consultation
            <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            or try a demo scenario below
          </p>
        </motion.div>
      </div>
    </section>
  )
}
