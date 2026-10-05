export const VALID_USER = {
  email: 'admin@bidboard.com',
  password: 'Bidboard@2026',
  name: 'Himank Yadav',
  initials: 'HY',
  emailVerified: true,
}

export const generateVerificationCode = () => String(Math.floor(100000 + Math.random() * 900000))

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

  return levels[Math.min(strength, 5)]
}

export function changePassword({ email, currentPassword, newPassword }, existingUsers = getUsersFromStorage()) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const cleanedCurrent = String(currentPassword || '').trim()
  const cleanedNew = String(newPassword || '').trim()

  if (!normalizedEmail || !cleanedCurrent || !cleanedNew) {
    return {
      success: false,
      message: 'Please provide current password and new password.',
      users: existingUsers,
    }
  }

  if (cleanedNew.length < 6) {
    return {
      success: false,
      message: 'New password must be at least 6 characters long.',
      users: existingUsers,
    }
  }

  if (normalizedEmail === VALID_USER.email && VALID_USER.password === cleanedCurrent) {
    VALID_USER.password = cleanedNew
    return {
      success: true,
      message: 'Password changed successfully.',
      users: existingUsers,
    }
  }

  const userIndex = existingUsers.findIndex((user) => user.email.toLowerCase() === normalizedEmail && user.password === cleanedCurrent)

  if (userIndex === -1) {
    return {
      success: false,
      message: 'Current password is incorrect.',
      users: existingUsers,
    }
  }

  const updatedUsers = [...existingUsers]
  updatedUsers[userIndex] = {
    ...updatedUsers[userIndex],
    password: cleanedNew,
  }

  return {
    success: true,
    message: 'Password changed successfully.',
    users: updatedUsers,
  }
}

export function verifyEmail({ email, code }, existingUsers = getUsersFromStorage()) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const verificationCode = String(code || '').trim()

  if (!normalizedEmail || !verificationCode) {
    return {
      success: false,
      message: 'Please provide both the email and the verification code.',
      users: existingUsers,
    }
  }

  const userIndex = existingUsers.findIndex((user) => user.email.toLowerCase() === normalizedEmail)

  if (userIndex === -1) {
    return {
      success: false,
      message: 'No account was found for that email address.',
      users: existingUsers,
    }
  }

  const targetUser = existingUsers[userIndex]
  const expectedCode = String(targetUser.verificationCode || '')

  if (verificationCode !== expectedCode) {
    return {
      success: false,
      message: 'That verification code is invalid or expired.',
      users: existingUsers,
    }
  }

  const updatedUsers = [...existingUsers]
  updatedUsers[userIndex] = {
    ...targetUser,
    emailVerified: true,
    verificationCode: '',
  }

  return {
    success: true,
    message: 'Your email has been verified successfully.',
    users: updatedUsers,
  }
}

export function getUsersFromStorage() {
  if (typeof window === 'undefined') return []

  try {
    const savedUsers = JSON.parse(window.localStorage.getItem('bidboard-users') || '[]')
    return Array.isArray(savedUsers) ? savedUsers : []
  } catch {
    return []
  }
}

export function saveUserSession(user, rememberMe = true) {
  if (typeof window === 'undefined') return

  if (rememberMe) {
    window.localStorage.setItem('bidboard-user', JSON.stringify(user))
    window.sessionStorage.removeItem('bidboard-user')
    return
  }

  window.sessionStorage.setItem('bidboard-user', JSON.stringify(user))
  window.localStorage.removeItem('bidboard-user')
}

export function clearUserSession() {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem('bidboard-user')
  window.sessionStorage.removeItem('bidboard-user')
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null

  try {
    const persistentUser = JSON.parse(window.localStorage.getItem('bidboard-user') || 'null')
    if (persistentUser) return persistentUser

    const sessionUser = JSON.parse(window.sessionStorage.getItem('bidboard-user') || 'null')
    return sessionUser
  } catch {
    return null
  }
}

export function registerUser({ name, email, password }, existingUsers = getUsersFromStorage()) {
  const cleanedName = String(name || '').trim()
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const cleanedPassword = String(password || '').trim()

  if (!cleanedName || !normalizedEmail || !cleanedPassword) {
    return {
      success: false,
      message: 'Please complete all fields to create an account.',
      users: existingUsers,
    }
  }

  if (cleanedPassword.length < 6) {
    return {
      success: false,
      message: 'Password must be at least 6 characters long.',
      users: existingUsers,
    }
  }

  const alreadyExists = existingUsers.some((user) => user.email.toLowerCase() === normalizedEmail)
  if (alreadyExists) {
    return {
      success: false,
      message: 'An account with that email already exists.',
      users: existingUsers,
    }
  }

  const newUser = {
    name: cleanedName,
    email: normalizedEmail,
    password: cleanedPassword,
    initials: cleanedName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || 'U',
    emailVerified: false,
    verificationCode: generateVerificationCode(),
  }

  const nextUsers = [...existingUsers, newUser]

  return {
    success: true,
    user: {
      name: newUser.name,
      email: newUser.email,
      initials: newUser.initials,
    },
    message: 'Account created successfully.',
    users: nextUsers,
  }
}

export function resetPassword({ email, newPassword }, existingUsers = getUsersFromStorage()) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const cleanedPassword = String(newPassword || '').trim()

  if (!normalizedEmail || !cleanedPassword) {
    return {
      success: false,
      message: 'Please provide both an email and a new password.',
      users: existingUsers,
    }
  }

  if (cleanedPassword.length < 6) {
    return {
      success: false,
      message: 'Your new password must be at least 6 characters long.',
      users: existingUsers,
    }
  }

  if (normalizedEmail === VALID_USER.email) {
    VALID_USER.password = cleanedPassword
    return {
      success: true,
      message: 'Your password has been reset successfully.',
      users: existingUsers,
    }
  }

  const userIndex = existingUsers.findIndex((user) => user.email.toLowerCase() === normalizedEmail)

  if (userIndex === -1) {
    return {
      success: false,
      message: 'No account was found for that email address.',
      users: existingUsers,
    }
  }

  const updatedUsers = [...existingUsers]
  updatedUsers[userIndex] = {
    ...updatedUsers[userIndex],
    password: cleanedPassword,
  }

  return {
    success: true,
    message: 'Your password has been reset successfully.',
    users: updatedUsers,
  }
}

export function authenticateUser({ email, password }, existingUsers = getUsersFromStorage()) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const normalizedPassword = String(password || '').trim()

  const registeredUser = existingUsers.find(
    (user) => user.email.toLowerCase() === normalizedEmail && user.password === normalizedPassword,
  )

  if (registeredUser) {
    if (!registeredUser.emailVerified) {
      return {
        success: false,
        message: 'Please verify your email before signing in.',
      }
    }

    return {
      success: true,
      user: {
        email: registeredUser.email,
        name: registeredUser.name,
        initials: registeredUser.initials,
        emailVerified: Boolean(registeredUser.emailVerified),
      },
      message: `Welcome back, ${registeredUser.name.split(' ')[0]}.`,
    }
  }

  if (normalizedEmail === VALID_USER.email && normalizedPassword === VALID_USER.password) {
    return {
      success: true,
      user: {
        email: VALID_USER.email,
        name: VALID_USER.name,
        initials: VALID_USER.initials,
        emailVerified: Boolean(VALID_USER.emailVerified),
      },
      message: 'Welcome back, Himank.',
    }
  }

  return {
    success: false,
    message: 'Invalid email or password. Please try again.',
  }
}

export function getRemainingTime(targetTime) {
  const difference = Math.max(0, targetTime - Date.now())
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
