import { FlaskConical } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'

const DEMO_CONVERSATIONS = [
  {
    emoji: '\ud83e\udd12',
    short: 'Viral Fever',
    name: 'Viral Fever (Hindi-English)',
    segments: [
      { text: 'Doctor sahab, mujhe 3 din se bukhar aa raha hai', delay: 0 },
      { text: 'temperature 101 degree tha kal raat', delay: 2000 },
      { text: 'saath mein sar dard bhi hai aur badan mein dard hai', delay: 4000 },
      { text: 'khansi bhi thodi thodi aa rahi hai, gala bhi kharab hai', delay: 6000 },
      { text: 'Patient ka naam Ajay Sharma hai, male, age 28 years', delay: 8000 },
      { text: 'Achha, aapko koi allergy hai kisi medicine se?', delay: 10000 },
      { text: 'Haan doctor, mujhe sulfa drugs se allergy hai, rashes aa jaate hain', delay: 12000 },
      { text: 'aur kabhi kabhi penicillin se bhi problem hoti hai', delay: 14000 },
      { text: 'Theek hai, BP check karte hain — 120 by 80, normal hai', delay: 16000 },
      { text: 'SpO2 97 percent hai, respiratory rate 18', delay: 18000 },
      { text: 'Throat examination mein pharyngeal congestion hai', delay: 20000 },
      { text: 'Main aapko Dolo 650 de raha hoon din mein teen baar khana khane ke baad', delay: 22000 },
      { text: 'Azithral 500 ek baar daily 3 din ke liye', delay: 24500 },
      { text: 'aur Montair LC raat ko ek goli, 5 din tak, khansi ke liye', delay: 27000 },
      { text: 'Zyma D bhi ek hafta lein, immunity ke liye', delay: 29000 },
      { text: 'Zyada paani piyen, rest karein, aur garam paani ke gargle karein', delay: 31000 },
      { text: 'CBC test karwa lein agar 3 din mein bukhar na utre', delay: 33000 },
      { text: 'Dengue ka season hai, toh platelet count bhi check karwayenge', delay: 35000 },
      { text: 'Agar 3 din mein theek na ho toh wapas aayen, tab Dengue NS1 test karenge', delay: 37500 },
    ],
  },
  {
    emoji: '\ud83d\udc8a',
    short: 'Diabetes',
    name: 'Diabetes Follow-up',
    segments: [
      { text: 'Patient Ramesh Kumar, male, age 52 years', delay: 0 },
      { text: 'aaj follow up visit hai, diabetes type 2 ke liye', delay: 2000 },
      { text: 'yeh 3 saal se diabetic hain, metformin chal rahi hai', delay: 4000 },
      { text: 'fasting sugar 180 aaya hai aur HbA1c 8.2 percent hai', delay: 6500 },
      { text: 'post prandial sugar 260 tha last week', delay: 8500 },
      { text: 'weight 82 kg hai, height 170 cm, BMI 28.4 — overweight category', delay: 10500 },
      { text: 'BP 140 by 90 hai, pulse 78 regular', delay: 12500 },
      { text: 'patient ko pair mein tingling ho rahi hai, dono pair mein', delay: 14500 },
      { text: 'aur ankhen bhi thodi blurry lagti hain kabhi kabhi', delay: 16500 },
      { text: 'yeh early diabetic neuropathy aur possible retinopathy ke signs hain', delay: 18500 },
      { text: 'Glycomet 500 dose badha ke 1000mg kar raha hoon twice daily', delay: 20500 },
      { text: 'Jalra 50mg add kar raha hoon, DPP-4 inhibitor, ek baar subah', delay: 22500 },
      { text: 'Telma 40 bhi add kar raha hoon BP ke liye, subah khali pet', delay: 24500 },
      { text: 'Methylcobalamin 1500mcg daily dein, neuropathy ke liye zaroori hai', delay: 26500 },
      { text: 'aur Shelcal 500 ek goli daily raat ko', delay: 28500 },
      { text: 'Fundoscopy karwana hai ophthalmologist se, ankh ki retina check ke liye', delay: 30500 },
      { text: 'HbA1c repeat karenge 3 mahine baad, target 7 se neeche laana hai', delay: 32500 },
      { text: 'Kidney function test — serum creatinine aur urine microalbumin bhi karwayein', delay: 34500 },
      { text: 'diet control karein, refined sugar band, aur 30 minute daily brisk walk karein', delay: 36500 },
      { text: 'ek mahine baad fasting sugar aur blood test karwake aana hai', delay: 38500 },
    ],
  },
  {
    emoji: '\u2764\ufe0f',
    short: 'Cardiac',
    name: 'Cardiac + Safety Alerts',
    description: 'Triggers CDS drug interaction alerts',
    segments: [
      { text: 'Patient Sunita Devi, female, age 58 years', delay: 0 },
      { text: 'chest mein halka dard hai left side mein, aur sans lene mein taklif', delay: 2500 },
      { text: 'yeh dard kal shaam se hai, chalte waqt zyada hota hai', delay: 5000 },
      { text: 'BP 150 by 95 hai, pulse 92 irregular, SpO2 94 percent', delay: 7500 },
      { text: 'weight 75 kg hai, height 158 cm', delay: 9500 },
      { text: 'patient ko penicillin se allergy hai, rashes aur swelling aati hai', delay: 11500 },
      { text: 'family history mein father ko heart attack hua tha 60 saal mein', delay: 13500 },
      { text: 'pehle se Ecosprin 75 chal rahi hai daily, blood thinner ke liye', delay: 15500 },
      { text: 'Atorva 20 bhi le rahi hain cholesterol ke liye', delay: 17500 },
      { text: 'ghutne mein bhi bahut dard hai toh Combiflam bhi de do teen din ke liye', delay: 19500 },
      { text: 'yeh important hai — Ecosprin ke saath Combiflam interaction hoga, NSAID hai dono', delay: 21500 },
      { text: 'lekin pain bahut hai toh short course de rahe hain, patient ko monitor karein', delay: 23500 },
      { text: 'infection bhi lag raha hai throat mein, toh Augmentin 625 dete hain teen din', delay: 25500 },
      { text: 'aur Pan-D ek goli subah khali pet, acidity ke liye', delay: 27500 },
      { text: 'ECG stat karwao, aur Troponin I test bhi, chest pain rule out ke liye', delay: 29500 },
      { text: 'blood test karwao CBC, lipid profile, aur thyroid profile', delay: 31500 },
      { text: '2D Echo bhi schedule karo is hafte mein', delay: 33500 },
      { text: 'Sorbitrate 5mg sublingual dena agar chest pain aaye toh emergency mein', delay: 35500 },
      { text: 'ek hafte baad follow up karein, reports lekar aayein', delay: 37500 },
    ],
  },
  {
    emoji: '\ud83d\udcf1',
    short: 'Telemedicine',
    name: 'Telemedicine Rural Visit',
    description: 'Rural telemedicine consultation',
    segments: [
      { text: 'Namaste doctor sahab, main Rampur se bol raha hoon', delay: 0 },
      { text: 'Meri maa ka haal theek nahi hai, unki umar 65 saal hai', delay: 2000 },
      { text: 'Patient ki age 65 years hai, female, naam Savitri Devi', delay: 3500 },
      { text: 'Unko pichle ek hafte se sans lene mein bahut takleef ho rahi hai', delay: 5500 },
      { text: 'Aur pair mein sujan bhi aa gayi hai, dono pair', delay: 7500 },
      { text: 'BP check karaya tha kal, 160 by 100 tha', delay: 9000 },
      { text: 'Pehle se Telma 40 chal rahi hai, aur sugar ki Glycomet 500', delay: 11000 },
      { text: 'Sugar fasting 180 aaya tha last week', delay: 13000 },
      { text: 'Dekhiye, BP kaafi high hai aur breathlessness ke saath pedal edema', delay: 14500 },
      { text: 'Yeh congestive heart failure ke symptoms ho sakte hain', delay: 16500 },
      { text: 'Main Telma 40 ko Telma 80 kar raha hoon, subah ek baar', delay: 18500 },
      { text: 'Aur Lasix 40mg add kar raha hoon, subah khali pet, pair ki sujan ke liye', delay: 20500 },
      { text: 'Glycomet 500 continue karein, lekin diet control zaroori hai', delay: 22500 },
      { text: 'ECG aur 2D Echo karwana zaroori hai, nearest city hospital mein', delay: 24500 },
      { text: 'Kidney function test bhi karwa lein, creatinine aur BUN', delay: 26500 },
      { text: 'Aur Ecosprin 75mg raat ko dein, blood thinner ke liye', delay: 28500 },
      { text: 'Namak bilkul kam kar dein, pani bhi limit mein rakhein', delay: 30500 },
      { text: 'Do din baad video call pe wapas baat karte hain', delay: 32500 },
      { text: 'Agar sans ki takleef badhe toh turant hospital le jaayein, emergency hai', delay: 34500 },
    ],
  },
]

