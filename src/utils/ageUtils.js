// Central place for age math so the whole app (form, promotion checker,
// admin dashboard) always agrees on the rules:
//   age < 12            -> Shaheen Scout (SS)
//   12 <= age < 18       -> Boy Scout (BS)
//   age >= 18            -> Rover Scout (RS)

export function calculateAge(dobString) {
  if (!dobString) return null
  const dob = new Date(dobString)
  if (Number.isNaN(dob.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }
  return age
}

export function groupForAge(age) {
  if (age === null || age === undefined) return null
  if (age < 12) return 'SS'
  if (age < 18) return 'BS'
  return 'RS'
}

export const GROUP_LABELS = {
  SS: 'Shaheen Scout',
  BS: 'Boy Scout',
  RS: 'Rover Scout',
}

export const GROUP_TABLES = {
  SS: 'shaheen_scouts',
  BS: 'boy_scouts',
  RS: 'rover_scouts',
}

// Given a scout's current recorded group and their live age, work out
// whether they have outgrown their current group and where they'd move to.
// Returns null if no promotion is due.
export function nextGroupIfDue(currentGroup, dobString) {
  const liveAge = calculateAge(dobString)
  const dueGroup = groupForAge(liveAge)
  if (dueGroup && dueGroup !== currentGroup) {
    // Only ever promote upward (SS -> BS -> RS), never silently demote
    const order = ['SS', 'BS', 'RS']
    if (order.indexOf(dueGroup) > order.indexOf(currentGroup)) {
      return dueGroup
    }
  }
  return null
}
