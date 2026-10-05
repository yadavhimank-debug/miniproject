export function calculatePasswordStrength(password) {
  let strength = 0
  if (!password) return { score: 0, label: 'None', color: '#5d5952' }
  if (password.length >= 8) strength++
  if (password.length >= 12) strength++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[^a-zA-Z\d]/.test(password)) strength++

  const levels = [
    { score: 0, label: 'Very weak', color: '#d64d4d' },
    { score: 1, label: 'Weak', color: '#e8874d' },
    { score: 2, label: 'Fair', color: '#e8c44d' },
    { score: 3, label: 'Good', color: '#9fc4a0' },
    { score: 4, label: 'Strong', color: '#7bb399' },
    { score: 5, label: 'Very strong', color: '#5ba48e' },
  ]

  return levels[Math.min(strength, levels.length - 1)]
}

export function getRemainingTime(targetTime) {
  const difference = Math.max(0, Number(targetTime) - Date.now())
  const totalSeconds = Math.floor(difference / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    totalSeconds,
    hours,
    minutes,
    seconds,
    formatted: `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
  }
}