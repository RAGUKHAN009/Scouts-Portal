import { supabase } from '../supabaseClient'
import { GROUP_TABLES, nextGroupIfDue } from './ageUtils'

const LAST_CHECK_KEY = 'idbszg_last_promotion_check'

// Runs at most once per day (per browser) so we are not hammering the
// database every time the admin dashboard re-renders. It walks every
// group table, compares each scout's stored group against their live
// age, and marks `promotion_due` = true on anyone who has outgrown it.
// It never moves the record itself -- that step always goes through the
// manual "revert -> leader re-enters form" flow, per the club's process.
export async function runDailyPromotionCheck({ force = false } = {}) {
  const today = new Date().toDateString()
  const lastRun = localStorage.getItem(LAST_CHECK_KEY)
  if (!force && lastRun === today) {
    return { skipped: true, flagged: [] }
  }

  const flagged = []

  for (const [groupCode, table] of Object.entries(GROUP_TABLES)) {
    const { data, error } = await supabase
      .from(table)
      .select('id, scout_id, full_name, date_of_birth, promotion_due, status')
      .eq('status', 'active')

    if (error) {
      console.error(`Promotion check failed for ${table}:`, error.message)
      continue
    }

    for (const scout of data || []) {
      const dueGroup = nextGroupIfDue(groupCode, scout.date_of_birth)
      if (dueGroup && !scout.promotion_due) {
        const { error: updateError } = await supabase
          .from(table)
          .update({ promotion_due: true, promotion_target: dueGroup })
          .eq('id', scout.id)

        if (!updateError) {
          flagged.push({
            ...scout,
            currentGroup: groupCode,
            currentTable: table,
            targetGroup: dueGroup,
          })
        }
      }
    }
  }

  localStorage.setItem(LAST_CHECK_KEY, today)
  return { skipped: false, flagged }
}

// Fetches everyone already flagged (from today's run or a previous one
// that the admin hasn't actioned yet) so the popup is accurate even on
// a page refresh.
export async function getPendingPromotions() {
  const results = []
  for (const [groupCode, table] of Object.entries(GROUP_TABLES)) {
    const { data, error } = await supabase
      .from(table)
      .select('id, scout_id, full_name, date_of_birth, promotion_target')
      .eq('promotion_due', true)
      .eq('status', 'active')

    if (!error && data) {
      results.push(...data.map((s) => ({ ...s, currentGroup: groupCode, currentTable: table })))
    }
  }
  return results
}
