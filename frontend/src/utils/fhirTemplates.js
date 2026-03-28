// Professional muted color system for FHIR resources
export const RESOURCE_COLORS = {
  Patient: {
    bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600 dark:text-slate-300',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300', accent: 'border-l-slate-500',
  },
  Encounter: {
    bg: 'bg-blue-50/60', border: 'border-blue-200', text: 'text-blue-600 dark:text-blue-300',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', accent: 'border-l-blue-500',
  },
  Condition: {
    bg: 'bg-amber-50/60', border: 'border-amber-200', text: 'text-amber-600 dark:text-amber-300',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', accent: 'border-l-amber-500',
  },
  Observation: {
    bg: 'bg-emerald-50/60', border: 'border-emerald-200', text: 'text-emerald-600 dark:text-emerald-300',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', accent: 'border-l-emerald-500',
  },
  MedicationRequest: {
    bg: 'bg-rose-50/60', border: 'border-rose-200', text: 'text-rose-600 dark:text-rose-300',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', accent: 'border-l-rose-500',
  },
  AllergyIntolerance: {
    bg: 'bg-orange-50/60', border: 'border-orange-200', text: 'text-orange-600 dark:text-orange-300',
    badge: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', accent: 'border-l-orange-500',
  },
  CarePlan: {
    bg: 'bg-teal-50/60', border: 'border-teal-200', text: 'text-teal-600 dark:text-teal-300',
    badge: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', accent: 'border-l-teal-500',
  },
  ServiceRequest: {
    bg: 'bg-cyan-50/60', border: 'border-cyan-200', text: 'text-cyan-600 dark:text-cyan-300',
    badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300', accent: 'border-l-cyan-500',
  },
  DetectedIssue: {
    bg: 'bg-red-50/60', border: 'border-red-200', text: 'text-red-600 dark:text-red-300',
    badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', accent: 'border-l-red-500',
  },
}

export function getResourceSummary(resource) {
  const type = resource.resourceType
  switch (type) {
    case 'Patient': {
      const name = resource.name?.[0]?.text || 'Unknown Patient'
      const gender = resource.gender || 'unknown'
      const age = resource.extension?.find(e => e.url?.includes('age'))?.valueString || ''
      return `${name} | ${gender}${age ? ` | ${age}` : ''}`
    }
    case 'Encounter':
      return `${resource.class?.display || 'Consultation'} | ${resource.status}`
    case 'Condition':
      return `${resource.code?.text || 'Unknown'} | ${resource.code?.coding?.[0]?.code || ''} | ${resource.verificationStatus?.coding?.[0]?.code || ''}`
    case 'Observation': {
      const cat = resource.category?.[0]?.coding?.[0]?.code
      const text = resource.code?.text || resource.valueString || ''
      const value = resource.valueString || ''
      return cat === 'vital-signs' ? `${text}: ${value}` : text
    }
    case 'MedicationRequest':
      return `${resource.medicationCodeableConcept?.text || ''} | ${resource.dosageInstruction?.[0]?.text || ''}`
    case 'AllergyIntolerance':
      return resource.code?.text || 'Unknown allergy'
    case 'CarePlan':
      return `${resource.title || 'Care Plan'} | ${resource.activity?.length || 0} activities`
    case 'ServiceRequest':
      return resource.code?.text || 'Diagnostic test'
    case 'DetectedIssue':
      return `${resource.severity?.toUpperCase() || 'ALERT'}: ${resource.code?.text || 'Clinical issue'}`
    default:
      return type
  }
}

export function getResourceIcon(type) {
  const icons = {
    Patient: 'User',
    Encounter: 'Stethoscope',
    Condition: 'AlertTriangle',
    Observation: 'Activity',
    MedicationRequest: 'Pill',
    AllergyIntolerance: 'ShieldAlert',
    CarePlan: 'CalendarCheck',
    ServiceRequest: 'FlaskConical',
    DetectedIssue: 'AlertTriangle',
  }
  return icons[type] || 'FileJson'
}
