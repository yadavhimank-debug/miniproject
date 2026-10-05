import { describe, expect, it } from 'vitest'
import { calculatePasswordStrength, getRemainingTime } from './auth-utils.js'

describe('calculatePasswordStrength', () => {
  it('returns no strength for an empty password', () => {
    expect(calculatePasswordStrength('')).toMatchObject({ score: 0, label: 'None' })
  })

  it('scores longer mixed-character passwords more strongly', () => {
    expect(calculatePasswordStrength('StrongPass123!').score).toBeGreaterThan(3)
  })
})

describe('getRemainingTime', () => {
  it('calculates a countdown from a future timestamp', () => {
    const deadline = Date.now() + 1000 * 60 * 90 + 1000 * 11
    const remaining = getRemainingTime(deadline)

    expect(remaining.minutes).toBeGreaterThanOrEqual(0)
    expect(remaining.seconds).toBeGreaterThanOrEqual(0)
    expect(remaining.totalSeconds).toBeGreaterThan(0)
  })

  it('clamps an elapsed auction to zero', () => {
    expect(getRemainingTime(Date.now() - 1000).totalSeconds).toBe(0)
  })
})
