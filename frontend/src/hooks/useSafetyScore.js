import { useMemo } from 'react'

/**
 * Computes a patient safety score (0-100) from CDS alerts, FHIR quality, and clinical note data.
 *
 * @param {Array} cdsAlerts - Array of CDS alert objects with { severity: 'critical'|'warning'|'info', ... }
 * @param {Object|null} fhirQuality - FHIR quality object with { grade: 'A'|'B'|'C'|'D', score: number }
 * @param {Object|null} clinicalNote - Clinical note object with { allergies, medications, ... }
 * @returns {{ score: number, level: string, breakdown: Array<{label: string, delta: number}> }}
 */
export default function useSafetyScore(cdsAlerts = [], fhirQuality = null, clinicalNote = null) {
  return useMemo(() => {
    let score = 100
    const breakdown = []

    // CDS alert deductions
    const criticalAlerts = cdsAlerts.filter(a => a.severity === 'critical')
    const warningAlerts = cdsAlerts.filter(a => a.severity === 'warning')
    const infoAlerts = cdsAlerts.filter(a => a.severity === 'info')

    if (criticalAlerts.length > 0) {
      const deduction = criticalAlerts.length * 30
      score -= deduction
      breakdown.push({
        label: `${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? 's' : ''}`,
        delta: -deduction,
      })
    }

    if (warningAlerts.length > 0) {
      const deduction = warningAlerts.length * 15
      score -= deduction
      breakdown.push({
        label: `${warningAlerts.length} warning alert${warningAlerts.length > 1 ? 's' : ''}`,
        delta: -deduction,
      })
    }

    if (infoAlerts.length > 0) {
      const deduction = infoAlerts.length * 5
      score -= deduction
      breakdown.push({
        label: `${infoAlerts.length} info alert${infoAlerts.length > 1 ? 's' : ''}`,
        delta: -deduction,
      })
    }

    // Allergy documentation check
    if (clinicalNote) {
      const hasAllergies = clinicalNote.allergies?.length > 0 && clinicalNote.allergies.some(a => a)
      const hasMedications = clinicalNote.medications?.length > 0
      const hasAllergyAlert = cdsAlerts.some(a =>
        a.type === 'allergy_contraindication' || /allergy/i.test(a.title || '')
      )

      if (hasAllergies && !hasAllergyAlert && hasMedications) {
        // Allergies documented but no cross-check alert generated — could indicate missing validation
        // Only deduct if there are medications that could interact
        score -= 10
        breakdown.push({
          label: 'Allergies documented without cross-check',
          delta: -10,
        })
      }
    }

    // FHIR quality deductions
    if (fhirQuality) {
      const grade = fhirQuality.grade?.toUpperCase()
      if (grade === 'C') {
        score -= 5
        breakdown.push({ label: 'FHIR quality grade C', delta: -5 })
      } else if (grade === 'D') {
        score -= 10
        breakdown.push({ label: 'FHIR quality grade D', delta: -10 })
      } else if (grade === 'A' || grade === 'B') {
        breakdown.push({ label: `FHIR quality grade ${grade}`, delta: 0 })
      }
    }

    // Clamp
    score = Math.max(0, Math.min(100, score))

    // Determine level
    let level
    if (score >= 90) level = 'safe'
    else if (score >= 70) level = 'caution'
    else if (score >= 40) level = 'warning'
    else level = 'critical'

    return { score, level, breakdown }
  }, [cdsAlerts, fhirQuality, clinicalNote])
}