export default function DemoMode({ onTranscript, isRecording }) {
  const [playing, setPlaying] = useState(false)
  const [currentDemo, setCurrentDemo] = useState(null)
  const [currentSegment, setCurrentSegment] = useState(0)
  const [totalSegments, setTotalSegments] = useState(0)
  const [collapsed, setCollapsed] = useState(true)
  const timeoutIdsRef = useRef([])

  const clearAllTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout)
    timeoutIdsRef.current = []
  }, [])

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => clearAllTimeouts()
  }, [clearAllTimeouts])

  const playDemo = (demo) => {
    if (playing || isRecording) return

    // Clear any leftover timeouts from a previous demo
    clearAllTimeouts()

    setPlaying(true)
    setCurrentDemo(demo.name)
    setTotalSegments(demo.segments.length)
    setCurrentSegment(0)

    demo.segments.forEach((seg, i) => {
      const outerTimeout = setTimeout(() => {
        setCurrentSegment(i + 1)
        onTranscript(seg.text, false) // interim first
        const innerTimeout = setTimeout(() => {
          onTranscript(seg.text, true) // then final
          if (i === demo.segments.length - 1) {
            setPlaying(false)
            setCurrentDemo(null)
            setCurrentSegment(0)
            setTotalSegments(0)
          }
        }, 800)
        timeoutIdsRef.current.push(innerTimeout)
      }, seg.delay)
      timeoutIdsRef.current.push(outerTimeout)
    })
  }

  const progressPercent = totalSegments > 0 ? (currentSegment / totalSegments) * 100 : 0

  return (
    <div className="overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2.5 min-h-[48px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors rounded"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 sm:w-3 sm:h-3 text-indigo-500" />
          <span className="text-sm sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Demo Scenarios {collapsed ? '\u25B8' : '\u25BE'}
          </span>
          {playing && (
            <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
              Playing {currentSegment}/{totalSegments}
            </span>
          )}
        </div>
      </button>

      {/* Progress bar — visible during playback */}
      {playing && (
        <div className="mx-2 h-[3px] rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Demo pills */}
      {!collapsed && (
        <div className="px-3 pb-3 pt-2 flex items-center gap-2 flex-wrap">
          {DEMO_CONVERSATIONS.map((demo) => {
            const isActive = playing && currentDemo === demo.name
            const isDisabled = (playing || isRecording) && !isActive
            return (
              <button
                key={demo.name}
                onClick={() => playDemo(demo)}
                disabled={isDisabled}
                title={demo.description || demo.name}
                className={`
                  inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[48px] rounded-full text-sm sm:text-[11px] font-medium transition-all
                  ${isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:bg-slate-300 dark:active:bg-slate-500'
                  }
                  ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <span className="text-base sm:text-xs">{demo.emoji}</span>
                <span>{demo.short}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
